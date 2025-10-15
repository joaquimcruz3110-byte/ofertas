// @ts-nocheck
/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const { to, subject, htmlContent } = await req.json();

    if (!to || !subject || !htmlContent) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, htmlContent' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const emailServiceApiKey = Deno.env.get('EMAIL_SERVICE_API_KEY');
    const emailServiceApiUrl = Deno.env.get('EMAIL_SERVICE_API_URL');

    if (!emailServiceApiKey || !emailServiceApiUrl) {
      console.error('EMAIL_SERVICE_API_KEY or EMAIL_SERVICE_API_URL not set in environment variables.');
      return new Response(JSON.stringify({ error: 'Email service not configured. Please set EMAIL_SERVICE_API_KEY and EMAIL_SERVICE_API_URL.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Este é um exemplo genérico de como você pode chamar uma API de serviço de e-mail.
    // Você precisará adaptar o 'body' e os 'headers' para o serviço de e-mail que você usa (ex: Mailgun, SendGrid).
    const emailResponse = await fetch(emailServiceApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${emailServiceApiKey}`, // Exemplo para APIs que usam Bearer Token
      },
      body: JSON.stringify({
        to: to,
        from: 'Olímpia Ofertas <no-reply@olimpiaofertas.com>', // Altere para o seu e-mail de remetente
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error(`Failed to send email: ${emailResponse.status} - ${errorBody}`);
      return new Response(JSON.stringify({ error: `Failed to send email: ${errorBody}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Email sent successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in send-email function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});