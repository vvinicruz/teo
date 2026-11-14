import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, CategoryIcon, EmptyState, Icon, IconButton, Money, Screen, Text } from '../components';
import { useData } from '../data/DataProvider';
import { investmentBalance, monthlyYield } from '../domain/investments';
import { formatMoney } from '../domain/money';
import { INVESTMENT_KINDS } from '../domain/types';
import { useIndexRates } from '../hooks/useIndexRates';
import { colors, space } from '../theme';

export default function Guardado() {
  const { data } = useData();
  const rates = useIndexRates();

  const items = useMemo(
    () =>
      data.investments
        .filter((i) => !i.archived)
        .map((inv) => {
          const balance = investmentBalance(data, inv);
          return { inv, balance, yield: rates ? monthlyYield(balance, inv, rates) : null };
        }),
    [data, rates],
  );
  const total = items.reduce((a, i) => a + i.balance, 0);
  const totalYield = items.reduce((a, i) => a + (i.yield ?? 0), 0);
  const hide = data.settings.hideValues;

  return (
    <Screen
      back
      title="caixinhas e investimentos"
      right={<IconButton icon={Plus} label="nova caixinha" onPress={() => router.push('/caixinha-form')} background={colors.cream} color={colors.primary} />}
    >
      {items.length === 0 ? (
        <EmptyState
          title="nada guardado por aqui ainda"
          message="cadastre suas caixinhas, cdb, poupança ou tesouro selic para ver tudo o que você já guardou num lugar só."
          actionLabel="cadastrar caixinha"
          onAction={() => router.push('/caixinha-form')}
        />
      ) : (
        <>
          <Card tone="cream" style={styles.total}>
            <Text variant="small" color={colors.textSoft}>
              você tem guardado
            </Text>
            <Money value={total} variant="display" color={colors.primary} />
            {totalYield > 0 ? (
              <Text variant="small" color={colors.textSoft}>
                {hide ? 'rendendo todo mês' : `rende cerca de ${formatMoney(totalYield)} por mês`} · estimativa, antes do imposto
              </Text>
            ) : null}
          </Card>

          <View style={{ gap: space.sm, marginTop: space.xl }}>
            {items.map(({ inv, balance, yield: y }) => (
              <Card key={inv.id} onPress={() => router.push({ pathname: '/caixinha', params: { id: inv.id } })} style={styles.row}>
                <CategoryIcon icon="reserva" size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{inv.name}</Text>
                  <Text variant="small" color={colors.textSoft}>
                    {INVESTMENT_KINDS.find((k) => k.id === inv.kind)?.label}
                    {inv.cdiPercent != null && inv.kind !== 'tesouro' ? ` · ${String(inv.cdiPercent).replace('.', ',')}% do cdi` : ''}
                    {y != null && !hide ? ` · +${formatMoney(y)}/mês` : ''}
                  </Text>
                </View>
                <Money value={balance} variant="bodyStrong" />
                <Icon as={ChevronRight} size={18} color={colors.textFaint} />
              </Card>
            ))}
          </View>

          <Text variant="small" color={colors.textFaint} center style={{ marginTop: space.xl }}>
            {rates
              ? `rendimento estimado com cdi de ${String(rates.cdiAnnual).replace('.', ',')}% e selic de ${String(rates.selicAnnual).replace('.', ',')}% ao ano (banco central).`
              : 'o teo não se conecta ao seu banco: de vez em quando, use “atualizar valor” para acertar com o app do banco.'}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { gap: space.xs, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
});
