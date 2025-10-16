// @ts-nocheck
/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import Pagarme from 'npm:pagarme@4.35.2'; // Versão atualizada

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  console.log('Edge Function create-pagarme-payment started for API key test.'); // Log para depuração

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Unauthorized: Missing Authorization header');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Unauthorized: Invalid user session', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid user session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
    console.log('PAGARME_API_KEY read in function (first 5 chars):', pagarmeApiKey ? pagarmeApiKey.substring(0, 5) : 'Not set');

    if (!pagarmeApiKey) {
      console.error('PAGARME_API_KEY not set in environment variables.');
      return new Response(JSON.stringify({ error: 'Pagar.me API Key not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = await Pagarme.client.connect({ api_key: pagarmeApiKey });

    // --- TESTE SIMPLES DA CHAVE DE API ---
    console.log('Attempting a simple Pagar.me API call: fetching recipients...');
    const recipients = await client.recipients.all();
    console.log('Pagar.me recipients fetched successfully:', recipients);
    // --- FIM DO TESTE SIMPLES ---

    return new Response(JSON.stringify({ message: 'Pagar.me API key test successful. Recipients fetched.', recipients }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error during Pagar.me API key test:', error);
    let errorMessage = 'An unknown error occurred during Pagar.me API key test.';

    if (error instanceof Error) {
      errorMessage = error.message;
    }
    if (error.response) {
      console.error('Pagar.me API Error Response (full object):', JSON.stringify(error.response, null, 2));
      errorMessage = `Pagar.me API Error: ${JSON.stringify(error.response.data || error.response)}`;
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});