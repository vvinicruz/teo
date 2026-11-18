import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, FileDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  IconButton,
  Money,
  Pressable,
  ProgressBar,
  Screen,
  Text,
  TourTarget,
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
  const { data } = useData();
  const { forKind, get } = useCategories();
  const { toast } = useFeedback();
  const todayDate = useToday();
  const [month, setMonth] = useState(monthOf(todayDate));
  const hide = data.settings.hideValues;
  // espaço que não quebra: "R$ 1.950,00" nunca se divide em duas linhas
  const money = (c: number) => (hide ? 'R$ ••••' : formatMoney(c).replace(/ /g, '\u00a0'));

  const report = useMemo(
    () => spendingByCategory(data, forKind('despesa'), month, todayDate),
    [data, forKind, month, todayDate],
  );
  const isPast = month < monthOf(todayDate);
  const nameOf = (id: string | null) => (id ? (get(id)?.name ?? 'categoria') : 'sem categoria');

  // detalhes da categoria: gastos do mês, comparação, evolução e limite
  const open = (id: string | null) =>
    router.push({ pathname: '/gasto-categoria', params: { id: id ?? 'sem', month } });

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

  return (
    <Screen back title="gastos por categoria">
      <View style={styles.monthRow}>
        <IconButton icon={ChevronLeft} label="mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
        <Text variant="bodyStrong">{monthName(month, month.slice(0, 4) !== todayDate.slice(0, 4))}</Text>
        <IconButton icon={ChevronRight} label="próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      <TourTarget id="gastos-resumo">
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
      </TourTarget>

      <TourTarget id="gastos-pdf" style={{ marginTop: space.md }}>
        <Button label="baixar relatório em pdf" icon={FileDown} variant="secondary" onPress={exportPdf} />
      </TourTarget>

      {report.withLimit.length ? (
        <TourTarget id="gastos-lista" style={styles.section}>
          <Text variant="heading">com limite</Text>
          {report.withLimit.map((r) => (
            <LimitCard key={r.categoryId} row={r} category={get(r.categoryId)} money={money} isPast={isPast} onPress={() => open(r.categoryId)} />
          ))}
        </TourTarget>
      ) : null}

      <TourTarget id={report.withLimit.length ? 'gastos-lista-2' : 'gastos-lista'} style={styles.section}>
        <Text variant="heading">{report.withLimit.length ? 'sem limite' : 'por categoria'}</Text>
        <Text variant="small" color={colors.textFaint}>
          {report.withLimit.length
            ? 'toque numa categoria para ver os gastos, comparar com os meses anteriores e, se quiser, definir um limite.'
            : 'toque numa categoria para ver os gastos e comparar com os meses anteriores. dá pra definir um limite por mês, se quiser.'}
        </Text>
        <Card padded={false}>
          {report.withoutLimit.map((r, i) => {
            const c = get(r.categoryId);
            return (
              <Pressable
                key={r.categoryId ?? 'sem'}
                onPress={() => open(r.categoryId)}
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
                  <Text variant="caption" color={colors.primary}>
                    ver gastos
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      </TourTarget>

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
