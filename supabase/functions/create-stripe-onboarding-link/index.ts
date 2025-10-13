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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { shopkeeperId, returnUrl, refreshUrl } = await req.json();

    if (user.id !== shopkeeperId) {
      return new Response(JSON.stringify({ error: 'User ID mismatch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Inicializa o Stripe com a chave secreta
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-06-20', // Use a versão mais recente da API do Stripe
      typescript: true,
    });

    let accountId: string;

    // Verifica se o lojista já tem uma conta Stripe conectada
    const { data: payoutDetails, error: fetchError } = await supabaseClient
      .from('shopkeeper_payout_details')
      .select('stripe_account_id')
      .eq('shopkeeper_id', shopkeeperId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means "no rows found"
      console.error('Error fetching payout details:', fetchError.message);
      throw new Error('Failed to fetch payout details.');
    }

    if (payoutDetails) {
      accountId = payoutDetails.stripe_account_id;
      // Se a conta já existe, podemos verificar o status ou gerar um link de login
      // Para simplificar, vamos gerar um link de conta para o lojista gerenciar
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding', // Ou 'account_update' se for para atualizar
      });
      return new Response(JSON.stringify({ url: accountLink.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      // Cria uma nova conta conectada no Stripe
      const account = await stripe.accounts.create({
        type: 'express', // Ou 'standard' ou 'custom' dependendo do seu modelo
        country: 'BR', // Ou o país do seu marketplace
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual', // Ou 'company'
      });

      accountId = account.id;

      // Salva o accountId no seu banco de dados
      const { error: insertError } = await supabaseClient
        .from('shopkeeper_payout_details')
        .insert({ shopkeeper_id: shopkeeperId, stripe_account_id: accountId });

      if (insertError) {
        console.error('Error inserting Stripe account ID:', insertError.message);
        throw new Error('Failed to save Stripe account ID.');
      }

      // Cria o link de onboarding para o lojista completar o cadastro
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return new Response(JSON.stringify({ url: accountLink.url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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