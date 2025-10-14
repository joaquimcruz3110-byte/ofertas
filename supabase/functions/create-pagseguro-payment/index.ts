// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ProductData {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Bearer token missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUserClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseUserClient.auth.getUser();

    if (userError || !user) {
      console.error('Error verifying user token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const { cartItems } = await req.json();

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Cart items are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // @ts-ignore
    const pagseguroEmail = Deno.env.get('PAGSEGURO_EMAIL');
    // @ts-ignore
    const pagseguroToken = Deno.env.get('PAGSEGURO_TOKEN');
    // @ts-ignore
    const pagseguroApiBase = Deno.env.get('PAGSEGURO_API_BASE') || 'https://ws.sandbox.pagseguro.uol.com.br'; // Usar sandbox por padrão
    // @ts-ignore
    const pagseguroCheckoutBase = Deno.env.get('PAGSEGURO_CHECKOUT_BASE') || 'https://sandbox.pagseguro.uol.com.br/v2/checkout/payment.html'; // Usar sandbox por padrão

    if (!pagseguroEmail || !pagseguroToken) {
      throw new Error('PagSeguro API credentials are not configured.');
    }

    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar detalhes do perfil do usuário para o senderName
    const { data: profileData, error: profileError } = await supabaseServiceRoleClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError.message);
      // Não lançar erro fatal, usar fallback
    }

    const senderFirstName = profileData?.first_name || 'Cliente';
    const senderLastName = profileData?.last_name || 'Olímpia Ofertas';
    const senderName = `${senderFirstName} ${senderLastName}`.trim();

    // **Ajuste aqui: Garantir que senderEmail seja diferente do email do vendedor**
    let senderEmail = user.email || 'comprador@example.com';
    if (senderEmail === pagseguroEmail) {
      senderEmail = 'comprador.teste@sandbox.pagseguro.com.br'; // E-mail de teste diferente
      console.warn(`Sender email matched seller email. Changed senderEmail to: ${senderEmail}`);
    }
    // Fim do ajuste

    // Buscar detalhes do produto para garantir que preços e quantidades estejam corretos
    const productIds = cartItems.map((item: CartItem) => item.id);
    const { data: productsData, error: productsError } = await supabaseServiceRoleClient
      .from('products')
      .select('id, name, price, quantity')
      .in('id', productIds);

    if (productsError) {
      throw new Error('Failed to fetch product details: ' + productsError.message);
    }

    const productsMap = new Map<string, ProductData>(productsData.map((p: ProductData) => [p.id, p]));

    let totalAmount = 0;
    let itemCounter = 1;
    const pagseguroItems = cartItems.map((item: CartItem) => {
      const product = productsMap.get(item.id);
      if (!product) {
        throw new Error(`Product with ID ${item.id} not found.`);
      }
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
      }
      totalAmount += product.price * item.quantity;
      return `itemId${itemCounter}=${item.id}&itemDescription${itemCounter}=${product.name}&itemAmount${itemCounter}=${product.price.toFixed(2)}&itemQuantity${itemCounter++}=${item.quantity}`;
    }).join('&');

    const referenceId = `order_${Date.now()}_${user.id.substring(0, 8)}`; // ID de referência único
    
    const pagseguroPaymentBody = new URLSearchParams({
      email: pagseguroEmail,
      token: pagseguroToken,
      currency: 'BRL',
      reference: referenceId,
      // Simplificando a redirectURL para evitar o erro de comprimento
      // @ts-ignore
      redirectURL: `${Deno.env.get('VITE_APP_URL')}/pagseguro-return?referenceId=${referenceId}&buyer_id=${user.id}`,
      // @ts-ignore
      notificationURL: `${Deno.env.get('VITE_APP_URL')}/functions/v1/pagseguro-webhook`,
      senderName: senderName, // Usando o nome real do perfil
      senderAreaCode: '11', // Código de área de São Paulo
      senderPhone: '999999999', // Telefone de 9 dígitos
      senderEmail: senderEmail, // Usando o e-mail ajustado
      shippingType: '1', // 1 = PAC, 2 = SEDEX, 3 = Não especificado
      shippingAddressStreet: 'Avenida Paulista', // Endereço de teste
      shippingAddressNumber: '1578', // Número de teste
      shippingAddressComplement: 'Conjunto 100', // Complemento de teste
      shippingAddressDistrict: 'Bela Vista', // Bairro de teste
      shippingAddressPostalCode: '01310200', // CEP válido para São Paulo
      shippingAddressCity: 'Sao Paulo', // Cidade de teste
      shippingAddressState: 'SP', // Estado de teste
      shippingAddressCountry: 'BRA',
    });

    // Usar um CPF válido para testes no sandbox
    pagseguroPaymentBody.append('senderCPF', '11111111111'); // CPF de teste válido para sandbox

    // Adicionar itens ao corpo da requisição
    pagseguroItems.split('&').forEach(param => {
      const [key, value] = param.split('=');
      pagseguroPaymentBody.append(key, value);
    });

    console.log('PagSeguro Request Body:', pagseguroPaymentBody.toString()); // Log do corpo da requisição

    const pagseguroResponse = await fetch(`${pagseguroApiBase}/v2/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body: pagseguroPaymentBody.toString(),
    });

    const responseText = await pagseguroResponse.text();
    console.log('PagSeguro Response Status:', pagseguroResponse.status); // Log do status da resposta
    console.log('PagSeguro Response Text:', responseText); // Log do texto completo da resposta

    if (!pagseguroResponse.ok) {
      throw new Error(`Failed to create PagSeguro payment: ${pagseguroResponse.status} - ${responseText}`);
    }
    
    // Usar regex para extrair o código de checkout
    const codeMatch = responseText.match(/<code>(.*?)<\/code>/);
    const checkoutCode = codeMatch && codeMatch[1] ? codeMatch[1] : null;

    if (!checkoutCode) {
      throw new Error('Failed to get PagSeguro checkout code from response. Response: ' + responseText);
    }

    // Registrar a intenção de venda no banco de dados com status inicial
    const { error: insertError } = await supabaseServiceRoleClient
      .from('sales')
      .insert(cartItems.map((item: CartItem) => ({
        product_id: item.id,
        buyer_id: user.id,
        quantity: item.quantity,
        total_price: item.price * item.quantity,
        commission_rate: 0, // Será atualizado pelo webhook ou na captura final
        payment_gateway_id: referenceId, // Usar o referenceId interno
        payment_gateway_status: 'pending', // Status inicial
      })));

    if (insertError) {
      console.error('Error inserting pending sales:', insertError.message);
      throw new Error('Failed to record pending sales in database: ' + insertError.message);
    }

    return new Response(JSON.stringify({
      checkoutUrl: `${pagseguroCheckoutBase}?code=${checkoutCode}`,
      referenceId: referenceId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('Edge Function error:', (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});