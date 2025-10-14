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
    const picpaySellerToken = Deno.env.get('PICPAY_SELLER_TOKEN');
    // @ts-ignore
    const picpayApiBase = Deno.env.get('PICPAY_API_BASE') || 'https://appws.picpay.com/ecommerce/public';

    if (!picpaySellerToken) {
      throw new Error('PicPay Seller Token is not configured.');
    }

    // 2. Criar um cliente Supabase com a service_role_key para buscar detalhes do produto
    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
    const orderItems = cartItems.map((item: CartItem) => {
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
        value: product.price.toFixed(2),
      };
    });

    const referenceId = `order_${Date.now()}_${user.id.substring(0, 8)}`; // ID de referência único
    
    const picpayPaymentBody = {
      referenceId: referenceId,
      // @ts-ignore
      callbackUrl: `${Deno.env.get('VITE_APP_URL')}/functions/v1/picpay-webhook`, // URL do webhook para notificações
      // @ts-ignore
      returnUrl: `${Deno.env.get('VITE_APP_URL')}/picpay-return?referenceId=${referenceId}&buyer_id=${user.id}&cart_items=${encodeURIComponent(JSON.stringify(cartItems))}`,
      value: totalAmount.toFixed(2),
      buyer: {
        firstName: user.user_metadata?.first_name || 'Comprador',
        lastName: user.user_metadata?.last_name || 'PicPay',
        document: '999.999.999-99', // PicPay exige um CPF/CNPJ. Usar um placeholder ou buscar do perfil.
        email: user.email,
        phone: '99999999999', // PicPay exige um telefone. Usar um placeholder ou buscar do perfil.
      },
      // Adicionar itens para melhor detalhamento no PicPay (opcional)
      items: orderItems,
    };

    const picpayResponse = await fetch(`${picpayApiBase}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-picpay-seller-token': picpaySellerToken,
      },
      body: JSON.stringify(picpayPaymentBody),
    });

    if (!picpayResponse.ok) {
      const errorDetails = await picpayResponse.json();
      console.error('PicPay payment creation error:', errorDetails);
      throw new Error(`Failed to create PicPay payment: ${picpayResponse.status} - ${JSON.stringify(errorDetails)}`);
    }

    const picpayData = await picpayResponse.json();

    // Registrar a intenção de venda no banco de dados com status inicial
    const { error: insertError } = await supabaseServiceRoleClient
      .from('sales')
      .insert(cartItems.map((item: CartItem) => ({
        product_id: item.id,
        buyer_id: user.id,
        quantity: item.quantity,
        total_price: item.price * item.quantity, // Preço unitário * quantidade
        commission_rate: 0, // Será atualizado pelo webhook ou na captura final
        payment_gateway_id: picpayData.referenceId, // Usar o referenceId do PicPay
        payment_gateway_status: 'pending', // Status inicial
      })));

    if (insertError) {
      console.error('Error inserting pending sales:', insertError.message);
      // Em caso de erro aqui, idealmente você cancelaria o pagamento no PicPay
      throw new Error('Failed to record pending sales in database: ' + insertError.message);
    }

    return new Response(JSON.stringify({
      paymentUrl: picpayData.paymentUrl,
      qrCode: picpayData.qrcode.base64,
      referenceId: picpayData.referenceId,
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