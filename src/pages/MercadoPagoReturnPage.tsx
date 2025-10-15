"use client";

import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '@/components/CartProvider';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { exportToPdf } from '@/utils/pdfGenerator';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SaleDetail {
  id: string;
  product_id: string;
  buyer_id: string;
  quantity: number;
  total_price: number;
  commission_rate: number;
  sale_date: string;
  payment_gateway_id: string | null;
  payment_gateway_status: string | null;
  product_name: string;
  product_price: number;
  shopkeeper_name: string;
}

const MercadoPagoReturnPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const [saleDetails, setSaleDetails] = useState<SaleDetail[]>([]);
  const [isLoadingSale, setIsLoadingSale] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);

  const queryParams = new URLSearchParams(location.search);
  const status = queryParams.get('status');
  const paymentId = queryParams.get('payment_id');

  useEffect(() => {
    const fetchSaleDetails = async () => {
      if (status === 'success' && paymentId) {
        setIsLoadingSale(true);
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select(`
            id,
            product_id,
            buyer_id,
            quantity,
            total_price,
            commission_rate,
            sale_date,
            payment_gateway_id,
            payment_gateway_status
          `)
          .eq('payment_gateway_id', paymentId);

        if (salesError) {
          console.error('Erro ao buscar detalhes da venda:', salesError.message);
          showError('Erro ao carregar detalhes da venda para o comprovante.');
          setSaleDetails([]);
          setIsLoadingSale(false);
          return;
        }

        if (salesData && salesData.length > 0) {
          const uniqueProductIds = [...new Set(salesData.map(sale => sale.product_id))];
          const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('id, name, price, shopkeeper_id')
            .in('id', uniqueProductIds);

          if (productsError) {
            console.error('Erro ao buscar detalhes dos produtos:', productsError.message);
            showError('Erro ao carregar detalhes dos produtos para o comprovante.');
            setIsLoadingSale(false);
            return;
          }
          const productDetailsMap = new Map(productsData?.map(p => [p.id, { name: p.name, price: p.price, shopkeeper_id: p.shopkeeper_id }]));

          const uniqueShopkeeperIds = [...new Set(productsData?.map(p => p.shopkeeper_id).filter(Boolean))];
          const { data: shopDetailsData, error: shopDetailsError } = await supabase
            .from('shop_details')
            .select('id, shop_name')
            .in('id', uniqueShopkeeperIds);

          if (shopDetailsError) {
            console.error('Erro ao buscar detalhes das lojas:', shopDetailsError.message);
            showError('Erro ao carregar detalhes das lojas para o comprovante.');
            setIsLoadingSale(false);
            return;
          }
          const shopNameMap = new Map(shopDetailsData?.map(s => [s.id, s.shop_name]));

          const formattedSales: SaleDetail[] = salesData.map(sale => {
            const productDetail = productDetailsMap.get(sale.product_id);
            const shopkeeperId = productDetail?.shopkeeper_id;
            return {
              ...sale,
              product_name: productDetail?.name || 'Produto Desconhecido',
              product_price: productDetail?.price || 0,
              shopkeeper_name: shopkeeperId ? (shopNameMap.get(shopkeeperId) || 'Lojista Desconhecido') : 'Lojista Desconhecido',
            };
          });
          setSaleDetails(formattedSales);
        }
        setIsLoadingSale(false);
      } else {
        setIsLoadingSale(false);
      }
    };

    fetchSaleDetails();

    if (status === 'success') {
      showSuccess('Pagamento aprovado! Seu pedido foi realizado com sucesso.');
      clearCart(); // Limpa o carrinho após o sucesso
    } else if (status === 'pending') {
      showError('Pagamento pendente. Aguardando confirmação do Mercado Pago.');
    } else if (status === 'failure') {
      showError('Pagamento falhou. Por favor, tente novamente.');
    } else {
      showError('Status de pagamento desconhecido ou erro na transação.');
    }
  }, [location.search, navigate, clearCart, status, paymentId]);

  let title = '';
  let message = '';
  let icon = null;
  let iconColor = '';

  switch (status) {
    case 'success':
      title = 'Pagamento Aprovado!';
      message = 'Seu pedido foi realizado com sucesso. Agradecemos a sua compra!';
      icon = <CheckCircle className="h-24 w-24 text-green-500 mb-4" />;
      iconColor = 'text-green-500';
      break;
    case 'pending':
      title = 'Pagamento Pendente';
      message = 'Seu pagamento está aguardando confirmação. Você será notificado quando for processado.';
      icon = <Clock className="h-24 w-24 text-yellow-500 mb-4" />;
      iconColor = 'text-yellow-500';
      break;
    case 'failure':
      title = 'Pagamento Recusado';
      message = 'Houve um problema com o seu pagamento. Por favor, tente novamente ou utilize outro método.';
      icon = <XCircle className="h-24 w-24 text-red-500 mb-4" />;
      iconColor = 'text-red-500';
      break;
    default:
      title = 'Status de Pagamento Desconhecido';
      message = 'Não foi possível determinar o status do seu pagamento. Por favor, verifique seus pedidos ou entre em contato.';
      icon = <XCircle className="h-24 w-24 text-gray-500 mb-4" />;
      iconColor = 'text-gray-500';
      break;
  }

  const handleDownloadReceipt = () => {
    if (receiptRef.current) {
      exportToPdf(receiptRef.current, `comprovante_compra_${paymentId}.pdf`);
    } else {
      showError('Conteúdo do comprovante não encontrado para exportação.');
    }
  };

  const totalOrderPrice = saleDetails.reduce((sum, item) => sum + item.total_price, 0);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray p-4">
      <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-md w-full">
        {icon}
        <h1 className={`text-4xl font-bold mb-4 ${iconColor}`}>{title}</h1>
        <p className="text-xl text-gray-600 mb-6">{message}</p>
        
        {status === 'success' && !isLoadingSale && saleDetails.length > 0 && (
          <div className="mt-8">
            <Button
              onClick={handleDownloadReceipt}
              className="bg-dyad-vibrant-orange hover:bg-orange-600 text-dyad-white mb-4"
            >
              <FileText className="mr-2 h-4 w-4" /> Baixar Comprovante
            </Button>
            <div ref={receiptRef} className="text-left p-4 border rounded-md bg-white shadow-sm">
              <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue">Comprovante de Compra</h2>
              <p className="text-sm text-gray-600 mb-2">
                <strong>ID do Pagamento:</strong> {paymentId || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Data da Compra:</strong> {saleDetails[0]?.sale_date ? format(new Date(saleDetails[0].sale_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'N/A'}
              </p>
              <div className="space-y-2 mb-4">
                {saleDetails.map((item, index) => (
                  <div key={index} className="border-t pt-2">
                    <p className="font-semibold text-dyad-dark-blue">{item.product_name}</p>
                    <p className="text-sm text-gray-700">Lojista: {item.shopkeeper_name}</p>
                    <p className="text-sm text-gray-700">Quantidade: {item.quantity}</p>
                    <p className="text-sm text-gray-700">Preço Unitário: {formatCurrency(item.product_price)}</p>
                    <p className="text-sm text-gray-700">Preço Total: {formatCurrency(item.total_price)}</p>
                  </div>
                ))}
              </div>
              <p className="text-lg font-bold text-dyad-vibrant-orange border-t pt-4">
                Total do Pedido: {formatCurrency(totalOrderPrice)}
              </p>
            </div>
          </div>
        )}

        <Button onClick={() => navigate('/')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white mt-6">
          Voltar para a Página Inicial
        </Button>
      </div>
    </div>
  );
};

export default MercadoPagoReturnPage;