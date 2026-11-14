import { router } from 'expo-router';
import {
  ChevronRight,
  Cloud,
  CloudOff,
  CreditCard,
  Eye,
  FileText,
  Landmark,
  LifeBuoy,
  LogOut,
  PiggyBank,
  RotateCcw,
  ShieldCheck,
  Repeat,
  SlidersHorizontal,
  Tags,
  Trash2,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  Chip,
  Icon,
  Logo,
  Money,
  Pressable,
  Screen,
  Sheet,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useAuth } from '../data/AuthProvider';
import { useData } from '../data/DataProvider';
import { friendlyDate, today } from '../domain/dates';
import { colors, radius, space } from '../theme';

type Editing = null | 'nome' | 'saldo' | 'reserva';

export default function Perfil() {
  const auth = useAuth();
  const { data, updateSettings, wipeAll } = useData();
  const { toast, confirm } = useFeedback();
  const s = data.settings;
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState(s.name);
  const [amount, setAmount] = useState(0);
  const [negative, setNegative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const open = (e: Editing) => {
    setEditing(e);
    setName(s.name);
    if (e === 'saldo') {
      setAmount(Math.abs(s.initialBalance));
      setNegative(s.initialBalance < 0);
    }
    if (e === 'reserva') setAmount(s.reserve);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing === 'nome') await updateSettings({ name: name.trim().toLowerCase() });
      if (editing === 'saldo') await updateSettings({ initialBalance: negative ? -amount : amount });
      if (editing === 'reserva') await updateSettings({ reserve: amount });
      toast('prontinho, salvo.');
      setEditing(null);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    const ok = await confirm({ title: 'sair da sua conta?', message: 'seus dados continuam guardados na nuvem.', confirmLabel: 'sair' });
    if (ok) await auth.signOut();
  };

  const wipe = async () => {
    const ok = await confirm({
      title: 'começar do zero?',
      message: 'movimentações, contas fixas, metas e planejamento serão apagados para sempre. sua conta continua, e você volta para o começo.',
      confirmLabel: 'apagar tudo',
      danger: true,
    });
    if (!ok) return;
    try {
      await wipeAll();
      toast('tudo apagado. um novo começo!', 'info');
    } catch {
      toast('não conseguimos apagar agora. tenta de novo?', 'erro');
    }
  };

  // apagar a conta é definitivo: pedimos para digitar "apagar" antes.
  const deleteAccount = async () => {
    if (deleteText.trim().toLowerCase() !== 'apagar') return;
    setDeleting(true);
    try {
      await auth.deleteAccount();
      setDeleteOpen(false);
      toast('sua conta foi apagada. obrigado por ter usado o teo.', 'info');
    } catch {
      setDeleting(false);
      toast('não conseguimos apagar sua conta agora. tenta de novo em instantes?', 'erro');
    }
  };

  return (
    <Screen back title="perfil">
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text variant="title" color={colors.primary}>
            {(s.name[0] ?? 't').toLowerCase()}
          </Text>
        </View>
        <Text variant="heading">{s.name || 'você'}</Text>
        {auth.email ? (
          <Text variant="small" color={colors.textSoft}>
            {auth.email}
          </Text>
        ) : null}
      </View>

      <Group title="seu dinheiro">
        <Item icon={Wallet} label="saldo inicial" detail={<Money value={s.initialBalance} variant="small" color={colors.textSoft} />} onPress={() => open('saldo')} />
        <Item icon={PiggyBank} label="reserva que não quero gastar" detail={<Money value={s.reserve} variant="small" color={colors.textSoft} />} onPress={() => open('reserva')} />
        <Item icon={CreditCard} label="cartões de crédito" onPress={() => router.push('/cartoes')} />
        <Item icon={Landmark} label="caixinhas e investimentos" onPress={() => router.push('/guardado')} />
        <Item icon={Repeat} label="contas fixas e recorrências" onPress={() => router.push('/recorrencias')} />
        <Item icon={SlidersHorizontal} label="planejamento do mês" onPress={() => router.push('/planejamento')} />
        <Item icon={Tags} label="categorias" onPress={() => router.push('/categorias')} last />
      </Group>

      <Group title="preferências">
        <Item icon={User} label="como te chamamos" detail={<Text variant="small" color={colors.textSoft}>{s.name}</Text>} onPress={() => open('nome')} />
        <View style={styles.item}>
          <Icon as={Eye} size={20} color={colors.textSoft} />
          <Text style={{ flex: 1 }}>esconder valores ao abrir</Text>
          <Switch
            value={s.hideValues}
            onValueChange={(v) => updateSettings({ hideValues: v }).catch(() => toast('não deu para salvar.', 'erro'))}
            trackColor={{ true: colors.primary, false: colors.line }}
            thumbColor={colors.white}
            accessibilityLabel="esconder valores"
          />
        </View>
      </Group>

      <Group title="conta">
        {auth.mode === 'local' ? (
          <View style={[styles.item, { alignItems: 'flex-start' }]}>
            <Icon as={CloudOff} size={20} color={colors.textSoft} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text>modo local</Text>
              <Text variant="small" color={colors.textSoft}>
                seus dados estão só neste aparelho. quando a nuvem for configurada, você poderá entrar com e-mail e senha.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.item}>
              <Icon as={Cloud} size={20} color={colors.income} />
              <Text style={{ flex: 1 }}>dados sincronizados na nuvem</Text>
            </View>
            <Item icon={LogOut} label="sair" onPress={signOut} />
          </>
        )}
        <Item icon={RotateCcw} label="começar do zero" danger onPress={wipe} last={auth.mode === 'local'} />
        {auth.mode === 'cloud' ? (
          <Item
            icon={Trash2}
            label="apagar minha conta"
            danger
            last
            onPress={() => {
              setDeleteText('');
              setDeleting(false);
              setDeleteOpen(true);
            }}
          />
        ) : null}
      </Group>

      <Group title="sobre">
        <Item icon={LifeBuoy} label="como usar o teo" onPress={() => router.push('/ajuda')} />
        <Item icon={FileText} label="termos de uso" onPress={() => router.push('/termos')} />
        <Item icon={ShieldCheck} label="política de privacidade" onPress={() => router.push('/privacidade')} last />
      </Group>

      <View style={styles.footer}>
        <Logo height={22} />
        <Text variant="caption" color={colors.textFaint}>
          tudo em ordem · usando desde {friendlyDate(s.initialBalanceDate, today())}
        </Text>
      </View>

      <Sheet visible={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="apagar sua conta?">
        <View style={{ gap: space.lg }}>
          <Text color={colors.textSoft}>
            sua conta e todos os seus dados (movimentações, contas fixas, planejamento e metas) serão apagados para sempre.
            não dá para desfazer.
          </Text>
          <TextField
            label='para confirmar, digite "apagar"'
            value={deleteText}
            onChangeText={setDeleteText}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="apagar"
          />
          <Button
            label="apagar minha conta"
            variant="danger"
            onPress={deleteAccount}
            loading={deleting}
            disabled={deleteText.trim().toLowerCase() !== 'apagar'}
          />
          <Button label="cancelar" variant="ghost" onPress={() => setDeleteOpen(false)} disabled={deleting} />
        </View>
      </Sheet>

      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'nome' ? 'como podemos te chamar?' : editing === 'saldo' ? 'saldo inicial' : 'sua reserva'}
      >
        <View style={{ gap: space.lg }}>
          {editing === 'nome' ? (
            <TextField value={name} onChangeText={setName} autoFocus maxLength={30} autoCapitalize="none" />
          ) : (
            <>
              <Text color={colors.textSoft}>
                {editing === 'saldo'
                  ? `quanto você tinha em ${friendlyDate(s.initialBalanceDate, today())}, quando começou a usar o teo. o saldo atual é esse valor mais tudo o que você registrou depois.`
                  : 'um valor que você quer manter guardado. ele não entra no "dá pra gastar por dia".'}
              </Text>
              <AmountInput value={amount} onChange={setAmount} autoFocus color={negative ? colors.danger : colors.text} />
              {editing === 'saldo' ? (
                <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
                  <Chip label="positivo" selected={!negative} onPress={() => setNegative(false)} />
                  <Chip label="negativo" selected={negative} onPress={() => setNegative(true)} />
                </View>
              ) : null}
            </>
          )}
          <Button label="salvar" onPress={save} loading={saving} />
        </View>
      </Sheet>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: space.xxl, gap: space.sm }}>
      <Text variant="smallStrong" color={colors.textSoft} style={{ paddingHorizontal: space.xs }}>
        {title}
      </Text>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

function Item({
  icon,
  label,
  detail,
  onPress,
  danger,
  last,
}: {
  icon: LucideIcon;
  label: string;
  detail?: ReactNode;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.item, !last && styles.itemSep]} accessibilityRole="button" scaleTo={0.99}>
      <Icon as={icon} size={20} color={danger ? colors.danger : colors.textSoft} />
      <Text style={{ flex: 1 }} color={danger ? colors.danger : colors.text}>
        {label}
      </Text>
      {detail}
      {!danger ? <Icon as={ChevronRight} size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.xs, marginTop: space.lg },
  avatar: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
  itemSep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  footer: { alignItems: 'center', gap: space.sm, marginTop: space.xxxl },
});
