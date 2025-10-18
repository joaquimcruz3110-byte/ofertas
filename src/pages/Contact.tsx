"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

const ContactPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const toastId = showLoading('Enviando sua mensagem...');

    try {
      // Basic validation
      if (!name || !email || !subject || !message) {
        throw new Error('Por favor, preencha todos os campos obrigatórios.');
      }

      // Invocando a Edge Function para enviar o e-mail
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'empregocerto@olimpiamais.com.br', // E-mail de destino para o contato
          subject: `Contato Olímpia Ofertas: ${subject} (de ${name})`,
          htmlContent: `
            <p><strong>Nome:</strong> ${name}</p>
            <p><strong>E-mail:</strong> ${email}</p>
            <p><strong>Assunto:</strong> ${subject}</p>
            <p><strong>Mensagem:</strong></p>
            <p>${message}</p>
          `,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      dismissToast(toastId);
      showSuccess('Sua mensagem foi enviada com sucesso! Em breve entraremos em contato.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (error: any) {
      dismissToast(toastId);
      showError('Erro ao enviar mensagem: ' + error.message);
      console.error('Erro ao enviar mensagem de contato:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-dyad-white p-8 rounded-dyad-rounded-lg shadow-dyad-soft max-w-4xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)} // Volta para a página anterior
        className="mb-6 text-dyad-dark-blue hover:bg-dyad-light-gray"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <h1 className="text-3xl font-bold mb-6 text-dyad-dark-blue">Entre em Contato</h1>
      <p className="text-lg text-gray-600 mb-8">
        Tem alguma dúvida, sugestão ou precisa de suporte? Envie-nos uma mensagem!
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="name">Seu Nome</Label>
          <Input
            id="name"
            type="text"
            placeholder="Seu nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor="email">Seu E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu.email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor="subject">Assunto</Label>
          <Input
            id="subject"
            type="text"
            placeholder="Assunto da mensagem"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <Label htmlFor="message">Mensagem</Label>
          <Textarea
            id="message"
            placeholder="Digite sua mensagem aqui..."
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>
        <Button type="submit" className="w-full bg-dyad-dark-blue hover:bg-dyad-vibrant-orange text-dyad-white py-3 text-lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          Enviar Mensagem
        </Button>
      </form>
    </div>
  );
};

export default ContactPage;