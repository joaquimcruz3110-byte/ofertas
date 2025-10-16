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

    const { cartItems, buyer_id, customer_cpf, commission_rate, app_url } = await req.json();

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !buyer_id || !customer_cpf || commission_rate === undefined || !app_url) {
      console.error('Missing required fields for payment creation:', { cartItems, buyer_id, customer_cpf, commission_rate, app_url });
      return new Response(JSON.stringify({ error: 'Missing required fields for payment creation.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
    if (!pagarmeApiKey) {
      console.error('PAGARME_API_KEY not set in environment variables.');
      return new Response(JSON.stringify({ error: 'Pagar.me API Key not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = await Pagarme.client.connect({ api_key: pagarmeApiKey });

    // Fetch Pagar.me recipient IDs for all involved shopkeepers
    const uniqueShopkeeperIds = Array.from(new Set(cartItems.map((item: any) => item.shopkeeper_id))).filter(id => id !== null && id !== undefined);
    
    const { data: shopDetails, error: shopError } = await supabaseClient
      .from('shop_details')
      .select('id, pagarme_recipient_id')
      .in('id', uniqueShopkeeperIds);

    if (shopError) {
      console.error('Error fetching shop details for recipients:', shopError.message);
      return new Response(JSON.stringify({ error: 'Error fetching shop details for recipients.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shopkeeperPagarmeRecipients = new Map(shopDetails.map(s => [s.id, s.pagarme_recipient_id]));

    // Fetch buyer's profile to get first_name, last_name, phone_number
    const { data: buyerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, phone_number')
      .eq('id', buyer_id)
      .single();

    if (profileError) {
      console.error('Error fetching buyer profile:', profileError.message);
      // Continue without phone number if there's an error, but log it
    }

    const cleanedCpf = customer_cpf.replace(/\D/g, '');
    if (!cleanedCpf) {
      return new Response(JSON.stringify({ error: 'CPF do cliente é obrigatório e não foi fornecido ou é inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const splitRules = cartItems.map((item: any) => {
      const amountToShopkeeper = Math.round(item.price * item.quantity * (1 - commission_rate / 100));
      const recipientId = shopkeeperPagarmeRecipients.get(item.shopkeeper_id);

      if (!recipientId) {
        throw new Error(`Recipient ID not found for shopkeeper ${item.shopkeeper_id}`);
      }

      return {
        recipient_id: recipientId,
        amount: amountToShopkeeper,
        liable: true, // O lojista é responsável pela transação
        charge_processing_fee: true, // O lojista paga a taxa de processamento
      };
    });

    const totalAmount = Math.round(cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) * 100); // Total amount in cents

    // Refatorando a construção do nome do cliente para evitar erros de parsing
    let customerName = user.email; // Fallback padrão
    if (buyerProfile) {
      const firstName = buyerProfile.first_name || '';
      const lastName = buyerProfile.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        customerName = fullName;
      }
    }

    const customerData: any = {
      external_id: user.id,
      name: customerName, // Usando o nome construído de forma mais robusta
      email: user.email,
      type: 'individual',
      country: 'br',
      documents: [
        {
          type: 'cpf',
          number: cleanedCpf,
        },
      ],
    };

    if (buyerProfile?.phone_number) {
      customerData.phone_numbers = [buyerProfile.phone_number.replace(/\D/g, '')];
    }

    const transactionPayload = {
      amount: totalAmount,
      payment_method: 'checkout',
      customer: customerData, // Use the constructed object
      items: cartItems.map((item: any) => ({
        id: item.id,
        title: item.name,
        unit_price: Math.round(item.price * 100), // Price in cents
        quantity: item.quantity,
        tangible: true, // Assuming all products are tangible
      })),
      split_rules: splitRules,
      postback_url: `${app_url}/supabase/functions/v1/pagarme-webhook`, // URL da sua Edge Function de webhook
      async: false, // Set to false for synchronous checkout flow
    };

    console.log('Pagar.me Transaction Payload:', JSON.stringify(transactionPayload, null, 2)); // Log do payload

    const transaction = await client.transactions.create(transactionPayload);

    // For Pagar.me Checkout, the response will contain a checkout_url
    if (transaction.checkout_url) {
      return new Response(JSON.stringify({ checkout_url: transaction.checkout_url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error('Pagar.me transaction creation did not return a checkout_url:', transaction);
      return new Response(JSON.stringify({ error: 'Failed to get Pagar.me checkout URL.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('Error creating Pagar.me payment:', error);
    let clientErrorMessage = 'Ocorreu um erro inesperado ao processar seu pagamento.'; // Default message for client

    if (error instanceof Error) {
      clientErrorMessage = error.message;
    }

    if (error.response) {
      // Pagar.me API errors usually have a 'data' field with 'errors' array
      if (error.response.data && error.response.data.errors && Array.isArray(error.response.data.errors)) {
        const pagarmeErrors = error.response.data.errors.map((e: any) => e.message).join('; ');
        clientErrorMessage = `Erro Pagar.me: ${pagarmeErrors}`;
      } else if (typeof error.response.data === 'string') {
        clientErrorMessage = `Erro Pagar.me: ${error.response.data}`;
      } else {
        clientErrorMessage = `Erro Pagar.me: ${JSON.stringify(error.response.data)}`;
      }
      console.error('Pagar.me API Error Response (full object):', JSON.stringify(error.response, null, 2));
    }

    return new Response(JSON.stringify({ error: clientErrorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});