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
    // PagSeguro envia notificações via POST com application/x-www-form-urlencoded
    const body = await req.text();
    const params = new URLSearchParams(body);
    const notificationCode = params.get('notificationCode');
    const notificationType = params.get('notificationType');

    console.log('Received PagSeguro Webhook:', { notificationCode, notificationType });

    if (notificationType !== 'transaction') {
      return new Response(JSON.stringify({ message: 'Ignoring non-transaction notification.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!notificationCode) {
      return new Response(JSON.stringify({ error: 'Missing notificationCode in webhook payload.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // @ts-ignore
    const pagseguroEmail = Deno.env.get('PAGSEGURO_EMAIL');
    // @ts-ignore
    const pagseguroToken = Deno.env.get('PAGSEGURO_TOKEN');
    // @ts-ignore
    const pagseguroApiBase = Deno.env.get('PAGSEGURO_API_BASE') || 'https://ws.sandbox.pagseguro.uol.com.br';

    if (!pagseguroEmail || !pagseguroToken) {
      throw new Error('PagSeguro API credentials are not configured for webhook.');
    }

    // Consultar a transação no PagSeguro para obter detalhes
    const transactionResponse = await fetch(`${pagseguroApiBase}/v2/transactions/notifications/${notificationCode}?email=${pagseguroEmail}&token=${pagseguroToken}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/xml; charset=ISO-8859-1',
      },
    });

    if (!transactionResponse.ok) {
      const errorText = await transactionResponse.text();
      console.error('PagSeguro transaction query error:', errorText);
      throw new Error(`Failed to query PagSeguro transaction: ${transactionResponse.status} - ${errorText}`);
    }

    const transactionXml = await transactionResponse.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(transactionXml, "text/xml");

    const transactionStatusElement = xmlDoc.getElementsByTagName("status")[0];
    const transactionReferenceElement = xmlDoc.getElementsByTagName("reference")[0];

    const pagseguroStatus = transactionStatusElement ? transactionStatusElement.textContent : null;
    const referenceId = transactionReferenceElement ? transactionReferenceElement.textContent : null;

    if (!pagseguroStatus || !referenceId) {
      throw new Error('Could not extract status or reference from PagSeguro transaction XML.');
    }

    const supabaseServiceRoleClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Mapear status do PagSeguro para um status interno
    let internalStatus = 'pending';
    switch (pagseguroStatus) {
      case '1': // Aguardando pagamento
        internalStatus = 'pending';
        break;
      case '2': // Em análise
        internalStatus = 'pending';
        break;
      case '3': // Paga
        internalStatus = 'completed';
        break;
      case '4': // Disponível (PagSeguro liberou o valor)
        internalStatus = 'completed';
        break;
      case '5': // Em disputa
        internalStatus = 'disputed';
        break;
      case '6': // Devolvida
        internalStatus = 'refunded';
        break;
      case '7': // Cancelada
        internalStatus = 'cancelled';
        break;
      case '8': // Debitado
        internalStatus = 'completed'; // Ou um status mais específico se necessário
        break;
      case '9': // Retenção temporária
        internalStatus = 'pending';
        break;
      default:
        internalStatus = 'unknown';
    }

    // Buscar vendas associadas a este referenceId que ainda estão pendentes
    const { data: salesToUpdate, error: fetchSalesError } = await supabaseServiceRoleClient
      .from('sales')
      .select('id, product_id, buyer_id, quantity, total_price')
      .eq('payment_gateway_id', referenceId)
      .eq('payment_gateway_status', 'pending');

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
          const commissionRate = commissionRateData?.rate || 10;

          // Decrementar a quantidade do produto
          const { error: updateProductError } = await supabaseServiceRoleClient
            .from('products')
            .update({ quantity: (prevQuantity: number) => prevQuantity - sale.quantity })
            .eq('id', sale.product_id)
            .gte('quantity', sale.quantity);

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
      console.warn(`No pending sales found for referenceId: ${referenceId} or already processed.`);
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