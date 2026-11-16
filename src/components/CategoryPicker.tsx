import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useData } from '../data/DataProvider';
import type { Category, Kind } from '../domain/types';
import { colors, radius, space } from '../theme';
import { Button } from './Button';
import { CATEGORY_ICONS, CategoryIcon } from './CategoryIcon';
import { useFeedback } from './Feedback';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { TextField } from './TextField';

interface Props {
  categories: Category[];
  value: string | null;
  onChange: (id: string | null) => void;
  income?: boolean;
}

/** escolha de categoria em "pílulas" com ícone. tocar de novo desmarca. dá pra criar uma nova na hora. */
export function CategoryPicker({ categories, value, onChange, income }: Props) {
  const { data, addCategory } = useData();
  const { toast } = useFeedback();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('outros');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = () => {
    setName('');
    setIcon('outros');
    setError(null);
    setCreating(true);
  };

  const create = async () => {
    const n = name.trim().toLowerCase();
    if (!n) return setError('dá um nome para a categoria.');
    if (data.categories.some((c) => !c.archived && c.name === n)) return setError('já existe uma categoria com esse nome.');
    setSaving(true);
    try {
      const kind: Kind = income ? 'receita' : 'despesa';
      const cat = await addCategory({ name: n, icon, kind });
      onChange(cat.id);
      toast(`categoria "${n}" criada.`);
      setCreating(false);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

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
      <Pressable onPress={open} style={[styles.cat, styles.add]} accessibilityRole="button" accessibilityLabel="nova categoria">
        <View style={styles.addIcon}>
          <Icon as={Plus} size={16} color={colors.primary} />
        </View>
        <Text variant="smallStrong" color={colors.primary}>
          nova categoria
        </Text>
      </Pressable>

      <Sheet visible={creating} onClose={() => setCreating(false)} title="nova categoria">
        <View style={{ gap: space.lg }}>
          <TextField
            label="nome"
            value={name}
            onChangeText={setName}
            placeholder={income ? 'ex.: freelas, vendas' : 'ex.: pet, café, presentes'}
            maxLength={40}
            autoCapitalize="none"
            autoFocus
            error={error}
          />
          <Text variant="smallStrong" color={colors.textSoft}>
            escolha um ícone
          </Text>
          <View style={styles.icons}>
            {Object.keys(CATEGORY_ICONS).map((k) => (
              <Pressable
                key={k}
                onPress={() => setIcon(k)}
                style={[styles.icon, icon === k && styles.iconOn]}
                accessibilityLabel={k}
                accessibilityState={{ selected: icon === k }}
                scaleTo={0.9}
              >
                <CategoryIcon icon={k} size={40} tone={icon === k ? 'primary' : income ? 'income' : 'cream'} />
              </Pressable>
            ))}
          </View>
          <Button label="criar categoria" onPress={create} loading={saving} />
        </View>
      </Sheet>
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
  add: { borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.background },
  addIcon: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  icon: { borderRadius: radius.pill, padding: 2, borderWidth: 2, borderColor: 'transparent' },
  iconOn: { borderColor: colors.primary },
});
