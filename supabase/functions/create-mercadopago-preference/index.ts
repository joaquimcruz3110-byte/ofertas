// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as mercadopago from 'https://esm.sh/mercadopago@2.9.0?target=deno';

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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    // @ts-ignore
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // @ts-ignore
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    // @ts-ignore
    const appUrl = Deno.env.get('VITE_APP_URL');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !mpAccessToken || !appUrl) {
      console.error('Missing environment variables for Edge Function.');
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing environment variables.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500, // Internal Server Error
      });
    }

    // DEBUG: Log the start of the access token to confirm it's loaded
    console.log('Mercado Pago Access Token (start):', mpAccessToken.substring(0, 10) + '...');

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
    const supabaseUserClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
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

    // 2. Inicializar o cliente Mercado Pago v2.x
    const client = new mercadopago.MercadoPagoConfig({ 
      accessToken: mpAccessToken,
      // Adicionando uma opção de cabeçalhos explícita para tentar contornar o erro de compatibilidade
      options: {
        headers: new Headers(), 
      }
    });
    const preference = new mercadopago.Preference(client);

    // 3. Criar um cliente Supabase com a service_role_key para buscar detalhes do produto
    const supabaseServiceRoleClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    // Buscar detalhes do produto para garantir que preços e quantidades estejam corretos
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
        unit_price: Number(product.price),
        quantity: item.quantity,
        currency_id: 'BRL',
        picture_url: (product.photo_urls && product.photo_urls.length > 0) ? product.photo_urls[0] : undefined,
      };
    });

    const externalReference = `${user.id}-${Date.now()}`; // Unique reference for the order

    const preferenceData = {
      items: preferenceItems,
      payer: {
        email: user.email,
      },
      back_urls: {
        success: `${appUrl}/mercadopago-return?status=success&external_reference=${externalReference}`,
        pending: `${appUrl}/mercadopago-return?status=pending&external_reference=${externalReference}`,
        failure: `${appUrl}/mercadopago-return?status=failure&external_reference=${externalReference}`,
      },
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      auto_return: 'approved',
      external_reference: externalReference, // Usado para vincular a venda
      metadata: {
        buyer_id: user.id,
        cart_items: JSON.stringify(cartItems), // Armazena itens do carrinho para processamento do webhook
      },
    };

    const mpResponse = await preference.create({ body: preferenceData });
    const initPoint = mpResponse.init_point;
    const preferenceId = mpResponse.id;

    // Salvar a preferência na tabela payment_preferences
    const { error: insertPreferenceError } = await supabaseServiceRoleClient
      .from('payment_preferences')
      .insert({
        preference_id: preferenceId,
        buyer_id: user.id,
        external_reference: externalReference,
        cart_items_snapshot: cartItems,
        status: 'created',
      });

    if (insertPreferenceError) {
      console.error('Error saving payment preference to DB:', insertPreferenceError.message);
      // Decida se este erro deve impedir o checkout ou apenas ser logado
      // Por enquanto, vamos apenas logar e continuar, pois o MP já criou a preferência.
    }

    return new Response(JSON.stringify({ success: true, preferenceId, url: initPoint }), {
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