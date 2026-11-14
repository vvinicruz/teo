import { router } from 'expo-router';
import { ChevronRight, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  CategoryIcon,
  EmptyState,
  FadeIn,
  Icon,
  InvestmentMoveSheet,
  IconButton,
  Mascot,
  Money,
  ProgressBar,
  Screen,
  Segmented,
  Sheet,
  Text,
  useFeedback,
} from '../../components';
import { useData } from '../../data/DataProvider';
import { daysInclusive, friendlyDate } from '../../domain/dates';
import { goalProgress } from '../../domain/finance';
import { formatMoney } from '../../domain/money';
import { goalSaved, investmentBalance, monthlyYield, totalInvested } from '../../domain/investments';
import type { Goal, Investment } from '../../domain/types';
import { useIndexRates } from '../../hooks/useIndexRates';
import { useToday } from '../../hooks/useToday';
import { colors, space } from '../../theme';

type Move = 'guardar' | 'retirar';

export default function Metas() {
  const { data, updateGoal } = useData();
  const { toast } = useFeedback();
  const todayDate = useToday();
  const [target, setTarget] = useState<Goal | null>(null);
  const [move, setMove] = useState<Move>('guardar');
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const [invMove, setInvMove] = useState<{ inv: Investment; move: Move; goalName: string } | null>(null);
  const rates = useIndexRates();
  // metas ligadas a uma caixinha usam o saldo dela como "guardado".
  const goals = data.goals
    .map((g) => ({ ...g, saved: goalSaved(data, g) }))
    .sort((a, b) => goalProgress(b.saved, b.target) - goalProgress(a.saved, a.target));
  const investments = data.investments.filter((i) => !i.archived);
  const invested = totalInvested(data);
  const investedYield = rates
    ? investments.reduce((a, i) => a + (monthlyYield(investmentBalance(data, i), i, rates) ?? 0), 0)
    : 0;
  const [featured, ...others] = goals;

  const openMove = (g: Goal, m: Move = 'guardar') => {
    const inv = g.investmentId ? data.investments.find((i) => i.id === g.investmentId) : undefined;
    if (inv) {
      setInvMove({ inv, move: m, goalName: g.name });
      return;
    }
    setTarget(g);
    setMove(m);
    setValue(0);
  };

  const saveMove = async () => {
    if (!target || value <= 0) return;
    const saved = move === 'guardar' ? target.saved + value : Math.max(0, target.saved - value);
    setSaving(true);
    try {
      await updateGoal({ ...target, saved });
      const done = saved >= target.target && target.saved < target.target;
      toast(done ? 'meta concluída! que orgulho :)' : move === 'guardar' ? 'mais um passo! valor guardado.' : 'valor retirado da meta.');
      setTarget(null);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  const meta = (g: Goal) => {
    if (g.saved >= g.target) return 'meta concluída!';
    if (!g.deadline) return `faltam ${formatMoney(g.target - g.saved)}`;
    const days = daysInclusive(todayDate, g.deadline) - 1;
    if (days < 0) return `faltam ${formatMoney(g.target - g.saved)}`;
    const months = Math.max(1, Math.ceil(days / 30));
    return `guardando ${formatMoney(Math.ceil((g.target - g.saved) / months))} por mês, chega lá até ${friendlyDate(g.deadline, todayDate)}`;
  };

  return (
    <Screen tabBarSpace>
      <View style={styles.titleRow}>
        <Text variant="title">metas</Text>
        <Button label="nova meta" icon={Plus} small onPress={() => router.push('/meta')} />
      </View>

      <Card tone="cream" onPress={() => router.push('/guardado')} style={styles.saved}>
        <CategoryIcon icon="reserva" size={44} tone="primary" />
        <View style={{ flex: 1 }}>
          <Text variant="small" color={colors.textSoft}>
            dinheiro guardado
          </Text>
          {investments.length ? (
            <>
              <Money value={invested} variant="heading" />
              {investedYield > 0 && !data.settings.hideValues ? (
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
            <Card style={styles.featured} onPress={() => router.push({ pathname: '/meta', params: { id: featured.id } })}>
              {featured.saved >= featured.target ? <Mascot size={64} /> : <CategoryIcon icon={featured.icon} size={64} />}
              <Text variant="heading" center>
                {featured.name}
              </Text>
              <Text color={colors.textSoft} center>
                <Money value={featured.saved} variant="bodyStrong" color={colors.text} /> de {data.settings.hideValues ? 'R$ ••••' : formatMoney(featured.target)}
              </Text>
              <View style={styles.progressRow}>
                <View style={{ flex: 1 }}>
                  <ProgressBar value={goalProgress(featured.saved, featured.target)} height={10} />
                </View>
                <Text variant="smallStrong">{Math.floor(goalProgress(featured.saved, featured.target) * 100)}%</Text>
              </View>
              <Text variant="small" color={colors.textSoft} center>
                {meta(featured)}
              </Text>
              <View style={styles.actions}>
                <Button label="guardar" icon={Plus} small onPress={() => openMove(featured)} style={{ flex: 1 }} />
                <Button label="retirar" icon={Minus} small variant="ghost" onPress={() => openMove(featured, 'retirar')} style={{ flex: 1 }} />
              </View>
            </Card>
          </FadeIn>

          {others.length ? (
            <View style={{ gap: space.sm, marginTop: space.xxl }}>
              <Text variant="heading">outras metas</Text>
              {others.map((g) => (
                <Card key={g.id} onPress={() => router.push({ pathname: '/meta', params: { id: g.id } })} style={styles.row}>
                  <CategoryIcon icon={g.icon} size={44} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.rowHead}>
                      <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                        {g.name}
                      </Text>
                      <Text variant="smallStrong">{Math.floor(goalProgress(g.saved, g.target) * 100)}%</Text>
                    </View>
                    <ProgressBar value={goalProgress(g.saved, g.target)} height={6} />
                    <Text variant="small" color={colors.textSoft}>
                      {data.settings.hideValues ? meta(g).replace(/R\$ [\d.,]+/g, 'R$ ••••') : `${formatMoney(g.saved)} de ${formatMoney(g.target)}`}
                    </Text>
                  </View>
                  <IconButton icon={Plus} label={`guardar em ${g.name}`} onPress={() => openMove(g)} background={colors.cream} color={colors.primary} />
                </Card>
              ))}
            </View>
          ) : null}

          <Text variant="small" color={colors.textFaint} center style={{ marginTop: space.xxl }}>
            metas ligadas a uma caixinha acompanham o saldo dela. as outras só registram quanto você separou, sem mexer no seu saldo.
          </Text>
        </>
      )}

      <Sheet visible={!!target} onClose={() => setTarget(null)} title={target?.name}>
        <View style={{ gap: space.lg }}>
          <Segmented<Move>
            value={move}
            onChange={setMove}
            options={[
              { value: 'guardar', label: 'guardar' },
              { value: 'retirar', label: 'retirar' },
            ]}
          />
          <AmountInput value={value} onChange={setValue} autoFocus color={move === 'guardar' ? colors.primary : colors.text} />
          {target ? (
            <Text variant="small" color={colors.textSoft} center>
              hoje na meta: {formatMoney(target.saved)}
            </Text>
          ) : null}
          <Button label={move === 'guardar' ? 'guardar valor' : 'retirar valor'} onPress={saveMove} loading={saving} disabled={value <= 0} />
        </View>
      </Sheet>

      <InvestmentMoveSheet
        investment={invMove?.inv ?? null}
        initial={invMove?.move === 'retirar' ? 'resgatar' : 'guardar'}
        goalName={invMove?.goalName}
        onClose={() => setInvMove(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  saved: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg, paddingBottom: space.xl },
  featured: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
