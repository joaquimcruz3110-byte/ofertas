// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as mercadopagoSdk from 'https://esm.sh/mercadopago@2.0.10'; // Importação como namespace

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  photo_urls: string[] | null;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  photo_url: string | null; // Mantido como string | null para a imagem principal do item no carrinho
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

    // 1. Criar um cliente Supabase com o token do usuário para verificar a sessão
    // Passando o cabeçalho de autorização diretamente nas opções do cliente.
    const supabaseUserClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false, // Importante para ambientes sem estado como Edge Functions
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
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpAccessToken) {
      throw new Error('Mercado Pago access token is not configured.');
    }
    console.log('Mercado Pago Access Token loaded.'); // Log para confirmar que o token foi carregado

    mercadopagoSdk.configure({ // Acessando 'configure' diretamente do mercadopagoSdk
      access_token: mpAccessToken,
    });

    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const productIds = cartItems.map((item: CartItem) => item.id);
    const { data: productsData, error: productsError } = await supabaseServiceRoleClient
      .from('products')
      .select('id, name, price, quantity, photo_urls')
      .in('id', productIds);

    if (productsError) {
      throw new Error('Failed to fetch product details: ' + productsError.message);
    }

    const productsMap = new Map<string, Product>(productsData.map((p: Product) => [p.id, p]));

    const preferenceItems = cartItems.map((item: CartItem) => {
      const product = productsMap.get(item.id);
      if (!product) {
        throw new Error(`Product with ID ${item.id} not found.`);
      }
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
      }

      return {
        id: product.id,
        title: product.name,
        unit_price: Number(product.price), // Garantir que é um número
        quantity: item.quantity,
        currency_id: 'BRL',
        picture_url: (product.photo_urls && product.photo_urls.length > 0) ? product.photo_urls[0] : undefined,
      };
    });

    const externalReference = `${user.id}-${Date.now()}`; // Unique reference for the order

    const preference = {
      items: preferenceItems,
      payer: {
        email: user.email,
      },
      back_urls: {
        // @ts-ignore
        success: `${Deno.env.get('VITE_APP_URL')}/mercadopago-return?status=success&external_reference=${externalReference}`,
        // @ts-ignore
        pending: `${Deno.env.get('VITE_APP_URL')}/mercadopago-return?status=pending&external_reference=${externalReference}`,
        // @ts-ignore
        failure: `${Deno.env.get('VITE_APP_URL')}/mercadopago-return?status=failure&external_reference=${externalReference}`,
      },
      // @ts-ignore
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      auto_return: 'approved',
      metadata: {
        buyer_id: user.id,
        cart_items: JSON.stringify(cartItems), // Store cart items for webhook processing
        external_reference: externalReference,
      },
    };

    console.log('Mercado Pago Preference object:', JSON.stringify(preference, null, 2)); // Log do objeto de preferência

    const mpResponse = await mercadopagoSdk.preferences.create(preference); // Acessando 'preferences.create' diretamente

    return new Response(JSON.stringify({ url: mpResponse.body.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('Edge Function error:', (error as Error).message);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2)); // Log do objeto de erro completo
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});