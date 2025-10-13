import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
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

    // Fetch product details
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

    // Fetch active commission rate
    const { data: commissionRateData, error: commissionError } = await supabaseClient
      .from('commission_rates')
      .select('rate')
      .eq('active', true)
      .order('set_date', { ascending: false })
      .limit(1)
      .single();

    const commissionRate = commissionRateData?.rate || 0; // Default to 0 if no active rate

    // Perform the transaction
    const { error: updateError } = await supabaseClient.rpc('perform_purchase', {
      p_product_id: productId,
      p_buyer_id: user.id,
      p_quantity: 1, // For now, assume 1 unit per purchase
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

  } catch (error) {
    console.error('Edge Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});