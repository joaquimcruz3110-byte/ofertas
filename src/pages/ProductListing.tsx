"use client";

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showError } from '@/utils/toast';
import { ShoppingCart, Search, Store as StoreIcon, XCircle } from 'lucide-react'; // Adicionado XCircle para limpar filtros
import { Link } from 'react-router-dom';
import { useCart } from '@/components/CartProvider';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatCurrency } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category: string | null;
  photo_url: string | null;
  discount: number | null;
  shopkeeper_id: string;
  created_at: string;
  shop_details: { // Adicionado para incluir os detalhes da loja
    shop_name: string;
    shop_logo_url: string | null; // Adicionado shop_logo_url
  } | null;
}

interface ShopDetail {
  id: string;
  shop_name: string;
}

const PRODUCTS_PER_PAGE = 8;
const CATEGORIES = [
  "Alimentos",
  "Eletrônicos",
  "Roupas",
  "Livros",
  "Casa e Decoração",
  "Esportes",
  "Beleza",
  "Brinquedos",
  "Automotivo",
  "Outros"
];

const ProductListing = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopkeepers, setShopkeepers] = useState<ShopDetail[]>([]);
  const [selectedShopkeeperId, setSelectedShopkeeperId] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined); // Novo estado para categoria
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = useCallback(async (page: number, term: string, shopkeeperId?: string, category?: string, minP?: string, maxP?: string) => {
    setIsLoadingProducts(true);
    const from = (page - 1) * PRODUCTS_PER_PAGE;
    const to = from + PRODUCTS_PER_PAGE - 1;

    let query = supabase
      .from('products')
      .select('*, shop_details(shop_name, shop_logo_url)', { count: 'exact' }) // Inclui o nome e logo da loja
      .gt('quantity', 0);

    if (term) {
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }
    if (shopkeeperId) {
      query = query.eq('shopkeeper_id', shopkeeperId);
    }
    if (category) { // Novo filtro por categoria
      query = query.eq('category', category);
    }
    if (minP && !isNaN(Number(minP))) {
      query = query.gte('price', Number(minP));
    }
    if (maxP && !isNaN(Number(maxP))) {
      query = query.lte('price', Number(maxP));
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      showError('Erro ao carregar produtos: ' + error.message);
      console.error('Erro ao carregar produtos:', error.message);
      setProducts([]);
      setTotalPages(1);
    } else {
      setProducts(data as Product[]);
      setTotalPages(Math.ceil((count || 0) / PRODUCTS_PER_PAGE));
    }
    setIsLoadingProducts(false);
  }, []);

  const fetchShopkeepers = useCallback(async () => {
    const { data, error } = await supabase
      .from('shop_details')
      .select('id, shop_name');

    if (error) {
      console.error('Erro ao buscar detalhes das lojas:', error.message);
    } else {
      setShopkeepers(data || []);
    }
  }, []);

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'comprador') {
      fetchShopkeepers();
    }
  }, [isSessionLoading, session, userRole, fetchShopkeepers]);

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'comprador') {
      const handler = setTimeout(() => {
        fetchProducts(currentPage, searchTerm, selectedShopkeeperId, selectedCategory, minPrice, maxPrice);
      }, 300);

      return () => {
        clearTimeout(handler);
      };
    }
  }, [session, isSessionLoading, userRole, searchTerm, currentPage, selectedShopkeeperId, selectedCategory, minPrice, maxPrice, fetchProducts]);

  const handleAddToCart = (product: Product) => {
    const originalPrice = Number(product.price);
    const finalPrice = product.discount
      ? originalPrice * (1 - Number(product.discount) / 100)
      : originalPrice;

    addItem({
      id: product.id,
      name: product.name,
      price: finalPrice,
      photo_url: product.photo_url,
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleShopkeeperChange = (value: string) => {
    setSelectedShopkeeperId(value === 'all' ? undefined : value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string) => { // Novo handler para categoria
    setSelectedCategory(value === 'all' ? undefined : value);
    setCurrentPage(1);
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMinPrice(e.target.value);
    setCurrentPage(1);
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxPrice(e.target.value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedShopkeeperId(undefined);
    setSelectedCategory(undefined); // Limpa a categoria
    setMinPrice('');
    setMaxPrice('');
    setCurrentPage(1);
  };

  if (isSessionLoading || isLoadingProducts) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'comprador') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Acesso Negado</h1>
          <p className="text-xl text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Explorar Produtos</h1>
      <p className="text-lg text-gray-600 mb-8">
        Confira os produtos disponíveis para compra na plataforma.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 items-end"> {/* Ajustado para 5 colunas */}
        <div className="relative">
          <Label htmlFor="search-product">Pesquisar Produto</Label>
          <Search className="absolute left-3 top-[38px] -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            id="search-product"
            type="text"
            placeholder="Nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-dyad-vibrant-orange"
          />
        </div>

        <div>
          <Label htmlFor="filter-shopkeeper">Filtrar por Loja</Label>
          <Select value={selectedShopkeeperId || 'all'} onValueChange={handleShopkeeperChange}>
            <SelectTrigger id="filter-shopkeeper" className="w-full">
              <SelectValue placeholder="Todas as Lojas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas</SelectItem>
              {shopkeepers.map(shopkeeper => (
                <SelectItem key={shopkeeper.id} value={shopkeeper.id}>
                  {shopkeeper.shop_name || 'Loja Desconhecida'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="filter-category">Filtrar por Categoria</Label> {/* Novo filtro de categoria */}
          <Select value={selectedCategory || 'all'} onValueChange={handleCategoryChange}>
            <SelectTrigger id="filter-category" className="w-full">
              <SelectValue placeholder="Todas as Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {CATEGORIES.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="min-price">Preço Mínimo</Label>
          <Input
            id="min-price"
            type="number"
            placeholder="0.00"
            value={minPrice}
            onChange={handleMinPriceChange}
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor="max-price">Preço Máximo</Label>
          <Input
            id="max-price"
            type="number"
            placeholder="999.99"
            value={maxPrice}
            onChange={handleMaxPriceChange}
            className="w-full"
          />
        </div>
      </div>
      <div className="flex justify-end mb-6">
        <Button variant="outline" onClick={handleClearFilters}>
          <XCircle className="mr-2 h-4 w-4" /> Limpar Filtros
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-center text-gray-500">Nenhum produto encontrado no momento.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const originalPrice = Number(product.price);
              const finalPrice = product.discount
                ? originalPrice * (1 - Number(product.discount) / 100)
                : originalPrice;
              
              return (
                <Card key={product.id} className="flex flex-col justify-between">
                  <Link to={`/product/${product.id}`} className="block">
                    <CardHeader>
                      {product.photo_url && (
                        <img
                          src={product.photo_url}
                          alt={product.name}
                          className="w-full h-48 object-cover rounded-md mb-4"
                        />
                      )}
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <CardDescription className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        {product.shop_details?.shop_logo_url ? (
                          <img
                            src={product.shop_details.shop_logo_url}
                            alt={`${product.shop_details.shop_name} logo`}
                            className="w-6 h-6 object-contain rounded-full"
                          />
                        ) : (
                          <StoreIcon className="h-4 w-4 text-gray-500" />
                        )}
                        {product.shop_details?.shop_name || 'Loja Desconhecida'}
                      </CardDescription>
                      <CardDescription className="text-sm text-gray-500">
                        {product.category || 'Geral'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p key={`price-${product.id}`} className="text-xl font-bold text-dyad-vibrant-orange mb-2">
                        {formatCurrency(finalPrice)}
                        {product.discount && product.discount > 0 && (
                          <span className="ml-2 text-sm text-gray-500 line-through">
                            {formatCurrency(originalPrice)}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-600">{product.description?.substring(0, 70)}{product.description && product.description.length > 70 ? '...' : ''}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Disponível: {product.quantity} unidades
                      </p>
                    </CardContent>
                  </Link>
                  <CardFooter>
                    <Button
                      className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white"
                      onClick={() => handleAddToCart(product)}
                      disabled={product.quantity <= 0}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      {product.quantity <= 0 ? 'Esgotado' : 'Adicionar ao Carrinho'}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={currentPage === 1 ? undefined : () => handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {[...Array(totalPages)].map((_, index) => (
                  <PaginationItem key={index}>
                    <PaginationLink
                      onClick={() => handlePageChange(index + 1)}
                      isActive={currentPage === index + 1}
                    >
                      {index + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={currentPage === totalPages ? undefined : () => handlePageChange(currentPage + 1)}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
};

export default ProductListing;