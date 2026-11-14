import { router, useLocalSearchParams } from 'expo-router';
import { Minus, Pencil, Plus, RefreshCw, Target } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  EmptyState,
  EntryRow,
  Icon,
  IconButton,
  InvestmentMoveSheet,
  Money,
  Pressable,
  ProgressBar,
  Screen,
  Section,
  Sheet,
  Text,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { friendlyDate } from '../domain/dates';
import { goalProgress } from '../domain/finance';
import { investmentBalance, monthlyYield, monthlyYieldPct } from '../domain/investments';
import { formatMoney } from '../domain/money';
import { INVESTMENT_KINDS } from '../domain/types';
import { useIndexRates } from '../hooks/useIndexRates';
import { useToday } from '../hooks/useToday';
import { colors, space } from '../theme';

export default function Caixinha() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setInvestmentBalance } = useData();
  const { toast } = useFeedback();
  const rates = useIndexRates();
  const todayDate = useToday();
  const inv = data.investments.find((i) => i.id === id);
  const [move, setMove] = useState<'guardar' | 'resgatar' | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [newValue, setNewValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const moves = useMemo(
    () =>
      data.transactions
        .filter((t) => t.investmentId === id)
        .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1)),
    [data.transactions, id],
  );

  if (!inv) {
    return (
      <Screen back title="caixinha">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          essa caixinha não existe mais.
        </Text>
      </Screen>
    );
  }

  const balance = investmentBalance(data, inv);
  const yieldValue = rates ? monthlyYield(balance, inv, rates) : null;
  const yieldPct = rates ? monthlyYieldPct(inv, rates) : null;
  const goals = data.goals.filter((g) => g.investmentId === inv.id);
  const kindLabel = INVESTMENT_KINDS.find((k) => k.id === inv.kind)?.label;

  const saveValue = async () => {
    setSaving(true);
    try {
      await setInvestmentBalance(inv, newValue);
      const diff = newValue - balance;
      toast(diff > 0 ? `valor atualizado. rendeu ${formatMoney(diff)}!` : 'valor atualizado.');
      setUpdateOpen(false);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      back
      title={inv.name}
      right={<IconButton icon={Pencil} label="editar caixinha" onPress={() => router.push({ pathname: '/caixinha-form', params: { id: inv.id } })} background={colors.surface} />}
    >
      <Card style={styles.hero}>
        <Text variant="small" color={colors.textSoft}>
          {kindLabel}
          {inv.cdiPercent != null && inv.kind !== 'tesouro' ? ` · ${String(inv.cdiPercent).replace('.', ',')}% do cdi` : ''}
        </Text>
        <Money value={balance} variant="display" />
        {yieldValue != null && yieldPct != null ? (
          <Text variant="small" color={colors.income}>
            rende cerca de {formatMoney(yieldValue)} por mês ({yieldPct.toFixed(2).replace('.', ',')}% ao mês · estimativa)
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button label="guardar" icon={Plus} small onPress={() => setMove('guardar')} style={{ flex: 1 }} />
          <Button label="resgatar" icon={Minus} small variant="ghost" onPress={() => setMove('resgatar')} style={{ flex: 1 }} />
        </View>
        <Pressable
          onPress={() => {
            setNewValue(balance);
            setUpdateOpen(true);
          }}
          style={styles.update}
          accessibilityRole="button"
        >
          <Icon as={RefreshCw} size={16} color={colors.primary} />
          <Text variant="smallStrong" color={colors.primary}>
            atualizar valor com o do banco
          </Text>
        </Pressable>
        <Text variant="caption" color={colors.textFaint}>
          último valor informado {friendlyDate(inv.balanceUpdatedAt.slice(0, 10), todayDate)}
        </Text>
      </Card>

      {goals.length ? (
        <Section title="metas guardadas aqui">
          <Card padded={false}>
            {goals.map((g, i) => (
              <Pressable
                key={g.id}
                onPress={() => router.push({ pathname: '/meta', params: { id: g.id } })}
                style={[styles.goal, i < goals.length - 1 && styles.sep]}
              >
                <Icon as={Target} color={colors.primary} />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text variant="bodyStrong">{g.name}</Text>
                  <ProgressBar value={goalProgress(balance, g.target)} height={6} />
                </View>
                <Text variant="smallStrong">{Math.floor(goalProgress(balance, g.target) * 100)}%</Text>
              </Pressable>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="movimentações">
        {moves.length ? (
          <Card padded={false} style={styles.list}>
            {moves.map((t) => (
              <EntryRow
                key={t.id}
                item={{ ...t, source: 'realizada' }}
                onPress={() => router.push({ pathname: '/movimentacao', params: { id: t.id } })}
              />
            ))}
          </Card>
        ) : (
          <EmptyState compact title="nenhuma movimentação ainda" message="quando você guardar ou resgatar, aparece aqui." />
        )}
      </Section>

      <InvestmentMoveSheet investment={move ? inv : null} initial={move ?? 'guardar'} onClose={() => setMove(null)} />

      <Sheet visible={updateOpen} onClose={() => setUpdateOpen(false)} title="quanto tem agora?">
        <View style={{ gap: space.lg }}>
          <Text color={colors.textSoft}>
            olhe no app do banco quanto tem nessa caixinha hoje. a diferença é o que rendeu (ou o que mudou).
          </Text>
          <AmountInput value={newValue} onChange={setNewValue} autoFocus />
          <Button label="atualizar" onPress={saveValue} loading={saving} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: space.xs, marginTop: space.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  update: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: space.md },
  goal: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
});
