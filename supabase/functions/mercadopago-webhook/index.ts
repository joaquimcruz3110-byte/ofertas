// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as mercadopago from 'https://esm.sh/mercadopago@2.9.0?target=deno'; // Atualizado para v2.9.0

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
    // Verificar variáveis de ambiente no início
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // @ts-ignore
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

    if (!supabaseUrl || !supabaseServiceRoleKey || !mpAccessToken) {
      console.error('Missing environment variables for Edge Function.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Internal Server Error
      });
    }

    // 1. Inicializar o cliente Mercado Pago v2.x
    const client = new mercadopago.MercadoPagoConfig({ accessToken: mpAccessToken });
    const paymentClient = new mercadopago.Payment(client);
    const merchantOrderClient = new mercadopago.MerchantOrder(client);

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

    let paymentDetails;
    let externalReference: string | undefined;
    let buyerId: string | undefined;
    let cartItems: CartItem[] | undefined;
    let preferenceId: string | undefined;

    if (topic === 'payment') {
      const paymentResponse = await paymentClient.get({ id: id });
      paymentDetails = paymentResponse;
      externalReference = paymentDetails.external_reference;
      buyerId = paymentDetails.payer.id || paymentDetails.metadata?.buyer_id;
      cartItems = paymentDetails.metadata?.cart_items ? JSON.parse(paymentDetails.metadata.cart_items) : undefined;
      preferenceId = paymentDetails.preference_id;

    } else if (topic === 'merchant_order') {
      const merchantOrderResponse = await merchantOrderClient.get({ id: id });
      const approvedPayment = merchantOrderResponse.payments.find((p: any) => p.status === 'approved');

      if (!approvedPayment) {
        console.log(`Merchant order ${id} has no approved payments yet.`);
        return new Response(JSON.stringify({ message: 'No approved payments in merchant order yet' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      paymentDetails = approvedPayment;
      externalReference = merchantOrderResponse.external_reference;
      buyerId = merchantOrderResponse.payer.id || merchantOrderResponse.metadata?.buyer_id;
      cartItems = merchantOrderResponse.metadata?.cart_items ? JSON.parse(merchantOrderResponse.metadata.cart_items) : undefined;
      preferenceId = merchantOrderResponse.preference_id;

    } else {
      console.log(`Unhandled Mercado Pago topic: ${topic}`);
      return new Response(JSON.stringify({ message: `Unhandled topic: ${topic}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!paymentDetails || paymentDetails.status !== 'approved') {
      console.log(`Payment ${id} not approved. Status: ${paymentDetails?.status}`);
      return new Response(JSON.stringify({ message: 'Payment not approved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!buyerId || !cartItems || !externalReference || !preferenceId) {
      console.error('Missing buyer_id, cart_items, external_reference or preference_id in Mercado Pago payment details.');
      return new Response(JSON.stringify({ error: 'Missing metadata for order fulfillment' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseServiceRoleClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    // Check if this order has already been fulfilled to prevent double processing
    const { data: existingSales, error: salesCheckError } = await supabaseServiceRoleClient
      .from('sales')
      .select('id')
      .eq('external_reference', externalReference)
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
        purchaseResults.push({ productId, success: false, message: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}` });
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
        p_external_reference: externalReference,
      });

      if (purchaseError) {
        console.error(`Purchase transaction error for ${product.name}:`, purchaseError.message);
        purchaseResults.push({ productId, success: false, message: `Failed to purchase ${product.name}: ${purchaseError.message}` });
        overallSuccess = false;
      } else {
        purchaseResults.push({ productId, success: true, message: `Successfully purchased ${product.name}` });
      }
    }

    // Atualizar o status da preferência de pagamento para 'fulfilled'
    const { error: updatePreferenceStatusError } = await supabaseServiceRoleClient
      .from('payment_preferences')
      .update({ status: 'fulfilled', updated_at: new Date().toISOString() })
      .eq('preference_id', preferenceId);

    if (updatePreferenceStatusError) {
      console.error('Error updating payment preference status:', updatePreferenceStatusError.message);
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