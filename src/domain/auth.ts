/**
 * validação de e-mail e tradução dos erros de login para o tom do teo.
 * fica no domínio (sem react) para poder ser testado.
 */

export type AuthField = 'email' | 'senha' | 'geral';

export interface AuthProblem {
  field: AuthField;
  message: string;
}

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/** limpa o e-mail digitado e explica o problema, se houver. */
export function validateEmail(raw: string): { email: string; problem: null } | { email: string; problem: string } {
  const email = raw.trim().toLowerCase();
  if (!email) return { email, problem: 'digita seu e-mail aqui.' };
  if (/\s/.test(email)) return { email, problem: 'o e-mail não pode ter espaços.' };
  // acentos e ç são o erro mais comum: e-mails só aceitam letras sem acento.
  const accented = email.match(/[^\x00-\x7f]/);
  if (accented) {
    return {
      email,
      problem: `e-mails não aceitam acento nem ç (tem um "${accented[0]}" aí). confere se digitou certinho?`,
    };
  }
  if (!email.includes('@')) return { email, problem: 'faltou o @ no e-mail.' };
  if (!EMAIL_RE.test(email)) return { email, problem: 'esse e-mail não parece certo. confere se digitou certinho?' };
  return { email, problem: null };
}

/** traduz um erro do supabase (pelo código e, na falta dele, pela mensagem). */
export function describeAuthError(err: unknown): AuthProblem {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err ?? '').toLowerCase();
  const is = (...codes: string[]) => codes.includes(code);

  if (is('email_address_invalid') || msg.includes('validate email') || msg.includes('invalid format')) {
    return { field: 'email', message: 'esse e-mail não parece certo. confere se digitou certinho?' };
  }
  if (is('email_address_not_authorized') || msg.includes('not authorized')) {
    return { field: 'email', message: 'ainda não conseguimos enviar e-mails para esse endereço. tenta outro?' };
  }
  if (is('user_already_exists', 'email_exists') || msg.includes('already registered')) {
    return { field: 'email', message: 'esse e-mail já tem conta. que tal entrar?' };
  }
  if (is('invalid_credentials') || msg.includes('invalid login')) {
    return { field: 'senha', message: 'e-mail ou senha não conferem. tenta de novo?' };
  }
  if (is('email_not_confirmed') || msg.includes('email not confirmed')) {
    return { field: 'geral', message: 'falta confirmar seu e-mail. dá uma olhadinha na sua caixa de entrada.' };
  }
  if (is('weak_password') || msg.includes('password')) {
    return { field: 'senha', message: 'essa senha é fraca. use pelo menos 6 caracteres, misturando letras e números.' };
  }
  if (is('over_request_rate_limit', 'over_email_send_rate_limit') || msg.includes('rate limit')) {
    return { field: 'geral', message: 'muitas tentativas seguidas. espera um pouquinho e tenta de novo.' };
  }
  if (is('signup_disabled') || msg.includes('signups not allowed')) {
    return { field: 'geral', message: 'os cadastros estão fechados no momento.' };
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return { field: 'geral', message: 'parece que você está sem internet. confere a conexão?' };
  }
  return { field: 'geral', message: 'algo não deu certo. tenta de novo em instantes?' };
}
