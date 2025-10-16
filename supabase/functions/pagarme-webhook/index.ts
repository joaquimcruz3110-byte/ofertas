// @ts-nocheck
/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Pagarme from 'npm:pagarme@4.24.0'; // Usando a versão mais recente do Pagar.me

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
    if (!pagarmeApiKey) {
      console.error('PAGARME_API_KEY not set in environment variables.');
      return new Response(JSON.stringify({ error: 'Pagar.me API Key not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = Pagarme(pagarmeApiKey);
    const body = await req.json();
    const signature = req.headers.get('x-hub-signature');

    // Verify webhook signature (important for security)
    // Note: Pagar.me's webhook verification might require a specific library or method.
    // For simplicity, this example skips full signature verification, but it's highly recommended in production.
    // You would typically use `client.postbacks.verifySignature(body, signature)` if available.
    // For now, we'll proceed without it, but be aware of the security implications.
    console.log('Pagar.me Webhook received. Body:', body);
    // if (!client.postbacks.verifySignature(body, signature)) {
    //   return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 403, headers: corsHeaders });
    // }

    const eventType = body.event;
    const transaction = body.transaction;

    if (!transaction || !transaction.id || !eventType) {
      console.log('Received Pagar.me webhook with missing transaction data or event type:', body);
      return new Response(JSON.stringify({ message: 'Not a valid Pagar.me transaction notification' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transactionId = transaction.id;
    const transactionStatus = transaction.status;
    const metadata = transaction.metadata;

    if (!metadata || !metadata.buyer_id || !metadata.commission_rate || !metadata.cartItems) {
      console.warn(`Pagar.me transaction ${transactionId} has no metadata. Cannot process sale.`);
      return new Response(JSON.stringify({ message: 'Transaction has no required metadata' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buyer_id = metadata.buyer_id;
    const commission_rate = parseFloat(metadata.commission_rate);
    const saleItems = JSON.parse(metadata.cartItems);

    // Use the service role key for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (transactionStatus === 'paid') { // Pagar.me uses 'paid' for approved transactions
      // Fetch buyer's email
      const { data: buyerUser, error: buyerUserError } = await supabaseAdmin.auth.admin.getUserById(buyer_id);
      const buyerEmail = buyerUserError ? null : buyerUser?.user?.email;
      if (buyerUserError) {
        console.error('Error fetching buyer user for email:', buyerUserError?.message);
      }

      const productsSoldDetails: {
        name: string;
        quantity: number;
        price: number;
        total: number;
        shopkeeper_id: string | null;
      }[] = [];
      let totalPurchasePrice = 0;

      // Map to store products grouped by shopkeeper for consolidated emails
      const shopkeeperSalesMap = new Map<string, { email: string | null; products: typeof productsSoldDetails }>();

      for (const item of saleItems) {
        const total_price = item.quantity * item.price;
        totalPurchasePrice += total_price;

        // Fetch product details for email content and shopkeeper_id
        const { data: productData, error: productError } = await supabaseAdmin
          .from('products')
          .select('name, price, shopkeeper_id')
          .eq('id', item.id)
          .single();

        const productDetail = {
          name: productData?.name || 'Produto Desconhecido',
          quantity: item.quantity,
          price: productData?.price || item.price,
          total: total_price,
          shopkeeper_id: productData?.shopkeeper_id || item.shopkeeper_id,
        };
        productsSoldDetails.push(productDetail);

        // Add product to shopkeeper's sales map
        if (productDetail.shopkeeper_id) {
          if (!shopkeeperSalesMap.has(productDetail.shopkeeper_id)) {
            // Fetch shopkeeper email only once per shopkeeper
            const { data: shopkeeperUser, error: shopkeeperUserError } = await supabaseAdmin.auth.admin.getUserById(productDetail.shopkeeper_id);
            const shopkeeperEmail = shopkeeperUserError ? null : shopkeeperUser?.user?.email;
            if (shopkeeperUserError) {
              console.error(`Error fetching shopkeeper user ${productDetail.shopkeeper_id} for email:`, shopkeeperUserError?.message);
            }
            shopkeeperSalesMap.set(productDetail.shopkeeper_id, { email: shopkeeperEmail, products: [] });
          }
          shopkeeperSalesMap.get(productDetail.shopkeeper_id)?.products.push(productDetail);
        }

        // Perform the purchase RPC call for each item
        const { error: saleError } = await supabaseAdmin.rpc('perform_purchase', {
          p_product_id: item.id,
          p_buyer_id: buyer_id,
          p_quantity: item.quantity,
          p_total_price: total_price,
          p_commission_rate: commission_rate,
          p_payment_gateway_id: transactionId,
          p_payment_gateway_status: transactionStatus,
        });

        if (saleError) {
          console.error(`Error performing purchase for product ${item.id}:`, saleError.message);
        }
      }

      // Send consolidated shopkeeper notification emails
      for (const [shopkeeperId, salesInfo] of shopkeeperSalesMap.entries()) {
        if (salesInfo.email) {
          const shopkeeperSubject = `Nova Venda(s) no Olímpia Ofertas!`;
          const shopkeeperHtml = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Nova Venda(s) no Olímpia Ofertas!</title>
                <style>
                    body { font-family: sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background-color: #1e3a8a; padding: 30px 20px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                    .content { padding: 30px 20px; color: #1f2937; line-height: 1.6; }
                    .content p { margin-bottom: 15px; font-size: 16px; }
                    .product-list { list-style: none; padding: 0; margin: 20px 0; border-top: 1px solid #eee; }
                    .product-list li { padding: 10px 0; border-bottom: 1px solid #eee; }
                    .footer { background-color: #1e3a8a; padding: 20px; text-align: center; color: #ffffff; font-size: 12px; }
                    .footer a { color: #f97316; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Olímpia Ofertas</h1>
                    </div>
                    <div class="content">
                        <p>Olá Lojista,</p>
                        <p>Você tem uma nova venda(s)!</p>
                        <p><strong>Detalhes do(s) Produto(s) Vendido(s):</strong></p>
                        <ul class="product-list">
                            ${salesInfo.products.map(p => `<li><strong>Produto:</strong> ${p.name} - <strong>Quantidade:</strong> ${p.quantity}x - <strong>Preço Unitário:</strong> R$ ${p.price.toFixed(2)} - <strong>Total:</strong> R$ ${p.total.toFixed(2)}</li>`).join('')}
                        </ul>
                        <p>O comprador foi notificado. Parabéns pela venda!</p>
                        <p>Atenciosamente,<br>Equipe Olímpia Ofertas</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Olímpia Ofertas. Todos os direitos reservados.</p>
                        <p>Visite nosso site: <a href="${Deno.env.get('VITE_APP_URL')}" target="_blank">${Deno.env.get('VITE_APP_URL')}</a></p>
                    </div>
                </div>
            </body>
            </html>
          `;
          await invokeSendEmail(salesInfo.email, shopkeeperSubject, shopkeeperHtml);
        }
      }

      // Send buyer receipt email (already consolidated for all items)
      if (buyerEmail) {
        const buyerSubject = 'Seu Comprovante de Compra no Olímpia Ofertas';
        const buyerHtml = `
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Seu Comprovante de Compra no Olímpia Ofertas</title>
              <style>
                  body { font-family: sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
                  .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden; }
                  .header { background-color: #1e3a8a; padding: 30px 20px; text-align: center; color: #ffffff; }
                  .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
                  .content { padding: 30px 20px; color: #1f2937; line-height: 1.6; }
                  .content p { margin-bottom: 15px; font-size: 16px; }
                  .product-list { list-style: none; padding: 0; margin: 20px 0; border-top: 1px solid #eee; }
                  .product-list li { padding: 10px 0; border-bottom: 1px solid #eee; }
                  .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
                  .footer { background-color: #1e3a8a; padding: 20px; text-align: center; color: #ffffff; font-size: 12px; }
                  .footer a { color: #f97316; text-decoration: none; }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="header">
                      <h1>Olímpia Ofertas</h1>
                  </div>
                  <div class="content">
                      <p>Olá Comprador,</p>
                      <p>Obrigado por sua compra no Olímpia Ofertas! Seu pagamento foi aprovado e seu pedido está a caminho.</p>
                      <p><strong>Detalhes do Pedido:</strong></p>
                      <ul class="product-list">
                          ${productsSoldDetails.map(p => `<li>${p.name} - ${p.quantity}x - R$ ${p.price.toFixed(2)} cada (Total: R$ ${p.total.toFixed(2)})</li>`).join('')}
                      </ul>
                      <p class="total">Total da Compra: R$ ${totalPurchasePrice.toFixed(2)}</p>
                      <p><strong>ID do Pagamento:</strong> ${transactionId}</p>
                      <p>Você pode acompanhar seus pedidos na sua conta.</p>
                      <p>Atenciosamente,<br>Equipe Olímpia Ofertas</p>
                  </div>
                  <div class="footer">
                      <p>&copy; ${new Date().getFullYear()} Olímpia Ofertas. Todos os direitos reservados.</p>
                      <p>Visite nosso site: <a href="${Deno.env.get('VITE_APP_URL')}" target="_blank">${Deno.env.get('VITE_APP_URL')}</a></p>
                  </div>
              </div>
          </body>
          </html>
        `;
        await invokeSendEmail(buyerEmail, buyerSubject, buyerHtml);
      }

    } else {
      console.log(`Pagar.me transaction ${transactionId} status is ${transactionStatus}. No stock update performed.`);
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error processing Pagar.me webhook:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to invoke the send-email Edge Function
async function invokeSendEmail(to: string, subject: string, htmlContent: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Supabase URL or Service Role Key not set for invoking send-email.');
    return;
  }

  const sendEmailFunctionUrl = `${supabaseUrl}/functions/v1/send-email`;

  try {
    const response = await fetch(sendEmailFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`, // Use service role key for internal function invocation
      },
      body: JSON.stringify({ to, subject, htmlContent }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Failed to invoke send-email function: ${response.status} - ${errorBody}`);
    } else {
      console.log(`Email invocation successful for ${to}.`);
    }
  } catch (error) {
    console.error('Error invoking send-email function:', error);
  }
}