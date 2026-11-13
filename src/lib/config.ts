/**
 * configuração do supabase.
 *
 * a url e a chave "publishable" são públicas por natureza (vão dentro do app):
 * quem protege os dados são as regras de row level security em supabase/migrations.
 * nunca coloque aqui a chave secreta (sb_secret_...).
 *
 * para apontar para outro projeto (ex.: testes), defina EXPO_PUBLIC_SUPABASE_URL e
 * EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env. para rodar sem nuvem (modo local),
 * defina EXPO_PUBLIC_MODO_LOCAL=1.
 */
const PROJECT_URL = 'https://rpyqlnbepnwydiwcohvc.supabase.co';
const PROJECT_PUBLISHABLE_KEY = 'sb_publishable_zKau_cC0gVYjZuf55l848Q_y62L-bto';

const forceLocal = process.env.EXPO_PUBLIC_MODO_LOCAL === '1';

export const SUPABASE_URL = forceLocal ? '' : (process.env.EXPO_PUBLIC_SUPABASE_URL || PROJECT_URL);
export const SUPABASE_ANON_KEY = forceLocal
  ? ''
  : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || PROJECT_PUBLISHABLE_KEY;

/** sem supabase configurado, o teo roda em modo local (dados só neste aparelho). */
export const isCloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
