import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, EntryRow, IconButton, Money, Screen, Section, Text } from '../components';
import { useData } from '../data/DataProvider';
import { monthName, monthOf } from '../domain/dates';
import { occurrenceDate, recurrenceEnd } from '../domain/finance';
import type { Recurrence } from '../domain/types';
import { useToday } from '../hooks/useToday';
import { colors, space } from '../theme';

export default function Recorrencias() {
  const { data } = useData();
  const todayDate = useToday();
  const month = monthOf(todayDate);

  const { incomes, expenses, ended } = useMemo(() => {
    const active: Recurrence[] = [];
    const ended: Recurrence[] = [];
    for (const r of data.recurrences) {
      const end = recurrenceEnd(r);
      (end && end < todayDate ? ended : active).push(r);
    }
    const byDay = (a: Recurrence, b: Recurrence) => a.dayOfMonth - b.dayOfMonth;
    return {
      incomes: active.filter((r) => r.kind === 'receita').sort(byDay),
      expenses: active.filter((r) => r.kind === 'despesa').sort(byDay),
      ended,
    };
  }, [data.recurrences, todayDate]);

  const totalIn = incomes.reduce((a, r) => a + r.amount, 0);
  const totalOut = expenses.reduce((a, r) => a + r.amount, 0);

  const row = (r: Recurrence) => {
    const end = recurrenceEnd(r);
    const meta = r.occurrences
      ? `todo dia ${r.dayOfMonth} · até ${monthName(monthOf(end!))}`
      : `todo dia ${r.dayOfMonth}`;
    return (
      <EntryRow
        key={r.id}
        item={{
          kind: r.kind,
          amount: r.amount,
          description: r.description,
          categoryId: r.categoryId,
          date: occurrenceDate(r, r.startMonth > month ? r.startMonth : month),
          source: 'realizada',
          installment: undefined,
        }}
        hideDate
        onPress={() => router.push({ pathname: '/recorrencia', params: { id: r.id } })}
        right={
          <View style={{ alignItems: 'flex-end' }}>
            <Money value={r.amount} variant="bodyStrong" color={r.kind === 'receita' ? colors.income : colors.text} />
            <Text variant="caption" color={colors.textFaint}>
              {meta}
            </Text>
          </View>
        }
      />
    );
  };

  return (
    <Screen
      back
      title="contas fixas e recorrências"
      right={<IconButton icon={Plus} label="nova recorrência" onPress={() => router.push('/recorrencia')} background={colors.cream} color={colors.primary} />}
    >
      <Text color={colors.textSoft} style={{ marginTop: space.md }}>
        tudo o que se repete todo mês: salário, aluguel, assinaturas, parcelas. o teo prevê por você no horizonte.
      </Text>

      {data.recurrences.length === 0 ? (
        <EmptyState
          title="nada se repete por aqui ainda"
          message="cadastre seu salário e suas contas fixas para ver o futuro do seu saldo."
          actionLabel="adicionar a primeira"
          onAction={() => router.push('/recorrencia')}
        />
      ) : (
        <>
          <Card tone="cream" style={styles.totals}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.textSoft}>
                entra todo mês
              </Text>
              <Money value={totalIn} variant="bodyStrong" color={colors.income} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.textSoft}>
                sai todo mês
              </Text>
              <Money value={totalOut} variant="bodyStrong" color={colors.primary} />
            </View>
          </Card>
          {incomes.length ? (
            <Section title="receitas">
              <Card padded={false} style={styles.list}>
                {incomes.map(row)}
              </Card>
            </Section>
          ) : null}
          {expenses.length ? (
            <Section title="despesas">
              <Card padded={false} style={styles.list}>
                {expenses.map(row)}
              </Card>
            </Section>
          ) : null}
          {ended.length ? (
            <Section title="já terminaram">
              <Card padded={false} style={[styles.list, { opacity: 0.6 }]}>
                {ended.map(row)}
              </Card>
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', marginTop: space.xl, paddingVertical: space.lg },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
});
