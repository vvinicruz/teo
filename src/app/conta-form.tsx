import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  BankBadge,
  Button,
  Chip,
  IconButton,
  Screen,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { BANKS } from '../domain/banks';
import { colors, space } from '../theme';

export default function ContaForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addAccount, updateAccount, deleteAccount } = useData();
  const { toast, confirm } = useFeedback();
  const existing = id ? data.accounts.find((a) => a.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [bankCode, setBankCode] = useState<string | null>(existing?.bankCode ?? null);
  const [balance, setBalance] = useState(Math.abs(existing?.initialBalance ?? 0));
  const [negative, setNegative] = useState((existing?.initialBalance ?? 0) < 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/contas'));

  if (id && !existing) {
    return (
      <Screen back title="conta">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          essa conta não existe mais.
        </Text>
      </Screen>
    );
  }

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('dá um nome para a conta, tipo "itaú" ou "nubank".');
    setSaving(true);
    const payload = { name: name.trim().toLowerCase(), bankCode, initialBalance: negative ? -balance : balance };
    try {
      if (existing) await updateAccount({ ...existing, ...payload });
      else await addAccount(payload);
      toast(existing ? 'conta atualizada.' : 'conta adicionada! já aparece no "onde foi?".');
      close();
    } catch {
      setSaving(false);
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `apagar a conta ${existing.name}?`,
      message: 'se ela já tiver movimentações, vamos só escondê-la para não perder seu histórico.',
      confirmLabel: 'apagar conta',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await deleteAccount(existing.id);
      toast(r === 'arquivada' ? 'conta escondida. o histórico continua.' : 'conta apagada.', 'info');
      router.replace('/contas');
    } catch {
      toast('não conseguimos apagar agora. tenta de novo?', 'erro');
    }
  };

  return (
    <Screen
      title={existing ? 'editar conta' : 'nova conta bancária'}
      right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}
      footer={<Button label="salvar conta" onPress={save} loading={saving} />}
    >
      <View style={{ gap: space.xl, marginTop: space.md }}>
        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            qual banco?
          </Text>
          <View style={styles.wrap}>
            {BANKS.slice(0, 12).map((b) => (
              <Chip
                key={b.code}
                label={b.name}
                leading={<BankBadge bankCode={b.code} name={b.name} kind="conta" size={20} />}
                selected={bankCode === b.code}
                onPress={() => {
                  setBankCode(b.code);
                  if (!name.trim() || BANKS.some((x) => x.name === name.trim())) setName(b.name);
                }}
              />
            ))}
            <Chip label="outro" selected={bankCode === null} onPress={() => setBankCode(null)} />
          </View>
        </View>

        <TextField label="nome da conta" value={name} onChangeText={setName} placeholder="ex.: itaú, nubank, carteira" maxLength={40} />

        <View style={styles.block}>
          <AmountInput
            value={balance}
            onChange={setBalance}
            label={existing ? 'saldo quando a conta foi cadastrada' : 'quanto tem nessa conta hoje?'}
            size="medium"
            color={negative ? colors.danger : colors.text}
          />
          <View style={[styles.wrap, { justifyContent: 'center' }]}>
            <Chip label="positivo" selected={!negative} onPress={() => setNegative(false)} />
            <Chip label="negativo" selected={negative} onPress={() => setNegative(true)} />
          </View>
          <Text variant="small" color={colors.textFaint} center>
            esse valor entra no seu saldo total. depois, o teo soma e tira o que você registrar nessa conta.
          </Text>
        </View>

        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {existing ? <Button label="apagar conta" icon={Trash2} variant="danger" onPress={remove} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
