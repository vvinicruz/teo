/**
 * configuração do supabase. as chaves vêm do arquivo .env (veja .env.example).
 * a chave "anon/publishable" é pública por natureza: quem protege os dados são as
 * regras de segurança (row level security) definidas em supabase/migrations.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** sem supabase configurado, o teo roda em modo local (dados só neste aparelho). */
export const isCloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
