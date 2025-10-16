"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
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
import { Loader2, PlusCircle, Edit, Trash2, Image as ImageIcon, X } from 'lucide-react'; // Adicionado X para remover imagem individual
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { formatCurrency } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Importar Select

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  category: string | null;
  photo_urls: string[] | null; // Alterado para array de strings
  discount: number;
  shopkeeper_id: string;
  created_at: string;
}

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
  category: z.string().min(1, "A categoria é obrigatória."), // Categoria agora é obrigatória
  discount: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "O desconto não pode ser negativo.").max(100, "O desconto não pode ser maior que 100.")
  ),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const MeusProdutos = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentImages, setCurrentImages] = useState<{ url: string; file?: File }[]>([]); // Gerencia imagens existentes e novas
  const MAX_IMAGES = 3;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      quantity: 0,
      category: "",
      discount: 0, // Alterado para 0
    },
  });

  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    if (!session?.user?.id) {
      setProducts([]);
      setIsLoadingProducts(false);
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shopkeeper_id', session.user.id);

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
    if (!isSessionLoading && session && userRole === 'lojista') {
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
      discount: 0, // Alterado para 0
    });
    setCurrentImages([]);
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
      discount: product.discount || 0, // Alterado para 0
    });
    setCurrentImages(product.photo_urls?.map(url => ({ url })) || []);
    setIsDialogOpen(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto? Isso removerá todas as suas imagens também.")) {
      return;
    }

    const toastId = showLoading('Excluindo produto...');
    
    try {
      // Primeiro, buscar as URLs das imagens para deletar do storage
      const { data: productToDelete, error: fetchError } = await supabase
        .from('products')
        .select('photo_urls')
        .eq('id', productId)
        .eq('shopkeeper_id', session?.user?.id)
        .single();

      if (fetchError) {
        throw new Error('Erro ao buscar produto para exclusão: ' + fetchError.message);
      }

      // Deletar imagens do storage
      if (productToDelete?.photo_urls && productToDelete.photo_urls.length > 0) {
        const filePathsToDelete = productToDelete.photo_urls.map((url: string) => {
          const urlParts = url.split('product_images/');
          return urlParts.length > 1 ? `product_images/${urlParts[1]}` : null;
        }).filter(Boolean) as string[];

        if (filePathsToDelete.length > 0) {
          const { error: deleteStorageError } = await supabase.storage
            .from('product_images')
            .remove(filePathsToDelete);

          if (deleteStorageError && deleteStorageError.message !== 'The resource was not found') {
            console.warn('Erro ao remover imagens do storage (algumas podem não existir):', deleteStorageError.message);
          }
        }
      }

      // Deletar o produto do banco de dados
      const { error: deleteDbError } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('shopkeeper_id', session?.user?.id);

      if (deleteDbError) {
        throw new Error('Erro ao excluir produto do banco de dados: ' + deleteDbError.message);
      }

      dismissToast(toastId);
      showSuccess('Produto excluído com sucesso!');
      setProducts(prevProducts => prevProducts.filter(p => p.id !== productId));
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao excluir produto: ' + error.message);
      console.error('Erro ao excluir produto:', error.message);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const newFiles = files.slice(0, MAX_IMAGES - currentImages.length); // Limita o número de novos arquivos

    if (newFiles.length > 0) {
      const newImagePreviews = newFiles.map(file => ({
        url: URL.createObjectURL(file),
        file: file,
      }));
      setCurrentImages(prev => [...prev, ...newImagePreviews]);
    }
    // Limpa o input para permitir o upload dos mesmos arquivos novamente se o usuário quiser
    event.target.value = '';
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setCurrentImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const uploadImage = async (productId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`; // Nome único
    const filePath = `product_images/${productId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('product_images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error('Erro ao fazer upload da imagem: ' + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from('product_images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const onSubmit = async (values: ProductFormValues) => {
    setIsSubmitting(true);
    const toastId = showLoading(editingProduct ? 'Atualizando produto...' : 'Adicionando produto...');

    let productPhotoUrls: string[] = [];
    let currentProductId = editingProduct?.id;

    try {
      // Se for um novo produto, insere primeiro para obter o ID
      if (!editingProduct) {
        const { data: newProductData, error: insertError } = await supabase
          .from('products')
          .insert({
            name: values.name,
            description: values.description,
            price: values.price,
            quantity: values.quantity,
            category: values.category,
            discount: values.discount,
            shopkeeper_id: session?.user?.id,
          })
          .select('id')
          .single();

        if (insertError) {
          throw new Error('Erro ao adicionar produto: ' + insertError.message);
        }
        currentProductId = newProductData.id;
      }

      // Processar uploads de novas imagens
      const uploadPromises = currentImages
        .filter(img => img.file) // Apenas arquivos novos
        .map(img => uploadImage(currentProductId!, img.file!));
      
      const newUploadedUrls = await Promise.all(uploadPromises);

      // Combinar URLs existentes (que não foram removidas) com as novas URLs
      const existingUrls = currentImages
        .filter(img => !img.file) // Apenas URLs existentes
        .map(img => img.url);
      
      productPhotoUrls = [...existingUrls, ...newUploadedUrls];

      // Atualizar o produto no banco de dados
      if (currentProductId) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: values.name,
            description: values.description,
            price: values.price,
            quantity: values.quantity,
            category: values.category,
            photo_urls: productPhotoUrls, // Salva o array de URLs
            discount: values.discount,
          })
          .eq('id', currentProductId)
          .eq('shopkeeper_id', session?.user?.id);

        if (updateError) {
          throw new Error('Erro ao salvar produto: ' + updateError.message);
        }
      }

      dismissToast(toastId);
      showSuccess(editingProduct ? 'Produto atualizado com sucesso!' : 'Produto adicionado com sucesso!');
      setIsDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      dismissToast(toastId);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSessionLoading || isLoadingProducts) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session || userRole !== 'lojista') {
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
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Meus Produtos</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui você pode visualizar, adicionar, editar e excluir seus produtos.
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
                <TableHead>Imagem</TableHead>
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
                  <TableCell>
                    {product.photo_urls && product.photo_urls.length > 0 ? (
                      <img
                        src={product.photo_urls[0]} // Exibe a primeira imagem
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{formatCurrency(product.price)}</TableCell>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormItem>
                <FormLabel>Fotos do Produto (até {MAX_IMAGES})</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    disabled={currentImages.length >= MAX_IMAGES}
                  />
                </FormControl>
                <FormDescription>
                  Você pode enviar até {MAX_IMAGES} imagens para o produto.
                </FormDescription>
                <FormMessage />
              </FormItem>
              {currentImages.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {currentImages.map((img, index) => (
                    <div key={index} className="relative w-full h-32 border rounded-md overflow-hidden">
                      <img src={img.url} alt={`Pré-visualização ${index + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
  );
};

export default MeusProdutos;