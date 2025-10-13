"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const { session, isLoading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && session) {
      // Redireciona para a página inicial se o usuário já estiver autenticado
      navigate('/');
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue text-dyad-white">Carregando...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dyad-dark-blue p-4">
      <div className="w-full max-w-md bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft">
        <h2 className="text-3xl font-bold text-center text-dyad-dark-blue mb-6">Bem-vindo(a)</h2>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Você pode adicionar 'google', 'facebook' etc. aqui se desejar
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#F97316', // Laranja vibrante
                  brandAccent: '#E06000', // Laranja mais escuro para hover
                  defaultButtonBackground: '#1E3A8A', // Azul escuro para botões
                  defaultButtonBackgroundHover: '#152B6A', // Azul escuro mais escuro para hover
                  inputBackground: '#F3F4F6', // Cinza claro para inputs
                  inputBorder: '#D1D5DB', // Borda cinza
                  inputText: '#1F2937', // Texto cinza escuro
                  messageText: '#1F2937', // Texto de mensagem
                  messageBackground: '#F3F4F6', // Fundo de mensagem
                },
                radii: {
                  borderRadiusButton: '8px',
                  inputBorderRadius: '8px',
                },
              },
            },
          }}
          theme="light"
          localization={{
            variables: {
              sign_in: {
                email_label: 'Seu e-mail',
                password_label: 'Sua senha',
                email_input_placeholder: 'Digite seu e-mail',
                password_input_placeholder: 'Digite sua senha',
                button_label: 'Entrar',
                social_provider_text: 'Ou continue com',
                link_text: 'Já tem uma conta? Entrar',
                // A propriedade forgotten_password_text não é necessária aqui,
                // pois o bloco 'forgotten_password' no nível superior já cuida disso.
                // confirmation_text: 'Verifique seu e-mail para o link de login', // Removido
              },
              sign_up: {
                email_label: 'Seu e-mail',
                password_label: 'Crie uma senha',
                email_input_placeholder: 'Digite seu e-mail',
                password_input_placeholder: 'Crie sua senha',
                button_label: 'Cadastrar',
                social_provider_text: 'Ou continue com',
                link_text: 'Não tem uma conta? Cadastrar',
                confirmation_text: 'Verifique seu e-mail para o link de confirmação',
              },
              forgotten_password: {
                email_label: 'Seu e-mail',
                email_input_placeholder: 'Digite seu e-mail',
                button_label: 'Enviar instruções de redefinição',
                link_text: 'Lembrou sua senha? Entrar',
                confirmation_text: 'Verifique seu e-mail para o link de redefinição de senha',
              },
              update_password: {
                password_label: 'Nova senha',
                password_input_placeholder: 'Digite sua nova senha',
                button_label: 'Atualizar senha',
                confirmation_text: 'Sua senha foi atualizada',
              },
            },
          }}
        />
      </div>
    </div>
  );
};

export default Login;