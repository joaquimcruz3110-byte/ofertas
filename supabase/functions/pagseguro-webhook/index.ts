// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SaleToUpdate {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  total_price: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // A nova API do PagSeguro envia webhooks em JSON
    const pagseguroNotification = await req.json();
    console.log('Received PagSeguro Webhook (New API):', pagseguroNotification);

    const { reference_id, status } = pagseguroNotification; // Extrair do payload JSON

    if (!reference_id || !status) {
      return new Response(JSON.stringify({ error: 'Missing reference_id or status in webhook payload.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Mapear status do PagSeguro (nova API) para um status interno
    let internalStatus = 'pending';
    switch (status) {
      case 'PAID':
        internalStatus = 'completed';
        break;
      case 'APPROVED': // Pode ser usado para Pix aprovado
        internalStatus = 'completed';
        break;
      case 'DECLINED':
        internalStatus = 'failed';
        break;
      case 'CANCELLED':
        internalStatus = 'cancelled';
        break;
      case 'REFUNDED':
        internalStatus = 'refunded';
        break;
      case 'IN_REVIEW': // Em análise
        internalStatus = 'pending';
        break;
      default:
        internalStatus = 'unknown';
    }

    // Buscar vendas associadas a este reference_id que ainda estão pendentes
    const { data: salesToUpdate, error: fetchSalesError } = await supabaseServiceRoleClient
      .from('sales')
      .select('id, product_id, buyer_id, quantity, total_price')
      .eq('payment_gateway_id', reference_id)
      .eq('payment_gateway_status', 'pending'); // Apenas atualiza vendas pendentes

    if (fetchSalesError) {
      console.error('Error fetching sales for webhook:', fetchSalesError.message);
      throw new Error('Failed to fetch sales for webhook: ' + fetchSalesError.message);
    }

    if (salesToUpdate && salesToUpdate.length > 0) {
      if (internalStatus === 'completed') {
        for (const sale of salesToUpdate) {
          // Obter a taxa de comissão ativa
          const { data: commissionRateData, error: commissionError } = await supabaseServiceRoleClient
            .from('commission_rates')
            .select('rate')
            .eq('active', true)
            .order('set_date', { ascending: false })
            .limit(1)
            .single();

          if (commissionError || !commissionRateData) {
            console.warn('No active commission rate found, using default 10%.', commissionError?.message);
          }
          const commissionRate = commissionRateData?.rate || 10; // Default to 10% if not found

          // Decrementar a quantidade do produto (se ainda não foi feito)
          const { error: updateProductError } = await supabaseServiceRoleClient
            .from('products')
            .update({ quantity: (prevQuantity: number) => prevQuantity - sale.quantity })
            .eq('id', sale.product_id)
            .gte('quantity', sale.quantity); // Garante que não vai para negativo

          if (updateProductError) {
            console.error(`Error updating product quantity for sale ${sale.id}:`, updateProductError.message);
            throw new Error(`Failed to update product quantity for sale ${sale.id}: ${updateProductError.message}`);
          }

          // Atualizar a venda existente para 'completed' e definir a comissão
          const { error: updateSaleError } = await supabaseServiceRoleClient
            .from('sales')
            .update({
              payment_gateway_status: internalStatus,
              commission_rate: commissionRate,
            })
            .eq('id', sale.id);

          if (updateSaleError) {
            console.error(`Error updating sale ${sale.id} status:`, updateSaleError.message);
            throw new Error(`Failed to update sale ${sale.id} status: ${updateSaleError.message}`);
          }
        }
      } else {
        // Se o status não for 'completed', apenas atualiza o status da venda
        const { error: updateSaleError } = await supabaseServiceRoleClient
          .from('sales')
          .update({ payment_gateway_status: internalStatus })
          .in('id', salesToUpdate.map((s: SaleToUpdate) => s.id));

        if (updateSaleError) {
          console.error('Error updating sales status for webhook:', updateSaleError.message);
          throw new Error('Failed to update sales status for webhook: ' + updateSaleError.message);
        }
      }
    } else {
      console.warn(`No pending sales found for reference_id: ${reference_id} or already processed.`);
    }

    return new Response(JSON.stringify({ message: 'Webhook processed successfully.' }), {
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