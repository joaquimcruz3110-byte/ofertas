-- Cria uma view para combinar informações de perfil com detalhes de autenticação do usuário
CREATE OR REPLACE VIEW public.user_details AS
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.role,
  au.email
FROM
  public.profiles p
JOIN
  auth.users au ON p.id = au.id;

-- Não é necessário habilitar RLS ou criar políticas diretamente em views.
-- A segurança será herdada das tabelas subjacentes (public.profiles e auth.users).