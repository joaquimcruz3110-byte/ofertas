"use client";

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, PlusCircle, Edit, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// import { Label } from "@/components/ui/label"; // Removido pois não é usado
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category: string | null;
  photo_url: string | null;
  discount: number | null;
  shopkeeper_id: string; // Adicionado para consistência com o schema
  created_at: string;
}

const productFormSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().optional(),
  price: z.preprocess(
    (val) => Number(val),
    z.number().min(0.01, "O preço deve ser maior que zero.")
  ),
  quantity: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, "A quantidade não pode ser negativa.")
  ),
  category: z.string().optional(),
  photo_url: z.string().url("URL da foto inválida.").optional().or(z.literal('')),
  discount: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "O desconto não pode ser negativo.").max(100, "O desconto não pode ser maior que 100.").optional()
  ),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const GerenciarProdutos = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      quantity: 0,
      category: "",
      photo_url: "",
      discount: 0,
    },
  });

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    const { data, error } = await supabase
      .from('products')
      .select('*');

    if (error) {
      showError('Erro ao carregar produtos: ' + error.message);
      console.error('Erro ao carregar produtos:', error.message);
      setProducts([]);
    } else {
      setProducts(data as Product[]);
    }
    setIsLoadingProducts(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'administrador') {
      fetchProducts();
    }
  }, [session, isSessionLoading, userRole]);

  const handleAddProductClick = () => {
    setEditingProduct(null);
    form.reset({
      name: "",
      description: "",
      price: 0,
      quantity: 0,
      category: "",
      photo_url: "",
      discount: 0,
    });
    setIsDialogOpen(true);
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProduct(product);
    form.reset({
      name: product.name,
      description: product.description || "",
      price: product.price,
      quantity: product.quantity,
      category: product.category || "",
      photo_url: product.photo_url || "",
      discount: product.discount || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto?")) {
      return;
    }

    const toastId = showLoading('Excluindo produto...');
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    dismissToast(toastId);
    if (error) {
      showError('Erro ao excluir produto: ' + error.message);
      console.error('Erro ao excluir produto:', error.message);
    } else {
      showSuccess('Produto excluído com sucesso!');
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
    }
  };

  const onSubmit = async (values: ProductFormValues) => {
    setIsSubmitting(true);
    const toastId = showLoading(editingProduct ? 'Atualizando produto...' : 'Adicionando produto...');

    let error = null;
    if (editingProduct) {
      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: values.name,
          description: values.description,
          price: values.price,
          quantity: values.quantity,
          category: values.category,
          photo_url: values.photo_url,
          discount: values.discount,
        })
        .eq('id', editingProduct.id);
      error = updateError;
    } else {
      // When adding a new product, assign it to the current admin's ID as shopkeeper_id
      // This might need adjustment if products are truly created by shopkeepers
      // For now, assuming admin creates products and is the shopkeeper for them
      const { error: insertError } = await supabase
        .from('products')
        .insert({
          name: values.name,
          description: values.description,
          price: values.price,
          quantity: values.quantity,
          category: values.category,
          photo_url: values.photo_url,
          discount: values.discount,
          shopkeeper_id: session?.user?.id, // Assign current admin as shopkeeper
        });
      error = insertError;
    }

    dismissToast(toastId);
    if (error) {
      showError('Erro ao salvar produto: ' + error.message);
      console.error('Erro ao salvar produto:', error.message);
    } else {
      showSuccess(editingProduct ? 'Produto atualizado com sucesso!' : 'Produto adicionado com sucesso!');
      setIsDialogOpen(false);
      fetchProducts(); // Recarrega a lista de produtos
    }
    setIsSubmitting(false);
  };

  if (isSessionLoading || isLoadingProducts) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'administrador') {
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
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main className="flex-grow p-4 bg-dyad-light-gray">
          <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
            <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Gerenciar Produtos</h1>
            <p className="text-lg text-gray-600 mb-8">
              Aqui você pode visualizar, adicionar, editar e excluir produtos da plataforma.
            </p>

            <div className="flex justify-end mb-4">
              <Button onClick={handleAddProductClick}>
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Produto
              </Button>
            </div>

            {products.length === 0 ? (
              <p className="text-center text-gray-500">Nenhum produto encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Desconto (%)</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                        <TableCell>{product.quantity}</TableCell>
                        <TableCell>{product.category || 'N/A'}</TableCell>
                        <TableCell>{product.discount ? `${product.discount}%` : '0%'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProductClick(product)}
                            className="mr-2"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </main>
        <MadeWithDyad />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Editar Produto" : "Adicionar Novo Produto"}</DialogTitle>
              <DialogDescription>
                {editingProduct ? "Faça alterações no produto existente." : "Preencha os detalhes para adicionar um novo produto."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Produto</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do produto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descrição do produto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço (R$)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <FormControl>
                          <Input placeholder="Eletrônicos, Roupas, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="discount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Desconto (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
                <FormField
                  control={form.control}
                  name="photo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Foto</FormLabel>
                      <FormControl>
                        <Input placeholder="https://exemplo.com/foto.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingProduct ? "Salvar Alterações" : "Adicionar Produto"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default GerenciarProdutos;