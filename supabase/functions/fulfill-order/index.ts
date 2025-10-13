// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import Stripe from 'https://esm.sh/stripe@16.2.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // @ts-ignore
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key is not configured.');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });

    const { sessionId } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (checkoutSession.payment_status !== 'paid') {
      return new Response(JSON.stringify({ error: 'Payment not successful' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const buyerId = checkoutSession.metadata?.buyer_id;
    const cartItemsString = checkoutSession.metadata?.cart_items;

    if (!buyerId || !cartItemsString) {
      throw new Error('Missing metadata in Stripe session.');
    }

    const cartItems: CartItem[] = JSON.parse(cartItemsString);

    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch active commission rate using service role client
    const { data: commissionRateData, error: commissionError } = await supabaseServiceRoleClient
      .from('commission_rates')
      .select('rate')
      .eq('active', true)
      .order('set_date', { ascending: false })
      .limit(1)
      .single();

    if (commissionError) {
      console.error('Commission rate fetch error (service role):', commissionError.message);
      throw new Error('Failed to fetch commission rate');
    }
    const commissionRate = commissionRateData?.rate || 0;

    const purchaseResults: Array<{ productId: string; success: boolean; message: string }> = [];
    let overallSuccess = true;

    for (const item of cartItems) {
      const { id: productId, quantity: requestedQuantity } = item;

      // Fetch real product details to validate price and stock (using service role for direct access)
      const { data: product, error: productError } = await supabaseServiceRoleClient
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

      const totalPriceForItem = product.price * requestedQuantity;

      // Perform the purchase using the RPC function
      const { error: purchaseError } = await supabaseServiceRoleClient.rpc('perform_purchase', {
        p_product_id: productId,
        p_buyer_id: buyerId,
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
        status: 400,
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