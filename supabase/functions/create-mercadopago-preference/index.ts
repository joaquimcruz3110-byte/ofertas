// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { MercadoPagoConfig, Preference } from 'https://esm.sh/mercadopago@2.0.10?target=deno'; // Importação do SDK v2.x com target=deno

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
    const mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpAccessToken) {
      throw new Error('Mercado Pago access token is not configured.');
    }

    // 2. Inicializar o cliente Mercado Pago v2.x
    const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
    const preference = new Preference(client);

    // 3. Criar um cliente Supabase com a service_role_key para buscar detalhes do produto
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