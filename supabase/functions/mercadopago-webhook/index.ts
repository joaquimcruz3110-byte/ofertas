// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdminClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('Mercado Pago Webhook received:', payload);

    // Mercado Pago sends notifications about different resource types
    // We are interested in 'payment' notifications
    if (payload.type === 'payment' && payload.data && payload.data.id) {
      const paymentId = payload.data.id;

      // Fetch payment details from Mercado Pago API using the paymentId
      // This is important to get the full payment status and metadata
      const { data: mpPrefs, error: mpPrefsError } = await supabaseAdminClient
        .from('mercadopago_preferences')
        .select('access_token')
        .limit(1) // Assuming one admin or a way to get a valid token
        .single();

      if (mpPrefsError || !mpPrefs) {
        console.error('Error fetching Mercado Pago preferences for webhook:', mpPrefsError?.message);
        return new Response(JSON.stringify({ error: 'Mercado Pago credentials not found for webhook processing.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const MERCADOPAGO_ACCESS_TOKEN = mpPrefs.access_token;
      const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

      const mpPaymentResponse = await fetch(`${MERCADOPAGO_API_BASE}/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        },
      });

      if (!mpPaymentResponse.ok) {
        const errorData = await mpPaymentResponse.json();
        console.error('Failed to fetch Mercado Pago payment details:', errorData);
        return new Response(JSON.stringify({ error: 'Failed to fetch Mercado Pago payment details', details: errorData }), {
          status: mpPaymentResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mpPayment = await mpPaymentResponse.json();
      const paymentStatus = mpPayment.status; // e.g., 'approved', 'pending', 'rejected'
      const externalReference = mpPayment.external_reference;
      const metadata = mpPayment.metadata;

      console.log(`Payment ${paymentId} status: ${paymentStatus}, External Reference: ${externalReference}`);

      if (paymentStatus === 'approved') {
        const buyerId = metadata.buyer_id;
        // const shopkeeperId = metadata.shopkeeper_id; // Removido: variável não utilizada
        const cartItems = metadata.cart_items;

        // Fetch the current active commission rate
        const { data: commissionRateData, error: commissionError } = await supabaseAdminClient
          .from('commission_rates')
          .select('rate')
          .eq('active', true)
          .order('set_date', { ascending: false })
          .limit(1)
          .single();

        if (commissionError || !commissionRateData) {
          console.error('Error fetching active commission rate:', commissionError?.message);
          return new Response(JSON.stringify({ error: 'Failed to fetch active commission rate.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const commissionRate = commissionRateData.rate;

        // Process each item in the cart
        for (const item of cartItems) {
          const { product_id, quantity, price } = item;
          const totalPrice = price * quantity;

          // Call the perform_purchase function
          const { error: purchaseError } = await supabaseAdminClient.rpc('perform_purchase', {
            p_product_id: product_id,
            p_buyer_id: buyerId,
            p_quantity: quantity,
            p_total_price: totalPrice,
            p_commission_rate: commissionRate,
            p_payment_gateway_id: paymentId,
            p_payment_gateway_status: paymentStatus,
          });

          if (purchaseError) {
            console.error(`Error performing purchase for product ${product_id}:`, purchaseError.message);
            // Depending on your error handling strategy, you might want to
            // revert previous purchases or notify an admin.
          } else {
            console.log(`Purchase recorded for product ${product_id}.`);
          }
        }
      } else {
        console.log(`Payment ${paymentId} not approved. Status: ${paymentStatus}. No purchase recorded.`);
        // You might want to log failed payments or update a pending order status
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('Error in mercadopago-webhook Edge Function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});