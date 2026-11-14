import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, FadeIn, Logo, Pressable, Screen, Segmented, Text, TextField, useFeedback } from '../components';
import { useAuth } from '../data/AuthProvider';
import { describeAuthError, validateEmail, type AuthField } from '../domain/auth';
import { colors, space } from '../theme';

type Mode = 'entrar' | 'criar';

export default function Entrar() {
  const auth = useAuth();
  const { toast } = useFeedback();
  const [mode, setMode] = useState<Mode>('entrar');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // cada erro aparece embaixo do campo a que se refere; o resto, acima do botão.
  const [problem, setProblem] = useState<{ field: AuthField; message: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const errorFor = (field: AuthField) => (problem?.field === field ? problem.message : null);

  const submit = async () => {
    setProblem(null);
    const { email: e, problem: emailProblem } = validateEmail(email);
    if (emailProblem) return setProblem({ field: 'email', message: emailProblem });
    if (password.length < 6) return setProblem({ field: 'senha', message: 'a senha precisa ter pelo menos 6 caracteres.' });
    setLoading(true);
    try {
      if (mode === 'entrar') {
        await auth.signIn(e, password);
      } else {
        const { needsConfirmation } = await auth.signUp(e, password);
        if (needsConfirmation) setSent(e);
      }
    } catch (err) {
      setProblem(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    setProblem(null);
    const { email: e, problem: emailProblem } = validateEmail(email);
    if (emailProblem) {
      return setProblem({ field: 'email', message: email.trim() ? emailProblem : 'digita seu e-mail aqui que a gente te manda o link.' });
    }
    try {
      await auth.resetPassword(e);
      toast('enviamos um link para criar uma nova senha.');
    } catch (err) {
      setProblem(describeAuthError(err));
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
              setProblem(null);
            }}
            options={[
              { value: 'entrar', label: 'entrar' },
              { value: 'criar', label: 'criar conta' },
            ]}
          />
          <TextField
            label="e-mail"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (problem?.field === 'email') setProblem(null);
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            placeholder="voce@email.com"
            textContentType="emailAddress"
            error={errorFor('email')}
          />
          <TextField
            label="senha"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (problem?.field === 'senha') setProblem(null);
            }}
            secureTextEntry
            autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
            placeholder="pelo menos 6 caracteres"
            onSubmitEditing={submit}
            error={errorFor('senha')}
          />
          {errorFor('geral') ? (
            <Text variant="small" color={colors.danger} center>
              {errorFor('geral')}
            </Text>
          ) : null}
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
      <Text variant="small" color={colors.textFaint} center style={{ marginTop: space.sm }}>
        {mode === 'criar' ? 'ao criar sua conta, você concorda com os ' : 'veja os '}
        <Text variant="smallStrong" color={colors.primary} onPress={() => router.push('/termos')} accessibilityRole="link">
          termos de uso
        </Text>
        {' e a '}
        <Text variant="smallStrong" color={colors.primary} onPress={() => router.push('/privacidade')} accessibilityRole="link">
          política de privacidade
        </Text>
        .
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.xxxl, paddingBottom: space.xxl },
  lead: { marginTop: space.md, maxWidth: 320 },
});
