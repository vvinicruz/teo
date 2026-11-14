import { router } from 'expo-router';
import { ChevronRight, CreditCard, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, EmptyState, Icon, IconButton, Money, ProgressBar, Screen, Text } from '../components';
import { useData } from '../data/DataProvider';
import { shortDate } from '../domain/dates';
import { cardLimitUsed, invoiceByDueDate, invoiceOf } from '../domain/finance';
import { formatMoney } from '../domain/money';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';

const STATUS = { aberta: 'aberta', fechada: 'fechada · aguardando pagamento', paga: 'paga' } as const;

export default function Cartoes() {
  const { data } = useData();
  const todayDate = useToday();

  const cards = useMemo(
    () =>
      data.cards
        .filter((c) => !c.archived)
        .map((card) => {
          // fatura em destaque: a que recebe as compras de hoje.
          const invoice = invoiceByDueDate(data, card, invoiceOf(card, todayDate).dueDate, todayDate);
          return { card, invoice, used: cardLimitUsed(data, card, todayDate) };
        }),
    [data, todayDate],
  );

  return (
    <Screen
      back
      title="cartões de crédito"
      right={<IconButton icon={Plus} label="novo cartão" onPress={() => router.push('/cartao-form')} background={colors.cream} color={colors.primary} />}
    >
      <Text color={colors.textSoft} style={{ marginTop: space.md }}>
        compras no cartão não saem do seu saldo na hora: elas vão para a fatura, que aparece no horizonte no dia do
        vencimento.
      </Text>

      {cards.length === 0 ? (
        <EmptyState
          title="nenhum cartão por aqui"
          message="cadastre seu cartão com o dia de fechamento e de vencimento. leva menos de um minuto."
          actionLabel="cadastrar cartão"
          onAction={() => router.push('/cartao-form')}
        />
      ) : (
        <View style={{ gap: space.md, marginTop: space.xl }}>
          {cards.map(({ card, invoice, used }) => (
            <Card key={card.id} onPress={() => router.push({ pathname: '/cartao', params: { id: card.id } })} style={{ gap: space.md }}>
              <View style={styles.head}>
                <View style={styles.icon}>
                  <Icon as={CreditCard} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{card.name}</Text>
                  <Text variant="small" color={colors.textSoft}>
                    fecha dia {card.closingDay} · vence dia {card.dueDay}
                  </Text>
                </View>
                <Icon as={ChevronRight} color={colors.textFaint} />
              </View>
              <View style={styles.invoice}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={colors.textSoft}>
                    fatura {STATUS[invoice.status]} · vence {shortDate(invoice.dueDate)}
                  </Text>
                  <Money value={invoice.total} variant="heading" />
                </View>
              </View>
              {card.creditLimit ? (
                <View style={{ gap: 6 }}>
                  <ProgressBar value={used / card.creditLimit} height={6} color={used > card.creditLimit ? colors.attention : colors.primary} />
                  <Text variant="small" color={colors.textSoft}>
                    {data.settings.hideValues
                      ? `${Math.round((used / card.creditLimit) * 100)}% do limite em uso`
                      : `${formatMoney(Math.max(0, card.creditLimit - used))} de limite disponível`}
                  </Text>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  invoice: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.line },
});
