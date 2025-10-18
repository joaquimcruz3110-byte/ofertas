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
import { Loader2, PlusCircle, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea"; // Removido
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface Banner {
  id: string;
  title: string;
  // description: string | null; // Removido
  image_url: string;
  image_url_mobile: string | null; // Adicionado
  // cta_text: string | null; // Removido
  // cta_link: string | null; // Removido
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const bannerFormSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  // description: z.string().optional(), // Removido
  // cta_text: z.string().optional(), // Removido
  // cta_link: z.string().url("O link deve ser uma URL válida.").optional().or(z.literal('')), // Removido
  is_active: z.boolean().default(true),
  order_index: z.preprocess(
    (val) => Number(val),
    z.number().int().min(0, "O índice de ordem não pode ser negativo.")
  ),
});

type BannerFormValues = z.infer<typeof bannerFormSchema>;

const AdminBanners = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedDesktopImageFile, setSelectedDesktopImageFile] = useState<File | null>(null);
  const [desktopImagePreview, setDesktopImagePreview] = useState<string | null>(null);
  
  const [selectedMobileImageFile, setSelectedMobileImageFile] = useState<File | null>(null);
  const [mobileImagePreview, setMobileImagePreview] = useState<string | null>(null);

  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: {
      title: "",
      // description: "", // Removido
      // cta_text: "", // Removido
      // cta_link: "", // Removido
      is_active: true,
      order_index: 0,
    },
  });

  const fetchBanners = async () => {
    setIsLoadingBanners(true);
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) {
      showError('Erro ao carregar banners: ' + error.message);
      console.error('Erro ao carregar banners:', error.message);
      setBanners([]);
    } else {
      setBanners(data as Banner[]);
    }
    setIsLoadingBanners(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session && userRole === 'administrador') {
      fetchBanners();
    }
  }, [session, isSessionLoading, userRole]);

  const handleAddBannerClick = () => {
    setEditingBanner(null);
    form.reset({
      title: "",
      // description: "", // Removido
      // cta_text: "", // Removido
      // cta_link: "", // Removido
      is_active: true,
      order_index: 0,
    });
    setSelectedDesktopImageFile(null);
    setDesktopImagePreview(null);
    setSelectedMobileImageFile(null);
    setMobileImagePreview(null);
    setIsDialogOpen(true);
  };

  const handleEditBannerClick = (banner: Banner) => {
    setEditingBanner(banner);
    form.reset({
      title: banner.title,
      // description: banner.description || "", // Removido
      // cta_text: banner.cta_text || "", // Removido
      // cta_link: banner.cta_link || "", // Removido
      is_active: banner.is_active,
      order_index: banner.order_index,
    });
    setSelectedDesktopImageFile(null);
    setDesktopImagePreview(banner.image_url);
    setSelectedMobileImageFile(null);
    setMobileImagePreview(banner.image_url_mobile);
    setIsDialogOpen(true);
  };

  const handleDeleteBanner = async (bannerId: string, desktopImageUrl: string, mobileImageUrl: string | null) => {
    if (!window.confirm("Tem certeza que deseja excluir este banner? Isso removerá as imagens também.")) {
      return;
    }

    const toastId = showLoading('Excluindo banner...');
    
    try {
      // Deletar imagem desktop do storage
      if (desktopImageUrl) {
        const urlParts = desktopImageUrl.split('banner_images/');
        const filePathInStorage = urlParts.length > 1 ? `banner_images/${urlParts[1]}` : null;

        if (filePathInStorage) {
          const { error: deleteStorageError } = await supabase.storage
            .from('banner_images')
            .remove([filePathInStorage]);

          if (deleteStorageError && deleteStorageError.message !== 'The resource was not found') {
            console.warn('Erro ao remover imagem desktop do storage (pode não existir):', deleteStorageError.message);
          }
        }
      }

      // Deletar imagem mobile do storage
      if (mobileImageUrl) {
        const urlParts = mobileImageUrl.split('banner_images/');
        const filePathInStorage = urlParts.length > 1 ? `banner_images/${urlParts[1]}` : null;

        if (filePathInStorage) {
          const { error: deleteStorageError } = await supabase.storage
            .from('banner_images')
            .remove([filePathInStorage]);

          if (deleteStorageError && deleteStorageError.message !== 'The resource was not found') {
            console.warn('Erro ao remover imagem mobile do storage (pode não existir):', deleteStorageError.message);
          }
        }
      }

      // Deletar o banner do banco de dados
      const { error: deleteDbError } = await supabase
        .from('banners')
        .delete()
        .eq('id', bannerId);

      if (deleteDbError) {
        throw new Error('Erro ao excluir banner do banco de dados: ' + deleteDbError.message);
      }

      dismissToast(toastId);
      showSuccess('Banner excluído com sucesso!');
      setBanners(prevBanners => prevBanners.filter(b => b.id !== bannerId));
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao excluir banner: ' + error.message);
      console.error('Erro ao excluir banner:', error.message);
    }
  };

  const handleDesktopImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedDesktopImageFile(file);
      setDesktopImagePreview(URL.createObjectURL(file));
    } else {
      setSelectedDesktopImageFile(null);
      setDesktopImagePreview(editingBanner?.image_url || null);
    }
  };

  const handleMobileImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMobileImageFile(file);
      setMobileImagePreview(URL.createObjectURL(file));
    } else {
      setSelectedMobileImageFile(null);
      setMobileImagePreview(editingBanner?.image_url_mobile || null);
    }
  };

  const uploadImage = async (file: File, type: 'desktop' | 'mobile') => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `banners/${type}/${fileName}`; // Subpastas 'desktop' ou 'mobile'

    const { error: uploadError } = await supabase.storage
      .from('banner_images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Erro ao fazer upload da imagem ${type}: ` + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from('banner_images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const onSubmit = async (values: BannerFormValues) => {
    setIsSubmitting(true);
    const toastId = showLoading(editingBanner ? 'Atualizando banner...' : 'Adicionando banner...');

    let desktopImageUrlToSave = editingBanner?.image_url || null;
    let mobileImageUrlToSave = editingBanner?.image_url_mobile || null;

    try {
      if (selectedDesktopImageFile) {
        desktopImageUrlToSave = await uploadImage(selectedDesktopImageFile, 'desktop');
      } else if (!editingBanner?.image_url) {
        // Se não há imagem desktop existente e nenhuma nova foi selecionada, é um erro para novos banners
        if (!editingBanner) {
          throw new Error('Uma imagem para desktop é obrigatória para o banner.');
        }
      }

      if (selectedMobileImageFile) {
        mobileImageUrlToSave = await uploadImage(selectedMobileImageFile, 'mobile');
      }
      // A imagem mobile pode ser opcional, então não lançamos erro se não houver.

      if (!desktopImageUrlToSave) {
        throw new Error('URL da imagem desktop não pode ser nula.');
      }

      if (editingBanner) {
        const { error: updateError } = await supabase
          .from('banners')
          .update({
            title: values.title,
            // description: values.description, // Removido
            image_url: desktopImageUrlToSave,
            image_url_mobile: mobileImageUrlToSave, // Salva a URL da imagem mobile
            // cta_text: values.cta_text, // Removido
            // cta_link: values.cta_link, // Removido
            is_active: values.is_active,
            order_index: values.order_index,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBanner.id);

        if (updateError) {
          throw new Error('Erro ao atualizar banner: ' + updateError.message);
        }
      } else {
        const { error: insertError } = await supabase
          .from('banners')
          .insert({
            title: values.title,
            // description: values.description, // Removido
            image_url: desktopImageUrlToSave,
            image_url_mobile: mobileImageUrlToSave, // Salva a URL da imagem mobile
            // cta_text: values.cta_text, // Removido
            // cta_link: values.cta_link, // Removido
            is_active: values.is_active,
            order_index: values.order_index,
          });

        if (insertError) {
          throw new Error('Erro ao adicionar banner: ' + insertError.message);
        }
      }

      dismissToast(toastId);
      showSuccess(editingBanner ? 'Banner atualizado com sucesso!' : 'Banner adicionado com sucesso!');
      setIsDialogOpen(false);
      fetchBanners();
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao salvar banner: ' + error.message);
      console.error('Erro ao salvar banner:', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSessionLoading || isLoadingBanners) {
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
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Gerenciar Banners</h1>
      <p className="text-lg text-gray-600 mb-8">
        Aqui você pode visualizar, adicionar, editar e excluir os banners da página inicial.
      </p>

      <div className="flex justify-end mb-4">
        <Button onClick={handleAddBannerClick} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Banner
        </Button>
      </div>

      {banners.length === 0 ? (
        <p className="text-center text-gray-500">Nenhum banner encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ordem</TableHead>
                <TableHead>Imagem Desktop</TableHead>
                <TableHead>Imagem Mobile</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((banner) => (
                <TableRow key={banner.id}>
                  <TableCell>{banner.order_index}</TableCell>
                  <TableCell>
                    {banner.image_url ? (
                      <img
                        src={banner.image_url}
                        alt={banner.title}
                        className="w-24 h-16 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-24 h-16 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {banner.image_url_mobile ? (
                      <img
                        src={banner.image_url_mobile}
                        alt={`${banner.title} (Mobile)`}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 flex items-center justify-center rounded-md text-gray-500">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{banner.title}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${banner.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {banner.is_active ? 'Sim' : 'Não'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditBannerClick(banner)}
                      className="mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteBanner(banner.id, banner.image_url, banner.image_url_mobile)}
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
            <DialogTitle>{editingBanner ? "Editar Banner" : "Adicionar Novo Banner"}</DialogTitle>
            <DialogDescription>
              {editingBanner ? "Faça alterações no banner existente." : "Preencha os detalhes para adicionar um novo banner."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormItem>
                <FormLabel>Imagem do Banner (Desktop)</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleDesktopImageFileChange}
                  />
                </FormControl>
                <FormDescription>
                  Recomendado: Imagem larga e de alta qualidade (ex: 1920x600px).
                </FormDescription>
                <FormMessage />
              </FormItem>
              {desktopImagePreview && (
                <div className="mt-2">
                  <img src={desktopImagePreview} alt="Pré-visualização do Banner Desktop" className="w-full h-48 object-contain rounded-md border" />
                </div>
              )}

              <FormItem>
                <FormLabel>Imagem do Banner (Mobile)</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleMobileImageFileChange}
                  />
                </FormControl>
                <FormDescription>
                  Opcional: Imagem otimizada para celular (ex: 700x300px). Se não for fornecida, a imagem desktop será usada.
                </FormDescription>
                <FormMessage />
              </FormItem>
              {mobileImagePreview && (
                <div className="mt-2">
                  <img src={mobileImagePreview} alt="Pré-visualização do Banner Mobile" className="w-full h-32 object-contain rounded-md border" />
                </div>
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Título principal do banner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Campos removidos: Description, CTA Text, CTA Link */}
              <FormField
                control={form.control}
                name="order_index"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordem de Exibição</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" placeholder="0" {...field} />
                    </FormControl>
                    <FormDescription>
                      Banners com menor número aparecem primeiro.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Ativo</FormLabel>
                      <DialogDescription>
                        Define se este banner será exibido na página inicial.
                      </DialogDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting} className="bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingBanner ? "Salvar Alterações" : "Adicionar Banner"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBanners;