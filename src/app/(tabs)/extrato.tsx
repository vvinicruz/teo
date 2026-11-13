import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  Button,
  Card,
  CategoryIcon,
  Chip,
  EmptyState,
  EntryRow,
  Icon,
  IconButton,
  Money,
  Pressable,
  Screen,
  Sheet,
  Text,
} from '../../components';
import { useData } from '../../data/DataProvider';
import { addMonths, friendlyDate, monthName, monthOf, weekday } from '../../domain/dates';
import type { Kind, Status, Transaction } from '../../domain/types';
import { useCategories } from '../../hooks/useCategories';
import { useToday } from '../../hooks/useToday';
import { colors, fonts, radius, space } from '../../theme';

type KindFilter = 'tudo' | Kind;
type StatusFilter = 'tudo' | Status;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export default function Extrato() {
  const { data } = useData();
  const { get, active } = useCategories();
  const todayDate = useToday();
  const [month, setMonth] = useState(monthOf(todayDate));
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('tudo');
  const [status, setStatus] = useState<StatusFilter>('tudo');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const searching = query.trim().length > 0;
  const activeFilters = (kind !== 'tudo' ? 1 : 0) + (status !== 'tudo' ? 1 : 0) + (categoryId ? 1 : 0);

  const { groups, income, expense, count } = useMemo(() => {
    const q = normalize(query.trim());
    const list = data.transactions.filter((t) => {
      if (!searching && monthOf(t.date) !== month) return false;
      if (kind !== 'tudo' && t.kind !== kind) return false;
      if (status !== 'tudo' && t.status !== status) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      if (q) {
        const cat = get(t.categoryId)?.name ?? '';
        if (!normalize(`${t.description} ${cat}`).includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1));
    const map = new Map<string, Transaction[]>();
    for (const t of list) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    const realized = list.filter((t) => t.status === 'realizada');
    return {
      groups: [...map.entries()],
      income: realized.filter((t) => t.kind === 'receita').reduce((a, t) => a + t.amount, 0),
      expense: realized.filter((t) => t.kind === 'despesa').reduce((a, t) => a + t.amount, 0),
      count: list.length,
    };
  }, [data.transactions, month, query, searching, kind, status, categoryId, get]);

  const clearFilters = () => {
    setKind('tudo');
    setStatus('tudo');
    setCategoryId(null);
  };

  return (
    <Screen tabBarSpace>
      <View style={styles.titleRow}>
        <Text variant="title">extrato</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Icon as={Search} size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="buscar movimentação"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="buscar"
          />
          {query ? <IconButton icon={X} label="limpar busca" size={16} onPress={() => setQuery('')} style={{ width: 28, height: 28 }} /> : null}
        </View>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={[styles.filterBtn, activeFilters > 0 && styles.filterBtnOn]}
          accessibilityLabel="filtros"
          accessibilityRole="button"
        >
          <Icon as={SlidersHorizontal} size={20} color={activeFilters ? colors.white : colors.text} />
          {activeFilters ? (
            <Text variant="caption" color={colors.white}>
              {activeFilters}
            </Text>
          ) : null}
        </Pressable>
      </View>

      {!searching ? (
        <View style={styles.monthRow}>
          <IconButton icon={ChevronLeft} label="mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
          <Text variant="bodyStrong">{monthName(month, month.slice(0, 4) !== todayDate.slice(0, 4))}</Text>
          <IconButton icon={ChevronRight} label="próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
        </View>
      ) : (
        <Text variant="small" color={colors.textSoft} style={{ marginVertical: space.md }}>
          buscando em todos os meses · {count} {count === 1 ? 'resultado' : 'resultados'}
        </Text>
      )}

      <View style={styles.totals}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.textSoft}>
            entradas
          </Text>
          <Money value={income} variant="bodyStrong" color={colors.income} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.textSoft}>
            saídas
          </Text>
          <Money value={expense} variant="bodyStrong" color={colors.primary} />
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text variant="caption" color={colors.textSoft}>
            resultado
          </Text>
          <Money value={income - expense} sign variant="bodyStrong" />
        </View>
      </View>

      {activeFilters > 0 ? (
        <Pressable onPress={clearFilters} style={styles.clear}>
          <Text variant="smallStrong" color={colors.primary}>
            limpar filtros
          </Text>
        </Pressable>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          title={searching || activeFilters ? 'nada encontrado' : 'nenhuma movimentação neste mês'}
          message={
            searching || activeFilters
              ? 'tente outra palavra ou ajuste os filtros.'
              : 'quando você registrar receitas e despesas, elas aparecem aqui.'
          }
          actionLabel={searching || activeFilters ? undefined : 'adicionar movimentação'}
          onAction={() => router.push('/movimentacao')}
        />
      ) : (
        groups.map(([date, items]) => {
          const dayTotal = items
            .filter((t) => t.status === 'realizada')
            .reduce((a, t) => a + (t.kind === 'receita' ? t.amount : -t.amount), 0);
          return (
            <View key={date} style={styles.group}>
              <View style={styles.groupHead}>
                <Text variant="smallStrong" color={colors.textSoft}>
                  {friendlyDate(date, todayDate)} · {weekday(date)}
                </Text>
                {items.some((t) => t.status === 'realizada') ? (
                  <Money value={dayTotal} sign variant="small" color={colors.textFaint} />
                ) : null}
              </View>
              <Card padded={false} style={styles.list}>
                {items.map((t) => (
                  <EntryRow
                    key={t.id}
                    hideDate
                    item={{ ...t, source: t.status, overdue: t.status === 'pendente' && t.date < todayDate }}
                    onPress={() => router.push({ pathname: '/movimentacao', params: { id: t.id } })}
                  />
                ))}
              </Card>
            </View>
          );
        })
      )}

      <Sheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="filtrar">
        <View style={{ gap: space.xl }}>
          <View style={styles.filterGroup}>
            <Text variant="smallStrong" color={colors.textSoft}>
              tipo
            </Text>
            <View style={styles.chips}>
              {(['tudo', 'despesa', 'receita'] as KindFilter[]).map((k) => (
                <Chip key={k} label={k === 'tudo' ? 'tudo' : k === 'receita' ? 'receitas' : 'despesas'} selected={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text variant="smallStrong" color={colors.textSoft}>
              situação
            </Text>
            <View style={styles.chips}>
              {(['tudo', 'realizada', 'pendente'] as StatusFilter[]).map((s) => (
                <Chip key={s} label={s === 'tudo' ? 'tudo' : s === 'realizada' ? 'realizadas' : 'pendentes'} selected={status === s} onPress={() => setStatus(s)} />
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text variant="smallStrong" color={colors.textSoft}>
              categoria
            </Text>
            <View style={styles.chips}>
              <Chip label="todas" selected={!categoryId} onPress={() => setCategoryId(null)} />
              {active.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={[styles.catChip, categoryId === c.id && styles.catChipOn]}
                  accessibilityState={{ selected: categoryId === c.id }}
                >
                  <CategoryIcon icon={c.icon} size={24} tone={categoryId === c.id ? 'primary' : 'cream'} />
                  <Text variant="smallStrong">{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="limpar" variant="ghost" onPress={clearFilters} style={{ flex: 1 }} />
            <Button label="ver resultados" onPress={() => setFiltersOpen(false)} style={{ flex: 2 }} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingTop: space.lg, paddingBottom: space.lg },
  searchRow: { flexDirection: 'row', gap: space.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, outlineStyle: 'none' } as never,
  filterBtn: {
    height: 48,
    minWidth: 48,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: space.md },
  totals: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, backgroundColor: colors.cream, borderRadius: radius.lg },
  clear: { alignSelf: 'flex-start', marginTop: space.md },
  group: { marginTop: space.xl, gap: space.sm },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  filterGroup: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: space.md,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  catChipOn: { borderColor: colors.primary, backgroundColor: colors.cream },
});
