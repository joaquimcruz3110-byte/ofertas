/// <reference types="https://deno.land/std@0.190.0/http/server.d.ts" />
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => { // Adicionado tipo Request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Could not get user session.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { cartItems, buyerId, returnUrl } = await req.json();

    if (!cartItems || !buyerId || !returnUrl) {
      return new Response(JSON.stringify({ error: 'Missing required fields: cartItems, buyerId, returnUrl' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch buyer profile for payment details
    const { data: buyerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, email, cpf, phone_number, address_street, address_number, address_complement, address_district, address_postal_code, address_city, address_state')
      .eq('id', buyerId)
      .single();

    if (profileError || !buyerProfile) {
      console.error('Error fetching buyer profile:', profileError?.message);
      return new Response(JSON.stringify({ error: 'Buyer profile not found or incomplete.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const salesToInsert = [];
    const paymentItems = [];
    let totalAmount = 0;

    for (const item of cartItems) {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, price, quantity, shopkeeper_id')
        .eq('id', item.id)
        .single();

      if (productError || !product) {
        console.error(`Product ${item.id} not found:`, productError?.message);
        return new Response(JSON.stringify({ error: `Product ${item.name} not found.` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (product.quantity < item.quantity) {
        return new Response(JSON.stringify({ error: `Insufficient stock for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch commission rate
      const { data: commissionRateData, error: commissionError } = await supabase
        .from('commission_rates')
        .select('rate')
        .eq('active', true)
        .order('set_date', { ascending: false })
        .limit(1)
        .single();

      if (commissionError || !commissionRateData) {
        console.error('Error fetching active commission rate:', commissionError?.message);
        return new Response(JSON.stringify({ error: 'Commission rate not found.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const commissionRate = commissionRateData.rate;

      const itemTotalPrice = product.price * item.quantity;
      totalAmount += itemTotalPrice;

      salesToInsert.push({
        product_id: product.id,
        buyer_id: buyerId,
        quantity: item.quantity,
        total_price: itemTotalPrice,
        commission_rate: commissionRate,
        payment_gateway_status: 'pending', // Initial status
      });

      paymentItems.push({
        sku_number: product.id,
        category: product.category || 'miscellaneous',
        title: product.name,
        description: product.description || product.name,
        unit_price: product.price,
        quantity: item.quantity,
        unit_measure: 'unit',
        total_amount: itemTotalPrice,
      });
    }

    // Fetch shopkeeper's Mercado Pago credentials
    const { data: shopkeeperPreferences, error: mpPrefError } = await supabase
      .from('mercadopago_preferences')
      .select('access_token, public_key')
      .eq('shopkeeper_id', cartItems[0].shopkeeper_id) // Assuming all items are from the same shopkeeper for simplicity
      .single();

    if (mpPrefError || !shopkeeperPreferences) {
      console.error('Error fetching Mercado Pago preferences:', mpPrefError?.message);
      return new Response(JSON.stringify({ error: 'Shopkeeper Mercado Pago credentials not found.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mercadopagoApiBase = Deno.env.get('MERCADOPAGO_API_BASE') || 'https://api.mercadopago.com';
    const mercadopagoAccessToken = shopkeeperPreferences.access_token;

    const paymentData = {
      transaction_amount: totalAmount,
      description: `Compra de produtos no Olímpia Ofertas`,
      payment_method_id: 'pix',
      payer: {
        email: user.email,
        first_name: buyerProfile.first_name,
        last_name: buyerProfile.last_name,
        identification: {
          type: 'CPF',
          number: buyerProfile.cpf,
        },
        address: {
          zip_code: buyerProfile.address_postal_code,
          street_name: buyerProfile.address_street,
          street_number: buyerProfile.address_number,
          neighborhood: buyerProfile.address_district,
          city: buyerProfile.address_city,
          federal_unit: buyerProfile.address_state,
        },
      },
      external_reference: buyerId, // Use buyerId as external reference
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
      items: paymentItems,
    };

    const mpResponse = await fetch(`${mercadopagoApiBase}/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mercadopagoAccessToken}`,
      },
      body: JSON.stringify(paymentData),
    });

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.json();
      console.error('Mercado Pago API error:', errorBody);
      return new Response(JSON.stringify({ error: 'Failed to create Mercado Pago payment', details: errorBody }), {
        status: mpResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpPayment = await mpResponse.json();

    // Update sales with payment_gateway_id
    const salesWithPaymentId = salesToInsert.map(sale => ({
      ...sale,
      payment_gateway_id: mpPayment.id.toString(),
    }));

    const { data: insertedSales, error: insertSalesError } = await supabase
      .from('sales')
      .insert(salesWithPaymentId)
      .select('id');

    if (insertSalesError) {
      console.error('Error inserting sales:', insertSalesError.message);
      // Consider rolling back Mercado Pago payment if possible, or handle reconciliation
      return new Response(JSON.stringify({ error: 'Failed to record sales in database.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      qr_code_base64: mpPayment.point_of_interaction.transaction_data.qr_code_base64,
      qr_code: mpPayment.point_of_interaction.transaction_data.qr_code,
      payment_id: mpPayment.id,
      sales_ids: insertedSales.map((s: { id: string }) => s.id), // Adicionado tipo explícito
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) { // Adicionado tipo unknown
    console.error('Error in create-mercadopago-payment:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: (error as Error).message }), { // Type assertion
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});