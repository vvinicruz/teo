import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  addMonths,
  firstDay,
  monthDays,
  monthName,
  monthOf,
  parseISODate,
  WEEKDAY_INITIALS,
  weekdayIndex,
} from '../domain/dates';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Pressable } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';

interface Props {
  visible: boolean;
  value: string;
  onClose: () => void;
  onChange: (date: string) => void;
  title?: string;
}

/** calendário simples, do jeito do teo. */
export function DatePickerSheet({ visible, value, onClose, onChange, title = 'escolha a data' }: Props) {
  const todayDate = useToday();
  // o calendário sempre abre no mês da data escolhida.
  const [month, setMonth] = useState(monthOf(value));
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  if (visible && openedWith !== value) {
    setOpenedWith(value);
    setMonth(monthOf(value));
  }
  if (!visible && openedWith !== null) setOpenedWith(null);

  const days = monthDays(month);
  const lead = weekdayIndex(firstDay(month));
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.monthRow}>
        <IconButton icon={ChevronLeft} label="mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
        <Text variant="bodyStrong">{monthName(month, true)}</Text>
        <IconButton icon={ChevronRight} label="próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
      </View>
      <View style={styles.grid}>
        {WEEKDAY_INITIALS.map((w, i) => (
          <View key={`h${i}`} style={styles.cell}>
            <Text variant="caption" color={colors.textFaint}>
              {w}
            </Text>
          </View>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={`e${i}`} style={styles.cell} />;
          const selected = d === value;
          const isToday = d === todayDate;
          return (
            <View key={d} style={styles.cell}>
              <Pressable
                onPress={() => {
                  onChange(d);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={d}
                accessibilityState={{ selected }}
                scaleTo={0.9}
                style={[styles.day, selected && styles.daySelected, !selected && isToday && styles.dayToday]}
              >
                <Text variant="bodyStrong" color={selected ? colors.white : isToday ? colors.primary : colors.text}>
                  {parseISODate(d).day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Button
        label="hoje"
        variant="ghost"
        small
        onPress={() => {
          onChange(todayDate);
          onClose();
        }}
        style={{ alignSelf: 'center', marginTop: space.md }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { backgroundColor: colors.cream },
});
