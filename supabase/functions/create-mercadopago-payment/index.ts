import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { MercadoPagoConfig, Preference } from 'https://esm.sh/mercadopago@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid user session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { items, buyer_id, shopkeeper_id, commission_rate, app_url } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0 || !buyer_id || !shopkeeper_id || !commission_rate || !app_url) {
      return new Response(JSON.stringify({ error: 'Missing required fields: items, buyer_id, shopkeeper_id, commission_rate, app_url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch shopkeeper's Mercado Pago credentials
    const { data: mpPreferences, error: mpError } = await supabaseClient
      .from('mercadopago_preferences')
      .select('access_token, public_key')
      .eq('id', shopkeeper_id)
      .single();

    if (mpError || !mpPreferences) {
      console.error('Error fetching Mercado Pago preferences:', mpError?.message);
      return new Response(JSON.stringify({ error: 'Mercado Pago credentials not found for shopkeeper.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = new MercadoPagoConfig({
      accessToken: mpPreferences.access_token,
      options: { timeout: 5000, idempotencyKey: crypto.randomUUID() }
    });

    const preference = new Preference(client);

    const preferenceBody = {
      items: items.map((item: any) => ({
        id: item.id,
        title: item.name,
        quantity: item.quantity,
        unit_price: item.price,
      })),
      payer: {
        id: buyer_id,
      },
      back_urls: {
        success: `${app_url}/mercadopago-return?status=success`,
        failure: `${app_url}/mercadopago-return?status=failure`,
        pending: `${app_url}/mercadopago-return?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${app_url}/functions/v1/mercadopago-webhook`, // Use the app_url for webhook
      external_reference: JSON.stringify({ buyer_id, shopkeeper_id, commission_rate, items: items.map((item: any) => ({ id: item.id, quantity: item.quantity, price: item.price })) }),
    };

    const result = await preference.create({ body: preferenceBody });

    return new Response(JSON.stringify({ init_point: result.init_point }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating Mercado Pago preference:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});