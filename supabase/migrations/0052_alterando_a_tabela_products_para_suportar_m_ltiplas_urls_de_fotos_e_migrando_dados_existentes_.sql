-- Renomear a coluna photo_url para photo_urls e alterar seu tipo para JSONB
ALTER TABLE public.products
RENAME COLUMN photo_url TO photo_urls;

ALTER TABLE public.products
ALTER COLUMN photo_urls TYPE JSONB USING CASE
    WHEN photo_urls IS NULL THEN '[]'::JSONB
    ELSE JSONB_BUILD_ARRAY(photo_urls)
END;

-- Definir o valor padrão para photo_urls como um array JSON vazio
ALTER TABLE public.products
ALTER COLUMN photo_urls SET DEFAULT '[]'::JSONB;

-- Atualizar as políticas RLS para usar a nova coluna photo_urls
-- As políticas existentes que referenciam 'photo_url' precisarão ser ajustadas se houver alguma lógica específica de RLS baseada nela.
-- No momento, as políticas RLS para 'products' não fazem referência direta a 'photo_url' para validação,
-- mas é bom revisar para garantir que não haja impacto inesperado.
-- As políticas de storage para 'product_images' já usam o ID do produto e não o nome do arquivo diretamente,
-- então elas devem continuar funcionando para múltiplos arquivos dentro da pasta do produto.