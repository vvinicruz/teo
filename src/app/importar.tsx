import { router, useLocalSearchParams } from 'expo-router';
import { Check, FileUp, Info, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Badge,
  Button,
  Card,
  CategoryIcon,
  CategoryPicker,
  DestinationPicker,
  Icon,
  IconButton,
  Mascot,
  Money,
  Pressable,
  Screen,
  Sheet,
  Text,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { friendlyDate, shortDate } from '../domain/dates';
import {
  buildImportRows,
  decodeBytes,
  parseStatement,
  suggestionText,
  type Decision,
  type ImportRow,
  type ParsedStatement,
} from '../domain/importer';
import { useCategories } from '../hooks/useCategories';
import { useToday } from '../hooks/useToday';
import { pickStatementFile } from '../lib/statementFile';
import { colors, radius, space } from '../theme';

export default function Importar() {
  const params = useLocalSearchParams<{ cardId?: string }>();
  const { data, importRows } = useData();
  const { forKind, get } = useCategories();
  const { toast } = useFeedback();
  const todayDate = useToday();

  const [cardId, setCardId] = useState<string | null>(params.cardId ?? null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statement, setStatement] = useState<ParsedStatement | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportRow | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/extrato'));

  const rebuild = (st: ParsedStatement, dest: string | null) => setRows(buildImportRows(data, st, dest, todayDate));

  const pick = async () => {
    setError(null);
    setReading(true);
    try {
      const file = await pickStatementFile();
      if (!file) return;
      const st = parseStatement(decodeBytes(file.bytes));
      if (!st.lines.length) {
        setError('não encontramos movimentações nesse arquivo. confere se ele é .ofx ou .csv, baixado no app ou site do banco?');
        return;
      }
      // arquivo de cartão e só um cartão cadastrado: já escolhemos ele.
      let dest = cardId;
      const activeCards = data.cards.filter((c) => !c.archived);
      if (st.looksLikeCard && !dest && activeCards.length === 1) dest = activeCards[0].id;
      setCardId(dest);
      setFileName(file.name);
      setStatement(st);
      rebuild(st, dest);
    } catch {
      setError('não conseguimos abrir esse arquivo. tenta baixar de novo no banco?');
    } finally {
      setReading(false);
    }
  };

  const changeDestination = (dest: string | null) => {
    setCardId(dest);
    if (statement) rebuild(statement, dest);
  };

  const setDecision = (key: string, decision: Decision) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, decision } : r)));
  const setCategory = (key: string, categoryId: string | null) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, categoryId } : r)));

  const counts = useMemo(() => {
    const pending = rows.filter((r) => r.decision === null).length;
    const saving = rows.filter((r) => r.decision === 'importar' || r.decision === 'vincular').length;
    return { pending, saving, skipped: rows.length - pending - saving };
  }, [rows]);

  const questions = rows.filter((r) => r.suggestion && ['parecida', 'previsao', 'fatura'].includes(r.suggestion.type));

  const save = async () => {
    if (counts.pending > 0 || counts.saving === 0) return;
    setSaving(true);
    try {
      const n = await importRows(rows, cardId);
      toast(`pronto! ${n} ${n === 1 ? 'movimentação importada' : 'movimentações importadas'}.`);
      router.replace(cardId ? { pathname: '/cartao', params: { id: cardId } } : '/extrato');
    } catch {
      setSaving(false);
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const footer = statement ? (
    <Button
      label={
        counts.pending > 0
          ? `responda ${counts.pending} ${counts.pending === 1 ? 'pergunta' : 'perguntas'}`
          : counts.saving === 0
            ? 'nada para importar'
            : `importar ${counts.saving} ${counts.saving === 1 ? 'movimentação' : 'movimentações'}`
      }
      onPress={save}
      loading={saving}
      disabled={counts.pending > 0 || counts.saving === 0}
    />
  ) : undefined;

  return (
    <Screen
      title="importar extrato"
      right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}
      footer={footer}
    >
      <Card tone="cream" style={styles.notice}>
        <Mascot size={36} mood="tranquilo" />
        <Text variant="small" color={colors.textSoft} style={{ flex: 1 }}>
          importar é prático para quando falta tempo. mas registrar você mesmo, no dia a dia, ajuda a perceber pra onde
          o dinheiro está indo. então use quando precisar, e dê uma olhadinha em cada item antes de salvar :)
        </Text>
      </Card>

      <View style={styles.block}>
        <Text variant="smallStrong" color={colors.textSoft}>
          de onde é esse extrato?
        </Text>
        <DestinationPicker value={cardId} onChange={changeDestination} />
        {data.cards.filter((c) => !c.archived).length === 0 ? (
          <Pressable onPress={() => router.push('/cartao-form')}>
            <Text variant="small" color={colors.textFaint}>
              é a fatura de um cartão?{' '}
              <Text variant="smallStrong" color={colors.primary}>
                cadastre o cartão primeiro
              </Text>
            </Text>
          </Pressable>
        ) : null}
        {statement && statement.looksLikeCard && !cardId ? (
          <Text variant="small" color={colors.attention}>
            esse arquivo parece ser de cartão de crédito. se for, escolha o cartão acima.
          </Text>
        ) : null}
      </View>

      {!statement ? (
        <View style={styles.block}>
          <Button label="escolher arquivo" icon={FileUp} onPress={pick} loading={reading} />
          {error ? (
            <Text variant="small" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <View style={styles.help}>
            <Icon as={Info} size={16} color={colors.textFaint} />
            <Text variant="small" color={colors.textFaint} style={{ flex: 1 }}>
              {'aceitamos arquivos .ofx e .csv. no app ou site do banco, procure por “exportar extrato” ou “baixar fatura”. o arquivo é lido aqui mesmo e não é enviado para lugar nenhum.'}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {fileName}
              </Text>
              <Text variant="small" color={colors.textSoft}>
                {rows.length} movimentações · {counts.saving} para salvar
                {counts.skipped ? ` · ${counts.skipped} puladas` : ''}
              </Text>
            </View>
            <Button label="trocar" variant="ghost" small onPress={pick} loading={reading} />
          </View>

          {questions.length ? (
            <View style={styles.block}>
              <Text variant="heading">confere pra gente?</Text>
              {questions.map((r) => (
                <QuestionCard key={r.key} row={r} onAnswer={(d) => setDecision(r.key, d)} />
              ))}
            </View>
          ) : null}

          <View style={styles.block}>
            <Text variant="heading">movimentações</Text>
            <Text variant="small" color={colors.textFaint}>
              toque na categoria para trocar. desmarque o que não quiser importar.
            </Text>
            <Card padded={false} style={styles.list}>
              {rows.map((r, i) => (
                <ImportLine
                  key={r.key}
                  row={r}
                  last={i === rows.length - 1}
                  categoryName={get(r.categoryId)?.name}
                  categoryIcon={get(r.categoryId)?.icon}
                  onToggle={() => setDecision(r.key, r.decision === 'pular' ? (r.suggestion?.type === 'previsao' || r.suggestion?.type === 'fatura' ? 'vincular' : 'importar') : 'pular')}
                  onCategory={() => setEditing(r)}
                />
              ))}
            </Card>
          </View>
        </>
      )}

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title="qual a categoria?">
        {editing ? (
          <View style={{ gap: space.lg }}>
            <Text variant="small" color={colors.textSoft}>
              {editing.description} · {editing.kind === 'receita' ? '+' : '-'} {friendlyDate(editing.date, todayDate)}
            </Text>
            <CategoryPicker
              categories={forKind(editing.kind)}
              value={editing.categoryId}
              onChange={(id) => {
                setCategory(editing.key, id);
                setEditing(null);
              }}
              income={editing.kind === 'receita'}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function QuestionCard({ row, onAnswer }: { row: ImportRow; onAnswer: (d: Decision) => void }) {
  const sug = row.suggestion!;
  const answered = row.decision !== null;
  const yes: Decision = sug.type === 'parecida' ? 'pular' : 'vincular';
  const labels =
    sug.type === 'parecida'
      ? { yes: 'é a mesma', no: 'são diferentes' }
      : sug.type === 'fatura'
        ? { yes: 'sim, é a fatura', no: 'não é' }
        : { yes: 'sim, é isso', no: 'não, é outra coisa' };
  return (
    <Card style={[styles.question, answered && styles.questionDone]}>
      <View style={styles.questionHead}>
        <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
          {row.description}
        </Text>
        <Money value={row.kind === 'receita' ? row.amount : -row.amount} sign={row.kind === 'receita'} variant="bodyStrong" alwaysShow />
      </View>
      <Text variant="small" color={colors.textSoft}>
        {shortDate(row.date)} · {suggestionText(sug, shortDate)}
      </Text>
      <View style={styles.answers}>
        <Button label={labels.yes} small variant={row.decision === yes ? 'primary' : 'ghost'} onPress={() => onAnswer(yes)} style={{ flex: 1 }} />
        <Button
          label={labels.no}
          small
          variant={row.decision === 'importar' ? 'primary' : 'ghost'}
          onPress={() => onAnswer('importar')}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

function ImportLine({
  row,
  last,
  categoryName,
  categoryIcon,
  onToggle,
  onCategory,
}: {
  row: ImportRow;
  last: boolean;
  categoryName?: string;
  categoryIcon?: string;
  onToggle: () => void;
  onCategory: () => void;
}) {
  const on = row.decision !== 'pular';
  const income = row.kind === 'receita';
  const note =
    row.decision === null
      ? 'aguardando sua resposta'
      : row.suggestion?.type === 'ja-importada'
        ? 'já importada antes'
        : row.suggestion?.type === 'pagamento-no-cartao'
          ? 'pagamento da fatura (já está na conta)'
          : row.decision === 'pular' && row.suggestion?.type === 'parecida'
            ? 'já registrada'
            : row.decision === 'vincular' && row.suggestion?.type === 'previsao'
              ? `confirma "${row.suggestion.entry.description}"`
              : row.decision === 'vincular' && row.suggestion?.type === 'fatura'
                ? `paga a fatura do ${row.suggestion.card.name}`
                : null;
  const linked = row.decision === 'vincular' || row.suggestion?.type === 'pagamento-no-cartao';
  return (
    <View style={[styles.line, !last && styles.lineSep, !on && { opacity: 0.5 }]}>
      <Pressable
        onPress={onToggle}
        style={[styles.check, on && styles.checkOn]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={on ? `não importar ${row.description}` : `importar ${row.description}`}
        disabled={row.decision === null}
        scaleTo={0.9}
      >
        {on ? <Icon as={Check} size={14} color={colors.white} strokeWidth={2.6} /> : null}
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="smallStrong" numberOfLines={1}>
          {row.description}
        </Text>
        <View style={styles.lineMeta}>
          <Text variant="caption" color={colors.textFaint}>
            {shortDate(row.date)}
          </Text>
          {!linked && on ? (
            <Pressable onPress={onCategory} style={styles.catChip} accessibilityRole="button" accessibilityLabel="trocar categoria">
              <CategoryIcon icon={categoryIcon} size={18} tone={income ? 'income' : 'cream'} />
              <Text variant="caption" color={categoryName ? colors.text : colors.primary}>
                {categoryName ?? 'escolher categoria'}
              </Text>
            </Pressable>
          ) : null}
          {note ? <Badge label={note} tone={row.decision === null ? 'atencao' : 'neutro'} /> : null}
        </View>
      </View>
      <Money value={income ? row.amount : -row.amount} sign={income} variant="smallStrong" color={income ? colors.income : colors.text} alwaysShow />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, marginTop: space.md },
  block: { gap: space.sm, marginTop: space.xl },
  help: { flexDirection: 'row', gap: 6, marginTop: space.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl },
  question: { gap: space.sm, padding: space.lg, borderColor: colors.attention },
  questionDone: { borderColor: colors.line },
  questionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  answers: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  list: { paddingHorizontal: space.lg },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  lineSep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  lineMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
    paddingLeft: 2,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
