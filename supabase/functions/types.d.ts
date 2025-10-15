/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
/// <reference lib="dom" /> // Necessário para 'crypto.randomUUID()'

// Declaração global para o objeto Deno
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Declaração de módulo para 'https://deno.land/std@0.190.0/http/server.ts'
declare module "https://deno.land/std@0.190.0/http/server.ts" {
  export const serve: (handler: (req: Request) => Promise<Response> | Response) => Promise<void>;
}

// Declaração de módulo para '@supabase/supabase-js' via npm:
declare module "npm:@supabase/supabase-js@2.45.0" {
  import { SupabaseClient } from '@supabase/supabase-js';
  export const createClient: (supabaseUrl: string, supabaseKey: string, options?: any) => SupabaseClient;
}

// Declaração de módulo para 'mercadopago' via npm:
declare module "npm:mercadopago@2.0.0" {
  export class MercadoPagoConfig {
    accessToken: string; // Adicionado para resolver o erro TS2339
    constructor(options: { accessToken: string; options?: { timeout?: number; idempotencyKey?: string } });
  }
  export class Preference {
    constructor(client: MercadoPagoConfig);
    create(body: any): Promise<any>;
  }
  // Adicione outras classes ou interfaces do MercadoPago conforme necessário
}