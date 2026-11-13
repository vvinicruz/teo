import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

interface Props<T extends string> {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.item, on && styles.itemOn]}
          >
            <Text variant="smallStrong" color={on ? (o.color ?? colors.text) : colors.textSoft}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.pill, padding: 4 },
  item: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  itemOn: { backgroundColor: colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
});
