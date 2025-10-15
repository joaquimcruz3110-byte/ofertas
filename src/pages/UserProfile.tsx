"use client";

import { useEffect, useState } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Loader2, User as UserIcon, Camera, Trash2 } from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  role: 'comprador' | 'lojista' | 'administrador';
}

const profileFormSchema = z.object({
  first_name: z.string().min(1, "O primeiro nome é obrigatório.").optional().or(z.literal('')),
  last_name: z.string().min(1, "O sobrenome é obrigatório.").optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const UserProfile = () => {
  const { session, isLoading: isSessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
    },
  });

  const fetchProfile = async () => {
    setIsLoadingProfile(true);
    if (!session?.user?.id) {
      setProfile(null);
      setIsLoadingProfile(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, role')
      .eq('id', session.user.id)
      .single();

    if (error) {
      showError('Erro ao carregar perfil: ' + error.message);
      console.error('Erro ao carregar perfil:', error.message);
      setProfile(null);
    } else if (data) {
      setProfile(data as Profile);
      form.reset({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
      });
      setAvatarPreview(data.avatar_url);
    }
    setIsLoadingProfile(false);
  };

  useEffect(() => {
    if (!isSessionLoading && session) {
      fetchProfile();
    }
  }, [session, isSessionLoading]);

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    } else {
      setSelectedAvatarFile(null);
      setAvatarPreview(profile?.avatar_url || null);
    }
  };

  const uploadAvatar = async (userId: string, file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    if (profile?.avatar_url) {
      const oldFilePath = profile.avatar_url.split('avatars/')[1];
      if (oldFilePath) {
        const { error: deleteError } = await supabase.storage
          .from('avatars')
          .remove([oldFilePath]);
        if (deleteError && deleteError.message !== 'The resource was not found') {
          console.warn('Erro ao remover avatar antigo (pode não existir):', deleteError.message);
        }
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      throw new Error('Erro ao fazer upload do avatar: ' + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url || !session?.user?.id) {
      showError('Nenhum avatar para remover.');
      return;
    }

    if (!window.confirm("Tem certeza que deseja remover seu avatar?")) {
      return;
    }

    setIsRemovingAvatar(true);
    const toastId = showLoading('Removendo avatar...');

    try {
      const urlParts = profile.avatar_url.split('avatars/');
      const filePathInStorage = urlParts.length > 1 ? `avatars/${urlParts[1]}` : null;

      if (filePathInStorage) {
        const { error: deleteStorageError } = await supabase.storage
          .from('avatars')
          .remove([filePathInStorage]);

        if (deleteStorageError && deleteStorageError.message !== 'The resource was not found') {
          throw new Error('Erro ao remover avatar do storage: ' + deleteStorageError.message);
        }
      }

      const { error: updateDbError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', session.user.id);

      if (updateDbError) {
        throw new Error('Erro ao atualizar perfil no banco de dados: ' + updateDbError.message);
      }

      dismissToast(toastId);
      showSuccess('Avatar removido com sucesso!');
      setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
      setAvatarPreview(null);
      setSelectedAvatarFile(null);
      fetchProfile();
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao remover avatar: ' + error.message);
      console.error('Erro ao remover avatar:', error.message);
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    setIsSubmitting(true);
    const toastId = showLoading('Atualizando perfil...');

    let avatarUrlToSave = profile?.avatar_url || null;

    try {
      if (selectedAvatarFile && session?.user?.id) {
        avatarUrlToSave = await uploadAvatar(session.user.id, selectedAvatarFile);
      } else if (!selectedAvatarFile && profile && !profile.avatar_url) {
        avatarUrlToSave = null;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: values.first_name,
          last_name: values.last_name,
          avatar_url: avatarUrlToSave,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session?.user?.id);

      if (updateError) {
        throw new Error('Erro ao atualizar perfil: ' + updateError.message);
      }

      dismissToast(toastId);
      showSuccess('Perfil atualizado com sucesso!');
      fetchProfile();
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao salvar perfil: ' + error.message);
      console.error('Erro ao salvar perfil:', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSessionLoading || isLoadingProfile) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dyad-light-gray">
        <div className="text-center bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
          <h1 className="text-4xl font-bold mb-4 text-dyad-dark-blue">Acesso Negado</h1>
          <p className="text-xl text-gray-600">Você precisa estar logado para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Meu Perfil</h1>
      <p className="text-lg text-gray-600 mb-8">
        Gerencie suas informações pessoais e foto de perfil.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative w-32 h-32">
              <Avatar className="w-32 h-32 border-2 border-dyad-dark-blue">
                <AvatarImage src={avatarPreview || undefined} alt="Avatar do Usuário" />
                <AvatarFallback className="bg-dyad-vibrant-orange text-dyad-white text-4xl font-bold">
                  {profile?.first_name ? profile.first_name[0].toUpperCase() : <UserIcon className="w-16 h-16" />}
                </AvatarFallback>
              </Avatar>
              <Label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-dyad-dark-blue text-dyad-white p-2 rounded-full cursor-pointer hover:bg-dyad-vibrant-orange transition-colors">
                <Camera className="h-5 w-5" />
                <Input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />
              </Label>
            </div>
            <p className="text-sm text-gray-500">Clique na câmera para mudar seu avatar</p>
            {profile?.avatar_url && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveAvatar}
                disabled={isRemovingAvatar}
                className="mt-2"
              >
                {isRemovingAvatar ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remover Avatar
              </Button>
            )}
          </div>

          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Primeiro Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Seu primeiro nome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sobrenome</FormLabel>
                <FormControl>
                  <Input placeholder="Seu sobrenome" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormItem>
            <FormLabel>E-mail</FormLabel>
            <FormControl>
              <Input value={session.user.email || ''} disabled className="bg-gray-100" />
            </FormControl>
            <FormMessage />
          </FormItem>
          <FormItem>
            <FormLabel>Papel</FormLabel>
            <FormControl>
              <Input value={profile?.role || 'comprador'} disabled className="capitalize bg-gray-100" />
            </FormControl>
            <FormMessage />
          </FormItem>

          <Button type="submit" className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white py-3 text-lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Salvar Alterações
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default UserProfile;