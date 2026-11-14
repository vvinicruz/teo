import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AmountInput, Button, Chip, IconButton, Screen, Text, TextField, useFeedback } from '../components';
import { useData } from '../data/DataProvider';
import { INVESTMENT_KINDS, type InvestmentKind } from '../domain/types';
import { colors, space } from '../theme';

export default function CaixinhaForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addInvestment, updateInvestment, deleteInvestment } = useData();
  const { toast, confirm } = useFeedback();
  const existing = id ? data.investments.find((i) => i.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<InvestmentKind>(existing?.kind ?? 'caixinha');
  const [cdi, setCdi] = useState(existing?.cdiPercent != null ? String(existing.cdiPercent).replace('.', ',') : '100');
  const [balance, setBalance] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/guardado'));
  const usesCdi = kind === 'caixinha' || kind === 'cdb' || kind === 'outro';

  if (id && !existing) {
    return (
      <Screen back title="caixinha">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          essa caixinha não existe mais.
        </Text>
      </Screen>
    );
  }

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('dá um nome, tipo "caixinha nubank" ou "reserva".');
    const pct = usesCdi && cdi.trim() ? Number(cdi.replace(',', '.')) : null;
    if (pct !== null && !(pct >= 0 && pct <= 300)) return setError('o rendimento precisa ser entre 0% e 300% do cdi.');
    setSaving(true);
    const payload = { name: name.trim().toLowerCase(), kind, cdiPercent: kind === 'poupanca' ? null : kind === 'tesouro' ? 100 : pct };
    try {
      if (existing) await updateInvestment({ ...existing, ...payload });
      else await addInvestment({ ...payload, balance });
      toast(existing ? 'caixinha atualizada.' : 'caixinha criada! cada real guardado conta :)');
      close();
    } catch {
      setSaving(false);
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `apagar "${existing.name}"?`,
      message: 'se ela já tiver movimentações ou metas ligadas, vamos só escondê-la para não perder seu histórico.',
      confirmLabel: 'apagar',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await deleteInvestment(existing.id);
      toast(r === 'arquivada' ? 'caixinha escondida. o histórico continua.' : 'caixinha apagada.', 'info');
      router.replace('/guardado');
    } catch {
      toast('não conseguimos apagar agora. tenta de novo?', 'erro');
    }
  };

  return (
    <Screen
      title={existing ? 'editar caixinha' : 'nova caixinha'}
      right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}
      footer={<Button label="salvar" onPress={save} loading={saving} />}
    >
      <View style={{ gap: space.xl, marginTop: space.md }}>
        <TextField
          label="nome"
          value={name}
          onChangeText={setName}
          placeholder="ex.: caixinha nubank, reserva, cdb inter"
          maxLength={40}
          autoFocus={!existing}
        />

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            o que é?
          </Text>
          <View style={styles.wrap}>
            {INVESTMENT_KINDS.map((k) => (
              <Chip key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
            ))}
          </View>
        </View>

        {usesCdi ? (
          <TextField
            label="quanto rende (% do cdi)"
            value={cdi}
            onChangeText={(t) => setCdi(t.replace(/[^\d,.]/g, '').slice(0, 6))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="ex.: 100"
            hint="aparece no app do banco, tipo “rende 100% do cdi”. se não souber, deixe 100."
          />
        ) : (
          <Text variant="small" color={colors.textFaint}>
            {kind === 'poupanca'
              ? 'a poupança rende 0,5% ao mês quando a selic está acima de 8,5% ao ano (mais a tr).'
              : 'o tesouro selic acompanha a taxa selic.'}
          </Text>
        )}

        {!existing ? (
          <AmountInput value={balance} onChange={setBalance} label="quanto tem guardado hoje?" size="medium" />
        ) : (
          <Text variant="small" color={colors.textFaint}>
            para acertar o valor com o banco, use “atualizar valor” na tela da caixinha.
          </Text>
        )}

        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {existing ? <Button label="apagar caixinha" icon={Trash2} variant="danger" onPress={remove} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
