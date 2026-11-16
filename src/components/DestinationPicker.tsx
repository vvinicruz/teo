import { router } from 'expo-router';
import { CreditCard, Landmark, Plus, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useData } from '../data/DataProvider';
import { MAIN_ACCOUNT_NAME } from '../domain/types';
import { colors, radius, space } from '../theme';
import { Button } from './Button';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';

/** onde o dinheiro entrou/saiu: uma conta (null = principal) ou um cartão de crédito. */
export interface Destination {
  accountId: string | null;
  cardId: string | null;
}

interface Props {
  value: Destination;
  onChange: (d: Destination) => void;
  /** esconde os cartões (ex.: receitas e transferências). */
  accountsOnly?: boolean;
}

export function DestinationPicker({ value, onChange, accountsOnly }: Props) {
  const { data } = useData();
  const [adding, setAdding] = useState(false);
  const accounts = data.accounts.filter((a) => !a.archived || a.id === value.accountId);
  const cards = accountsOnly ? [] : data.cards.filter((c) => !c.archived || c.id === value.cardId);

  const go = (path: '/conta-form' | '/cartao-form') => {
    setAdding(false);
    router.push(path);
  };

  return (
    <View style={styles.wrap}>
      <Chip
        label={accounts.length ? MAIN_ACCOUNT_NAME : 'conta'}
        icon={Wallet}
        selected={!value.cardId && !value.accountId}
        onPress={() => onChange({ accountId: null, cardId: null })}
      />
      {accounts.map((a) => (
        <Chip
          key={a.id}
          label={a.name}
          icon={Landmark}
          selected={!value.cardId && value.accountId === a.id}
          onPress={() => onChange({ accountId: a.id, cardId: null })}
        />
      ))}
      {cards.map((c) => (
        <Chip key={c.id} label={c.name} icon={CreditCard} selected={value.cardId === c.id} onPress={() => onChange({ accountId: null, cardId: c.id })} />
      ))}
      <Pressable onPress={() => setAdding(true)} style={styles.add} accessibilityRole="button" accessibilityLabel="adicionar conta ou cartão">
        <Icon as={Plus} size={16} color={colors.primary} />
        <Text variant="smallStrong" color={colors.primary}>
          adicionar
        </Text>
      </Pressable>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="o que você quer adicionar?">
        <View style={{ gap: space.sm }}>
          <Button label="conta bancária" icon={Landmark} variant="secondary" onPress={() => go('/conta-form')} />
          <Text variant="small" color={colors.textFaint} style={{ marginBottom: space.md }}>
            conta corrente ou digital, onde o dinheiro entra e sai (pix, débito, transferência).
          </Text>
          {!accountsOnly ? (
            <>
              <Button label="cartão de crédito" icon={CreditCard} variant="secondary" onPress={() => go('/cartao-form')} />
              <Text variant="small" color={colors.textFaint}>
                as compras vão para a fatura e saem do saldo só no vencimento.
              </Text>
            </>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
});
