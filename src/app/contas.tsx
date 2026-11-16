import { router } from 'expo-router';
import { ArrowLeftRight, ChevronRight, CreditCard, Landmark, Plus, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  Chip,
  Icon,
  IconButton,
  Money,
  Pressable,
  Screen,
  Section,
  Sheet,
  Text,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { addDays } from '../domain/dates';
import { accountBalance, currentBalance } from '../domain/finance';
import { formatMoney } from '../domain/money';
import { MAIN_ACCOUNT_NAME } from '../domain/types';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';

export default function Contas() {
  const { data, transfer } = useData();
  const { toast } = useFeedback();
  const todayDate = useToday();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [yesterday, setYesterday] = useState(false);
  const [saving, setSaving] = useState(false);

  const accounts = data.accounts.filter((a) => !a.archived);
  const list: { id: string | null; name: string }[] = [{ id: null, name: MAIN_ACCOUNT_NAME }, ...accounts.map((a) => ({ id: a.id, name: a.name }))];
  const cards = data.cards.filter((c) => !c.archived);

  const openTransfer = () => {
    setFrom(null);
    setTo(accounts[0]?.id ?? null);
    setAmount(0);
    setYesterday(false);
    setOpen(true);
  };

  const save = async () => {
    if (amount <= 0 || from === to) return;
    setSaving(true);
    try {
      await transfer(from, to, amount, yesterday ? addDays(todayDate, -1) : todayDate);
      toast('transferência registrada. ela não conta como gasto :)');
      setOpen(false);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  const nameOf = (id: string | null) => list.find((a) => a.id === id)?.name ?? '';

  return (
    <Screen
      back
      title="contas e cartões"
      right={<IconButton icon={Plus} label="nova conta" onPress={() => router.push('/conta-form')} background={colors.cream} color={colors.primary} />}
    >
      <Card tone="cream" style={styles.total}>
        <Text variant="small" color={colors.textSoft}>
          saldo somando todas as contas
        </Text>
        <Money value={currentBalance(data)} variant="display" />
      </Card>

      <Section title="contas" actionLabel={accounts.length ? 'transferir' : undefined} onAction={openTransfer}>
        <Card padded={false}>
          {list.map((a, i) => (
            <Pressable
              key={a.id ?? 'principal'}
              onPress={() => (a.id ? router.push({ pathname: '/conta-form', params: { id: a.id } }) : router.push('/perfil'))}
              style={[styles.row, i < list.length - 1 && styles.sep]}
              accessibilityRole="button"
              scaleTo={0.99}
            >
              <View style={styles.icon}>
                <Icon as={a.id ? Landmark : Wallet} color={colors.primary} />
              </View>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {a.name}
              </Text>
              <Money value={accountBalance(data, a.id)} variant="bodyStrong" />
              <Icon as={ChevronRight} size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </Card>
        <Button label="adicionar conta bancária" icon={Plus} variant="secondary" small onPress={() => router.push('/conta-form')} style={{ alignSelf: 'flex-start' }} />
        {accounts.length ? (
          <Button label="transferir entre contas" icon={ArrowLeftRight} variant="ghost" small onPress={openTransfer} style={{ alignSelf: 'flex-start' }} />
        ) : null}
      </Section>

      <Section title="cartões de crédito" actionLabel="ver cartões" onAction={() => router.push('/cartoes')}>
        {cards.length ? (
          <Card padded={false}>
            {cards.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => router.push({ pathname: '/cartao', params: { id: c.id } })}
                style={[styles.row, i < cards.length - 1 && styles.sep]}
                accessibilityRole="button"
                scaleTo={0.99}
              >
                <View style={styles.icon}>
                  <Icon as={CreditCard} color={colors.primary} />
                </View>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {c.name}
                </Text>
                <Text variant="small" color={colors.textSoft}>
                  vence dia {c.dueDay}
                </Text>
                <Icon as={ChevronRight} size={18} color={colors.textFaint} />
              </Pressable>
            ))}
          </Card>
        ) : (
          <Button label="adicionar cartão de crédito" icon={Plus} variant="secondary" small onPress={() => router.push('/cartao-form')} style={{ alignSelf: 'flex-start' }} />
        )}
      </Section>

      <Sheet visible={open} onClose={() => setOpen(false)} title="transferir entre contas">
        <View style={{ gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <Text variant="smallStrong" color={colors.textSoft}>
              de
            </Text>
            <View style={styles.chips}>
              {list.map((a) => (
                <Chip key={a.id ?? 'p'} label={a.name} selected={from === a.id} onPress={() => setFrom(a.id)} />
              ))}
            </View>
          </View>
          <View style={{ gap: space.sm }}>
            <Text variant="smallStrong" color={colors.textSoft}>
              para
            </Text>
            <View style={styles.chips}>
              {list.map((a) => (
                <Chip key={a.id ?? 'p'} label={a.name} selected={to === a.id} onPress={() => setTo(a.id)} />
              ))}
            </View>
          </View>
          <AmountInput value={amount} onChange={setAmount} />
          <View style={[styles.chips, { justifyContent: 'center' }]}>
            <Chip label="hoje" selected={!yesterday} onPress={() => setYesterday(false)} />
            <Chip label="ontem" selected={yesterday} onPress={() => setYesterday(true)} />
          </View>
          {from === to ? (
            <Text variant="small" color={colors.danger} center>
              escolha contas diferentes.
            </Text>
          ) : amount > 0 ? (
            <Text variant="small" color={colors.textSoft} center>
              {formatMoney(amount)} sai de {nameOf(from)} e entra em {nameOf(to)}. não conta como gasto.
            </Text>
          ) : null}
          <Button label="transferir" onPress={save} loading={saving} disabled={amount <= 0 || from === to} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { gap: space.xs, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
