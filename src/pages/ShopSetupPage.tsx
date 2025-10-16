"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, Store, Camera, Trash2 } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useNavigate } from 'react-router-dom';

interface ShopDetails {
  id: string;
  shop_name: string;
  shop_description: string | null;
  shop_logo_url: string | null;
  pagarme_recipient_id: string | null;
}

const shopSetupFormSchema = z.object({
  shop_name: z.string().min(1, "O nome da loja é obrigatório."),
  shop_description: z.string().optional(),
  pagarme_recipient_id: z.string().optional(),
});

type ShopSetupFormValues = z.infer<typeof shopSetupFormSchema>;

const ShopSetupPage = () => {
  const { session, isLoading: isSessionLoading, userRole } = useSession();
  const navigate = useNavigate();
  const [shopDetails, setShopDetails] = useState<ShopDetails | null>(null);
  const [isLoadingShopDetails, setIsLoadingShopDetails] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);

  const form = useForm<ShopSetupFormValues>({
    resolver: zodResolver(shopSetupFormSchema),
    defaultValues: {
      shop_name: "",
      shop_description: "",
      pagarme_recipient_id: "",
    },
  });

  const fetchShopDetails = async () => {
    setIsLoadingShopDetails(true);
    if (!session?.user?.id) {
      setShopDetails(null);
      setIsLoadingShopDetails(false);
      return;
    }

    const userId = session.user.id;

    // Fetch shop details
    const { data: shopData, error: shopError } = await supabase
      .from('shop_details')
      .select('*')
      .eq('id', userId)
      .single();

    if (shopError && shopError.code !== 'PGRST116') {
      showError('Erro ao carregar detalhes da loja: ' + shopError.message);
      console.error('Erro ao carregar detalhes da loja:', shopError.message);
      setShopDetails(null);
    } else if (shopData) {
      setShopDetails(shopData as ShopDetails);
      form.setValue('shop_name', shopData.shop_name || "");
      form.setValue('shop_description', shopData.shop_description || "");
      form.setValue('pagarme_recipient_id', shopData.pagarme_recipient_id || "");
      setLogoPreview(shopData.shop_logo_url);
    }

    setIsLoadingShopDetails(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session) {
      if (userRole !== 'lojista') {
        showError('Você não tem permissão para acessar esta página.');
        navigate('/');
        return;
      }
      fetchShopDetails();
    }
  }, [session, isSessionLoading, userRole, navigate]);

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setSelectedLogoFile(null);
      setLogoPreview(shopDetails?.shop_logo_url || null);
    }
  };

  const uploadLogo = async (shopId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${shopId}/${Math.random()}.${fileExt}`;
    const filePath = `shop_logos/${fileName}`;

    if (shopDetails?.shop_logo_url) {
      const oldFilePath = shopDetails.shop_logo_url.split('shop_logos/')[1];
      if (oldFilePath) {
        const { error: deleteError } = await supabase.storage
          .from('shop_logos')
          .remove([oldFilePath]);
        if (deleteError && deleteError.message !== 'The resource was not found') {
          console.warn('Erro ao remover logo antigo (pode não existir):', deleteError.message);
        }
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('shop_logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      throw new Error('Erro ao fazer upload do logo: ' + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from('shop_logos')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleRemoveLogo = async () => {
    if (!shopDetails?.shop_logo_url || !session?.user?.id) {
      showError('Nenhum logo para remover.');
      return;
    }

    if (!window.confirm("Tem certeza que deseja remover o logo da sua loja?")) {
      return;
    }

    setIsRemovingLogo(true);
    const toastId = showLoading('Removendo logo...');

    try {
      const urlParts = shopDetails.shop_logo_url.split('shop_logos/');
      const filePathInStorage = urlParts.length > 1 ? `shop_logos/${urlParts[1]}` : null;

      if (filePathInStorage) {
        const { error: deleteStorageError } = await supabase.storage
          .from('shop_logos')
          .remove([filePathInStorage]);

        if (deleteStorageError && deleteStorageError.message !== 'The resource was not found') {
          throw new Error('Erro ao remover logo do storage: ' + deleteStorageError.message);
        }
      }

      const { error: updateDbError } = await supabase
        .from('shop_details')
        .update({ shop_logo_url: null })
        .eq('id', session.user.id);

      if (updateDbError) {
        throw new Error('Erro ao atualizar detalhes da loja no banco de dados: ' + updateDbError.message);
      }

      dismissToast(toastId);
      showSuccess('Logo removido com sucesso!');
      setShopDetails(prev => prev ? { ...prev, shop_logo_url: null } : null);
      setLogoPreview(null);
      setSelectedLogoFile(null);
      fetchShopDetails();
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao remover logo: ' + error.message);
      console.error('Erro ao remover logo:', error.message);
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const onSubmit = async (values: ShopSetupFormValues) => {
    setIsSubmitting(true);
    const toastId = showLoading(shopDetails ? 'Atualizando detalhes da loja...' : 'Configurando sua loja...');

    let logoUrlToSave = shopDetails?.shop_logo_url || null;

    try {
      if (selectedLogoFile && session?.user?.id) {
        logoUrlToSave = await uploadLogo(session.user.id, selectedLogoFile);
      } else if (!selectedLogoFile && shopDetails && !shopDetails.shop_logo_url) {
        logoUrlToSave = null;
      }

      if (shopDetails) {
        const { error: updateError } = await supabase
          .from('shop_details')
          .update({
            shop_name: values.shop_name,
            shop_description: values.shop_description,
            shop_logo_url: logoUrlToSave,
            pagarme_recipient_id: values.pagarme_recipient_id || null,
          })
          .eq('id', session?.user?.id);

        if (updateError) {
          throw new Error('Erro ao atualizar detalhes da loja: ' + updateError.message);
        }
      } else {
        const { error: insertError } = await supabase
          .from('shop_details')
          .insert({
            id: session?.user?.id,
            shop_name: values.shop_name,
            shop_description: values.shop_description,
            shop_logo_url: logoUrlToSave,
            pagarme_recipient_id: values.pagarme_recipient_id || null,
          });

        if (insertError) {
          throw new Error('Erro ao configurar a loja: ' + insertError.message);
        }
      }

      dismissToast(toastId);
      showSuccess(shopDetails ? 'Detalhes da loja atualizados com sucesso!' : 'Loja configurada com sucesso!');
      fetchShopDetails(); // Re-fetch to update local state and context
      navigate('/lojista-dashboard');
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao salvar detalhes da loja: ' + error.message);
      console.error('Erro ao salvar detalhes da loja:', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSessionLoading || isLoadingShopDetails) {
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
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">
        {shopDetails ? "Gerenciar Detalhes da Loja" : "Configurar Sua Loja"}
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        {shopDetails ? "Atualize as informações da sua loja." : "Preencha os detalhes para configurar sua loja e começar a vender."}
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative w-32 h-32">
              <Avatar className="w-32 h-32 border-2 border-dyad-dark-blue">
                <AvatarImage src={logoPreview || undefined} alt="Logo da Loja" />
                <AvatarFallback className="bg-dyad-vibrant-orange text-dyad-white text-4xl font-bold">
                  <Store className="w-16 h-16" />
                </AvatarFallback>
              </Avatar>
              <Label htmlFor="logo-upload" className="absolute bottom-0 right-0 bg-dyad-dark-blue text-dyad-white p-2 rounded-full cursor-pointer hover:bg-dyad-vibrant-orange transition-colors">
                <Camera className="h-5 w-5" />
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="hidden"
                />
              </Label>
            </div>
            <p className="text-sm text-gray-500">Clique na câmera para mudar o logo da sua loja</p>
            {shopDetails?.shop_logo_url && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveLogo}
                disabled={isRemovingLogo}
                className="mt-2"
              >
                {isRemovingLogo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover Logo
              </Button>
            )}
          </div>

          <FormField
            control={form.control}
            name="shop_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome da Loja</FormLabel>
                <FormControl>
                  <Input placeholder="Nome da sua loja" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="shop_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição da Loja</FormLabel>
                <FormControl>
                  <Textarea placeholder="Uma breve descrição da sua loja" {...field} />
                </FormControl>
                <FormDescription>
                  Conte um pouco sobre sua loja, seus produtos e sua missão.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <h2 className="text-2xl font-bold mt-8 mb-4 text-dyad-dark-blue">Configuração de Pagamento</h2>
          <FormField
            control={form.control}
            name="pagarme_recipient_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID do Recebedor Pagar.me</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Seu ID de Recebedor Pagar.me" {...field} />
                </FormControl>
                <FormDescription>
                  Este é o ID do seu recebedor Pagar.me. Você pode obtê-lo no seu dashboard Pagar.me, na seção "Recebedores".
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white py-3 text-lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {shopDetails ? "Salvar Alterações" : "Configurar Loja"}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default ShopSetupPage;