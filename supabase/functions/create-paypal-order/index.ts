// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Bearer token missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUserClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      console.error('Error verifying user token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { cartItems } = await req.json();

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart items are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // @ts-ignore
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    // @ts-ignore
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
    // @ts-ignore
    const paypalApiBase = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.sandbox.paypal.com'; // Usar sandbox por padrão

    if (!paypalClientId || !paypalClientSecret) {
      throw new Error('PayPal API credentials are not configured.');
    }

    // 2. Criar um cliente Supabase com a service_role_key para buscar detalhes do produto
    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar detalhes do produto para garantir que preços e quantidades estejam corretos
    const productIds = cartItems.map((item: CartItem) => item.id);
    const { data: productsData, error: productsError } = await supabaseServiceRoleClient
      .from('products')
      .select('id, name, price, quantity')
      .in('id', productIds);

    if (productsError) {
      throw new Error('Failed to fetch product details: ' + productsError.message);
    }

    const productsMap = new Map<string, { id: string; name: string; price: number; quantity: number }>(productsData.map((p: { id: string; name: string; price: number; quantity: number }) => [p.id, p]));

    const purchaseUnits = [{
      items: cartItems.map((item: CartItem) => {
        const product = productsMap.get(item.id);
        if (!product) {
          throw new Error(`Product with ID ${item.id} not found.`);
        }
        if (product.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
        }
        return {
          name: product.name,
          quantity: item.quantity.toString(),
          unit_amount: {
            currency_code: 'BRL',
            value: product.price.toFixed(2),
          },
        };
      }),
      amount: {
        currency_code: 'BRL',
        value: cartItems.reduce((sum: number, item: CartItem) => {
          const product = productsMap.get(item.id);
          return sum + (product ? product.price * item.quantity : 0);
        }, 0).toFixed(2),
        breakdown: {
          item_total: {
            currency_code: 'BRL',
            value: cartItems.reduce((sum: number, item: CartItem) => {
              const product = productsMap.get(item.id);
              return sum + (product ? product.price * item.quantity : 0);
            }, 0).toFixed(2),
          },
        },
      },
      custom_id: user.id, // Armazenar o ID do comprador
      soft_descriptor: 'OlimpiaOfertas',
    }];

    // 1. Obter token de acesso do PayPal
    const authString = btoa(`${paypalClientId}:${paypalClientSecret}`);
    const tokenResponse = await fetch(`${paypalApiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Failed to get PayPal access token: ${tokenResponse.status} - ${errorText}`);
    }
    const { access_token } = await tokenResponse.json();

    // 2. Criar ordem no PayPal
    const orderResponse = await fetch(`${paypalApiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: purchaseUnits,
        application_context: {
          // @ts-ignore
          return_url: `${Deno.env.get('VITE_APP_URL')}/paypal-return?buyer_id=${user.id}&cart_items=${encodeURIComponent(JSON.stringify(cartItems))}`,
          // @ts-ignore
          cancel_url: `${Deno.env.get('VITE_APP_URL')}/cart`,
          brand_name: 'Olímpia Ofertas',
          locale: 'pt-BR',
          shipping_preference: 'NO_SHIPPING', // Ou 'GET_FROM_FILE' se você coletar endereço
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorDetails = await orderResponse.json();
      console.error('PayPal order creation error:', errorDetails);
      throw new Error(`Failed to create PayPal order: ${orderResponse.status} - ${JSON.stringify(errorDetails)}`);
    }

    const orderData = await orderResponse.json();
    const approveLink = orderData.links.find((link: any) => link.rel === 'approve');

    if (!approveLink) {
      throw new Error('No approval link found in PayPal order response.');
    }

    return new Response(JSON.stringify({ orderID: orderData.id, approveUrl: approveLink.href }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('Edge Function error:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});