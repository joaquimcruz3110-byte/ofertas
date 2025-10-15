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
    const pagseguroBearerToken = Deno.env.get('PAGSEGURO_BEARER_TOKEN');
    // @ts-ignore
    const pagseguroApiBase = Deno.env.get('PAGSEGURO_API_BASE') || 'https://sandbox.api.pagseguro.com'; // Usar sandbox para desenvolvimento

    if (!pagseguroBearerToken) {
      throw new Error('PagSeguro Bearer Token is not configured.');
    }

    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar detalhes completos do perfil do usuário
    const { data: profileData, error: profileError } = await supabaseServiceRoleClient
      .from('profiles')
      .select('first_name, last_name, cpf, phone_number, address_street, address_number, address_complement, address_district, address_postal_code, address_city, address_state')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError.message);
      // Não lançar erro fatal, usar fallback
    }

    // Usar dados reais do perfil do usuário, com fallbacks genéricos se não disponíveis
    const senderFirstName = profileData?.first_name || 'Cliente';
    const senderLastName = profileData?.last_name || 'Plataforma';
    const senderEmail = user.email || 'comprador@example.com';
    
    // Limpar e validar CPF, telefone e CEP
    const cleanCpf = profileData?.cpf?.replace(/\D/g, '') || '11111111111'; // Fallback para CPF
    const cleanPhone = profileData?.phone_number?.replace(/\D/g, '') || '11999999999'; // Fallback para telefone
    const cleanPostalCode = profileData?.address_postal_code?.replace(/\D/g, '') || '00000000'; // Fallback para CEP

    const senderPhoneDdd = cleanPhone.substring(0, 2);
    const senderPhoneNumber = cleanPhone.substring(2);

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
    const pagseguroItems = cartItems.map((item: CartItem) => {
      const product = productsMap.get(item.id);
      if (!product) {
        throw new Error(`Product with ID ${item.id} not found.`);
      }
      if (product.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`);
      }
      totalAmount += product.price * item.quantity;
      return {
        name: product.name,
        quantity: item.quantity,
        unit_amount: Math.round(product.price * 100), // Preço em centavos
      };
    });

    const referenceId = `order_${Date.now()}_${user.id.substring(0, 8)}`; // ID de referência único
    
    const pagseguroPaymentBody = {
      reference_id: referenceId,
      customer: {
        name: `${senderFirstName} ${senderLastName}`.trim(),
        email: senderEmail,
        tax_id: cleanCpf,
        phones: [
          {
            country: '55',
            area: senderPhoneDdd,
            number: senderPhoneNumber,
            type: 'MOBILE',
          },
        ],
      },
      items: pagseguroItems,
      shipping: {
        address: {
          street: profileData?.address_street || 'Rua Exemplo',
          number: profileData?.address_number || '123',
          complement: profileData?.address_complement || '',
          locality: profileData?.address_district || 'Bairro Exemplo',
          city: profileData?.address_city || 'Cidade Exemplo',
          state: profileData?.address_state || 'SP',
          zip_code: cleanPostalCode,
          country: 'BRA',
        },
      },
      notification_urls: [
        // @ts-ignore
        `${Deno.env.get('VITE_APP_URL')}/functions/v1/pagseguro-webhook`,
      ],
      payment_methods: [
        {
          type: 'PIX',
          amount: {
            value: Math.round(totalAmount * 100), // Valor total em centavos
          },
        },
      ],
      // @ts-ignore
      redirect_url: `${Deno.env.get('VITE_APP_URL')}/pagseguro-return?referenceId=${referenceId}&buyer_id=${user.id}`,
    };

    console.log('PagSeguro Request Body:', JSON.stringify(pagseguroPaymentBody, null, 2));

    const pagseguroResponse = await fetch(`${pagseguroApiBase}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pagseguroBearerToken}`,
        'accept': 'application/json',
      },
      body: JSON.stringify(pagseguroPaymentBody),
    });

    // --- Adicionado para depuração ---
    console.log('PagSeguro Response Status:', pagseguroResponse.status);
    console.log('PagSeguro Response Headers:', JSON.stringify(Object.fromEntries(pagseguroResponse.headers.entries()), null, 2));
    const responseText = await pagseguroResponse.text();
    console.log('PagSeguro Raw Response Text:', responseText);
    // --- Fim da adição para depuração ---

    if (!pagseguroResponse.ok) {
      // Tenta parsear como JSON se possível, caso contrário, usa o texto bruto
      let errorDetails = responseText;
      try {
        errorDetails = JSON.parse(responseText);
      } catch (e) {
        // Não é JSON, usa o texto bruto
      }
      throw new Error(`Failed to create PagSeguro payment: ${pagseguroResponse.status} - ${JSON.stringify(errorDetails)}`);
    }
    
    const responseData = JSON.parse(responseText); // Agora parseamos o texto que já lemos
    console.log('PagSeguro Parsed Response Data:', JSON.stringify(responseData, null, 2));

    const pixPayment = responseData.payment_methods?.find((pm: any) => pm.type === 'PIX');

    if (!pixPayment || !pixPayment.qr_codes || pixPayment.qr_codes.length === 0) {
      throw new Error('Pix payment details not found in PagSeguro response.');
    }

    const qrCode = pixPayment.qr_codes[0];

    // Registrar a intenção de venda no banco de dados com status inicial
    const { error: insertError } = await supabaseServiceRoleClient
      .from('sales')
      .insert(cartItems.map((item: CartItem) => ({
        product_id: item.id,
        buyer_id: user.id,
        quantity: item.quantity,
        total_price: item.price * item.quantity,
        commission_rate: 0, // Será atualizado pelo webhook ou na captura final
        payment_gateway_id: referenceId, // Usar o referenceId
        payment_gateway_status: 'pending', // Status inicial
      })));

    if (insertError) {
      console.error('Error inserting pending sales:', insertError.message);
      throw new Error('Failed to record pending sales in database: ' + insertError.message);
    }

    return new Response(JSON.stringify({
      qrCodeBase64: qrCode.image, // Base64 da imagem do QR Code
      qrCodeText: qrCode.text,    // Código Pix "copia e cola"
      referenceId: referenceId,
      // Se houver outras opções de pagamento ou redirecionamento, o PagSeguro pode retornar um link de checkout
      // checkoutUrl: responseData.links?.find((link: any) => link.rel === 'PAY')?.href,
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