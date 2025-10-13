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
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader! } },
      }
    );

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

    const { cartItems } = await req.json(); // Espera um array de itens do carrinho

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart items are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const purchaseResults: Array<{ productId: string; success: boolean; message: string }> = [];
    let overallSuccess = true;

    // Buscar taxa de comissão ativa uma vez para todas as compras
    const { data: commissionRateData, error: commissionError } = await supabaseServiceRoleClient
      .from('commission_rates')
      .select('rate')
      .eq('active', true)
      .order('set_date', { ascending: false })
      .limit(1)
      .single();

    if (commissionError) {
      console.error('Commission rate fetch error (service role):', commissionError.message);
      return new Response(JSON.stringify({ error: 'Failed to fetch commission rate' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    const commissionRate = commissionRateData?.rate || 0;

    for (const item of cartItems) {
      const { id: productId, quantity: requestedQuantity } = item;

      if (!productId || !requestedQuantity || requestedQuantity <= 0) {
        purchaseResults.push({ productId, success: false, message: 'Invalid product ID or quantity' });
        overallSuccess = false;
        continue;
      }

      // Buscar detalhes reais do produto para validar preço e estoque
      const { data: product, error: productError } = await supabaseClient
        .from('products')
        .select('id, name, price, quantity, shopkeeper_id')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        console.error(`Product fetch error for ${productId}:`, productError?.message);
        purchaseResults.push({ productId, success: false, message: 'Product not found or could not be fetched' });
        overallSuccess = false;
        continue;
      }

      if (product.quantity < requestedQuantity) {
        purchaseResults.push({ productId, success: false, message: `Insufficient stock for ${product.name}. Available: ${product.quantity}` });
        overallSuccess = false;
        continue;
      }

      // Calcular preço total para este item com base no preço real do produto
      const totalPriceForItem = product.price * requestedQuantity;

      // Realizar a compra usando a função RPC
      const { error: purchaseError } = await supabaseClient.rpc('perform_purchase', {
        p_product_id: productId,
        p_buyer_id: user.id,
        p_quantity: requestedQuantity,
        p_total_price: totalPriceForItem,
        p_commission_rate: commissionRate,
      });

      if (purchaseError) {
        console.error(`Purchase transaction error for ${product.name}:`, purchaseError.message);
        purchaseResults.push({ productId, success: false, message: `Failed to purchase ${product.name}: ${purchaseError.message}` });
        overallSuccess = false;
      } else {
        purchaseResults.push({ productId, success: true, message: `Successfully purchased ${product.name}` });
      }
    }

    if (overallSuccess) {
      return new Response(JSON.stringify({ message: 'All items purchased successfully!', results: purchaseResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      return new Response(JSON.stringify({ error: 'Some purchases failed', results: purchaseResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Ou 207 Multi-Status se sucesso parcial for aceitável
      });
    }

  } catch (error: unknown) {
    console.error('Edge Function error:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});