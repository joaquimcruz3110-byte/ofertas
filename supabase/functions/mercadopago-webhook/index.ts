// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import mercadopago from 'https://esm.sh/mercadopago@2.0.10?target=deno'; // Alterado para importação direta do default export

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  photo_url: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpAccessToken) {
      throw new Error('Mercado Pago access token is not configured.');
    }

    mercadopago.configure({ // Acessando 'configure' diretamente
      access_token: mpAccessToken,
    });

    const url = new URL(req.url);
    const topic = url.searchParams.get('topic');
    const id = url.searchParams.get('id'); // Payment ID or Merchant Order ID

    if (!topic || !id) {
      console.warn('Mercado Pago webhook received without topic or ID.');
      return new Response(JSON.stringify({ message: 'Missing topic or ID' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let payment;
    if (topic === 'payment') {
      payment = await mercadopago.payment.findById(id); // Acessando 'payment.findById' diretamente
    } else if (topic === 'merchant_order') {
      const merchantOrder = await mercadopago.merchant_orders.findById(id); // Acessando 'merchant_orders.findById' diretamente
      // Find the first approved payment in the merchant order
      payment = merchantOrder.body.payments.find((p: any) => p.status === 'approved');
      if (!payment) {
        console.log(`Merchant order ${id} has no approved payments yet.`);
        return new Response(JSON.stringify({ message: 'No approved payments in merchant order yet' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    } else {
      console.log(`Unhandled Mercado Pago topic: ${topic}`);
      return new Response(JSON.stringify({ message: `Unhandled topic: ${topic}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!payment || payment.body.status !== 'approved') {
      console.log(`Payment ${id} not approved. Status: ${payment?.body?.status}`);
      return new Response(JSON.stringify({ message: 'Payment not approved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const externalReference = payment.body.external_reference;
    const buyerId = payment.body.payer.id || payment.body.metadata?.buyer_id; // Try to get buyer_id from payer.id or metadata
    const cartItemsString = payment.body.metadata?.cart_items;

    if (!buyerId || !cartItemsString) {
      console.error('Missing buyer_id or cart_items in Mercado Pago payment metadata.');
      return new Response(JSON.stringify({ error: 'Missing metadata for order fulfillment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const cartItems: CartItem[] = JSON.parse(cartItemsString);

    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if this order has already been fulfilled to prevent double processing
    const { data: existingSales, error: salesCheckError } = await supabaseServiceRoleClient
      .from('sales')
      .select('id')
      .eq('external_reference', externalReference) // Assuming you add an external_reference column to sales table
      .limit(1);

    if (salesCheckError) {
      console.error('Error checking for existing sales:', salesCheckError.message);
      throw new Error('Failed to check for existing sales');
    }

    if (existingSales && existingSales.length > 0) {
      console.log(`Order with external_reference ${externalReference} already fulfilled.`);
      return new Response(JSON.stringify({ message: 'Order already fulfilled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Fetch active commission rate using service role client
    const { data: commissionRateData, error: commissionError } = await supabaseServiceRoleClient
      .from('commission_rates')
      .select('rate')
      .eq('active', true)
      .order('set_date', { ascending: false })
      .limit(1)
      .single();

    if (commissionError) {
      console.error('Commission rate fetch error (service role):', commissionError.message);
      throw new Error('Failed to fetch commission rate');
    }
    const commissionRate = commissionRateData?.rate || 0;

    const purchaseResults: Array<{ productId: string; success: boolean; message: string }> = [];
    let overallSuccess = true;

    for (const item of cartItems) {
      const { id: productId, quantity: requestedQuantity } = item;

      const { data: product, error: productError } = await supabaseServiceRoleClient
        .from('products')
        .select('id, name, price, quantity, shopkeeper_id')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        console.error(`Product fetch error for ${productId}:`, productError?.message);
        purchaseResults.push({ productId, success: false, message: 'Product not found or could not be fetched' });
        overallSuccess = false;
        continue;
      }

      if (product.quantity < requestedQuantity) {
        purchaseResults.push({ productId, success: false, message: `Insufficient stock for ${product.name}. Available: ${product.quantity}` });
        overallSuccess = false;
        continue;
      }

      const totalPriceForItem = product.price * requestedQuantity;

      const { error: purchaseError } = await supabaseServiceRoleClient.rpc('perform_purchase', {
        p_product_id: productId,
        p_buyer_id: buyerId,
        p_quantity: requestedQuantity,
        p_total_price: totalPriceForItem,
        p_commission_rate: commissionRate,
        p_external_reference: externalReference, // Pass external_reference to RPC
      });

      if (purchaseError) {
        console.error(`Purchase transaction error for ${product.name}:`, purchaseError.message);
        purchaseResults.push({ productId, success: false, message: `Failed to purchase ${product.name}: ${purchaseError.message}` });
        overallSuccess = false;
      } else {
        purchaseResults.push({ productId, success: true, message: `Successfully purchased ${product.name}` });
      }
    }

    if (overallSuccess) {
      return new Response(JSON.stringify({ message: 'All items purchased successfully!', results: purchaseResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ error: 'Some purchases failed', results: purchaseResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

  } catch (error: unknown) {
    console.error('Edge Function error:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});