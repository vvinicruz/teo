import { StyleSheet, View } from 'react-native';
import type { Category } from '../domain/types';
import { colors, radius, space } from '../theme';
import { CategoryIcon } from './CategoryIcon';
import { Pressable } from './Pressable';
import { Text } from './Text';

interface Props {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  income?: boolean;
}

/** escolha de categoria em "pílulas" com ícone. tocar de novo desmarca. */
export function CategoryPicker({ categories, value, onChange, income }: Props) {
  return (
    <View style={styles.wrap}>
      {categories.map((c) => {
        const on = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(on ? null : c.id)}
            style={[styles.cat, on && styles.catOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={c.name}
          >
            <CategoryIcon icon={c.icon} size={28} tone={on ? 'primary' : income ? 'income' : 'cream'} />
            <Text variant="smallStrong">{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 5,
    paddingRight: space.md,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  catOn: { borderColor: colors.primary, backgroundColor: colors.cream },
});
