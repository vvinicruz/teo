import { router } from 'expo-router';
import { ChevronRight, Flame, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  FadeIn,
  GoalMoveSheet,
  GoalNudgeCard,
  Icon,
  IconButton,
  Mascot,
  Money,
  ProgressBar,
  Screen,
  Text,
} from '../../components';
import { useData } from '../../data/DataProvider';
import { monthName } from '../../domain/dates';
import { goalProgress } from '../../domain/finance';
import { goalForecast, goalStreak } from '../../domain/goals';
import { investmentBalance, monthlyYield, totalInvested } from '../../domain/investments';
import { formatMoney } from '../../domain/money';
import type { Goal } from '../../domain/types';
import { useGoalNudge } from '../../hooks/useGoalNudge';
import { useIndexRates } from '../../hooks/useIndexRates';
import { useToday } from '../../hooks/useToday';
import { colors, radius, space } from '../../theme';

export default function Metas() {
  const { data } = useData();
  const todayDate = useToday();
  const rates = useIndexRates();
  const { nudge, dismiss } = useGoalNudge();
  const [moving, setMoving] = useState<Goal | null>(null);
  const hide = data.settings.hideValues;

  const goals = data.goals
    .map((g) => {
      const f = goalForecast(data, g, todayDate);
      return { goal: g, f, progress: goalProgress(f.saved, g.target), streak: goalStreak(data, g, todayDate) };
    })
    .sort((a, b) => b.progress - a.progress);
  const [featured, ...others] = goals;

  const investments = data.investments.filter((i) => !i.archived);
  const invested = totalInvested(data);
  const investedYield = rates
    ? investments.reduce((a, i) => a + (monthlyYield(investmentBalance(data, i), i, rates) ?? 0), 0)
    : 0;

  // uma frase curta de ritmo para os cards.
  const paceLine = ({ goal, f }: (typeof goals)[number]) => {
    if (f.remaining === 0) return 'meta concluída!';
    if (f.etaMonth) {
      const when = monthName(f.etaMonth, f.etaMonth.slice(0, 4) !== todayDate.slice(0, 4));
      return goal.deadline && f.onTrack === false ? `no seu ritmo, chega em ${when} (depois do prazo)` : `no seu ritmo, você chega lá em ${when}`;
    }
    return hide ? 'guarde um pouquinho para começar' : `faltam ${formatMoney(f.remaining)}`;
  };

  const open = (g: Goal) => router.push({ pathname: '/objetivo', params: { id: g.id } });

  return (
    <Screen tabBarSpace>
      <View style={styles.titleRow}>
        <Text variant="title">metas</Text>
        <Button label="nova meta" icon={Plus} small onPress={() => router.push('/meta')} />
      </View>

      {nudge ? (
        <View style={{ marginBottom: space.lg }}>
          <GoalNudgeCard goal={nudge.goal} days={nudge.days} onSave={() => setMoving(nudge.goal)} onDismiss={() => dismiss(nudge.goal.id)} />
        </View>
      ) : null}

      <Card tone="cream" onPress={() => router.push('/guardado')} style={styles.saved}>
        <CategoryIcon icon="reserva" size={44} tone="primary" />
        <View style={{ flex: 1 }}>
          <Text variant="small" color={colors.textSoft}>
            dinheiro guardado
          </Text>
          {investments.length ? (
            <>
              <Money value={invested} variant="heading" />
              {investedYield > 0 && !hide ? (
                <Text variant="caption" color={colors.income}>
                  rende cerca de {formatMoney(investedYield)} por mês
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="bodyStrong">cadastre suas caixinhas e investimentos</Text>
          )}
        </View>
        <Icon as={ChevronRight} color={colors.primary} />
      </Card>

      {!featured ? (
        <EmptyState
          title="qual é o seu próximo sonho?"
          message="uma viagem, um celular novo, uma reserva para emergências... crie uma meta e acompanhe cada passo."
          actionLabel="criar minha primeira meta"
          onAction={() => router.push('/meta')}
        />
      ) : (
        <>
          <FadeIn>
            <Card style={styles.featured} onPress={() => open(featured.goal)}>
              {featured.f.remaining === 0 ? <Mascot size={64} /> : <CategoryIcon icon={featured.goal.icon} size={64} />}
              <Text variant="heading" center>
                {featured.goal.name}
              </Text>
              <Text color={colors.textSoft} center>
                <Money value={featured.f.saved} variant="bodyStrong" color={colors.text} /> de{' '}
                {hide ? 'R$ ••••' : formatMoney(featured.goal.target)}
              </Text>
              <View style={styles.progressRow}>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={featured.progress} height={10} />
                </View>
                <Text variant="smallStrong">{Math.floor(featured.progress * 100)}%</Text>
              </View>
              <Text variant="small" color={colors.textSoft} center>
                {paceLine(featured)}
              </Text>
              {featured.streak.months > 0 ? <StreakBadge months={featured.streak.months} /> : null}
              {featured.f.remaining > 0 ? (
                <Button label="guardar" icon={Plus} small onPress={() => setMoving(featured.goal)} style={{ alignSelf: 'stretch' }} />
              ) : null}
            </Card>
          </FadeIn>

          {others.length ? (
            <View style={{ gap: space.sm, marginTop: space.xxl }}>
              <Text variant="heading">outras metas</Text>
              {others.map((item) => (
                <Card key={item.goal.id} onPress={() => open(item.goal)} style={styles.row}>
                  <CategoryIcon icon={item.goal.icon} size={44} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.rowHead}>
                      <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                        {item.goal.name}
                      </Text>
                      {item.streak.months > 1 ? (
                        <View style={styles.miniStreak}>
                          <Icon as={Flame} size={12} color={colors.primary} />
                          <Text variant="caption" color={colors.primary}>
                            {item.streak.months}
                          </Text>
                        </View>
                      ) : null}
                      <Text variant="smallStrong">{Math.floor(item.progress * 100)}%</Text>
                    </View>
                    <ProgressBar value={item.progress} height={6} />
                    <Text variant="small" color={colors.textSoft} numberOfLines={1}>
                      {paceLine(item)}
                    </Text>
                  </View>
                  {item.f.remaining > 0 ? (
                    <IconButton icon={Plus} label={`guardar em ${item.goal.name}`} onPress={() => setMoving(item.goal)} background={colors.cream} color={colors.primary} />
                  ) : null}
                </Card>
              ))}
            </View>
          ) : null}

          <Text variant="small" color={colors.textFaint} center style={{ marginTop: space.xxl }}>
            metas ligadas a uma caixinha acompanham o saldo dela. as outras só registram quanto você separou, sem mexer no
            seu saldo.
          </Text>
        </>
      )}

      <GoalMoveSheet goal={moving} onClose={() => setMoving(null)} />
    </Screen>
  );
}

function StreakBadge({ months }: { months: number }) {
  return (
    <View style={styles.streak}>
      <Icon as={Flame} size={14} color={colors.primary} />
      <Text variant="caption" color={colors.primary}>
        {months === 1 ? '1 mês guardando' : `${months} meses seguidos guardando`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  saved: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg, paddingBottom: space.xl },
  featured: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
  },
  miniStreak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
