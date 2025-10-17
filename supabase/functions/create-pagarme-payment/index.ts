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
    if (!customer_address_street || !customer_address_number || !customer_address_district || !customer_address_postal_code || !customer_address_city || !customer_address_state) {
      console.error('create-pagarme-payment: Missing required billing address fields.', { customer_address_street, customer_address_number, customer_address_district, customer_address_postal_code, customer_address_city, customer_address_state });
      return new Response(JSON.stringify({ error: 'Campos obrigatórios do endereço de cobrança ausentes. Por favor, complete seu perfil.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pagarmeApiKey = Deno.env.get('PAGARME_API_KEY');
    console.log('create-pagarme-payment: PAGARME_API_KEY (first 5 chars):', pagarmeApiKey ? pagarmeApiKey.substring(0, 5) : 'N/A');
    if (!pagarmeApiKey) {
      console.error('create-pagarme-payment: PAGARME_API_KEY not set.');
      return new Response(JSON.stringify({ error: 'Pagar.me API Key não configurada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const platformRecipientId = Deno.env.get('PAGARME_PLATFORM_RECIPIENT_ID');
    console.log('create-pagarme-payment: PAGARME_PLATFORM_RECIPIENT_ID:', platformRecipientId);
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
    console.log('create-pagarme-payment: Cleaned CPF for document:', cleanedCpf);
    
    if (cleanedCpf.length !== 11) {
      console.error('create-pagarme-payment: Invalid CPF length after cleaning:', cleanedCpf);
      return new Response(JSON.stringify({ error: 'CPF inválido. Por favor, verifique seu perfil e insira um CPF com 11 dígitos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Calculate total amount for the entire order in cents ---
    const totalOrderGrossAmountInCents = Math.round(cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) * 100);
    console.log('create-pagarme-payment: Total order gross amount in cents:', totalOrderGrossAmountInCents);

    // --- Build split rules using percentages ---
    const splitRules = [];
    let totalCalculatedPercentage = 0; // Para verificar a soma final

    // Calculate gross share for each shopkeeper
    const shopkeeperGrossShares = new Map<string, number>(); // shopkeeperId -> gross amount in cents
    for (const item of cartItems) {
      const currentGross = shopkeeperGrossShares.get(item.shopkeeper_id) || 0;
      shopkeeperGrossShares.set(item.shopkeeper_id, currentGross + Math.round(item.price * item.quantity * 100));
    }

    // 1. Add rules for each shopkeeper
    for (const [shopkeeperId, grossShareInCents] of shopkeeperGrossShares.entries()) {
      const recipientId = shopkeeperPagarmeRecipients.get(shopkeeperId);
      if (!recipientId) {
        console.error(`create-pagarme-payment: Pagar.me recipient ID not found for shopkeeper ${shopkeeperId}.`);
        throw new Error(`ID do recebedor Pagar.me não encontrado para o lojista ${shopkeeperId}.`);
      }

      let percentageForShopkeeper = 0;
      if (totalOrderGrossAmountInCents > 0) {
        const proportionOfTotalShopkeeperGross = grossShareInCents / totalOrderGrossAmountInCents;
        percentageForShopkeeper = proportionOfTotalShopkeeperGross * (100 - commission_rate);
      }
      
      const roundedPercentageForShopkeeper = Math.round(percentageForShopkeeper);

      splitRules.push({
        recipient_id: recipientId,
        amount: roundedPercentageForShopkeeper,
        type: 'percentage',
        options: {
          liable: true,
          charge_processing_fee: true,
        },
      });
      totalCalculatedPercentage += percentageForShopkeeper;
    }

    // 2. Add rule for the platform (commission)
    const platformCommissionPercentage = Math.round(commission_rate);
    console.log('create-pagarme-payment: Platform Commission Rate (rounded):', platformCommissionPercentage);
    if (platformCommissionPercentage > 0) {
      splitRules.push({
        recipient_id: platformRecipientId,
        amount: platformCommissionPercentage,
        type: 'percentage',
        options: {
          liable: false,
          charge_processing_fee: false,
        },
      });
      totalCalculatedPercentage += commission_rate;
      console.log('create-pagarme-payment: Platform rule added to splitRules.');
    } else {
      console.log('create-pagarme-payment: Platform commission is 0, no platform rule added.');
    }

    // Ajustar a porcentagem da plataforma para garantir que a soma seja exatamente 100%
    const roundedSum = splitRules.reduce((sum, rule) => sum + rule.amount, 0);
    if (roundedSum !== 100) {
      const difference = 100 - roundedSum;
      let platformRule = splitRules.find(rule => rule.recipient_id === platformRecipientId);
      
      if (platformRule) {
        platformRule.amount += difference;
        console.warn(`create-pagarme-payment: Adjusted platform percentage by ${difference} to ensure sum is 100.`);
      } else {
        console.error('create-pagarme-payment: Platform recipient rule not found for adjustment! Adding a new rule for platform.');
        splitRules.push({
          recipient_id: platformRecipientId,
          amount: platformCommissionPercentage + difference,
          type: 'percentage',
          options: {
            liable: false,
            charge_processing_fee: false,
          },
        });
      }
    }

    console.log('create-pagarme-payment: Final Split Rules Array (after adjustment):', JSON.stringify(splitRules));
    // --- End build split rules ---

    // Fetch buyer's profile to get first_name, last_name
    const { data: buyerProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', buyer_id)
      .single();

    let customerName = user.email;
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
    let customerPhones: any = {};
    console.log('create-pagarme-payment: Raw customer_phone_number:', customer_phone_number);
    if (customer_phone_number) {
      let cleanedPhoneNumber = customer_phone_number.replace(/\D/g, '');
      console.log('create-pagarme-payment: Cleaned phone number:', cleanedPhoneNumber);

      let countryCode = '55';
      let areaCode = '';
      let number = '';
      let numberToParse = cleanedPhoneNumber;

      if (cleanedPhoneNumber.startsWith('55') && cleanedPhoneNumber.length > 11) {
        numberToParse = cleanedPhoneNumber.substring(2);
      }

      if (numberToParse.length === 11) {
        areaCode = numberToParse.substring(0, 2);
        number = numberToParse.substring(2);
      } else if (numberToParse.length === 10) {
        areaCode = numberToParse.substring(0, 2);
        number = numberToParse.substring(2);
      } else {
        console.error('create-pagarme-payment: Phone number length is not standard for Brazilian numbers (10 or 11 digits after DDD):', cleanedPhoneNumber);
        return new Response(JSON.stringify({ error: 'Número de telefone inválido. Por favor, verifique o formato no seu perfil (ex: DDXXXXXXXXX).' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('create-pagarme-payment: Parsed phone components - countryCode:', countryCode, 'areaCode:', areaCode, 'number:', number);

      if (countryCode && areaCode && number) {
        customerPhones = {
          mobile_phone: {
            country_code: countryCode,
            area_code: areaCode,
            number: number,
          },
          home_phone: {
            country_code: countryCode,
            area_code: areaCode,
            number: number,
          }
        };
      } else {
        console.error('create-pagarme-payment: Failed to parse phone number components (areaCode or number missing):', { cleanedPhoneNumber, countryCode, areaCode, number });
        return new Response(JSON.stringify({ error: 'Não foi possível formatar o número de telefone para o Pagar.me. Verifique o formato no seu perfil.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.error('create-pagarme-payment: Customer phone number is missing or empty.');
      return new Response(JSON.stringify({ error: 'Número de telefone do cliente é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('create-pagarme-payment: Constructed customerPhones object:', JSON.stringify(customerPhones));
    // --- Fim da lógica de formatação e validação do número de telefone ---

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
      phones: customerPhones,
    };
    console.log('create-pagarme-payment: Final Customer Data before Pagar.me API call:', JSON.stringify(customerData));
    
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
        zip_code: customer_address_postal_code.replace(/\D/g, ''),
        complementary_info: customer_address_complement || '', 
      },
    };
    console.log('create-pagarme-payment: Billing Data:', JSON.stringify(billingData));
    // --- Fim da construção e validação do objeto billing ---

    const pagarmeApiUrl = 'https://api.pagar.me/core/v5/orders';

    const orderPayload = {
      customer: customerData,
      items: cartItems.map((item: any) => ({
        amount: Math.round(item.price * 100),
        description: item.name,
        quantity: item.quantity,
        code: item.id,
      })),
      payments: [
        {
          payment_method: 'pix',
          pix: {
            expires_in: 3600,
            qr_code_expiration_seconds: 3600,
          },
          split: splitRules.map(rule => ({
            recipient_id: rule.recipient_id,
            amount: rule.amount,
            options: rule.options,
            type: rule.type,
          })),
          // Adicionando redirect_url para garantir que o Pagar.me retorne o status
          redirect_url: `${app_url}/pagarme-return?status=success`, // Pagar.me pode sobrescrever o status
        },
      ],
      billing: billingData,
      shipping: {
        address: {
          country: 'br',
          state: customer_address_state,
          city: customer_address_city,
          neighborhood: customer_address_district,
          street: customer_address_street,
          street_number: customer_address_number,
          zip_code: customer_address_postal_code.replace(/\D/g, ''),
          complementary_info: customer_address_complement || '', 
        },
        description: "Entrega padrão",
        amount: 0,
        recipient_name: customerName,
        service_code: "STANDARD", 
        delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      metadata: {
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

    console.log('create-pagarme-payment: Sending Pagar.me Order Payload:', JSON.stringify(orderPayload, null, 2));

    const pagarmeResponse = await fetch(pagarmeApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(pagarmeApiKey + ':')}`,
      },
      body: JSON.stringify(orderPayload),
    });

    const responseData = await pagarmeResponse.json();
    console.log('create-pagarme-payment: Pagar.me API Response:', JSON.stringify(responseData, null, 2)); // Log com pretty print
    console.log('create-pagarme-payment: Pagar.me API Response - Charges:', JSON.stringify(responseData.charges, null, 2)); // Log com pretty print

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

    // Verificar se charges[0].last_transaction existe e se a transação foi bem-sucedida
    if (responseData.charges && responseData.charges.length > 0 && responseData.charges[0].last_transaction) {
      const lastTransaction = responseData.charges[0].last_transaction;
      console.log('create-pagarme-payment: Pagar.me last_transaction details:', JSON.stringify(lastTransaction, null, 2)); // Log detalhado da transação com pretty print

      // Se a transação falhou, extrair e retornar os erros do gateway
      if (lastTransaction.status === 'failed' && lastTransaction.gateway_response && lastTransaction.gateway_response.errors) {
        console.error('create-pagarme-payment: Pagar.me Gateway Errors:', JSON.stringify(lastTransaction.gateway_response.errors, null, 2)); // Log com pretty print
        
        const gatewayErrors = lastTransaction.gateway_response.errors
            .map((err: any) => {
                if (typeof err === 'string') {
                    return err;
                } else if (err && typeof err === 'object' && err.message) {
                    return err.message;
                } else {
                    return JSON.stringify(err); // Fallback para stringify o objeto completo
                }
            })
            .join('; ');

        return new Response(JSON.stringify({ error: `Erro no gateway de pagamento: ${gatewayErrors}` }), {
          status: 400, // Retorna 400 porque é um erro de validação do Pagar.me
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Se a transação foi bem-sucedida, retornar o QR code e a chave copia e cola
      if (lastTransaction.qr_code_url && (lastTransaction.qr_code_base64 || lastTransaction.payload)) {
        return new Response(JSON.stringify({
          pix_qr_code_url: lastTransaction.qr_code_url,
          pix_copy_paste_key: lastTransaction.qr_code_base64 || lastTransaction.payload, // Prioriza qr_code_base64, fallback para payload
          order_id: responseData.id,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    // Se chegarmos aqui, significa que os dados esperados não foram encontrados na resposta ou a transação não foi bem-sucedida e não houve erros específicos do gateway
    console.error('create-pagarme-payment: Pagar.me Pix payment creation did not return QR code or copy-paste key as expected, or transaction failed without specific gateway errors:', JSON.stringify(responseData, null, 2));
    return new Response(JSON.stringify({ error: 'Falha ao obter dados do Pix do Pagar.me ou transação não concluída. Verifique os logs da função para mais detalhes.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('create-pagarme-payment: Unhandled error during Pagar.me payment creation:', error);
    let clientErrorMessage = 'Ocorreu um erro inesperado ao processar seu pagamento.';

    if (error instanceof Error) {
      clientErrorMessage = error.message;
    } else if (typeof error === 'string') {
      clientErrorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      clientErrorMessage = error.message;
    } else {
      clientErrorMessage = JSON.stringify(error);
    }

    return new Response(JSON.stringify({ error: clientErrorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});