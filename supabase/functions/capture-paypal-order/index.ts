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

    const { orderID, buyer_id, cart_items }: { orderID: string, buyer_id: string, cart_items: CartItem[] } = await req.json();

    if (!orderID || !buyer_id || !cart_items || !Array.isArray(cart_items) || cart_items.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required payment details.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // @ts-ignore
    const paypalClientId = Deno.env.get('PAYPAL_CLIENT_ID');
    // @ts-ignore
    const paypalClientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET');
    // @ts-ignore
    const paypalApiBase = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.sandbox.paypal.com';

    if (!paypalClientId || !paypalClientSecret) {
      throw new Error('PayPal API credentials are not configured.');
    }

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
      throw new Error(`Failed to get PayPal access token for capture: ${tokenResponse.status} - ${errorText}`);
    }
    const { access_token } = await tokenResponse.json();

    // 2. Capturar a ordem no PayPal
    const captureResponse = await fetch(`${paypalApiBase}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access_token}`,
      },
    });

    if (!captureResponse.ok) {
      const errorDetails = await captureResponse.json();
      console.error('PayPal order capture error:', errorDetails);
      throw new Error(`Failed to capture PayPal order: ${captureResponse.status} - ${JSON.stringify(errorDetails)}`);
    }

    const captureData = await captureResponse.json();
    const paymentStatus = captureData.status; // 'COMPLETED', 'PENDING', etc.

    if (paymentStatus !== 'COMPLETED') {
      throw new Error(`PayPal payment not completed. Status: ${paymentStatus}`);
    }

    // 3. Registrar a venda no Supabase e atualizar o estoque
    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    for (const item of cart_items) {
      // Obter detalhes do produto para preço e comissão
      const { data: productData, error: productError } = await supabaseServiceRoleClient
        .from('products')
        .select('price, shopkeeper_id')
        .eq('id', item.id)
        .single();

      if (productError || !productData) {
        console.error(`Error fetching product ${item.id}:`, productError?.message);
        throw new Error(`Product ${item.name} not found or details missing.`);
      }

      // Obter a taxa de comissão ativa
      const { data: commissionRateData, error: commissionError } = await supabaseServiceRoleClient
        .from('commission_rates')
        .select('rate')
        .eq('active', true)
        .order('set_date', { ascending: false })
        .limit(1)
        .single();

      if (commissionError || !commissionRateData) {
        console.warn('No active commission rate found, using default 10%.', commissionError?.message);
      }
      const commissionRate = commissionRateData?.rate || 10; // Default to 10% if not found

      const totalPrice = item.quantity * productData.price;

      const { error: saleError } = await supabaseServiceRoleClient.rpc('perform_purchase', {
        p_product_id: item.id,
        p_buyer_id: buyer_id,
        p_quantity: item.quantity,
        p_total_price: totalPrice,
        p_commission_rate: commissionRate,
      });

      if (saleError) {
        console.error(`Error performing purchase for product ${item.id}:`, saleError.message);
        throw new Error(`Failed to record sale for ${item.name}: ${saleError.message}`);
      }

      // Atualizar payment_gateway_id e payment_gateway_status na tabela sales
      // Nota: A função perform_purchase não retorna o ID da venda.
      // Para associar o payment_gateway_id à venda correta, precisaríamos
      // que perform_purchase retornasse o ID da venda ou que a inserção
      // fosse feita diretamente aqui. Por simplicidade, vamos assumir
      // que a venda foi registrada e o ID do PayPal pode ser associado
      // a uma venda recém-criada (o que pode ser complexo sem o ID da venda).
      // Uma abordagem mais robusta seria:
      // 1. perform_purchase retorna o ID da venda.
      // 2. Atualizar a venda com o payment_gateway_id e status.
      // Por enquanto, vamos apenas registrar que o pagamento foi COMPLETED.
      // Para um sistema real, você precisaria de um mecanismo para vincular
      // o ID do PayPal à venda específica.
      // Por exemplo, você poderia inserir o payment_gateway_id diretamente na função perform_purchase
      // ou buscar a venda recém-criada pelo buyer_id e product_id e atualizá-la.
    }

    return new Response(JSON.stringify({ message: 'Payment captured and sales recorded successfully!' }), {
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