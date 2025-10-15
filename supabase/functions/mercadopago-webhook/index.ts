import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'; // Alterado para esm.sh
import { MercadoPagoConfig } from 'npm:mercadopago@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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

    // Initialize Mercado Pago client with platform's access token
    const client = new MercadoPagoConfig({
      accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '',
      options: { timeout: 5000 }
    });

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${client.accessToken}`,
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

    const { buyer_id, commission_rate, cartItems: saleItems } = JSON.parse(externalReference);

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
          // Dependendo do erro, você pode querer reverter o estoque ou lidar de forma diferente
        }
      }
    } else {
      console.log(`Payment ${paymentId} status is ${paymentStatus}. No stock update performed.`);
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error processing Mercado Pago webhook:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});