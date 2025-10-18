-- Criar a tabela 'banners'
CREATE TABLE public.banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  cta_text TEXT,
  cta_link TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela 'banners' (OBRIGATÓRIO para segurança)
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para a tabela 'banners'
-- Administradores podem gerenciar todos os banners
CREATE POLICY "Admins can manage all banners" ON public.banners
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Usuários autenticados e não autenticados podem ver banners ativos
CREATE POLICY "Public and authenticated users can view active banners" ON public.banners
FOR SELECT USING (is_active = TRUE);

-- Criar o bucket de armazenamento 'banner_images'
INSERT INTO storage.buckets (id, name, public)
VALUES ('banner_images', 'banner_images', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS para o bucket 'banner_images'
-- Permitir acesso público de leitura
CREATE POLICY "Public read access for banner images" ON storage.objects
FOR SELECT USING (bucket_id = 'banner_images');

-- Permitir que administradores façam upload, atualizem e deletem imagens de banners
CREATE POLICY "Admins can manage banner images" ON storage.objects
FOR ALL TO authenticated USING (bucket_id = 'banner_images' AND public.is_admin()) WITH CHECK (bucket_id = 'banner_images' AND public.is_admin());