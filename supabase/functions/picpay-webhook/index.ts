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
    // O PicPay não envia Authorization header para webhooks, então não verificamos aqui.
    // A autenticação do webhook é feita via x-picpay-signature (se implementado) ou simplesmente
    // confiando que apenas o PicPay enviará para esta URL secreta.
    // Para maior segurança, você pode implementar a verificação da assinatura X-Picpay-Signature.

    const picpayNotification = await req.json();
    console.log('Received PicPay Webhook:', picpayNotification);

    const { referenceId, status } = picpayNotification; // 'value' removido

    if (!referenceId || !status) {
      return new Response(JSON.stringify({ error: 'Missing referenceId or status in webhook payload.' }), {
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

    // Mapear status do PicPay para um status interno se necessário
    let internalStatus = 'pending';
    if (status === 'paid') {
      internalStatus = 'completed';
    } else if (status === 'refunded' || status === 'chargeback') {
      internalStatus = 'refunded';
    } else if (status === 'cancelled') {
      internalStatus = 'cancelled';
    }

    // Atualizar todas as vendas associadas a este referenceId
    const { data: salesToUpdate, error: fetchSalesError } = await supabaseServiceRoleClient
      .from('sales')
      .select('id, product_id, buyer_id, quantity, total_price')
      .eq('payment_gateway_id', referenceId)
      .eq('payment_gateway_status', 'pending'); // Apenas atualiza vendas pendentes

    if (fetchSalesError) {
      console.error('Error fetching sales for webhook:', fetchSalesError.message);
      throw new Error('Failed to fetch sales for webhook: ' + fetchSalesError.message);
    }

    if (salesToUpdate && salesToUpdate.length > 0) {
      // Se o pagamento foi concluído, finalize a venda e atualize o estoque
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

          // Chamar a função perform_purchase para decrementar estoque e registrar a venda final
          // Nota: A função perform_purchase já insere na tabela sales.
          // Como já inserimos uma venda 'pending' na criação do pagamento,
          // precisamos decidir se perform_purchase deve ser chamada aqui (e remover a inserção inicial)
          // ou se apenas atualizamos o status da venda existente e o estoque.
          // Para evitar duplicidade, vamos apenas atualizar o status e o estoque aqui.
          // A lógica de decremento de estoque já está na perform_purchase, então vamos adaptar.

          // Opção 1: Se perform_purchase *apenas* decrementa estoque e *não* insere venda,
          // então a inserção inicial é a venda real e só atualizamos o status.
          // Opção 2: Se perform_purchase *decrementa estoque E insere venda*,
          // então a inserção inicial é um placeholder e a venda real é feita aqui.
          // Vamos assumir a Opção 1 para simplificar, e que a venda já existe como 'pending'.

          // Decrementar a quantidade do produto (se ainda não foi feito)
          const { error: updateProductError } = await supabaseServiceRoleClient
            .from('products')
            .update({ quantity: (prevQuantity: number) => prevQuantity - sale.quantity })
            .eq('id', sale.product_id)
            .gte('quantity', sale.quantity); // Garante que não vai para negativo

          if (updateProductError) {
            console.error(`Error updating product quantity for sale ${sale.id}:`, updateProductError.message);
            // Se o estoque não puder ser atualizado, a venda não pode ser concluída.
            // Você pode querer reverter o pagamento no PicPay ou marcar a venda como falha.
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