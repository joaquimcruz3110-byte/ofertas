"use client";

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { showError } from '@/utils/toast';
import { ShoppingCart, ArrowLeft, Store as StoreIcon, Image as ImageIcon, ShieldCheck, Facebook, Twitter, Mail } from 'lucide-react';
import { useCart } from '@/components/CartProvider';
import { formatCurrency } from '@/utils/formatters';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import RelatedProductsCarousel from '@/components/RelatedProductsCarousel';
import DiscountedProductsCarousel from '@/components/DiscountedProductsCarousel';
import NewArrivalsCarousel from '@/components/NewArrivalsCarousel';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category: string | null;
  photo_urls: string[] | null;
  discount: number | null;
  shopkeeper_id: string;
  created_at: string;
  shop_details: {
    shop_name: string;
    shop_logo_url: string | null;
  } | null;
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoadingProduct(true);
      if (!id) {
        showError('ID do produto não fornecido.');
        navigate('/explorar-produtos');
        return;
      }

      const { data, error } = await supabase
        .from('products')
        .select('*, shop_details(shop_name, shop_logo_url)')
        .eq('id', id)
        .single();

      if (error) {
        showError('Erro ao carregar detalhes do produto: ' + error.message);
        console.error('Erro ao carregar detalhes do produto:', error.message);
        setProduct(null);
        navigate('/explorar-produtos');
      } else {
        setProduct(data as Product);
        if (data?.photo_urls && data.photo_urls.length > 0) {
          setMainImage(data.photo_urls[0]);
        } else {
          setMainImage(null);
        }
      }
      setIsLoadingProduct(false);
    };

    fetchProduct();
  }, [id, navigate]);

  // Efeito para atualizar as meta tags para compartilhamento social
  useEffect(() => {
    const originalMetaTags: { [key: string]: string | null } = {};

    const saveOriginalMeta = (property: string, isNameTag = false) => {
      const selector = `meta[${isNameTag ? 'name' : 'property'}="${property}"]`;
      const tag = document.querySelector(selector);
      if (tag) {
        originalMetaTags[property] = tag.getAttribute('content');
      }
    };

    const updateMetaTag = (property: string, content: string, isNameTag = false) => {
      let tag = document.querySelector(`meta[${isNameTag ? 'name' : 'property'}="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(isNameTag ? 'name' : 'property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Salvar as meta tags originais do index.html
    saveOriginalMeta('og:title');
    saveOriginalMeta('og:description');
    saveOriginalMeta('og:image');
    saveOriginalMeta('og:url');
    saveOriginalMeta('og:type');
    saveOriginalMeta('twitter:card', true);
    saveOriginalMeta('twitter:title', true);
    saveOriginalMeta('twitter:description', true);
    saveOriginalMeta('twitter:image', true);
    saveOriginalMeta('twitter:url', true);

    if (product) {
      const productUrl = `${window.location.origin}/product/${product.id}`;
      const productTitle = product.name;
      const productDescription = product.description || "Confira este produto incrível no Olímpia Ofertas!";
      const productImage = product.photo_urls && product.photo_urls.length > 0 ? product.photo_urls[0] : `${window.location.origin}/ofertas_olimpia.png`; // Fallback para imagem padrão

      // Atualizar meta tags Open Graph
      updateMetaTag('og:title', productTitle);
      updateMetaTag('og:description', productDescription);
      updateMetaTag('og:image', productImage);
      updateMetaTag('og:url', productUrl);
      updateMetaTag('og:type', 'product'); // Tipo mais específico para produtos

      // Atualizar meta tags Twitter Card
      updateMetaTag('twitter:title', productTitle, true);
      updateMetaTag('twitter:description', productDescription, true);
      updateMetaTag('twitter:image', productImage, true);
      updateMetaTag('twitter:url', productUrl, true);
      updateMetaTag('twitter:card', 'summary_large_image', true); // Garantir que o tipo de card esteja correto
    }

    // Função de limpeza para restaurar as meta tags originais
    return () => {
      const defaultOgTitle = "Olímpia Ofertas";
      const defaultOgDescription = "Olímpia Ofertas: compre mais, gaste menos! Descubra uma nova forma de comprar e vender produtos online. Conecte-se com lojistas e encontre tudo o que você precisa, ou comece a vender seus próprios produtos hoje mesmo!";
      const defaultOgImage = `${window.location.origin}/ofertas_olimpia.png`;
      const defaultOgUrl = `${window.location.origin}`;
      const defaultOgType = "website";

      updateMetaTag('og:title', originalMetaTags['og:title'] || defaultOgTitle);
      updateMetaTag('og:description', originalMetaTags['og:description'] || defaultOgDescription);
      updateMetaTag('og:image', originalMetaTags['og:image'] || defaultOgImage);
      updateMetaTag('og:url', originalMetaTags['og:url'] || defaultOgUrl);
      updateMetaTag('og:type', originalMetaTags['og:type'] || defaultOgType);

      updateMetaTag('twitter:card', originalMetaTags['twitter:card'] || 'summary_large_image', true);
      updateMetaTag('twitter:title', originalMetaTags['twitter:title'] || defaultOgTitle, true);
      updateMetaTag('twitter:description', originalMetaTags['twitter:description'] || defaultOgDescription, true);
      updateMetaTag('twitter:image', originalMetaTags['twitter:image'] || defaultOgImage, true);
      updateMetaTag('twitter:url', originalMetaTags['twitter:url'] || defaultOgUrl, true);
    };
  }, [product]); // Depende do objeto 'product'

  const handleAddToCart = () => {
    if (!session) {
      showError('Você precisa estar logado para adicionar produtos ao carrinho.');
      navigate('/login');
      return;
    }

    if (!product) {
      showError('Produto não disponível para adicionar ao carrinho.');
      return;
    }
    const finalPrice = product.discount
      ? product.price * (1 - product.discount / 100)
      : product.price;

    addItem({
      id: product.id,
      name: product.name,
      price: finalPrice,
      photo_url: product.photo_urls && product.photo_urls.length > 0 ? product.photo_urls[0] : null,
      shopkeeper_id: product.shopkeeper_id,
    });
  };

  const openImageDialog = (imageUrl: string) => {
    setExpandedImageUrl(imageUrl);
    setIsImageDialogOpen(true);
  };

  const shareProduct = (platform: 'facebook' | 'twitter' | 'email') => {
    if (!product) return;

    const productUrl = `${window.location.origin}/product/${product.id}`;
    const productTitle = product.name;
    const productDescription = product.description || "Confira este produto incrível no Olímpia Ofertas!";

    let shareUrl = '';

    switch (platform) {
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(productTitle)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(`Confira: ${productTitle} no Olímpia Ofertas`)}&body=${encodeURIComponent(`${productDescription}\n\nLink: ${productUrl}`)}`;
        break;
      default:
        return;
    }

    console.log(`Sharing ${platform}: ${shareUrl}`); // Log para depuração
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  if (isLoadingProduct) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Produto Não Encontrado</h1>
          <p className="text-xl text-gray-600 mb-4">O produto que você está procurando não existe ou não está disponível.</p>
          <Button onClick={() => navigate('/explorar-produtos')} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Explorar Produtos
          </Button>
        </div>
      </div>
    );
  }

  const originalPrice = Number(product.price);
  const finalPrice = product.discount
    ? originalPrice * (1 - Number(product.discount) / 100)
    : originalPrice;

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-6xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate('/explorar-produtos')}
        className="mb-6 text-dyad-dark-blue hover:bg-dyad-light-gray"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Explorar Produtos
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] lg:grid-cols-[100px_1fr_1fr] gap-8">
        {/* Coluna 1: Miniaturas (visível em telas maiores) */}
        <div className="hidden md:flex flex-col gap-2 overflow-y-auto max-h-[500px]">
          {product.photo_urls && product.photo_urls.length > 0 ? (
            product.photo_urls.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`${product.name} - Miniatura ${index + 1}`}
                className={`w-24 h-24 object-cover rounded-md cursor-pointer border-2 ${
                  url === mainImage ? 'border-dyad-vibrant-orange' : 'border-transparent'
                }`}
                onClick={() => setMainImage(url)}
              />
            ))
          ) : (
            <div className="w-24 h-24 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
              <ImageIcon className="h-12 w-12" />
            </div>
          )}
        </div>

        {/* Coluna 2 (ou 1 em mobile): Imagem Principal */}
        <div className="md:col-span-1">
          <div className="relative mb-4">
            {mainImage ? (
              <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
                <DialogTrigger asChild>
                  <img
                    src={mainImage}
                    alt={`${product.name} - Imagem principal`}
                    className="w-full max-h-[500px] object-contain rounded-md shadow-sm cursor-pointer"
                    onClick={() => openImageDialog(mainImage)}
                  />
                </DialogTrigger>
                <DialogContent className="max-w-3xl p-0">
                  {expandedImageUrl && (
                    <img src={expandedImageUrl} alt="Imagem Expandida" className="w-full h-auto object-contain" />
                  )}
                </DialogContent>
              </Dialog>
            ) : (
              <div className="w-full h-96 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                <ImageIcon className="h-12 w-12" /> Sem Imagem
              </div>
            )}
          </div>
          {/* Miniaturas para mobile (visível em telas menores) */}
          {product.photo_urls && product.photo_urls.length > 1 && (
            <div className="flex md:hidden space-x-2 overflow-x-auto pb-2">
              {product.photo_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`${product.name} - Miniatura ${index + 1}`}
                  className={`w-20 h-20 object-cover rounded-md cursor-pointer border-2 ${
                    url === mainImage ? 'border-dyad-vibrant-orange' : 'border-transparent'
                  }`}
                  onClick={() => setMainImage(url)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Coluna 3 (ou 2 em mobile): Detalhes do Produto */}
        <div>
          <h1 className="text-4xl font-bold mb-2 text-dyad-dark-blue">{product.name}</h1>
          <p className="text-lg text-gray-600 mb-2 flex items-center gap-2">
            {product.shop_details?.shop_logo_url ? (
              <img
                src={product.shop_details.shop_logo_url}
                alt={`${product.shop_details.shop_name} logo`}
                className="w-6 h-6 object-contain rounded-full"
              />
            ) : (
              <StoreIcon className="h-5 w-5 text-gray-500" />
            )}
            {product.shop_details?.shop_name || 'Loja Desconhecida'}
          </p>
          <p className="text-lg text-gray-600 mb-4">{product.category || 'Geral'}</p>
          <p className="text-2xl font-bold text-dyad-vibrant-orange mb-4">
            {formatCurrency(finalPrice)}
            {product.discount && product.discount > 0 && (
              <span className="ml-3 text-lg text-gray-500 line-through">
                {formatCurrency(originalPrice)}
              </span>
            )}
          </p>
          
          <div className="space-y-2 mb-6">
            <div className="flex items-center text-green-600 font-medium">
              <ShieldCheck className="h-5 w-5 mr-2" /> Compra garantida
            </div>
          </div>

          <Button
            className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white py-3 text-lg mb-6"
            onClick={handleAddToCart}
            disabled={product.quantity <= 0}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            {product.quantity <= 0 ? 'Esgotado' : 'Adicionar ao Carrinho'}
          </Button>

          <div className="flex space-x-4 mb-6 justify-center">
            <Button variant="outline" size="icon" className="text-dyad-dark-blue hover:bg-dyad-light-gray" onClick={() => shareProduct('facebook')}>
              <Facebook className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="text-dyad-dark-blue hover:bg-dyad-light-gray" onClick={() => shareProduct('twitter')}>
              <Twitter className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="text-dyad-dark-blue hover:bg-dyad-light-gray" onClick={() => shareProduct('email')}>
              <Mail className="h-5 w-5" />
            </Button>
          </div>

          <p className="text-sm text-gray-500 mb-1 text-center">
            Vendido por: <Link to={`/shop/${product.shopkeeper_id}`} className="text-dyad-vibrant-orange hover:underline">{product.shop_details?.shop_name || 'Loja Desconhecida'}</Link>
          </p>
          <p className="text-sm text-gray-500 mb-4 text-center">
            Produto disponível para retirada na loja.
          </p>
        </div>
      </div>

      {/* Seção de Detalhes do Produto (Descrição) */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-4 text-dyad-dark-blue">Detalhes do Produto</h2>
        <div 
          className="text-gray-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: product.description?.replace(/\n/g, '<br />') || 'Nenhuma descrição detalhada disponível para este produto.' }}
        />
      </section>

      {/* Seções de Produtos Relacionados */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6 text-dyad-dark-blue">Outros revendedores também compraram</h2>
        <RelatedProductsCarousel currentProductId={product.id} currentProductCategory={product.category || ''} />
      </section>

      <section className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6 text-dyad-dark-blue">Descontos Imperdíveis</h2>
        <DiscountedProductsCarousel />
      </section>

      <section className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6 text-dyad-dark-blue">Novidades da Semana</h2>
        <NewArrivalsCarousel />
      </section>
    </div>
  );
};

export default ProductDetail;