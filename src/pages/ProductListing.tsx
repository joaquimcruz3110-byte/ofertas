"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showError } from '@/utils/toast';
import { ShoppingCart, Search } from 'lucide-react';
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
}

const PRODUCTS_PER_PAGE = 8;

const ProductListing = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchProducts = async (page: number, term: string) => {
    setIsLoadingProducts(true);
    const from = (page - 1) * PRODUCTS_PER_PAGE;
    const to = from + PRODUCTS_PER_PAGE - 1;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .gt('quantity', 0);

    if (term) {
      query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
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
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'comprador') {
      const handler = setTimeout(() => {
        fetchProducts(currentPage, searchTerm);
      }, 300);

      return () => {
        clearTimeout(handler);
      };
    }
  }, [session, isSessionLoading, userRole, searchTerm, currentPage]);

  const handleAddToCart = (product: Product) => {
    const finalPrice = product.discount
      ? product.price * (1 - product.discount / 100)
      : product.price;

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

  const currencyFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Explorar Produtos</h1>
      <p className="text-lg text-gray-600 mb-8">
        Confira os produtos disponíveis para compra na plataforma.
      </p>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Pesquisar produtos por nome ou descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-dyad-vibrant-orange"
        />
      </div>

      {products.length === 0 ? (
        <p className="text-center text-gray-500">Nenhum produto encontrado no momento.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const finalPrice = product.discount
                ? product.price * (1 - product.discount / 100)
                : product.price;

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
                      <CardDescription className="text-sm text-gray-500">
                        {product.category || 'Geral'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xl font-bold text-dyad-vibrant-orange mb-2">
                        {currencyFormatter.format(finalPrice)}
                        {product.discount && product.discount > 0 && (
                          <span className="ml-2 text-sm text-gray-500 line-through">
                            {currencyFormatter.format(product.price)}
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