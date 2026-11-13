import { describe, expect, it } from 'vitest';
import { describeAuthError, validateEmail } from '../auth';

const supabaseError = (message: string, code?: string) => Object.assign(new Error(message), { code });

describe('validação de e-mail', () => {
  it('aceita e-mails normais e limpa espaços e maiúsculas', () => {
    expect(validateEmail('  Vini.Cruz+teo@Gmail.com ')).toEqual({ email: 'vini.cruz+teo@gmail.com', problem: null });
  });
  it('explica quando tem acento ou ç', () => {
    const r = validateEmail('teteugostozão44@gmail.com');
    expect(r.problem).toContain('acento');
    expect(r.problem).toContain('ã');
    expect(validateEmail('joão@gmail.com').problem).toContain('ã');
    expect(validateEmail('françoise@gmail.com').problem).toContain('ç');
  });
  it('pega erros comuns de digitação', () => {
    expect(validateEmail('').problem).toBeTruthy();
    expect(validateEmail('vini gmail.com').problem).toContain('espaços');
    expect(validateEmail('vinigmail.com').problem).toContain('@');
    expect(validateEmail('vini@gmail').problem).toBeTruthy();
    expect(validateEmail('vini@@gmail.com').problem).toBeTruthy();
  });
});

describe('erros do supabase', () => {
  it('formato inválido aponta para o campo de e-mail (o erro que aconteceu de verdade)', () => {
    const r = describeAuthError(supabaseError('Unable to validate email address: invalid format', 'validation_failed'));
    expect(r.field).toBe('email');
    expect(r.message).not.toContain('algo não deu certo');
  });
  it('traduz pelo código', () => {
    expect(describeAuthError(supabaseError('x', 'invalid_credentials')).field).toBe('senha');
    expect(describeAuthError(supabaseError('x', 'user_already_exists')).message).toContain('já tem conta');
    expect(describeAuthError(supabaseError('x', 'over_email_send_rate_limit')).message).toContain('tentativas');
    expect(describeAuthError(supabaseError('x', 'weak_password')).field).toBe('senha');
  });
  it('erro desconhecido vira mensagem geral, nunca embaixo da senha', () => {
    expect(describeAuthError(new Error('boom')).field).toBe('geral');
  });
});
