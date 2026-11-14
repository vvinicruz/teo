import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  CategoryIcon,
  Chip,
  DatePickerSheet,
  IconButton,
  Pressable,
  Screen,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { addMonths, friendlyDate, lastDay, monthOf } from '../domain/dates';
import { investmentBalance } from '../domain/investments';
import { formatMoney } from '../domain/money';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';

const GOAL_ICONS = ['viagem', 'reserva', 'carro', 'celular', 'moradia', 'curso', 'presentes', 'pets', 'filhos', 'lazer', 'meta'];

export default function MetaForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addGoal, updateGoal, deleteGoal } = useData();
  const { toast, confirm } = useFeedback();
  const todayDate = useToday();
  const existing = id ? data.goals.find((g) => g.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'viagem');
  const [target, setTarget] = useState(existing?.target ?? 0);
  const [saved, setSaved] = useState(existing?.saved ?? 0);
  const [deadline, setDeadline] = useState<string | null>(existing?.deadline ?? null);
  const [investmentId, setInvestmentId] = useState<string | null>(existing?.investmentId ?? null);
  const investments = data.investments.filter((i) => !i.archived || i.id === investmentId);
  const linked = investmentId ? data.investments.find((i) => i.id === investmentId) : undefined;
  const [dateOpen, setDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/metas'));

  if (id && !existing) {
    return (
      <Screen back title="meta">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          essa meta não existe mais.
        </Text>
      </Screen>
    );
  }

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('dá um nome para sua meta.');
    if (target <= 0) return setError('quanto você quer juntar?');
    setSaving(true);
    try {
      const payload = { name: name.trim(), icon, target, saved, deadline, investmentId };
      if (existing) await updateGoal({ ...existing, ...payload });
      else await addGoal(payload);
      toast(existing ? 'meta atualizada.' : 'meta criada! um passo de cada vez.');
      close();
    } catch {
      setSaving(false);
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({ title: `apagar "${existing.name}"?`, message: 'essa ação não pode ser desfeita.', confirmLabel: 'apagar meta', danger: true });
    if (!ok) return;
    try {
      await deleteGoal(existing.id);
      toast('meta apagada.', 'info');
      close();
    } catch {
      toast('não conseguimos apagar agora. tenta de novo?', 'erro');
    }
  };

  const quick = [6, 12].map((m) => lastDay(addMonths(monthOf(todayDate), m)));

  return (
    <Screen
      title={existing ? 'editar meta' : 'nova meta'}
      right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}
      footer={<Button label="salvar meta" onPress={save} loading={saving} />}
    >
      <View style={{ gap: space.xl, marginTop: space.md }}>
        <TextField label="qual é a meta?" value={name} onChangeText={setName} placeholder="ex.: viagem dos sonhos" maxLength={60} autoFocus={!existing} />

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            ícone
          </Text>
          <View style={styles.wrap}>
            {GOAL_ICONS.map((k) => (
              <Pressable key={k} onPress={() => setIcon(k)} style={[styles.icon, icon === k && styles.iconOn]} accessibilityLabel={k} accessibilityState={{ selected: icon === k }} scaleTo={0.9}>
                <CategoryIcon icon={k} size={44} tone={icon === k ? 'primary' : 'cream'} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <AmountInput value={target} onChange={setTarget} label="quanto você quer juntar?" size="medium" color={colors.primary} />
        </View>

        {investments.length ? (
          <View style={styles.block}>
            <Text variant="smallStrong" color={colors.textSoft}>
              onde você guarda esse dinheiro?
            </Text>
            <View style={styles.wrap}>
              <Chip label="em nenhuma caixinha" selected={!investmentId} onPress={() => setInvestmentId(null)} />
              {investments.map((i) => (
                <Chip key={i.id} label={i.name} selected={investmentId === i.id} onPress={() => setInvestmentId(i.id)} />
              ))}
            </View>
          </View>
        ) : null}

        {linked ? (
          <Text variant="small" color={colors.textSoft}>
            o progresso acompanha o saldo de “{linked.name}”: hoje, {formatMoney(investmentBalance(data, linked))}. guardar
            na meta é guardar na caixinha.
          </Text>
        ) : (
          <View style={styles.block}>
            <AmountInput value={saved} onChange={setSaved} label="quanto já tem guardado?" size="medium" />
          </View>
        )}

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            até quando? <Text variant="small" color={colors.textFaint}>(opcional)</Text>
          </Text>
          <View style={styles.wrap}>
            <Chip label="sem prazo" selected={!deadline} onPress={() => setDeadline(null)} />
            <Chip label="em 6 meses" selected={deadline === quick[0]} onPress={() => setDeadline(quick[0])} />
            <Chip label="em 1 ano" selected={deadline === quick[1]} onPress={() => setDeadline(quick[1])} />
            <Chip
              label={deadline && !quick.includes(deadline) ? friendlyDate(deadline, todayDate) : 'escolher data'}
              icon={CalendarDays}
              selected={!!deadline && !quick.includes(deadline)}
              onPress={() => setDateOpen(true)}
            />
          </View>
        </View>

        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {existing ? <Button label="apagar meta" icon={Trash2} variant="danger" onPress={remove} /> : null}
      </View>

      <DatePickerSheet visible={dateOpen} value={deadline ?? todayDate} onClose={() => setDateOpen(false)} onChange={setDeadline} title="prazo da meta" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  icon: { borderRadius: radius.pill, padding: 2, borderWidth: 2, borderColor: 'transparent' },
  iconOn: { borderColor: colors.primary },
});
