import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    if (type !== 'payment' || !data || !data.id) {
      console.log('Received non-payment webhook or missing data:', { type, data });
      return new Response(JSON.stringify({ message: 'Not a payment notification or missing data' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentId = data.id;

    // Use the service role key for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch payment details from Mercado Pago API
    const { data: mpPreferences, error: mpError } = await supabaseAdmin
      .from('mercadopago_preferences')
      .select('access_token')
      .limit(1) // Assuming one access token is enough to query MP API
      .single();

    if (mpError || !mpPreferences) {
      console.error('Error fetching Mercado Pago preferences for webhook:', mpError?.message);
      return new Response(JSON.stringify({ error: 'Mercado Pago credentials not found for webhook processing.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpPreferences.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error(`Error fetching payment ${paymentId} from Mercado Pago: ${mpResponse.status} - ${errorText}`);
      return new Response(JSON.stringify({ error: `Failed to fetch payment details from Mercado Pago: ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentDetails = await mpResponse.json();
    const paymentStatus = paymentDetails.status;
    const externalReference = paymentDetails.external_reference;

    if (!externalReference) {
      console.warn(`Payment ${paymentId} has no external_reference. Cannot process sale.`);
      return new Response(JSON.stringify({ message: 'Payment has no external_reference' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { buyer_id, shopkeeper_id, commission_rate, items: saleItems } = JSON.parse(externalReference);

    if (paymentStatus === 'approved') {
      for (const item of saleItems) {
        const total_price = item.quantity * item.price;
        const { error: saleError } = await supabaseAdmin.rpc('perform_purchase', {
          p_product_id: item.id,
          p_buyer_id: buyer_id,
          p_quantity: item.quantity,
          p_total_price: total_price,
          p_commission_rate: commission_rate,
          p_payment_gateway_id: paymentId,
          p_payment_gateway_status: paymentStatus,
        });

        if (saleError) {
          console.error(`Error performing purchase for product ${item.id}:`, saleError.message);
          // Depending on the error, you might want to revert stock or handle it differently
          // For now, we'll log and continue, but a more robust solution might involve retries or manual intervention
        }
      }
    } else {
      // If payment is not approved, just update the sales record if it exists
      // Or log the status for further review
      console.log(`Payment ${paymentId} status is ${paymentStatus}. No stock update performed.`);
      // You might want to update a pending sale record here if you create one before payment
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing Mercado Pago webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});