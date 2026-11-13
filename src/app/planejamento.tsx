import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  CategoryIcon,
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
import { addMonths, monthName, monthOf } from '../domain/dates';
import { budgetProgress, type BudgetProgress } from '../domain/finance';
import { formatMoney } from '../domain/money';
import type { Category } from '../domain/types';
import { useCategories } from '../hooks/useCategories';
import { useToday } from '../hooks/useToday';
import { colors, space } from '../theme';

const STATUS_TEXT = {
  tranquilo: 'tranquilo',
  atencao: 'quase no limite',
  passou: 'passou do planejado',
} as const;

export default function Planejamento() {
  const { data, setBudget } = useData();
  const { forKind } = useCategories();
  const { toast } = useFeedback();
  const todayDate = useToday();
  const [month, setMonth] = useState(monthOf(todayDate));
  const [editing, setEditing] = useState<Category | null>(null);
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const progress = useMemo(() => {
    const map = new Map<string, BudgetProgress>();
    for (const p of budgetProgress(data, month, todayDate)) map.set(p.budget.categoryId, p);
    return map;
  }, [data, month, todayDate]);

  const categories = forKind('despesa');
  const planned = [...progress.values()].reduce((a, p) => a + p.budget.amount, 0);
  const spent = [...progress.values()].reduce((a, p) => a + p.spent, 0);
  const isPast = month < monthOf(todayDate);

  const open = (c: Category) => {
    setEditing(c);
    setValue(data.budgets.find((b) => b.categoryId === c.id)?.amount ?? 0);
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await setBudget(editing.id, value);
      toast(value > 0 ? 'planejamento salvo.' : 'limite removido.');
      setEditing(null);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen back title="planejamento">
      <View style={styles.monthRow}>
        <IconButton icon={ChevronLeft} label="mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
        <Text variant="bodyStrong">{monthName(month, month.slice(0, 4) !== todayDate.slice(0, 4))}</Text>
        <IconButton icon={ChevronRight} label="próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      <Card tone="cream" style={{ gap: space.sm }}>
        {planned > 0 ? (
          <>
            <Text variant="small" color={colors.textSoft}>
              {isPast ? 'você gastou' : 'até agora você gastou'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <Money value={spent} variant="title" color={spent > planned ? colors.attention : colors.primary} />
              <Text color={colors.textSoft}>de {formatMoney(planned)} planejados</Text>
            </View>
            <ProgressBar value={planned ? spent / planned : 0} color={spent > planned ? colors.attention : colors.primary} />
          </>
        ) : (
          <>
            <Text variant="bodyStrong">quanto você quer gastar em cada categoria?</Text>
            <Text variant="small" color={colors.textSoft}>
              toque em uma categoria para definir um valor. ele vale para todos os meses e entra no seu horizonte como
              gasto planejado.
            </Text>
          </>
        )}
      </Card>

      <Card padded={false} style={{ marginTop: space.xl }}>
        {categories.map((c, i) => {
          const p = progress.get(c.id);
          const color = p?.status === 'passou' ? colors.attention : colors.primary;
          return (
            <Pressable
              key={c.id}
              onPress={() => open(c)}
              style={[styles.row, i < categories.length - 1 && styles.rowSep]}
              accessibilityRole="button"
              accessibilityLabel={`limite para ${c.name}`}
              scaleTo={0.99}
            >
              <CategoryIcon icon={c.icon} size={40} tone={p ? 'cream' : 'muted'} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.rowHead}>
                  <Text variant="bodyStrong">{c.name}</Text>
                  {p ? (
                    <Text variant="caption" color={p.status === 'tranquilo' ? colors.textFaint : colors.attention}>
                      {STATUS_TEXT[p.status]}
                    </Text>
                  ) : (
                    <Text variant="smallStrong" color={colors.primary}>
                      definir
                    </Text>
                  )}
                </View>
                {p ? (
                  <>
                    <ProgressBar value={p.ratio} color={color} height={6} />
                    <Text variant="small" color={colors.textSoft}>
                      {formatMoney(p.spent)} de {formatMoney(p.budget.amount)}
                      {p.committed > 0 ? ` · ${formatMoney(p.committed)} previstos` : ''}
                      {!isPast && p.remaining > 0 ? ` · sobram ${formatMoney(p.remaining)}` : ''}
                    </Text>
                  </>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </Card>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing ? `limite para ${editing.name}` : undefined}>
        <View style={{ gap: space.lg }}>
          <Text color={colors.textSoft}>quanto você quer gastar com isso por mês?</Text>
          <AmountInput value={value} onChange={setValue} autoFocus />
          <Button label="salvar" onPress={save} loading={saving} />
          {data.budgets.some((b) => b.categoryId === editing?.id) ? (
            <Button
              label="remover limite"
              variant="ghost"
              onPress={() => {
                setValue(0);
                if (editing) {
                  setBudget(editing.id, 0)
                    .then(() => {
                      toast('limite removido.', 'info');
                      setEditing(null);
                    })
                    .catch(() => toast('não conseguimos salvar agora.', 'erro'));
                }
              }}
            />
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowSep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

