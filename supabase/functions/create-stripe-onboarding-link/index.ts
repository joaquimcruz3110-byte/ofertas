/// <reference lib="deno.ns" />
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

    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      console.error('Unauthorized: No user session found.');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { shopkeeperId, returnUrl, refreshUrl } = await req.json();

    if (user.id !== shopkeeperId) {
      console.error(`Forbidden: User ID mismatch. User: ${user.id}, ShopkeeperId: ${shopkeeperId}`);
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY is not set in Supabase secrets.');
      throw new Error('Stripe secret key is not configured.');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });

    let accountId: string;

    console.log(`Fetching payout details for shopkeeper: ${shopkeeperId}`);
    const { data: payoutDetails, error: fetchError } = await supabaseClient
      .from('shopkeeper_payout_details')
      .select('stripe_account_id')
      .eq('shopkeeper_id', shopkeeperId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error('Error fetching payout details from DB:', fetchError.message);
      throw new Error('Failed to fetch payout details from database.');
    }

    if (payoutDetails) {
      accountId = payoutDetails.stripe_account_id;
      console.log(`Existing Stripe account found: ${accountId}`);
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      console.log(`Generated account link for existing account: ${accountLink.url}`);
      return new Response(JSON.stringify({ url: accountLink.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      console.log('No existing Stripe account found. Creating a new one.');
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
      });

      accountId = account.id;
      console.log(`New Stripe account created: ${accountId}`);

      const { error: insertError } = await supabaseClient
        .from('shopkeeper_payout_details')
        .insert({ shopkeeper_id: shopkeeperId, stripe_account_id: accountId });

      if (insertError) {
        console.error('Error inserting Stripe account ID into DB:', insertError.message);
        throw new Error('Failed to save Stripe account ID to database.');
      }
      console.log('Stripe account ID saved to DB.');

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });
      console.log(`Generated account link for new account: ${accountLink.url}`);
      return new Response(JSON.stringify({ url: accountLink.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error: unknown) {
    console.error('Edge Function caught an error:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});