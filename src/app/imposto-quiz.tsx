import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AmountInput, Button, Chip, FadeIn, IconButton, Screen, Text } from '../components';
import { EMPTY_ANSWERS, irpfStatus, type IrpfAnswers } from '../domain/irpf';
import { formatMoney } from '../domain/money';
import { useIrpf } from '../hooks/useIrpf';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';

type YesNoKey = Exclude<keyof IrpfAnswers, 'taxableIncome'>;

export default function ImpostoQuiz() {
  const todayDate = useToday();
  const { cycle } = irpfStatus(todayDate);
  const irpf = useIrpf();
  const [answers, setAnswers] = useState<IrpfAnswers>(irpf.answersFor(cycle.year) ?? EMPTY_ANSWERS);
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState(answers.taxableIncome ?? 0);

  const fmt = (c: number) => formatMoney(c).replace(',00', '');
  const questions: { key: YesNoKey; title: string; help: string }[] = [
    {
      key: 'assetsOver',
      title: `em 31/12/${cycle.baseYear}, tudo o que você tinha somava mais de ${fmt(cycle.limits.assets)}?`,
      help: 'conta casa, apartamento, carro, dinheiro no banco e investimentos (pelo valor de compra, não de mercado).',
    },
    {
      key: 'exemptOver',
      title: `recebeu mais de ${fmt(cycle.limits.exemptIncome)} que não pagam imposto?`,
      help: 'ex.: fgts sacado, indenizações, herança, lucros de empresa, rendimento de poupança, plr.',
    },
    {
      key: 'capitalGain',
      title: 'vendeu algo com lucro?',
      help: 'ex.: vendeu um imóvel, um carro ou outro bem por mais do que pagou.',
    },
    {
      key: 'stockMarket',
      title: `vendeu mais de ${fmt(cycle.limits.stockSales)} em ações ou fundos na bolsa?`,
      help: 'ou teve lucro com imposto a pagar na bolsa. se nunca investiu em bolsa, é "não".',
    },
    { key: 'rural', title: `teve atividade rural com receita acima de ${fmt(cycle.limits.ruralRevenue)}?`, help: 'ex.: produção agrícola ou criação de animais.' },
    { key: 'newResident', title: `passou a morar no brasil em ${cycle.baseYear}?`, help: 'se você já morava aqui, é "não".' },
    { key: 'abroad', title: 'teve dinheiro, bens ou rendimentos no exterior?', help: 'ex.: conta ou investimento fora do brasil, lucros de empresa estrangeira.' },
  ];
  const total = questions.length + 1;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/imposto'));

  const finish = (a: IrpfAnswers) => {
    irpf.saveAnswers(cycle.year, a);
    if (router.canGoBack()) router.back();
    else router.replace('/imposto');
  };

  const answer = (key: YesNoKey, value: boolean) => {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step >= total - 1) finish(next);
    else setStep(step + 1);
  };

  const q = step > 0 ? questions[step - 1] : null;

  return (
    <Screen title="preciso declarar?" right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${((step + 1) / total) * 100}%` }]} />
      </View>
      <Text variant="caption" color={colors.textFaint} style={{ marginTop: space.sm }}>
        pergunta {step + 1} de {total} · sobre o que aconteceu em {cycle.baseYear}
      </Text>

      {step === 0 ? (
        <FadeIn key="renda" style={styles.step}>
          <Text variant="title">quanto você recebeu em {cycle.baseYear}?</Text>
          <Text color={colors.textSoft}>
            some salário (com 13º e férias), aposentadoria, aluguel e trabalhos por conta. use o valor bruto, antes dos
            descontos. pode ser aproximado.
          </Text>
          <AmountInput value={income} onChange={setIncome} autoFocus />
          <Button
            label="continuar"
            onPress={() => {
              setAnswers({ ...answers, taxableIncome: income });
              setStep(1);
            }}
          />
          <Text variant="small" color={colors.textFaint} center>
            dica: o informe de rendimentos da empresa traz esse total.
          </Text>
        </FadeIn>
      ) : q ? (
        <FadeIn key={q.key} style={styles.step}>
          <Text variant="title">{q.title}</Text>
          <Text color={colors.textSoft}>{q.help}</Text>
          <View style={styles.answers}>
            <Chip label="sim" selected={answers[q.key] === true} onPress={() => answer(q.key, true)} />
            <Chip label="não" selected={answers[q.key] === false} onPress={() => answer(q.key, false)} />
          </View>
          <Button label="voltar" variant="ghost" small onPress={() => setStep(step - 1)} style={{ alignSelf: 'flex-start' }} />
        </FadeIn>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: colors.muted, overflow: 'hidden', marginTop: space.md },
  barFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
  step: { gap: space.lg, marginTop: space.xl },
  answers: { flexDirection: 'row', gap: space.sm },
});
