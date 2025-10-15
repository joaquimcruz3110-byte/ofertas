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
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { 'Authorization': req.headers.get('Authorization')! } },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { cartItems, buyerId, totalAmount, shopkeeperId } = await req.json();

    if (!cartItems || !buyerId || !totalAmount || !shopkeeperId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: cartItems, buyerId, totalAmount, shopkeeperId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch shopkeeper's Mercado Pago credentials
    const { data: mpPrefs, error: mpPrefsError } = await supabaseClient
      .from('mercadopago_preferences')
      .select('access_token')
      .eq('shopkeeper_id', shopkeeperId)
      .single();

    if (mpPrefsError || !mpPrefs) {
      console.error('Error fetching Mercado Pago preferences:', mpPrefsError?.message);
      return new Response(JSON.stringify({ error: 'Mercado Pago credentials not found for shopkeeper.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const MERCADOPAGO_ACCESS_TOKEN = mpPrefs.access_token;
    const MERCADOPAGO_API_BASE = 'https://api.mercadopago.com';

    const externalReference = `sale_${Date.now()}_${buyerId}`; // Unique reference for the sale

    const paymentData = {
      transaction_amount: parseFloat(totalAmount.toFixed(2)),
      description: `Compra na Olímpia Ofertas - ${externalReference}`,
      payment_method_id: 'pix', // For Pix payments
      external_reference: externalReference,
      // @ts-ignore
      notification_url: `${Deno.env.get('VITE_APP_URL')}/api/mercadopago-webhook`, // Your webhook URL
      payer: {
        entity_type: 'individual',
        type: 'customer',
        id: buyerId, // Supabase user ID
      },
      metadata: {
        buyer_id: buyerId,
        shopkeeper_id: shopkeeperId,
        cart_items: cartItems.map((item: any) => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
      },
    };

    const mpResponse = await fetch(`${MERCADOPAGO_API_BASE}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(paymentData),
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json();
      console.error('Mercado Pago API error:', errorData);
      return new Response(JSON.stringify({ error: 'Failed to create Mercado Pago payment', details: errorData }), {
        status: mpResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpPayment = await mpResponse.json();

    // Extract Pix data
    const pixData = {
      qr_code: mpPayment.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: mpPayment.point_of_interaction.transaction_data.qr_code_base64,
      ticket_url: mpPayment.point_of_interaction.transaction_data.ticket_url,
      payment_id: mpPayment.id,
      payment_status: mpPayment.status,
      external_reference: mpPayment.external_reference,
    };

    return new Response(JSON.stringify(pixData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('Error in create-mercadopago-payment Edge Function:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});