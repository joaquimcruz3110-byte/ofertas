// @ts-nocheck
/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
      console.error('create-pagarme-payment: Unauthorized: Missing Authorization header');
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
      console.error('create-pagarme-payment: Unauthorized: Invalid user session', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid user session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      cartItems,
      buyer_id,
      customer_cpf,
      customer_phone_number,
      customer_address_street,
      customer_address_number,
      customer_address_complement,
      customer_address_district,
      customer_address_postal_code,
      customer_address_city,
      customer_address_state,
      commission_rate,
      app_url,
    } = await req.json();

    console.log('create-pagarme-payment: Received request with buyer_id:', buyer_id);
    console.log('create-pagarme-payment: Cart Items:', JSON.stringify(cartItems));

    // --- Validação de campos obrigatórios da requisição ---
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      console.error('create-pagarme-payment: Cart items are empty or invalid.');
      return new Response(JSON.stringify({ error: 'Carrinho de compras vazio ou inválido.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!buyer_id) {
      console.error('create-pagarme-payment: Buyer ID is missing.');
      return new Response(JSON.stringify({ error: 'ID do comprador é obrigatório.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!customer_cpf) {
      console.error('create-pagarme-payment: Customer CPF is missing.');
      return new Response(JSON.stringify({ error: 'CPF do cliente é obrigatório.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!customer_phone_number) {
      console.error('create-pagarme-payment: Customer phone number is missing.');
      return new Response(JSON.stringify({ error: 'Número de telefone do cliente é obrigatório.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (commission_rate === undefined || commission_rate < 0 || commission_rate > 100) {
      console.error('create-pagarme-payment: Invalid commission rate:', commission_rate);
      return new Response(JSON.stringify({ error: 'Taxa de comissão inválida.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!app_url) {
      console.error('create-pagarme-payment: App URL is missing.');
      return new Response(JSON.stringify({ error: 'URL da aplicação é obrigatória para postback.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!customer_address_street || !customer_address_number || !customer_address_district || !customer_address_postal_code || !customer_address_city || !customer_address_state) {
      console.error('create-pagarme-payment: Missing required billing address fields.', { customer_address_street, customer_address_number, customer_address_district, customer_address_postal_code, customer_address_city, customer_address_state });
      return new Response(JSON.stringify({ error: 'Campos obrigatórios do endereço de cobrança ausentes. Por favor, complete seu perfil.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
    if (!pagarmeApiKey) {
      console.error('create-pagarme-payment: PAGARME_API_KEY not set.');
      return new Response(JSON.stringify({ error: 'Pagar.me API Key não configurada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const platformRecipientId = Deno.env.get('PAGARME_PLATFORM_RECIPIENT_ID');
    if (!platformRecipientId) {
      console.error('create-pagarme-payment: PAGARME_PLATFORM_RECIPIENT_ID not set.');
      return new Response(JSON.stringify({ error: 'ID do recebedor da plataforma Pagar.me não configurado.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch Pagar.me recipient IDs for all involved shopkeepers
    const uniqueShopkeeperIds = Array.from(new Set(cartItems.map((item: any) => item.shopkeeper_id))).filter(id => id !== null && id !== undefined);
    
    const { data: shopDetails, error: shopError } = await supabaseClient
      .from('shop_details')
      .select('id, pagarme_recipient_id')
      .in('id', uniqueShopkeeperIds);

    if (shopError) {
      console.error('create-pagarme-payment: Error fetching shop details for recipients:', shopError.message);
      return new Response(JSON.stringify({ error: 'Erro ao buscar detalhes das lojas para recebedores.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const shopkeeperPagarmeRecipients = new Map(shopDetails.map(s => [s.id, s.pagarme_recipient_id]));
    console.log('create-pagarme-payment: Shopkeeper Pagar.me Recipients Map:', shopkeeperPagarmeRecipients);

    const cleanedCpf = customer_cpf.replace(/\D/g, '');
    if (cleanedCpf.length !== 11) {
      console.error('create-pagarme-payment: Invalid CPF length:', cleanedCpf);
      return new Response(JSON.stringify({ error: 'CPF inválido. Deve conter 11 dígitos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Calculate total amount in cents ---
    const totalAmountInCents = Math.round(cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) * 100);
    console.log('create-pagarme-payment: Total amount in cents:', totalAmountInCents);

    // --- Build split rules ---
    const splitRules = [];
    let totalAmountToShopkeepersInCents = 0;

    for (const item of cartItems) {
      const itemTotalPriceInCents = Math.round(item.price * item.quantity * 100);
      const amountToShopkeeperForThisItem = Math.round(itemTotalPriceInCents * (1 - commission_rate / 100));
      totalAmountToShopkeepersInCents += amountToShopkeeperForThisItem;

      const recipientId = shopkeeperPagarmeRecipients.get(item.shopkeeper_id);

      if (!recipientId) {
        console.error(`create-pagarme-payment: Pagar.me recipient ID not found for shopkeeper ${item.shopkeeper_id}.`);
        throw new Error(`ID do recebedor Pagar.me não encontrado para o lojista ${item.shopkeeper_id}.`);
      }

      splitRules.push({
        recipient_id: recipientId,
        amount: amountToShopkeeperForThisItem,
        liable: true,
        charge_processing_fee: true,
        type: 'flat', // Adicionado o campo 'type'
      });
    }

    // Calculate the total commission for the platform
    const totalCommissionInCents = totalAmountInCents - totalAmountToShopkeepersInCents;

    // Add the platform's split rule if there's commission
    if (totalCommissionInCents > 0) {
      splitRules.push({
        recipient_id: platformRecipientId,
        amount: totalCommissionInCents,
        liable: false,
        charge_processing_fee: false,
        type: 'flat', // Adicionado o campo 'type'
      });
    }

    // Validate that the sum of split rules equals the total amount
    const sumOfSplitAmounts = splitRules.reduce((sum, rule) => sum + rule.amount, 0);
    if (sumOfSplitAmounts !== totalAmountInCents) {
      console.error('create-pagarme-payment: Split rules total amount does not match transaction total amount.', { sumOfSplitAmounts, totalAmountInCents });
      return new Response(JSON.stringify({ error: 'Configuração de divisão de pagamento inválida: a soma dos valores de split não corresponde ao total da transação.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('create-pagarme-payment: Split Rules:', JSON.stringify(splitRules));
    // --- End build split rules ---

    // Fetch buyer's profile to get first_name, last_name
    const { data: buyerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', buyer_id)
      .single();

    let customerName = user.email; // Fallback padrão
    if (buyerProfile) {
      const firstName = buyerProfile.first_name || '';
      const lastName = buyerProfile.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        customerName = fullName;
      }
    }
    console.log('create-pagarme-payment: Customer Name:', customerName);

    // --- Lógica de formatação e validação do número de telefone ---
    let formattedPhoneNumber: string | null = null;
    const phoneRegex = /^\+(?:[0-9] ?){6,14}[0-9]$/;

    if (customer_phone_number) {
      const cleaned = customer_phone_number.replace(/\D/g, '');
      if (cleaned.length >= 10 && cleaned.length <= 11 && !customer_phone_number.startsWith('+')) {
        formattedPhoneNumber = `+55${cleaned}`;
      } else if (customer_phone_number.startsWith('+')) {
        formattedPhoneNumber = customer_phone_number;
      } else {
        formattedPhoneNumber = `+${cleaned}`;
      }
    }

    const customerData: any = {
      external_id: user.id,
      name: customerName,
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

    if (formattedPhoneNumber) {
      if (!phoneRegex.test(formattedPhoneNumber)) {
        console.error('create-pagarme-payment: Invalid phone number format after formatting:', formattedPhoneNumber);
        return new Response(JSON.stringify({ error: 'Número de telefone inválido. Por favor, verifique o formato no seu perfil (ex: +5511999999999).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      customerData.phone_numbers = [formattedPhoneNumber];
    } else {
      console.warn('create-pagarme-payment: customer_phone_number was null or empty after CartPage validation. This should not happen if it is mandatory.');
      return new Response(JSON.stringify({ error: 'Número de telefone do cliente é obrigatório e não foi fornecido ou é inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('create-pagarme-payment: Customer Data:', JSON.stringify(customerData));
    // --- Fim da lógica de formatação e validação do número de telefone ---

    // --- Construção e validação do objeto billing ---
    const billingData = {
      name: customerName,
      address: {
        country: 'br',
        state: customer_address_state,
        city: customer_address_city,
        neighborhood: customer_address_district,
        street: customer_address_street,
        street_number: customer_address_number,
        zip_code: customer_address_postal_code.replace(/\D/g, ''), // CORRIGIDO: zip_code
        complementary_info: customer_address_complement || '', 
      },
    };
    console.log('create-pagarme-payment: Billing Data:', JSON.stringify(billingData));
    // --- Fim da construção e validação do objeto billing ---

    const pagarmeApiUrl = 'https://api.pagar.me/core/v5/orders'; // API v5 para Orders

    const orderPayload = {
      customer: customerData,
      items: cartItems.map((item: any) => ({
        amount: Math.round(item.price * 100), // Preço unitário em centavos
        description: item.name,
        quantity: item.quantity,
        code: item.id, // Usar ID do produto como código
      })),
      payments: [
        {
          payment_method: 'checkout', // Usar checkout hospedado
          checkout: {
            customer_editable: false,
            billing_address_editable: false,
            accepted_payment_methods: ['credit_card', 'pix'], // Aceitar cartão de crédito e Pix
            success_url: `${app_url}/pagarme-return?status=success`,
            cancel_url: `${app_url}/pagarme-return?status=failure`,
            pix: { // Adicionado o objeto pix
              expires_in: 3600, // Expira em 1 hora (em segundos)
              qr_code_expiration_seconds: 3600, // Adicionado este campo
            },
          },
          split: splitRules.map(rule => ({
            recipient_id: rule.recipient_id,
            amount: rule.amount,
            options: {
              charge_processing_fee: rule.charge_processing_fee,
              charge_remainder_fee: rule.charge_remainder_fee,
              liable: rule.liable,
            },
            type: rule.type, // Adicionado o campo 'type' aqui também
          })),
        },
      ],
      billing: billingData,
      shipping: { // Pagar.me exige shipping mesmo que não seja físico
        address: { // O endereço de shipping precisa de todos os campos, incluindo zip_code
          country: 'br',
          state: customer_address_state,
          city: customer_address_city,
          neighborhood: customer_address_district,
          street: customer_address_street,
          street_number: customer_address_number,
          zip_code: customer_address_postal_code.replace(/\D/g, ''), // CORRIGIDO: zip_code
          complementary_info: customer_address_complement || '', 
        },
        description: "Entrega padrão",
        amount: 0, // Custo de frete, se houver
        recipient_name: customerName,
        service_code: "STANDARD", 
        delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Data de entrega futura (ex: 7 dias)
      },
      metadata: { // Adicionando metadata para o webhook
        buyer_id: buyer_id,
        commission_rate: commission_rate.toString(),
        cartItems: JSON.stringify(cartItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          shopkeeper_id: item.shopkeeper_id,
        }))),
      },
    };

    console.log('create-pagarme-payment: Pagar.me Order Payload (full, non-sensitive fields):', JSON.stringify(orderPayload, null, 2));

    const pagarmeResponse = await fetch(pagarmeApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(pagarmeApiKey + ':')}`, // API Key no formato Basic Auth
      },
      body: JSON.stringify(orderPayload),
    });

    const responseData = await pagarmeResponse.json();
    console.log('create-pagarme-payment: Pagar.me API Response:', JSON.stringify(responseData));

    if (!pagarmeResponse.ok) {
      console.error('create-pagarme-payment: Pagar.me API Error:', responseData);
      let errorMessage = 'Erro ao criar pedido no Pagar.me.';
      if (responseData.errors && typeof responseData.errors === 'object') {
        errorMessage = Object.entries(responseData.errors).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
      } else if (responseData.message) {
        errorMessage = responseData.message;
      }
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: pagarmeResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CORREÇÃO AQUI: Usar responseData.checkouts[0].payment_url
    if (responseData.checkouts && responseData.checkouts.length > 0 && responseData.checkouts[0].payment_url) {
      return new Response(JSON.stringify({ checkout_url: responseData.checkouts[0].payment_url }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error('create-pagarme-payment: Pagar.me order creation did not return a payment_url:', responseData);
      return new Response(JSON.stringify({ error: 'Falha ao obter URL de checkout do Pagar.me.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('create-pagarme-payment: Error creating Pagar.me payment:', error);
    let clientErrorMessage = 'Ocorreu um erro inesperado ao processar seu pagamento.';

    if (error instanceof Error) {
      clientErrorMessage = error.message;
    }

    return new Response(JSON.stringify({ error: clientErrorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});