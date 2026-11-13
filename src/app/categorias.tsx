import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  CategoryIcon,
  CATEGORY_ICONS,
  IconButton,
  Pressable,
  Screen,
  Section,
  Segmented,
  Sheet,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import type { Category } from '../domain/types';
import { colors, radius, space } from '../theme';

type KindOpt = Category['kind'];

export default function Categorias() {
  const { data, addCategory, updateCategory, deleteCategory } = useData();
  const { toast, confirm } = useFeedback();
  const [editing, setEditing] = useState<Category | 'nova' | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('outros');
  const [kind, setKind] = useState<KindOpt>('despesa');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = data.categories.filter((c) => !c.archived);
  const groups: { title: string; items: Category[] }[] = [
    { title: 'despesas', items: active.filter((c) => c.kind === 'despesa') },
    { title: 'receitas', items: active.filter((c) => c.kind === 'receita') },
    { title: 'servem para os dois', items: active.filter((c) => c.kind === 'ambos') },
  ];
  const archived = data.categories.filter((c) => c.archived);

  const open = (c: Category | 'nova') => {
    setEditing(c);
    setError(null);
    if (c === 'nova') {
      setName('');
      setIcon('outros');
      setKind('despesa');
    } else {
      setName(c.name);
      setIcon(c.icon);
      setKind(c.kind);
    }
  };

  const save = async () => {
    const n = name.trim().toLowerCase();
    if (!n) return setError('dá um nome para a categoria.');
    const dup = data.categories.some((c) => !c.archived && c.name === n && (editing === 'nova' || c.id !== editing?.id));
    if (dup) return setError('já existe uma categoria com esse nome.');
    setSaving(true);
    try {
      if (editing === 'nova') await addCategory({ name: n, icon, kind });
      else if (editing) await updateCategory({ ...editing, name: n, icon, kind });
      toast('categoria salva.');
      setEditing(null);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || editing === 'nova') return;
    const ok = await confirm({
      title: `apagar "${editing.name}"?`,
      message: 'se ela já tiver movimentações, vamos só escondê-la para não perder seu histórico.',
      confirmLabel: 'apagar',
      danger: true,
    });
    if (!ok) return;
    try {
      const result = await deleteCategory(editing.id);
      toast(result === 'arquivada' ? 'categoria escondida. o histórico continua.' : 'categoria apagada.', 'info');
      setEditing(null);
    } catch {
      toast('não conseguimos apagar agora. tenta de novo?', 'erro');
    }
  };

  return (
    <Screen
      back
      title="categorias"
      right={<IconButton icon={Plus} label="nova categoria" onPress={() => open('nova')} background={colors.cream} color={colors.primary} />}
    >
      {groups.map((g) =>
        g.items.length ? (
          <Section key={g.title} title={g.title}>
            <View style={styles.grid}>
              {g.items.map((c) => (
                <Card key={c.id} onPress={() => open(c)} style={styles.cell}>
                  <CategoryIcon icon={c.icon} size={40} tone={c.kind === 'receita' ? 'income' : 'cream'} />
                  <Text variant="smallStrong" numberOfLines={1}>
                    {c.name}
                  </Text>
                </Card>
              ))}
            </View>
          </Section>
        ) : null,
      )}

      {archived.length ? (
        <Section title="escondidas">
          <View style={styles.grid}>
            {archived.map((c) => (
              <Card
                key={c.id}
                style={[styles.cell, { opacity: 0.6 }]}
                onPress={async () => {
                  try {
                    await updateCategory({ ...c, archived: false });
                    toast(`"${c.name}" voltou.`);
                  } catch {
                    toast('não conseguimos salvar agora.', 'erro');
                  }
                }}
              >
                <CategoryIcon icon={c.icon} size={40} tone="muted" />
                <Text variant="smallStrong" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text variant="caption" color={colors.primary}>
                  toque para mostrar
                </Text>
              </Card>
            ))}
          </View>
        </Section>
      ) : null}

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing === 'nova' ? 'nova categoria' : 'editar categoria'}>
        <View style={{ gap: space.lg }}>
          <TextField label="nome" value={name} onChangeText={setName} maxLength={40} autoCapitalize="none" error={error} />
          <Segmented<KindOpt>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'despesa', label: 'despesa' },
              { value: 'receita', label: 'receita' },
              { value: 'ambos', label: 'os dois' },
            ]}
          />
          <View style={styles.icons}>
            {Object.keys(CATEGORY_ICONS).map((k) => (
              <Pressable key={k} onPress={() => setIcon(k)} style={[styles.icon, icon === k && styles.iconOn]} accessibilityLabel={k} scaleTo={0.9}>
                <CategoryIcon icon={k} size={40} tone={icon === k ? 'primary' : 'cream'} />
              </Pressable>
            ))}
          </View>
          <Button label="salvar" onPress={save} loading={saving} />
          {editing && editing !== 'nova' ? <Button label="apagar categoria" variant="ghost" onPress={remove} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '31.5%', alignItems: 'center', gap: space.sm, paddingVertical: space.lg, paddingHorizontal: space.sm },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  icon: { borderRadius: radius.pill, padding: 2, borderWidth: 2, borderColor: 'transparent' },
  iconOn: { borderColor: colors.primary },
});
