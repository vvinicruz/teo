import { router } from 'expo-router';
import { Check, ChevronRight, Eye, EyeOff, SlidersHorizontal } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  CategoryIcon,
  EmptyState,
  EntryRow,
  FadeIn,
  Icon,
  IconButton,
  Money,
  Pressable,
  ProgressBar,
  Screen,
  Section,
  Text,
  useFeedback,
} from '../../components';
import { useAuth } from '../../data/AuthProvider';
import { useData } from '../../data/DataProvider';
import { addDays, addMonths, dayAndMonth, friendlyDate, lastDay, monthOf, shortDate, weekday } from '../../domain/dates';
import {
  budgetProgress,
  cardInvoices,
  dailyAllowance,
  invoiceByDueDate,
  invoiceOf,
  horizon,
  monthSummary,
  upcomingEntries,
  type Entry,
} from '../../domain/finance';
import { formatMoney } from '../../domain/money';
import { useCategories } from '../../hooks/useCategories';
import { openEntry } from '../../lib/navigation';
import { useToday } from '../../hooks/useToday';
import { colors, radius, space } from '../../theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'boa noite';
  if (h < 12) return 'bom dia';
  if (h < 18) return 'boa tarde';
  return 'boa noite';
}

export default function Inicio() {
  const { data, updateSettings, confirmEntry } = useData();
  const { mode } = useAuth();
  const { toast } = useFeedback();
  const { get } = useCategories();
  const todayDate = useToday();
  const month = monthOf(todayDate);

  const view = useMemo(() => {
    const h = horizon(data, month, todayDate);
    const upcoming = upcomingEntries(data, todayDate, addDays(todayDate, 30));
    return {
      h,
      summary: monthSummary(data, month, todayDate),
      allowance: dailyAllowance(data, todayDate),
      overdue: upcoming.filter((e) => e.overdue),
      next: upcoming.filter((e) => !e.overdue).slice(0, 4),
      budgets: budgetProgress(data, month, todayDate)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3),
      // fatura em destaque de cada cartão: a próxima que ainda não foi paga.
      cards: data.cards
        .filter((c) => !c.archived)
        .map((card) => {
          const unpaid = cardInvoices(data, card, lastDay(addMonths(month, 2)), todayDate).filter(
            (i) => !i.payment && i.dueDate >= todayDate,
          );
          return { card, invoice: unpaid[0] ?? invoiceByDueDate(data, card, invoiceOf(card, todayDate).dueDate, todayDate) };
        }),
      recent: [...data.transactions]
        .filter((t) => t.status === 'realizada')
        .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1))
        .slice(0, 5),
    };
  }, [data, month, todayDate]);

  const { h, summary, allowance } = view;
  const name = data.settings.name;
  const hide = data.settings.hideValues;

  const confirm = async (e: Entry) => {
    try {
      await confirmEntry(e);
      toast(e.kind === 'receita' ? 'oba! receita confirmada.' : 'prontinho, marcado como pago.');
    } catch {
      toast('não deu para salvar agora. tenta de novo?', 'erro');
    }
  };

  const mood =
    h.projectedEnd < 0
      ? `pela previsão, o mês fecha em ${hide ? 'negativo' : formatMoney(h.projectedEnd)}. vamos olhar o horizonte juntos?`
      : h.lowest && h.lowest.balance < 0
        ? `seu saldo pode ficar negativo ${friendlyDate(h.lowest.date, todayDate) === 'hoje' ? 'hoje' : `no dia ${h.lowest.date.slice(8)}`}. dá uma olhada no horizonte.`
        : `você está indo bem! a previsão é fechar o mês com ${hide ? 'saldo positivo' : formatMoney(h.projectedEnd)}.`;

  return (
    <Screen tabBarSpace>
      {/* topo */}
      <View style={styles.top}>
        <Pressable onPress={() => router.push('/perfil')} style={styles.avatar} accessibilityLabel="perfil" accessibilityRole="button">
          <Text variant="bodyStrong" color={colors.primary}>
            {(name[0] ?? 't').toLowerCase()}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="heading">
            {greeting()}
            {name ? `, ${name}` : ''}!
          </Text>
          <Text variant="small" color={colors.textSoft}>
            {weekday(todayDate)}, {dayAndMonth(todayDate)}
          </Text>
        </View>
        <IconButton
          icon={hide ? EyeOff : Eye}
          label={hide ? 'mostrar valores' : 'esconder valores'}
          onPress={() => updateSettings({ hideValues: !hide }).catch(() => {})}
          color={colors.textSoft}
        />
      </View>

      {mode === 'local' ? (
        <Pressable onPress={() => router.push('/perfil')} style={styles.localBanner}>
          <Text variant="caption" color={colors.textSoft}>
            modo local · seus dados estão só neste aparelho
          </Text>
        </Pressable>
      ) : null}

      {/* saldo */}
      <FadeIn>
        <Card style={styles.balanceCard}>
          <Text variant="smallStrong" color={colors.textSoft}>
            saldo atual
          </Text>
          <Money value={h.currentBalance} variant="display" color={h.currentBalance < 0 ? colors.danger : colors.text} />
          <View style={styles.monthRow}>
            <View style={styles.monthCol}>
              <Text variant="caption" color={colors.textSoft}>
                entrou no mês
              </Text>
              <Money value={summary.income} variant="bodyStrong" color={colors.income} />
            </View>
            <View style={styles.divider} />
            <View style={styles.monthCol}>
              <Text variant="caption" color={colors.textSoft}>
                saiu no mês
              </Text>
              <Money value={summary.expense} variant="bodyStrong" color={colors.primary} />
            </View>
          </View>
        </Card>
      </FadeIn>

      {/* quanto dá pra gastar hoje */}
      <FadeIn delay={60}>
        <Card tone="cream" onPress={() => router.navigate('/horizonte')} style={styles.allowance}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="small" color={colors.textSoft}>
              {allowance.leftToday >= 0 ? 'hoje ainda dá pra gastar' : 'hoje você passou um pouquinho'}
            </Text>
            <Money
              value={Math.abs(allowance.leftToday)}
              variant="title"
              color={allowance.leftToday >= 0 ? colors.primary : colors.attention}
            />
            {allowance.perDay > 0 ? (
              <>
                <ProgressBar
                  value={allowance.perDay ? allowance.spentToday / allowance.perDay : 0}
                  color={allowance.leftToday >= 0 ? colors.primary : colors.attention}
                  height={6}
                />
                <Text variant="small" color={colors.textSoft}>
                  {hide
                    ? `sugestão diária para os próximos ${allowance.daysLeft} dias`
                    : `sugestão: ${formatMoney(allowance.perDay)} por dia até o fim do mês`}
                </Text>
              </>
            ) : (
              <Text variant="small" color={colors.textSoft}>
                o que entra até o fim do mês está todo comprometido. o horizonte te ajuda a ver o caminho.
              </Text>
            )}
          </View>
          <Icon as={ChevronRight} color={colors.primary} />
        </Card>
      </FadeIn>

      {/* resumo em uma frase */}
      <FadeIn delay={100}>
        <Pressable onPress={() => router.navigate('/horizonte')} style={styles.mood}>
          <Text variant="small" color={colors.textSoft} style={{ flex: 1 }}>
            {mood}
          </Text>
          <Text variant="smallStrong" color={colors.primary}>
            ver horizonte
          </Text>
        </Pressable>
      </FadeIn>

      {view.overdue.length > 0 && (
        <Section title="para confirmar">
          <Card padded={false} style={styles.list}>
            {view.overdue.map((e) => (
              <EntryRow
                key={e.key}
                item={{ ...e, date: e.originalDate }}
                onPress={() => openEntry(e)}
                right={
                  <IconButton
                    icon={Check}
                    label={e.kind === 'receita' ? 'confirmar recebimento' : 'marcar como pago'}
                    onPress={() => confirm(e)}
                    background={colors.cream}
                    color={colors.primary}
                  />
                }
              />
            ))}
          </Card>
          <Text variant="small" color={colors.textFaint}>
            esses itens já passaram da data. se já aconteceram, é só confirmar.
          </Text>
        </Section>
      )}

      <Section title="próximos compromissos" actionLabel="ver todos" onAction={() => router.navigate('/horizonte')}>
        {view.next.length ? (
          <Card padded={false} style={styles.list}>
            {view.next.map((e) => (
              <EntryRow key={e.key} item={e} onPress={() => openEntry(e)} />
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              title="nada marcado para os próximos dias"
              message="cadastre contas fixas, como aluguel e internet, para o teo prever por você."
              actionLabel="adicionar conta fixa"
              onAction={() => router.push('/recorrencia')}
            />
          </Card>
        )}
      </Section>

      {view.cards.length ? (
        <Section title="cartões" actionLabel="ver cartões" onAction={() => router.push('/cartoes')}>
          <Card padded={false} style={styles.list}>
            {view.cards.map(({ card, invoice }, i) => (
              <Pressable
                key={card.id}
                onPress={() => router.push({ pathname: '/cartao', params: { id: card.id } })}
                style={[styles.cardRow, i < view.cards.length - 1 && styles.cardRowSep]}
                accessibilityRole="button"
                scaleTo={0.99}
              >
                <CategoryIcon icon="cartao" size={42} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{card.name}</Text>
                  <Text variant="small" color={colors.textSoft}>
                    fatura {invoice.status === 'aberta' ? 'aberta' : 'fechada'} · vence {shortDate(invoice.dueDate)}
                  </Text>
                </View>
                <Money value={invoice.total} variant="bodyStrong" />
              </Pressable>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="planejamento do mês" actionLabel={view.budgets.length ? 'ajustar' : undefined} onAction={() => router.push('/planejamento')}>
        {view.budgets.length ? (
          <Card style={{ gap: space.lg }} onPress={() => router.push('/planejamento')}>
            {view.budgets.map((b) => {
              const cat = get(b.budget.categoryId);
              const color = b.status === 'passou' ? colors.attention : colors.primary;
              return (
                <View key={b.budget.id} style={{ gap: 6 }}>
                  <View style={styles.budgetHead}>
                    <Text variant="bodyStrong">{cat?.name ?? 'categoria'}</Text>
                    <Text variant="small" color={colors.textSoft}>
                      {hide ? `${Math.round(b.ratio * 100)}%` : `${formatMoney(b.spent)} de ${formatMoney(b.budget.amount)}`}
                    </Text>
                  </View>
                  <ProgressBar value={b.ratio} color={color} height={6} />
                </View>
              );
            })}
          </Card>
        ) : (
          <Card onPress={() => router.push('/planejamento')} style={styles.planCta}>
            <Icon as={SlidersHorizontal} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">quanto você quer gastar este mês?</Text>
              <Text variant="small" color={colors.textSoft}>
                defina um valor por categoria e o teo acompanha com você.
              </Text>
            </View>
            <Icon as={ChevronRight} color={colors.textFaint} />
          </Card>
        )}
      </Section>

      <Section title="últimas movimentações" actionLabel={view.recent.length ? 'ver extrato' : undefined} onAction={() => router.navigate('/extrato')}>
        {view.recent.length ? (
          <Card padded={false} style={styles.list}>
            {view.recent.map((t) => (
              <EntryRow
                key={t.id}
                item={{ ...t, source: 'realizada' }}
                onPress={() => router.push({ pathname: '/movimentacao', params: { id: t.id } })}
              />
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState
              compact
              title="nenhuma movimentação ainda"
              message="registre seu primeiro gasto ou receita. leva só alguns segundos."
              actionLabel="adicionar agora"
              onAction={() => router.push('/movimentacao')}
            />
          </Card>
        )}
      </Section>

      <Text variant="small" color={colors.textFaint} center style={{ marginTop: space.xxl }}>
        previsão até {friendlyDate(lastDay(month), todayDate)} · {view.h.days.length} dias no horizonte
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg, paddingBottom: space.lg },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localBanner: {
    alignSelf: 'flex-start',
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: 4,
    marginBottom: space.md,
  },
  balanceCard: { gap: space.xs },
  monthRow: { flexDirection: 'row', marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  monthCol: { flex: 1, gap: 2 },
  divider: { width: 1, backgroundColor: colors.line, marginHorizontal: space.lg },
  allowance: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  mood: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, paddingHorizontal: space.xs },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  budgetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  cardRowSep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  planCta: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
