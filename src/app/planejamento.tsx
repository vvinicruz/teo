import { ChevronLeft, ChevronRight, FileDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Badge,
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
import type { BudgetStatus } from '../domain/finance';
import { formatMoney } from '../domain/money';
import { spendingByCategory, type CategorySpending } from '../domain/spending';
import { MAIN_ACCOUNT_NAME, type Category, type Transaction } from '../domain/types';
import { useCategories } from '../hooks/useCategories';
import { useToday } from '../hooks/useToday';
import { downloadFile, downloadSupported } from '../lib/download';
import { STATUS_COLOR, STATUS_LABEL } from '../lib/limitStatus';
import { spendingPdf } from '../lib/spendingPdf';
import { colors, space } from '../theme';

const BADGE_TONE: Record<BudgetStatus, 'ok' | 'atencao' | 'perigo'> = { tranquilo: 'ok', atencao: 'atencao', passou: 'perigo' };

/** gastos do mês por categoria, com limite (opcional) para cada uma. */
export default function GastosPorCategoria() {
  const { data, setBudget } = useData();
  const { forKind, get } = useCategories();
  const { toast } = useFeedback();
  const todayDate = useToday();
  const [month, setMonth] = useState(monthOf(todayDate));
  const [editing, setEditing] = useState<Category | null>(null);
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const hide = data.settings.hideValues;
  // espaço que não quebra: "R$ 1.950,00" nunca se divide em duas linhas
  const money = (c: number) => (hide ? 'R$ ••••' : formatMoney(c).replace(/ /g, '\u00a0'));

  const report = useMemo(
    () => spendingByCategory(data, forKind('despesa'), month, todayDate),
    [data, forKind, month, todayDate],
  );
  const isPast = month < monthOf(todayDate);
  const nameOf = (id: string | null) => (id ? (get(id)?.name ?? 'categoria') : 'sem categoria');

  const open = (id: string | null) => {
    const c = id ? get(id) : undefined;
    if (!c) return;
    setEditing(c);
    setValue(data.budgets.find((b) => b.categoryId === c.id)?.amount ?? 0);
  };

  const save = async (amount: number) => {
    if (!editing) return;
    setSaving(true);
    try {
      await setBudget(editing.id, amount);
      toast(amount > 0 ? 'limite salvo. vale para todos os meses.' : 'limite removido.', amount > 0 ? 'ok' : 'info');
      setEditing(null);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  const exportPdf = () => {
    if (!downloadSupported) {
      toast('por enquanto, o relatório em pdf sai pelo navegador (appteo.com.br).', 'info');
      return;
    }
    const origin = (t: Transaction) => {
      if (t.cardId) return `cartão ${data.cards.find((c) => c.id === t.cardId)?.name ?? ''}`.trim();
      return data.accounts.find((a) => a.id === t.accountId)?.name ?? MAIN_ACCOUNT_NAME;
    };
    try {
      const bytes = spendingPdf(report, { name: data.settings.name, generatedOn: todayDate, categoryName: nameOf, origin });
      downloadFile(bytes, `teo-gastos-${month}.pdf`, 'application/pdf');
      toast('relatório pronto! confira seus downloads.');
    } catch {
      toast('não conseguimos gerar o relatório agora. tenta de novo?', 'erro');
    }
  };

  const hasLimit = !!editing && data.budgets.some((b) => b.categoryId === editing.id && b.amount > 0);

  return (
    <Screen back title="gastos por categoria">
      <View style={styles.monthRow}>
        <IconButton icon={ChevronLeft} label="mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
        <Text variant="bodyStrong">{monthName(month, month.slice(0, 4) !== todayDate.slice(0, 4))}</Text>
        <IconButton icon={ChevronRight} label="próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      <Card tone="cream" style={{ gap: space.sm }}>
        <Text variant="small" color={colors.textSoft}>
          {isPast ? 'você gastou' : 'até agora você gastou'}
        </Text>
        <Money value={report.total} variant="title" color={colors.primary} />
        {report.planned > 0 ? (
          <View style={{ gap: 6, marginTop: space.xs }}>
            <Text variant="small" color={colors.textSoft}>
              nas categorias com limite: {money(report.spentPlanned)} de {money(report.planned)}
            </Text>
            <ProgressBar
              value={report.spentPlanned / report.planned}
              color={report.spentPlanned > report.planned ? colors.danger : colors.primary}
              height={6}
            />
          </View>
        ) : null}
        {!isPast && report.committed > 0 ? (
          <Text variant="small" color={colors.textFaint}>
            e ainda tem {money(report.committed)} previstos até o fim do mês.
          </Text>
        ) : null}
      </Card>

      <Button
        label="baixar relatório em pdf"
        icon={FileDown}
        variant="secondary"
        onPress={exportPdf}
        style={{ marginTop: space.md }}
      />

      {report.withLimit.length ? (
        <View style={styles.section}>
          <Text variant="heading">com limite</Text>
          {report.withLimit.map((r) => (
            <LimitCard key={r.categoryId} row={r} category={get(r.categoryId)} money={money} isPast={isPast} onPress={() => open(r.categoryId)} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="heading">{report.withLimit.length ? 'sem limite' : 'por categoria'}</Text>
        <Text variant="small" color={colors.textFaint}>
          {report.withLimit.length
            ? 'toque numa categoria se quiser definir um limite para ela.'
            : 'quer acompanhar quanto ainda pode gastar? toque numa categoria e defina um limite por mês. é opcional.'}
        </Text>
        <Card padded={false}>
          {report.withoutLimit.map((r, i) => {
            const c = get(r.categoryId);
            return (
              <Pressable
                key={r.categoryId ?? 'sem'}
                onPress={() => (c ? open(r.categoryId) : toast('dá pra escolher a categoria tocando na movimentação, no extrato.', 'info'))}
                style={[styles.row, i < report.withoutLimit.length - 1 && styles.rowSep]}
                accessibilityRole="button"
                accessibilityLabel={`${nameOf(r.categoryId)}: ${money(r.spent)}`}
                scaleTo={0.99}
              >
                <CategoryIcon icon={c?.icon ?? 'outros'} size={40} tone={r.spent > 0 ? 'cream' : 'muted'} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="bodyStrong" color={r.spent > 0 ? colors.text : colors.textSoft}>
                    {nameOf(r.categoryId)}
                  </Text>
                  <Text variant="small" color={colors.textFaint}>
                    {r.spent > 0 ? `${Math.round(r.share * 100)}% do que você gastou` : 'nada gasto este mês'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Money value={r.spent} variant="bodyStrong" color={r.spent > 0 ? colors.text : colors.textFaint} />
                  {c ? (
                    <Text variant="caption" color={colors.primary}>
                      definir limite
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </Card>
      </View>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing ? `limite para ${editing.name}` : undefined}>
        <View style={{ gap: space.lg }}>
          <Text color={colors.textSoft}>quanto você quer gastar com isso por mês? vale para todos os meses.</Text>
          <AmountInput value={value} onChange={setValue} autoFocus />
          <Button label="salvar" onPress={() => save(value)} loading={saving} disabled={value <= 0} />
          {hasLimit ? <Button label="tirar o limite" variant="ghost" onPress={() => save(0)} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}

function LimitCard({
  row,
  category,
  money,
  isPast,
  onPress,
}: {
  row: CategorySpending;
  category?: Category;
  money: (c: number) => string;
  isPast: boolean;
  onPress: () => void;
}) {
  const status = row.status ?? 'tranquilo';
  const percent = Math.round(row.ratio * 100);
  return (
    <Card onPress={onPress} style={{ gap: space.md }} accessibilityLabel={`${category?.name}: ${STATUS_LABEL[status]}`}>
      <View style={styles.cardHead}>
        <CategoryIcon icon={category?.icon ?? 'outros'} size={36} tone="cream" />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {category?.name ?? 'categoria'}
        </Text>
        <Badge label={STATUS_LABEL[status]} tone={BADGE_TONE[status]} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
        <Money value={row.spent} variant="heading" />
        <Text variant="small" color={colors.textSoft}>
          gastos de {money(row.limit ?? 0)}
        </Text>
      </View>
      <ProgressBar value={row.ratio} color={STATUS_COLOR[status]} height={8} />
      <View style={styles.cardFoot}>
        <Text variant="small" color={colors.textSoft}>
          {percent}% usado
        </Text>
        <Text variant="smallStrong" color={status === 'passou' ? colors.danger : colors.text}>
          {status === 'passou'
            ? `passou ${money(row.over)}`
            : isPast
              ? `sobraram ${money(Math.max(0, (row.limit ?? 0) - row.spent))}`
              : `ainda dá ${money(row.available ?? 0)}`}
        </Text>
      </View>
      {!isPast && row.committed > 0 && status !== 'passou' ? (
        <Text variant="caption" color={colors.textFaint}>
          já descontando {money(row.committed)} que ainda estão previstos este mês
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: space.md },
  section: { gap: space.md, marginTop: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowSep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
