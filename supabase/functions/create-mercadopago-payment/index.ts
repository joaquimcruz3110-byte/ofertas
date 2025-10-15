/// <reference types="./types.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @deno-types="https://esm.sh/@supabase/supabase-js@2.45.0/dist/main.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @deno-types="https://esm.sh/mercadopago@2.0.0/dist/index.d.ts"
import * as MercadoPago from 'https://esm.sh/mercadopago@2.0.0'; // Importa como namespace

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => { // Tipagem explícita para 'req'
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

    const { cartItems, buyer_id, commission_rate, app_url } = await req.json();

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !buyer_id || !commission_rate || !app_url) {
      return new Response(JSON.stringify({ error: 'Missing required fields: cartItems, buyer_id, commission_rate, app_url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group cart items by shopkeeper
    const itemsByShopkeeper = cartItems.reduce((acc: any, item: any) => {
      if (!acc[item.shopkeeper_id]) {
        acc[item.shopkeeper_id] = [];
      }
      acc[item.shopkeeper_id].push(item);
      return acc;
    }, {});

    const shopkeeperIds = Object.keys(itemsByShopkeeper);

    // Fetch Mercado Pago account IDs for all involved shopkeepers
    const { data: shopDetails, error: shopError } = await supabaseClient
      .from('shop_details')
      .select('id, mercadopago_account_id')
      .in('id', shopkeeperIds);

    if (shopError || !shopDetails || shopDetails.length !== shopkeeperIds.length) {
      console.error('Error fetching shop details or missing Mercado Pago account IDs:', shopError?.message);
      return new Response(JSON.stringify({ error: 'Mercado Pago account not configured for all shopkeepers involved in the cart.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tipagem explícita para 's'
    const shopkeeperMpAccounts = new Map(shopDetails.map((s: { id: string; mercadopago_account_id: string | null }) => [s.id, s.mercadopago_account_id]));

    // Construct items for Mercado Pago preference
    const mpItems = cartItems.map((item: any) => ({
      id: item.id,
      title: item.name,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    // Construct payments array for split payments
    const payments = shopkeeperIds.map(shopkeeperId => {
      const shopkeeperItems = itemsByShopkeeper[shopkeeperId];
      const shopkeeperRevenue = shopkeeperItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const commissionAmount = shopkeeperRevenue * (commission_rate / 100);
      const amountToReceive = shopkeeperRevenue - commissionAmount;

      const mpAccountId = shopkeeperMpAccounts.get(shopkeeperId);
      if (!mpAccountId) {
        throw new Error(`Mercado Pago account ID not found for shopkeeper ${shopkeeperId}`);
      }

      return {
        receiver_id: mpAccountId,
        amount: parseFloat(amountToReceive.toFixed(2)), // Amount for the shopkeeper
      };
    });

    // Initialize Mercado Pago client with platform's access token
    const client = new MercadoPago.MercadoPagoConfig({ // Usando MercadoPago.MercadoPagoConfig
      accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '',
      options: { timeout: 5000, idempotencyKey: crypto.randomUUID() }
    });

    const preference = new MercadoPago.Preference(client); // Usando MercadoPago.Preference

    const preferenceBody = {
      items: mpItems,
      payer: {
        id: buyer_id,
      },
      back_urls: {
        success: `${app_url}/mercadopago-return?status=success`,
        failure: `${app_url}/mercadopago-return?status=failure`,
        pending: `${app_url}/mercadopago-return?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${app_url}/functions/v1/mercadopago-webhook`,
      external_reference: JSON.stringify({ buyer_id, commission_rate, cartItems: cartItems.map((item: any) => ({ id: item.id, quantity: item.quantity, price: item.price, shopkeeper_id: item.shopkeeper_id })) }),
      // Split payments configuration
      payments: payments,
    };

    const result = await preference.create({ body: preferenceBody });

    return new Response(JSON.stringify({ init_point: result.init_point }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) { // Tipagem explícita para 'error'
    console.error('Error creating Mercado Pago preference:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});