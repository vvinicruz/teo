import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, FadeIn, Logo, Pressable, Screen, Segmented, Text, TextField, useFeedback } from '../components';
import { friendlyAuthError, useAuth } from '../data/AuthProvider';
import { colors, space } from '../theme';

type Mode = 'entrar' | 'criar';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Entrar() {
  const auth = useAuth();
  const { toast } = useFeedback();
  const [mode, setMode] = useState<Mode>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setEmailError(null);
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setEmailError('esse e-mail não parece certo.');
    if (password.length < 6) return setError('a senha precisa ter pelo menos 6 caracteres.');
    setLoading(true);
    try {
      if (mode === 'entrar') {
        await auth.signIn(e, password);
      } else {
        const { needsConfirmation } = await auth.signUp(e, password);
        if (needsConfirmation) setSent(e);
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) return setEmailError('digita seu e-mail aqui que a gente te manda o link.');
    try {
      await auth.resetPassword(e);
      toast('enviamos um link para criar uma nova senha.');
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  };

  if (sent) {
    return (
      <Screen>
        <FadeIn style={styles.hero}>
          <Logo height={44} />
          <Text variant="title" center style={{ marginTop: space.xxl }}>
            quase lá!
          </Text>
          <Text color={colors.textSoft} center style={styles.lead}>
            mandamos um link de confirmação para {sent}. é só abrir e voltar aqui para entrar.
          </Text>
          <Button
            label="já confirmei, quero entrar"
            onPress={() => {
              setSent(null);
              setMode('entrar');
            }}
            style={{ marginTop: space.xxl, alignSelf: 'stretch' }}
          />
        </FadeIn>
      </Screen>
    );
  }

  return (
    <Screen>
      <FadeIn style={styles.hero}>
        <Logo height={56} />
        <Text variant="heading" color={colors.primary} style={{ marginTop: space.md }}>
          tudo em ordem.
        </Text>
        <Text color={colors.textSoft} center style={styles.lead}>
          oi! vamos deixar seu dinheiro organizado, do seu jeito e no seu ritmo?
        </Text>
      </FadeIn>

      <FadeIn delay={80}>
        <Card style={{ gap: space.lg }}>
          <Segmented<Mode>
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
              setEmailError(null);
            }}
            options={[
              { value: 'entrar', label: 'entrar' },
              { value: 'criar', label: 'criar conta' },
            ]}
          />
          <TextField
            label="e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            placeholder="voce@email.com"
            textContentType="emailAddress"
            error={emailError}
          />
          <TextField
            label="senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            placeholder="pelo menos 6 caracteres"
            onSubmitEditing={submit}
            error={error}
          />
          <Button label={mode === 'entrar' ? 'entrar' : 'criar minha conta'} onPress={submit} loading={loading} />
          {mode === 'entrar' ? (
            <Pressable onPress={forgot} style={{ alignSelf: 'center' }} hitSlop={8}>
              <Text variant="smallStrong" color={colors.primary}>
                esqueci minha senha
              </Text>
            </Pressable>
          ) : null}
        </Card>
      </FadeIn>

      <Text variant="small" color={colors.textFaint} center style={{ marginTop: space.xl }}>
        seus dados ficam protegidos e só você tem acesso a eles.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.xxxl, paddingBottom: space.xxl },
  lead: { marginTop: space.md, maxWidth: 320 },
});
