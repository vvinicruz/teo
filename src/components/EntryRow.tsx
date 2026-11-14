import { StyleSheet, View } from 'react-native';
import { friendlyDate } from '../domain/dates';
import type { EntrySource } from '../domain/finance';
import type { Kind } from '../domain/types';
import { useData } from '../data/DataProvider';
import { useCategories } from '../hooks/useCategories';
import { colors, space } from '../theme';
import { Badge } from './Badge';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';
import { Pressable } from './Pressable';
import { Text } from './Text';

export interface EntryRowData {
  kind: Kind;
  amount: number;
  description: string;
  categoryId: string | null;
  date: string;
  source: EntrySource;
  overdue?: boolean;
  installment?: string;
  recurring?: boolean;
  /** compra no cartão: mostra o nome do cartão. */
  cardId?: string | null;
  /** previsão de fatura (ou, junto com paysCardId, a fatura que foi paga). */
  invoiceDate?: string | null;
  /** pagamento de fatura. */
  paysCardId?: string | null;
  /** textos e ícone próprios (ex.: saldo e juros da fatura anterior). */
  metaOverride?: string;
  iconOverride?: string;
}

interface Props {
  item: EntryRowData;
  onPress?: () => void;
  /** esconde a data (quando a lista já está agrupada por dia). */
  hideDate?: boolean;
  right?: React.ReactNode;
}

export function EntryRow({ item, onPress, hideDate, right }: Props) {
  const { get } = useCategories();
  const { data } = useData();
  const cat = get(item.categoryId);
  const isIncome = item.kind === 'receita';
  const planned = item.source !== 'realizada';
  const invoiceForecast = !!item.invoiceDate && !item.paysCardId;
  const isInvoice = invoiceForecast || !!item.paysCardId;
  const cardName = item.cardId && !invoiceForecast ? data.cards.find((c) => c.id === item.cardId)?.name : null;

  const meta = item.metaOverride ?? [
    invoiceForecast ? 'fatura do cartão' : item.paysCardId ? 'pagamento de fatura' : (cat?.name ?? 'sem categoria'),
    cardName ? `cartão ${cardName}` : null,
    hideDate ? null : friendlyDate(item.date),
    item.installment ? `parcela ${item.installment}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const body = (
    <View style={[styles.row, planned && styles.planned]}>
      <CategoryIcon icon={item.iconOverride ?? (isInvoice ? 'cartao' : cat?.icon)} tone={isIncome ? 'income' : planned ? 'muted' : 'cream'} size={42} />
      <View style={styles.middle}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {item.description}
        </Text>
        <Text variant="small" color={colors.textSoft} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {right ?? (
        <View style={styles.right}>
          <Money
            value={isIncome ? item.amount : -item.amount}
            sign={isIncome}
            variant="bodyStrong"
            color={isIncome ? colors.income : planned ? colors.textSoft : colors.text}
          />
          {item.overdue ? (
            <Badge label="a confirmar" tone="atencao" />
          ) : item.source === 'pendente' ? (
            <Badge label="pendente" tone="pendente" />
          ) : null}
        </View>
      )}
    </View>
  );

  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" scaleTo={0.985}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  planned: { opacity: 0.92 },
  middle: { flex: 1, gap: 3 },
  right: { alignItems: 'flex-end', gap: 4 },
});
