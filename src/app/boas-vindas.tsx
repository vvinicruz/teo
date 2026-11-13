import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  FadeIn,
  Logo,
  Mascot,
  Pressable,
  Screen,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useAuth } from '../data/AuthProvider';
import { useData } from '../data/DataProvider';
import { monthOf, today } from '../domain/dates';
import { colors, radius, space } from '../theme';

type Step = 0 | 1 | 2;

export default function BoasVindas() {
  const { mode } = useAuth();
  const { data, updateSettings, addRecurrence } = useData();
  const { toast } = useFeedback();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState(0);
  const [negative, setNegative] = useState(false);
  const [salary, setSalary] = useState(0);
  const [payday, setPayday] = useState('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (withSalary: boolean) => {
    setError(null);
    const day = parseInt(payday, 10);
    if (withSalary && salary > 0 && !(day >= 1 && day <= 31)) {
      setError('o dia precisa ser entre 1 e 31.');
      return;
    }
    setSaving(true);
    try {
      if (withSalary && salary > 0) {
        const salario = data.categories.find((c) => c.icon === 'salario');
        await addRecurrence({
          kind: 'receita',
          amount: salary,
          description: 'salário',
          categoryId: salario?.id ?? null,
          paymentMethod: 'transferencia',
          dayOfMonth: day,
          startMonth: monthOf(today()),
          occurrences: null,
        });
      }
      await updateSettings({
        name: name.trim().toLowerCase(),
        initialBalance: negative ? -balance : balance,
        initialBalanceDate: today(),
        onboarded: true,
      });
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
      setSaving(false);
    }
  };

  const dots = (
    <View style={styles.dots}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.dot, i === step && styles.dotOn]} />
      ))}
    </View>
  );

  return (
    <Screen
      footer={
        step === 0 ? (
          <Button label="continuar" onPress={() => setStep(1)} disabled={!name.trim()} />
        ) : step === 1 ? (
          <Button label="continuar" onPress={() => setStep(2)} />
        ) : (
          <View style={{ gap: space.sm }}>
            <Button label="tudo pronto!" onPress={() => finish(true)} loading={saving} />
            <Button label="pular por enquanto" variant="ghost" onPress={() => finish(false)} disabled={saving} />
          </View>
        )
      }
    >
      <View style={styles.top}>
        <Logo height={28} />
        {dots}
      </View>

      {step === 0 && (
        <FadeIn key="s0" style={styles.step}>
          <Mascot size={72} />
          <Text variant="title">oi! que bom te ver por aqui.</Text>
          <Text color={colors.textSoft}>
            o teo vai te ajudar a entender seu dinheiro e planejar os próximos dias, sem complicação. como
            podemos te chamar?
          </Text>
          <TextField
            value={name}
            onChangeText={setName}
            placeholder="seu nome ou apelido"
            autoFocus
            maxLength={30}
            autoCapitalize="none"
            onSubmitEditing={() => name.trim() && setStep(1)}
            returnKeyType="next"
          />
          {mode === 'local' ? (
            <Card tone="cream" style={{ padding: space.lg }}>
              <Text variant="small" color={colors.textSoft}>
                você está no modo local: seus dados ficam só neste aparelho até a nuvem ser configurada.
              </Text>
            </Card>
          ) : null}
        </FadeIn>
      )}

      {step === 1 && (
        <FadeIn key="s1" style={styles.step}>
          <Text variant="title">quanto você tem hoje?</Text>
          <Text color={colors.textSoft}>
            some o que está na sua conta e na carteira. não precisa ser exato, dá pra ajustar depois.
          </Text>
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <AmountInput
              value={balance}
              onChange={setBalance}
              autoFocus
              color={negative ? colors.danger : colors.text}
            />
            <Pressable onPress={() => setNegative((v) => !v)} style={styles.toggle} accessibilityRole="switch" accessibilityState={{ checked: negative }}>
              <View style={[styles.check, negative && styles.checkOn]} />
              <Text variant="small" color={colors.textSoft}>
                estou no negativo
              </Text>
            </Pressable>
          </Card>
        </FadeIn>
      )}

      {step === 2 && (
        <FadeIn key="s2" style={styles.step}>
          <Text variant="title">você recebe salário?</Text>
          <Text color={colors.textSoft}>
            se sim, conta pra gente quanto e em que dia. assim o horizonte de saldo já mostra o que vem por aí.
          </Text>
          <Card style={{ gap: space.lg }}>
            <AmountInput value={salary} onChange={setSalary} label="valor que cai na conta" color={colors.income} />
            <TextField
              label="dia do pagamento"
              value={payday}
              onChangeText={(t) => setPayday(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              inputMode="numeric"
              error={error}
              hint="se o mês não tiver esse dia, usamos o último dia do mês."
            />
          </Card>
        </FadeIn>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg, paddingBottom: space.xxl },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.line },
  dotOn: { width: 22, backgroundColor: colors.primary },
  step: { gap: space.lg },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  check: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: colors.textFaint },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
