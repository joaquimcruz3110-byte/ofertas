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
  console.log('Edge Function create-pagarme-payment started.'); // Log para depuração

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

    const { cartItems, buyer_id, commission_rate, app_url } = await req.json();

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0 || !buyer_id || !commission_rate || !app_url) {
      console.error('Missing required fields in request body:', { cartItems, buyer_id, commission_rate, app_url });
      return new Response(JSON.stringify({ error: 'Missing required fields: cartItems, buyer_id, commission_rate, app_url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group cart items by shopkeeper
    const itemsByShopkeeper = cartItems.reduce((acc: any, item: any) => {
      if (!acc[item.shopkeeper_id]) {
        acc[item.shopkeeper_id] = [];
      }
      acc[item.shopkeeper_id].push(item);
      return acc;
    }, {});

    const shopkeeperIds = Object.keys(itemsByShopkeeper);

    // Fetch Pagar.me recipient IDs for all involved shopkeepers
    const { data: shopDetails, error: shopError } = await supabaseClient
      .from('shop_details')
      .select('id, pagarme_recipient_id')
      .in('id', shopkeeperIds);

    if (shopError || !shopDetails || shopDetails.length !== shopkeeperIds.length) {
      console.error('Error fetching shop details or missing Pagar.me recipient IDs:', shopError?.message, 'Shop details:', shopDetails);
      return new Response(JSON.stringify({ error: 'Pagar.me recipient ID not configured for all shopkeepers involved in the cart.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shopkeeperPagarmeRecipients = new Map(shopDetails.map((s: { id: string; pagarme_recipient_id: string | null }) => [s.id, s.pagarme_recipient_id]));

    // Construct items for Pagar.me transaction
    const pagarmeItems = cartItems.map((item: any) => ({
      id: item.id,
      title: item.name,
      unit_price: Math.round(parseFloat(item.price.toFixed(2)) * 100), // Pagar.me expects cents
      quantity: item.quantity,
      tangible: true, // Assuming products are tangible
    }));

    // Construct split rules for Pagar.me
    const splitRules = shopkeeperIds.map(shopkeeperId => {
      const shopkeeperItems = itemsByShopkeeper[shopkeeperId];
      const shopkeeperRevenueCents = shopkeeperItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity * 100), 0);
      const commissionAmountCents = Math.round(shopkeeperRevenueCents * (commission_rate / 100));
      const amountToReceiveCents = shopkeeperRevenueCents - commissionAmountCents;

      const recipientId = shopkeeperPagarmeRecipients.get(shopkeeperId);
      if (!recipientId) {
        // This case should ideally be caught by the earlier shopDetails check, but good to have a fallback
        console.error(`Pagar.me recipient ID not found for shopkeeper ${shopkeeperId} during split rule creation.`);
        throw new Error(`Pagar.me recipient ID not found for shopkeeper ${shopkeeperId}`);
      }

      return {
        recipient_id: recipientId,
        amount: Math.round(amountToReceiveCents), // Amount for the shopkeeper in cents
        liable: true, // Shopkeeper is liable for chargebacks
        charge_processing_fee: true, // Shopkeeper pays processing fee
      };
    });

    const totalAmountCents = pagarmeItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.quantity), 0);

    // Fetch buyer profile for customer details
    const { data: buyerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name, cpf, phone_number, address_street, address_number, address_complement, address_district, address_postal_code, address_city, address_state')
      .eq('id', buyer_id)
      .single();

    console.log('Buyer Profile Data:', buyerProfile); // Adicionado para depuração
    console.log('Buyer Profile Error:', profileError); // Adicionado para depuração

    if (profileError || !buyerProfile) {
      console.error('Error fetching buyer profile:', profileError?.message);
      if (profileError) {
        console.error('Supabase profile fetch error details:', profileError);
      }
      if (!buyerProfile) {
        console.error('Buyer profile is null or undefined for buyer_id:', buyer_id);
      }
      return new Response(JSON.stringify({ error: 'Seu perfil está incompleto. Por favor, preencha seu CPF, telefone e endereço completo (Rua, Número, CEP, Cidade, Estado) antes de finalizar a compra.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Explicitly check for required address and contact fields
    const missingFields = [
      buyerProfile.first_name,
      buyerProfile.last_name,
      buyerProfile.cpf,
      buyerProfile.phone_number,
      buyerProfile.address_street,
      buyerProfile.address_number,
      buyerProfile.address_postal_code,
      buyerProfile.address_city,
      buyerProfile.address_state,
    ].some(field => !field || String(field).trim() === '');

    if (missingFields) {
      console.error('Buyer profile is missing required address or contact details for Pagar.me transaction.');
      return new Response(JSON.stringify({ error: 'Seu perfil está incompleto. Por favor, preencha seu nome completo, CPF, telefone e endereço completo (Rua, Número, CEP, Cidade, Estado) antes de finalizar a compra.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
    console.log('PAGARME_API_KEY read in function (first 5 chars):', pagarmeApiKey ? pagarmeApiKey.substring(0, 5) : 'Not set'); // Log da chave de API
    if (!pagarmeApiKey) {
      console.error('PAGARME_API_KEY not set in environment variables.');
      return new Response(JSON.stringify({ error: 'Pagar.me API Key not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = await Pagarme.client.connect({ api_key: pagarmeApiKey });

    const transactionBody = {
      amount: totalAmountCents,
      items: pagarmeItems,
      customer: {
        external_id: buyer_id,
        name: `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim(),
        email: user.email,
        type: 'individual',
        documents: [{
          type: 'cpf',
          number: buyerProfile.cpf?.replace(/\D/g, ''), // Remove non-digits
        }],
        phone_numbers: [`+55${buyerProfile.phone_number?.replace(/\D/g, '')}`], // Format for Pagar.me
      },
      billing: {
        name: `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim(),
        address: {
          country: 'br',
          state: buyerProfile.address_state,
          city: buyerProfile.address_city,
          zipcode: buyerProfile.address_postal_code?.replace(/\D/g, ''),
          line_1: `${buyerProfile.address_street}, ${buyerProfile.address_number}`,
          line_2: buyerProfile.address_complement || '',
        },
      },
      shipping: {
        name: `${buyerProfile.first_name || ''} ${buyerProfile.last_name || ''}`.trim(),
        address: {
          country: 'br',
          state: buyerProfile.address_state,
          city: buyerProfile.address_city,
          zipcode: buyerProfile.address_postal_code?.replace(/\D/g, ''),
          line_1: `${buyerProfile.address_street}, ${buyerProfile.address_number}`,
          line_2: buyerProfile.address_complement || '',
        },
      },
      payment_method: 'checkout', // Use checkout para redirecionar o usuário
      split_rules: splitRules,
      postback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/pagarme-webhook`,
      // Pass external_reference to webhook for sale processing
      metadata: {
        buyer_id: buyer_id,
        commission_rate: commission_rate,
        cartItems: JSON.stringify(cartItems.map((item: any) => ({ id: item.id, quantity: item.quantity, price: item.price, shopkeeper_id: item.shopkeeper_id }))),
      },
      // Redirecionamento após o pagamento
      success_url: `${app_url}/pagarme-return?status=success`,
      failure_url: `${app_url}/pagarme-return?status=failure`,
    };

    console.log('Pagar.me transactionBody:', JSON.stringify(transactionBody, null, 2)); // Log do corpo da transação

    const transaction = await client.transactions.create(transactionBody);

    console.log('Pagar.me transaction response:', JSON.stringify(transaction, null, 2)); // Log da resposta da transação

    if (transaction.status === 'pending_review' || transaction.status === 'waiting_payment') {
      return new Response(JSON.stringify({ checkout_url: transaction.checkout_url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error(`Pagar.me transaction failed or unexpected status: ${transaction.status}`, transaction);
      return new Response(JSON.stringify({ error: `Pagar.me transaction failed or unexpected status: ${transaction.status}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('Error creating Pagar.me payment:', error); // Captura erros gerais
    let errorMessage = 'An unknown error occurred during Pagar.me payment creation.';

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Log the entire error.response object if it exists
    if (error.response) {
      console.error('Pagar.me API Error Response (full object):', JSON.stringify(error.response, null, 2));
      if (error.response.data) {
        console.error('Pagar.me API Error Response Data:', JSON.stringify(error.response.data, null, 2));
        errorMessage = `Pagar.me API Error: ${JSON.stringify(error.response.data)}`;
      } else {
        errorMessage = `Pagar.me API Error (no data property): ${JSON.stringify(error.response)}`;
      }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});