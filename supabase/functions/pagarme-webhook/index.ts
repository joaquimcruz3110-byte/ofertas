// @ts-nocheck
/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
      console.error('pagarme-webhook: PAGARME_API_KEY not set in environment variables.');
      return new Response(JSON.stringify({ error: 'Pagar.me API Key not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const eventType = body.type;
    const order = body.data; // Este 'order' é o objeto dentro de 'data'

    console.log('pagarme-webhook: Webhook received. Event Type:', eventType, 'Order ID:', order?.id);
    console.log('pagarme-webhook: Full Webhook Body:', JSON.stringify(body));

    // Apenas processar eventos 'order.paid' para registro de vendas
    if (eventType !== 'order.paid') {
      console.log(`pagarme-webhook: Ignorando evento do tipo ${eventType}. Apenas eventos 'order.paid' são processados para registro de vendas.`);
      return new Response(JSON.stringify({ message: `Evento do tipo ${eventType} reconhecido, mas não processado para registro de vendas.` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!order || !order.id) {
      console.log('pagarme-webhook: Notificação de pedido Pagar.me inválida (dados do pedido ou ID ausentes).');
      return new Response(JSON.stringify({ message: 'Notificação de pedido Pagar.me inválida' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderId = order.id;
    const orderStatus = order.status;
    const metadata = order.metadata;

    console.log(`pagarme-webhook: Processando pedido ${orderId} com status ${orderStatus}. Metadados:`, JSON.stringify(metadata));

    if (!metadata || !metadata.buyer_id || !metadata.commission_rate || !metadata.cartItems) {
      console.warn(`pagarme-webhook: O pedido Pagar.me ${orderId} não possui os metadados necessários. Não é possível processar a venda.`);
      return new Response(JSON.stringify({ message: 'O pedido não possui os metadados necessários' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const buyer_id = metadata.buyer_id;
    const commission_rate = parseFloat(metadata.commission_rate);
    const saleItems = JSON.parse(metadata.cartItems);

    // Usar a chave de serviço (service role key) para operações de banco de dados
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (orderStatus === 'paid') {
      console.log(`pagarme-webhook: Pedido ${orderId} está 'paid'. Prosseguindo para registrar as vendas.`);

      // Buscar o e-mail do comprador
      const { data: buyerUser, error: buyerUserError } = await supabaseAdmin.auth.admin.getUserById(buyer_id);
      const buyerEmail = buyerUserError ? null : buyerUser?.user?.email;
      if (buyerUserError) {
        console.error('pagarme-webhook: Erro ao buscar usuário comprador para e-mail:', buyerUserError?.message);
      }

      const productsSoldDetails: {
        id: string;
        name: string;
        quantity: number;
        price: number;
        total: number;
        shopkeeper_id: string | null;
      }[] = [];
      let totalPurchasePrice = 0;

      const shopkeeperSalesMap = new Map<string, { email: string | null; products: typeof productsSoldDetails }>();

      for (const item of saleItems) {
        const total_price = item.quantity * item.price;
        totalPurchasePrice += total_price;

        const { data: productData, error: productError } = await supabaseAdmin
          .from('products')
          .select('name, price, shopkeeper_id')
          .eq('id', item.id)
          .single();

        const productDetail = {
          id: item.id,
          name: productData?.name || item.name || 'Produto Desconhecido',
          quantity: item.quantity,
          price: productData?.price || item.price,
          total: total_price,
          shopkeeper_id: productData?.shopkeeper_id || item.shopkeeper_id,
        };
        productsSoldDetails.push(productDetail);

        if (productDetail.shopkeeper_id) {
          if (!shopkeeperSalesMap.has(productDetail.shopkeeper_id)) {
            const { data: shopkeeperUser, error: shopkeeperUserError } = await supabaseAdmin.auth.admin.getUserById(productDetail.shopkeeper_id);
            const shopkeeperEmail = shopkeeperUserError ? null : shopkeeperUser?.user?.email;
            if (shopkeeperUserError) {
              console.error(`pagarme-webhook: Erro ao buscar usuário lojista ${productDetail.shopkeeper_id} para e-mail:`, shopkeeperUserError?.message);
            }
            shopkeeperSalesMap.set(productDetail.shopkeeper_id, { email: shopkeeperEmail, products: [] });
          }
          shopkeeperSalesMap.get(productDetail.shopkeeper_id)?.products.push(productDetail);
        }

        // Chamar a função RPC perform_purchase para cada item
        const { error: saleError } = await supabaseAdmin.rpc('perform_purchase', {
          p_product_id: item.id,
          p_buyer_id: buyer_id,
          p_quantity: item.quantity,
          p_total_price: total_price,
          p_commission_rate: commission_rate,
          p_payment_gateway_id: orderId, // Usar o ID do pedido como ID do gateway
          p_payment_gateway_status: orderStatus,
        });

        if (saleError) {
          console.error(`pagarme-webhook: Erro ao realizar compra para o produto ${item.id}:`, saleError.message);
        } else {
          console.log(`pagarme-webhook: Compra registrada para o produto ${item.id}.`);
        }
      }

      // Enviar e-mails de notificação consolidados para os lojistas
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
                            ${salesInfo.products.map(p => `<li><strong>Produto:</strong> ${p.name} (ID: ${p.id}) - <strong>Quantidade:</strong> ${p.quantity}x - <strong>Preço Unitário:</strong> R$ ${p.price.toFixed(2)} - <strong>Total:</strong> R$ ${p.total.toFixed(2)}</li>`).join('')}
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
          console.log(`pagarme-webhook: E-mail do lojista enviado para ${salesInfo.email}.`);
        } else {
          console.warn(`pagarme-webhook: Nenhum e-mail encontrado para o ID do lojista ${shopkeeperId}. Pulando notificação.`);
        }
      }

      // Enviar e-mail de recibo para o comprador (já consolidado para todos os itens)
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
                      <p><strong>ID do Pagamento:</strong> ${orderId}</p>
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
        console.log(`pagarme-webhook: E-mail do comprador enviado para ${buyerEmail}.`);
      } else {
        console.warn(`pagarme-webhook: Nenhum e-mail encontrado para o ID do comprador ${buyer_id}. Pulando notificação.`);
      }

    } else {
      console.log(`pagarme-webhook: Pedido Pagar.me ${orderId} status é ${orderStatus}. Nenhuma atualização de estoque realizada.`);
    }

    return new Response(JSON.stringify({ message: 'Webhook processado com sucesso' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('pagarme-webhook: Erro ao processar webhook do Pagar.me:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Função auxiliar para invocar a Edge Function send-email
async function invokeSendEmail(to: string, subject: string, htmlContent: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('pagarme-webhook: URL do Supabase ou Service Role Key não configurados para invocar send-email.');
    return;
  }

  const sendEmailFunctionUrl = `${supabaseUrl}/functions/v1/send-email`;

  try {
    const response = await fetch(sendEmailFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`, // Usar service role key para invocação interna da função
      },
      body: JSON.stringify({ to, subject, htmlContent }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`pagarme-webhook: Falha ao invocar a função send-email: ${response.status} - ${errorBody}`);
    } else {
      console.log(`pagarme-webhook: Invocação de e-mail bem-sucedida para ${to}.`);
    }
  } catch (error) {
    console.error('pagarme-webhook: Erro ao invocar a função send-email:', error);
  }
}