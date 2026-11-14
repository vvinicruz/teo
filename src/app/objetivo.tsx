import { router, useLocalSearchParams } from 'expo-router';
import { CalendarClock, Check, Flame, Minus, Pencil, Plus, Repeat } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  CategoryIcon,
  EntryRow,
  GoalMoveSheet,
  Icon,
  IconButton,
  Mascot,
  Money,
  ProgressBar,
  Screen,
  Section,
  Sheet,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { addMonths, monthName, monthOf, parseISODate } from '../domain/dates';
import { goalProgress } from '../domain/finance';
import { goalForecast, goalPlan, goalStreak, MILESTONES } from '../domain/goals';
import { goalSaved } from '../domain/investments';
import { formatMoney } from '../domain/money';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';

export default function Objetivo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, addRecurrence, updateRecurrence, deleteRecurrence } = useData();
  const { toast, confirm } = useFeedback();
  const todayDate = useToday();
  const goal = data.goals.find((g) => g.id === id);
  const [move, setMove] = useState<'guardar' | 'retirar' | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planAmount, setPlanAmount] = useState(0);
  const [planDay, setPlanDay] = useState('5');
  const [saving, setSaving] = useState(false);

  const view = useMemo(() => {
    if (!goal) return null;
    return {
      forecast: goalForecast(data, goal, todayDate),
      streak: goalStreak(data, goal, todayDate),
      plan: goalPlan(data, goal, todayDate),
      moves: goal.investmentId
        ? data.transactions
            .filter((t) => t.investmentId === goal.investmentId)
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 8)
        : [],
    };
  }, [data, goal, todayDate]);

  if (!goal || !view) {
    return (
      <Screen back title="meta">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          essa meta não existe mais.
        </Text>
      </Screen>
    );
  }

  const { forecast: f, streak, plan } = view;
  const saved = goalSaved(data, goal);
  const progress = goalProgress(saved, goal.target);
  const done = saved >= goal.target;
  const investment = goal.investmentId ? data.investments.find((i) => i.id === goal.investmentId) : undefined;
  const hide = data.settings.hideValues;

  const openPlan = () => {
    setPlanAmount(plan?.amount ?? f.neededPerMonth ?? 0);
    setPlanDay(String(plan?.dayOfMonth ?? 5));
    setPlanOpen(true);
  };

  const savePlan = async () => {
    const day = parseInt(planDay, 10);
    if (!investment || planAmount <= 0 || !(day >= 1 && day <= 31)) return;
    setSaving(true);
    try {
      if (plan) {
        await updateRecurrence({ ...plan, amount: planAmount, dayOfMonth: day });
        toast('combinado! valor atualizado.');
      } else {
        // começa neste mês se o dia ainda não passou; senão, no próximo.
        const start = day >= parseISODate(todayDate).day ? monthOf(todayDate) : addMonths(monthOf(todayDate), 1);
        await addRecurrence({
          kind: 'despesa',
          amount: planAmount,
          description: `guardar para ${goal.name}`,
          categoryId: null,
          paymentMethod: 'transferencia',
          dayOfMonth: day,
          startMonth: start,
          occurrences: null,
          cardId: null,
          investmentId: investment.id,
        });
        toast('combinado! vai aparecer no seu horizonte todo mês.');
      }
      setPlanOpen(false);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  const stopPlan = async () => {
    if (!plan) return;
    const ok = await confirm({
      title: 'parar de guardar todo mês?',
      message: 'as próximas previsões saem do horizonte. o que já foi guardado continua na caixinha.',
      confirmLabel: 'parar',
    });
    if (!ok) return;
    try {
      await deleteRecurrence(plan.id);
      setPlanOpen(false);
      toast('combinado. você pode voltar quando quiser.', 'info');
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  // frase do ritmo, sempre no tom do teo.
  const paceText = done
    ? 'meta concluída! que orgulho :)'
    : f.pace && f.etaMonth
      ? `no seu ritmo${hide ? '' : ` (${formatMoney(f.pace)} por mês)`}, você chega lá em ${monthName(f.etaMonth, f.etaMonth.slice(0, 4) !== todayDate.slice(0, 4))}.`
      : 'guarde um pouquinho para o teo calcular quando você chega lá.';

  return (
    <Screen
      back
      title={goal.name}
      right={<IconButton icon={Pencil} label="editar meta" onPress={() => router.push({ pathname: '/meta', params: { id: goal.id } })} background={colors.surface} />}
    >
      <Card style={styles.hero}>
        {done ? <Mascot size={72} /> : <CategoryIcon icon={goal.icon} size={64} />}
        <Text variant="title" center>
          <Money value={saved} variant="title" />
        </Text>
        <Text color={colors.textSoft} center>
          de {hide ? 'R$ ••••' : formatMoney(goal.target)}
          {investment ? ` · guardado em ${investment.name}` : ''}
        </Text>
        <View style={styles.progressRow}>
          <View style={{ flex: 1 }}>
            <ProgressBar value={progress} height={12} />
          </View>
          <Text variant="bodyStrong">{Math.floor(progress * 100)}%</Text>
        </View>
        <View style={styles.milestones}>
          {MILESTONES.map((m) => {
            const reached = progress * 100 >= m;
            return (
              <View key={m} style={[styles.milestone, reached && styles.milestoneOn]}>
                {reached ? <Icon as={Check} size={12} color={colors.white} strokeWidth={2.6} /> : null}
                <Text variant="caption" color={reached ? colors.white : colors.textFaint}>
                  {m}%
                </Text>
              </View>
            );
          })}
        </View>
        {!done ? (
          <View style={styles.actions}>
            <Button label="guardar" icon={Plus} small onPress={() => setMove('guardar')} style={{ flex: 1 }} />
            <Button label="retirar" icon={Minus} small variant="ghost" onPress={() => setMove('retirar')} style={{ flex: 1 }} />
          </View>
        ) : null}
      </Card>

      <Card tone="cream" style={styles.pace}>
        <Text variant="bodyStrong">{paceText}</Text>
        {!done && f.boost && !hide ? (
          <Text variant="small" color={colors.textSoft}>
            guardando {formatMoney(f.boost.extra)} a mais por mês, você chega {f.boost.monthsSooner}{' '}
            {f.boost.monthsSooner === 1 ? 'mês' : 'meses'} antes.
          </Text>
        ) : null}
        {!done && goal.deadline && f.neededPerMonth ? (
          <Text variant="small" color={f.onTrack ? colors.income : colors.textSoft}>
            {f.onTrack
              ? `você está dentro do prazo de ${monthName(monthOf(goal.deadline), true)}.`
              : `pra chegar até ${monthName(monthOf(goal.deadline), true)}, seriam ${hide ? 'R$ ••••' : formatMoney(f.neededPerMonth)} por mês.`}
          </Text>
        ) : null}
      </Card>

      <View style={styles.streak}>
        <View style={[styles.flame, streak.months > 0 && styles.flameOn]}>
          <Icon as={Flame} size={20} color={streak.months > 0 ? colors.white : colors.textFaint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">
            {streak.months === 0
              ? 'comece uma sequência'
              : streak.months === 1
                ? 'sequência começou: 1 mês guardando'
                : `${streak.months} meses seguidos guardando`}
          </Text>
          <Text variant="small" color={colors.textSoft}>
            {streak.thisMonth
              ? 'este mês já está garantido. continua assim!'
              : streak.months > 0
                ? 'guarde qualquer valor este mês para não perder a sequência.'
                : 'guarde qualquer valor este mês. todo começo conta.'}
          </Text>
        </View>
      </View>

      <Section title="guardar todo mês">
        {investment ? (
          plan ? (
            <Card onPress={openPlan} style={styles.planRow}>
              <Icon as={Repeat} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">
                  <Money value={plan.amount} variant="bodyStrong" /> todo dia {plan.dayOfMonth}
                </Text>
                <Text variant="small" color={colors.textSoft}>
                  aparece no horizonte como um compromisso com você mesmo.
                </Text>
              </View>
              <Text variant="smallStrong" color={colors.primary}>
                ajustar
              </Text>
            </Card>
          ) : (
            <Card style={{ gap: space.md }}>
              <Text color={colors.textSoft}>
                combine um valor fixo todo mês. ele entra no horizonte e o teo lembra de você confirmar.
              </Text>
              <Button label="guardar todo mês" icon={CalendarClock} variant="secondary" onPress={openPlan} />
            </Card>
          )
        ) : (
          <Card style={{ gap: space.md }}>
            <Text color={colors.textSoft}>
              pra guardar todo mês, ligue essa meta a uma caixinha. assim o dinheiro sai da conta e vai direto pra ela.
            </Text>
            <Button
              label={data.investments.some((i) => !i.archived) ? 'ligar a uma caixinha' : 'criar uma caixinha'}
              variant="secondary"
              onPress={() =>
                data.investments.some((i) => !i.archived)
                  ? router.push({ pathname: '/meta', params: { id: goal.id } })
                  : router.push('/caixinha-form')
              }
            />
          </Card>
        )}
      </Section>

      {view.moves.length ? (
        <Section title="últimas movimentações">
          <Card padded={false} style={styles.list}>
            {view.moves.map((t) => (
              <EntryRow
                key={t.id}
                item={{ ...t, source: 'realizada' }}
                onPress={() => router.push({ pathname: '/movimentacao', params: { id: t.id } })}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      <GoalMoveSheet goal={move ? goal : null} initial={move ?? 'guardar'} onClose={() => setMove(null)} />

      <Sheet visible={planOpen} onClose={() => setPlanOpen(false)} title="guardar todo mês">
        <View style={{ gap: space.lg }}>
          <Text color={colors.textSoft}>quanto você quer guardar para “{goal.name}” todo mês?</Text>
          <AmountInput value={planAmount} onChange={setPlanAmount} autoFocus color={colors.primary} />
          {f.neededPerMonth && !plan ? (
            <Text variant="small" color={colors.textFaint} center>
              pra chegar no prazo, seriam {formatMoney(f.neededPerMonth)} por mês.
            </Text>
          ) : null}
          <TextField
            label="em que dia?"
            value={planDay}
            onChangeText={(t) => setPlanDay(t.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            inputMode="numeric"
            hint="dica: um ou dois dias depois do salário cair."
          />
          <Button label={plan ? 'salvar' : 'combinado!'} onPress={savePlan} loading={saving} disabled={planAmount <= 0} />
          {plan ? <Button label="parar de guardar todo mês" variant="ghost" onPress={stopPlan} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginTop: space.md, paddingVertical: space.xxl },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', marginTop: space.sm },
  milestones: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  milestoneOn: { backgroundColor: colors.primary },
  actions: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.md },
  pace: { gap: space.sm, marginTop: space.md },
  streak: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.xs },
  flame: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  flameOn: { backgroundColor: colors.primary },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
});
