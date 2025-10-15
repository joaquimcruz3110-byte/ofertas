/// <reference types="https://deno.land/std@0.190.0/http/server.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => { // Adicionado tipo Request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key for webhooks
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();
    console.log('Mercado Pago Webhook received:', body);

    const { type, data } = body;

    if (type === 'payment' && data?.id) {
      const paymentId = data.id;

      // Fetch payment details from Mercado Pago API
      const mercadopagoApiBase = Deno.env.get('MERCADOPAGO_API_BASE') || 'https://api.mercadopago.com';
      // You need to fetch the shopkeeper's access_token to query Mercado Pago API
      // This is a simplification. In a real scenario, you'd need to store and retrieve
      // the shopkeeper's access_token associated with the payment.
      // For now, we'll assume a single, global access token for testing or
      // fetch it based on the external_reference if it contains shopkeeper_id.
      // For this example, we'll use a placeholder.
      const mercadopagoAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN_GLOBAL'); // Placeholder for global token

      if (!mercadopagoAccessToken) {
        console.error('MERCADOPAGO_ACCESS_TOKEN_GLOBAL is not set.');
        return new Response(JSON.stringify({ error: 'Mercado Pago access token not configured.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mpPaymentResponse = await fetch(`${mercadopagoApiBase}/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${mercadopagoAccessToken}`,
        },
      });

      if (!mpPaymentResponse.ok) {
        const errorBody = await mpPaymentResponse.json();
        console.error('Failed to fetch payment details from Mercado Pago:', errorBody);
        return new Response(JSON.stringify({ error: 'Failed to fetch payment details from Mercado Pago' }), {
          status: mpPaymentResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mpPayment = await mpPaymentResponse.json();
      const paymentStatus = mpPayment.status; // e.g., 'approved', 'pending', 'rejected'
      const externalReference = mpPayment.external_reference; // This should be our buyerId

      console.log(`Payment ${paymentId} status: ${paymentStatus}, External Reference: ${externalReference}`);

      // Update sales records in Supabase
      const { data: sales, error: salesFetchError } = await supabase
        .from('sales')
        .select('id, product_id, quantity')
        .eq('payment_gateway_id', paymentId.toString());

      if (salesFetchError) {
        console.error('Error fetching sales for payment:', salesFetchError.message);
        return new Response(JSON.stringify({ error: 'Failed to fetch sales for payment.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabase
        .from('sales')
        .update({ payment_gateway_status: paymentStatus })
        .eq('payment_gateway_id', paymentId.toString());

      if (updateError) {
        console.error('Error updating sales status:', updateError.message);
        return new Response(JSON.stringify({ error: 'Failed to update sales status.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If payment is approved, decrement product quantities
      if (paymentStatus === 'approved') {
        for (const sale of sales) {
          const { error: decrementError } = await supabase
            .from('products')
            .update({ quantity: (prevQuantity: number) => prevQuantity - sale.quantity })
            .eq('id', sale.product_id);

          if (decrementError) {
            console.error(`Error decrementing quantity for product ${sale.product_id}:`, decrementError.message);
            // Log this, but don't fail the webhook, as sales status is already updated.
            // Manual intervention might be needed for stock reconciliation.
          }
        }
      }

      return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Webhook received, but not a payment notification or missing data.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) { // Adicionado tipo unknown
    console.error('Error in mercadopago-webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: (error as Error).message }), { // Type assertion
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});