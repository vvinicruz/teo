import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Info, SlidersHorizontal, Sparkles, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Badge,
  Button,
  Card,
  CategoryIcon,
  Chip,
  EntryRow,
  Icon,
  IconButton,
  Money,
  Pressable,
  ProgressBar,
  Screen,
  Sheet,
  Text,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { addMonths, monthName, monthOf, type MonthKey } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { categoryExpenses, categoryHistory, categoryInsights, limitStatus, spendingByCategory } from '../domain/spending';
import { useCategories } from '../hooks/useCategories';
import { useToday } from '../hooks/useToday';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/limitStatus';
import { colors, radius, space } from '../theme';

const TONE = {
  bom: { bg: colors.incomeSoft, fg: colors.income, icon: Sparkles },
  atencao: { bg: colors.attentionSoft, fg: colors.attention, icon: TriangleAlert },
  neutro: { bg: colors.muted, fg: colors.textSoft, icon: Info },
} as const;
const BADGE = { tranquilo: 'ok', atencao: 'atencao', passou: 'perigo' } as const;

/** gastos de uma categoria: o mês, comparação com o anterior, evolução e cada gasto. */
export default function GastoCategoria() {
  const params = useLocalSearchParams<{ id: string; month?: string }>();
  const { data, setBudget } = useData();
  const { get, forKind } = useCategories();
  const { toast } = useFeedback();
  const todayDate = useToday();
  const categoryId = params.id && params.id !== 'sem' ? params.id : null;
  const category = get(categoryId);
  const name = category?.name ?? 'sem categoria';
  const [month, setMonth] = useState<MonthKey>((params.month as MonthKey) || monthOf(todayDate));
  const [months, setMonths] = useState(6);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const hide = data.settings.hideValues;
  const money = (c: number) => (hide ? 'R$ ••••' : formatMoney(c).replace(/ /g, ' '));

  const limit = categoryId ? (data.budgets.find((b) => b.categoryId === categoryId && b.amount > 0)?.amount ?? null) : null;
  const view = useMemo(() => {
    const report = spendingByCategory(data, forKind('despesa'), month, todayDate);
    const row = [...report.withLimit, ...report.withoutLimit].find((r) => r.categoryId === categoryId);
    return {
      row,
      total: report.total,
      expenses: categoryExpenses(data, categoryId, month),
      history: categoryHistory(data, categoryId, month, months),
    };
  }, [data, forKind, month, todayDate, categoryId, months]);
  const insights = categoryInsights(data, categoryId, name, month, todayDate, money);
  const spent = view.row?.spent ?? 0;
  const status = limit ? limitStatus(spent / limit) : null;
  const isPast = month < monthOf(todayDate);
  const maxBar = Math.max(1, limit ?? 0, ...view.history.map((m) => m.spent));

  const save = async (amount: number) => {
    if (!categoryId) return;
    setSaving(true);
    try {
      await setBudget(categoryId, amount);
      toast(amount > 0 ? 'limite salvo. vale para todos os meses.' : 'limite removido.', amount > 0 ? 'ok' : 'info');
      setEditing(false);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen back title={name}>
      <View style={styles.monthRow}>
        <IconButton icon={ChevronLeft} label="mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
        <Text variant="bodyStrong">{monthName(month, month.slice(0, 4) !== todayDate.slice(0, 4))}</Text>
        <IconButton icon={ChevronRight} label="próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      <Card tone="cream" style={{ gap: space.sm }}>
        <View style={styles.head}>
          <CategoryIcon icon={category?.icon ?? 'outros'} size={36} />
          <Text variant="small" color={colors.textSoft} style={{ flex: 1 }}>
            {isPast ? `em ${monthName(month)} você gastou` : 'até agora, este mês, você gastou'}
          </Text>
          {status ? <Badge label={STATUS_LABEL[status]} tone={BADGE[status]} /> : null}
        </View>
        <Money value={spent} variant="title" color={colors.primary} />
        {limit && status ? (
          <View style={{ gap: 6 }}>
            <ProgressBar value={spent / limit} color={STATUS_COLOR[status]} height={8} />
            <Text variant="small" color={colors.textSoft}>
              {Math.round((spent / limit) * 100)}% do limite de {money(limit)}
              {spent > limit
                ? ` · passou ${money(spent - limit)}`
                : !isPast
                  ? ` · ainda dá ${money(view.row?.available ?? 0)}`
                  : ` · sobraram ${money(limit - spent)}`}
            </Text>
          </View>
        ) : view.total > 0 ? (
          <Text variant="small" color={colors.textSoft}>
            {Math.round((spent / view.total) * 100)}% de tudo o que você gastou no mês
          </Text>
        ) : null}
        {categoryId ? (
          <Button
            label={limit ? 'mudar o limite' : 'definir um limite (opcional)'}
            icon={SlidersHorizontal}
            variant="ghost"
            small
            onPress={() => {
              setValue(limit ?? 0);
              setEditing(true);
            }}
            style={{ alignSelf: 'flex-start', marginTop: space.xs }}
          />
        ) : null}
      </Card>

      {insights.length ? (
        <View style={styles.section}>
          {insights.map((ins) => {
            const t = TONE[ins.tone];
            return (
              <View key={ins.text} style={[styles.insight, { backgroundColor: t.bg }]}>
                <Icon as={t.icon} size={18} color={t.fg} />
                <Text variant="small" color={colors.text} style={{ flex: 1 }}>
                  {ins.text}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text variant="heading">mês a mês</Text>
          <View style={{ flexDirection: 'row', gap: space.xs }}>
            <Chip label="6 meses" selected={months === 6} onPress={() => setMonths(6)} />
            <Chip label="12 meses" selected={months === 12} onPress={() => setMonths(12)} />
          </View>
        </View>
        <Card style={{ gap: space.md }}>
          {view.history.map((m) => {
            const color = limit ? STATUS_COLOR[limitStatus(m.spent / limit)] : colors.primary;
            const selected = m.month === month;
            return (
              <Pressable
                key={m.month}
                onPress={() => setMonth(m.month)}
                style={styles.barRow}
                accessibilityRole="button"
                accessibilityLabel={`${monthName(m.month, true)}: ${money(m.spent)}`}
                scaleTo={0.99}
              >
                <Text variant={selected ? 'smallStrong' : 'small'} color={selected ? colors.text : colors.textSoft} style={styles.barMonth}>
                  {monthName(m.month).slice(0, 3)}
                  {m.month.slice(0, 4) !== todayDate.slice(0, 4) ? `/${m.month.slice(2, 4)}` : ''}
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(m.spent / maxBar) * 100}%`, backgroundColor: m.spent ? color : 'transparent' }]} />
                  {limit ? <View style={[styles.limitMark, { left: `${(limit / maxBar) * 100}%` }]} /> : null}
                </View>
                <Text variant={selected ? 'smallStrong' : 'small'} color={m.spent ? colors.text : colors.textFaint} style={styles.barValue}>
                  {money(m.spent)}
                </Text>
              </Pressable>
            );
          })}
          {limit ? (
            <Text variant="caption" color={colors.textFaint}>
              a linha fininha marca o limite de {money(limit)}. toque num mês para ver os gastos dele.
            </Text>
          ) : (
            <Text variant="caption" color={colors.textFaint}>
              toque num mês para ver os gastos dele.
            </Text>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="heading">gastos de {monthName(month)}</Text>
        {view.expenses.length ? (
          <Card padded={false} style={{ paddingHorizontal: space.lg }}>
            {view.expenses.map((t) => (
              <EntryRow
                key={t.id}
                item={{ ...t, source: t.status }}
                onPress={() => router.push({ pathname: '/movimentacao', params: { id: t.id } })}
              />
            ))}
          </Card>
        ) : (
          <Text color={colors.textSoft}>nenhum gasto com {name} neste mês.</Text>
        )}
      </View>

      <Sheet visible={editing} onClose={() => setEditing(false)} title={`limite para ${name}`}>
        <View style={{ gap: space.lg }}>
          <Text color={colors.textSoft}>quanto você quer gastar com isso por mês? vale para todos os meses.</Text>
          <AmountInput value={value} onChange={setValue} autoFocus />
          <Button label="salvar" onPress={() => save(value)} loading={saving} disabled={value <= 0} />
          {limit ? <Button label="tirar o limite" variant="ghost" onPress={() => save(0)} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  section: { gap: space.md, marginTop: space.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  insight: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  barMonth: { width: 52 },
  barTrack: { flex: 1, height: 10, borderRadius: radius.pill, backgroundColor: colors.muted, overflow: 'visible' },
  barFill: { height: 10, borderRadius: radius.pill },
  limitMark: { position: 'absolute', top: -3, width: 2, height: 16, marginLeft: -1, backgroundColor: colors.text, opacity: 0.35 },
  barValue: { width: 96, textAlign: 'right' },
});
