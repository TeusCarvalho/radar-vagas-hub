import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase não configurado. Verifique VITE_SUPABASE_URL e " +
        "VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local.",
    );
  }

  client = createClient(url, publishableKey, {
    // Consultas de listagem: evitar tentativas internas prolongadas quando a
    // conexão estiver indisponível. A UI oferece "Tentar novamente".
    db: { retry: false },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
