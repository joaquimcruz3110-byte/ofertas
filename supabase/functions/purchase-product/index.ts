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
    const authHeader = req.headers.get('Authorization');
    // O token não é usado diretamente aqui, mas é bom ter a variável caso precise
    // const token = authHeader?.replace('Bearer ', '');

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader! } },
      }
    );

    // Criar um cliente com a chave de serviço para buscar taxas de comissão, ignorando RLS
    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { productId } = await req.json();

    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Buscar detalhes do produto usando o cliente do usuário (respeita RLS para produtos)
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('id, name, price, quantity, shopkeeper_id')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('Product fetch error:', productError?.message);
      return new Response(JSON.stringify({ error: 'Product not found or could not be fetched' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (product.quantity <= 0) {
      return new Response(JSON.stringify({ error: 'Product is out of stock' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Buscar taxa de comissão ativa usando o cliente com chave de serviço (ignora RLS)
    const { data: commissionRateData, error: commissionError } = await supabaseServiceRoleClient
      .from('commission_rates')
      .select('rate')
      .eq('active', true)
      .order('set_date', { ascending: false })
      .limit(1)
      .single();

    console.log('Fetched commission rate data (service role):', commissionRateData);
    console.log('Commission rate fetch error (service role):', commissionError);

    const commissionRate = commissionRateData?.rate || 0; // Padrão para 0 se nenhuma taxa ativa for encontrada

    // Realizar a transação
    const { error: updateError } = await supabaseClient.rpc('perform_purchase', {
      p_product_id: productId,
      p_buyer_id: user.id,
      p_quantity: 1, // Por enquanto, assume 1 unidade por compra
      p_total_price: product.price,
      p_commission_rate: commissionRate,
    });

    if (updateError) {
      console.error('Purchase transaction error:', updateError.message);
      return new Response(JSON.stringify({ error: 'Failed to complete purchase: ' + updateError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ message: 'Purchase successful!' }), {
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