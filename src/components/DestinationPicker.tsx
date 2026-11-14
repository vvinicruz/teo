import { CreditCard, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useData } from '../data/DataProvider';
import { space } from '../theme';
import { Chip } from './Chip';

interface Props {
  /** null = conta. */
  value: string | null;
  onChange: (cardId: string | null) => void;
}

/** onde a movimentação acontece: na conta ou em um cartão de crédito. */
export function DestinationPicker({ value, onChange }: Props) {
  const { data } = useData();
  const cards = data.cards.filter((c) => !c.archived || c.id === value);
  return (
    <View style={styles.wrap}>
      <Chip label="conta" icon={Wallet} selected={value === null} onPress={() => onChange(null)} />
      {cards.map((c) => (
        <Chip key={c.id} label={c.name} icon={CreditCard} selected={value === c.id} onPress={() => onChange(c.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
