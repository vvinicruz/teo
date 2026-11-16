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
  Chip,
  DestinationPicker,
  type Destination,
  Icon,
  IconButton,
  Mascot,
  Money,
  Pressable,
  Screen,
  Sheet,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { friendlyDate, shortDate } from '../domain/dates';
import { maskedLayout } from '../domain/pdfLayout';
import {
  buildImportRows,
  decodeBytes,
  parsePdfPages,
  parseStatement,
  suggestionText,
  type Decision,
  type ImportRow,
  type InstallmentChoice,
  type ParsedStatement,
} from '../domain/importer';
import { useCategories } from '../hooks/useCategories';
import { useToday } from '../hooks/useToday';
import { isPdf, pdfPages, pdfSupported } from '../lib/pdfText';
import { pickStatementFile } from '../lib/statementFile';
import { colors, radius, space } from '../theme';

export default function Importar() {
  const params = useLocalSearchParams<{ cardId?: string; accountId?: string }>();
  const { data, importRows } = useData();
  const { forKind, get } = useCategories();
  const { toast } = useFeedback();
  const todayDate = useToday();

  const [dest, setDest] = useState<Destination>({ cardId: params.cardId ?? null, accountId: params.accountId ?? null });
  const cardId = dest.cardId;
  const [fileName, setFileName] = useState<string | null>(null);
  const [statement, setStatement] = useState<ParsedStatement | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ImportRow | null>(null);
  /** detalhes técnicos do último pdf lido (sem nomes nem valores), para ajudar a ensinar o teo a ler um banco novo. */
  const [pdfLayout, setPdfLayout] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/extrato'));

  const rebuild = (st: ParsedStatement, d: Destination) => setRows(buildImportRows(data, st, d, todayDate));

  const pick = async () => {
    setError(null);
    setReading(true);
    try {
      const file = await pickStatementFile();
      if (!file) return;
      let st: ParsedStatement;
      setPdfLayout(null);
      if (isPdf(file.bytes)) {
        if (!pdfSupported) {
          setError('por enquanto, faturas em pdf só podem ser importadas pelo navegador (appteo.com.br).');
          return;
        }
        const pages = await pdfPages(file.bytes);
        setPdfLayout(maskedLayout(pages));
        st = parsePdfPages(pages, todayDate, !!dest.cardId);
        if (!st.lines.length) {
          setError(
            'não conseguimos reconhecer as movimentações desse pdf. manda um exemplo pra gente (contato@appteo.com.br) que a gente ensina o teo a ler esse banco.',
          );
          return;
        }
      } else {
        st = parseStatement(decodeBytes(file.bytes));
      }
      if (!st.lines.length) {
        setError('não encontramos movimentações nesse arquivo. confere se ele é .ofx, .csv ou a fatura em .pdf, baixado no app ou site do banco?');
        return;
      }
      // arquivo de cartão e só um cartão cadastrado: já escolhemos ele.
      let next = dest;
      const activeCards = data.cards.filter((c) => !c.archived);
      if (st.looksLikeCard && !next.cardId && activeCards.length === 1) next = { cardId: activeCards[0].id, accountId: null };
      setDest(next);
      setFileName(file.name);
      setStatement(st);
      rebuild(st, next);
    } catch {
      setError('não conseguimos abrir esse arquivo. tenta baixar de novo no banco?');
    } finally {
      setReading(false);
    }
  };

  const copyLayout = async () => {
    try {
      await (globalThis as { navigator?: Navigator }).navigator!.clipboard.writeText(pdfLayout ?? '');
      toast('copiado! é só colar na conversa com a gente (contato@appteo.com.br).');
    } catch {
      toast('não conseguimos copiar agora. tenta de novo?', 'erro');
    }
  };

  const changeDestination = (d: Destination) => {
    setDest(d);
    if (statement) rebuild(statement, d);
  };

  const setDecision = (key: string, decision: Decision) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, decision } : r)));
  const setCategory = (key: string, categoryId: string | null) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, categoryId } : r)));
  const setInstallment = (key: string, installmentChoice: InstallmentChoice) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, installmentChoice } : r)));
  const setText = (key: string, patch: { description?: string; note?: string }) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const [expanded, setExpanded] = useState<string | null>(null);

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
      const n = await importRows(rows, dest);
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
        <DestinationPicker value={dest} onChange={changeDestination} />
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
          {error && pdfLayout ? <LayoutHelp onCopy={copyLayout} /> : null}
          <View style={styles.help}>
            <Icon as={Info} size={16} color={colors.textFaint} />
            <Text variant="small" color={colors.textFaint} style={{ flex: 1 }}>
              {'aceitamos .ofx, .csv e .pdf (extrato da conta ou fatura do cartão). no app ou site do banco, procure por “exportar extrato” ou “baixar fatura”. o arquivo é lido aqui mesmo e não é enviado para lugar nenhum.'}
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
              toque no nome para editar ou escrever uma observação. desmarque o que não quiser importar.
            </Text>
            <Card padded={false} style={styles.list}>
              {rows.map((r, i) => (
                <ImportLine
                  key={r.key}
                  row={r}
                  expanded={expanded === r.key}
                  onExpand={() => setExpanded(expanded === r.key ? null : r.key)}
                  onText={(patch) => setText(r.key, patch)}
                  onInstallment={(c) => setInstallment(r.key, c)}
                  last={i === rows.length - 1}
                  categoryName={get(r.categoryId)?.name}
                  categoryIcon={get(r.categoryId)?.icon}
                  onToggle={() => setDecision(r.key, r.decision === 'pular' ? (r.suggestion?.type === 'previsao' || r.suggestion?.type === 'fatura' ? 'vincular' : 'importar') : 'pular')}
                  onCategory={() => setEditing(r)}
                />
              ))}
            </Card>
            {pdfLayout ? <LayoutHelp onCopy={copyLayout} /> : null}
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

/** quando a leitura do pdf sai estranha: copia os detalhes técnicos (sem dados pessoais). */
function LayoutHelp({ onCopy }: { onCopy: () => void }) {
  return (
    <View style={styles.help}>
      <Icon as={Info} size={16} color={colors.textFaint} />
      <View style={{ flex: 1, gap: space.xs }}>
        <Text variant="small" color={colors.textFaint}>
          algum nome veio quebrado ou faltou alguma compra? copie os detalhes técnicos da leitura e mande pra gente. eles
          não levam nomes nem valores, só a posição do texto no pdf.
        </Text>
        <Button label="copiar detalhes técnicos" variant="ghost" small onPress={onCopy} />
      </View>
    </View>
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
  expanded,
  onExpand,
  onText,
  onInstallment,
  last,
  categoryName,
  categoryIcon,
  onToggle,
  onCategory,
}: {
  row: ImportRow;
  expanded: boolean;
  onExpand: () => void;
  onText: (patch: { description?: string; note?: string }) => void;
  onInstallment: (c: InstallmentChoice) => void;
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
        <Pressable onPress={onExpand} accessibilityRole="button" accessibilityLabel={`editar ${row.description}`} scaleTo={0.99}>
          <Text variant="smallStrong" numberOfLines={expanded ? undefined : 1}>
            {row.description}
          </Text>
          {row.note && !expanded ? (
            <Text variant="caption" color={colors.textFaint} numberOfLines={1}>
              {row.note}
            </Text>
          ) : null}
        </Pressable>
        {expanded ? (
          <View style={styles.editor}>
            <TextField label="nome" value={row.description} onChangeText={(t) => onText({ description: t })} maxLength={80} />
            <TextField
              label="observação (opcional)"
              value={row.note}
              onChangeText={(t) => onText({ note: t })}
              placeholder="ex.: presente de aniversário da mãe"
              maxLength={500}
              multiline
              style={{ height: 80, paddingTop: space.md, textAlignVertical: 'top' }}
            />
            <Button label="pronto" small variant="secondary" onPress={onExpand} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}
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
        {row.installment && row.decision === 'importar' ? (
          <View style={styles.installment}>
            <Text variant="caption" color={colors.textSoft}>
              parcela {row.installment.n} de {row.installment.total}. lançar também:
            </Text>
            <View style={styles.installmentChips}>
              <Chip label="só esta" selected={row.installmentChoice === 'so-esta'} onPress={() => onInstallment('so-esta')} />
              {row.installment.n < row.installment.total ? (
                <Chip
                  label={`as próximas (${row.installment.n + 1} a ${row.installment.total})`}
                  selected={row.installmentChoice === 'proximas'}
                  onPress={() => onInstallment('proximas')}
                />
              ) : null}
              {row.installment.n > 1 ? (
                <Chip
                  label={`todas (1 a ${row.installment.total})`}
                  selected={row.installmentChoice === 'todas'}
                  onPress={() => onInstallment('todas')}
                />
              ) : null}
            </View>
          </View>
        ) : null}
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
  editor: { gap: space.sm, marginTop: space.sm },
  installment: { gap: 6, marginTop: space.sm, padding: space.sm, borderRadius: radius.md, backgroundColor: colors.cream },
  installmentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
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
