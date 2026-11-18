import { router } from 'expo-router';
import { Check, ChevronDown, ChevronUp, ExternalLink, Info } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Chip, FadeIn, Icon, Mascot, Pressable, ProgressBar, Screen, Section, Text } from '../components';
import { checklist, evaluate, formatDay, irpfStatus, SITUATIONS } from '../domain/irpf';
import { useIrpf } from '../hooks/useIrpf';
import { useToday } from '../hooks/useToday';
import { colors, space } from '../theme';

const MEU_IR_URL = 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda';

const BASICS: { title: string; text: string }[] = [
  {
    title: 'declaração pré-preenchida',
    text: 'a receita já preenche boa parte dos dados com o que empresas, bancos e médicos informaram. você só confere e completa. precisa de conta gov.br prata ou ouro.',
  },
  {
    title: 'simplificada ou completa?',
    text: 'na simplificada, a receita dá um desconto padrão. na completa, você abate os gastos de verdade (saúde, educação, dependentes...). o próprio programa mostra qual é melhor pra você.',
  },
  {
    title: 'restituição',
    text: 'é o imposto que foi descontado a mais durante o ano e volta pra você. por isso, mesmo quem não é obrigado pode ganhar declarando.',
  },
  {
    title: 'malha fina',
    text: 'quando o que você declarou não bate com o que outros informaram (empresa, banco, médico). dá pra corrigir enviando uma declaração retificadora.',
  },
  {
    title: 'isenção de até R$ 5 mil',
    text: 'desde janeiro de 2026, quem ganha até R$ 5 mil por mês não paga imposto no salário. mas isso não dispensa de declarar: o que vale é o limite de rendimentos do ano.',
  },
  {
    title: 'carnê-leão',
    text: 'para quem recebe de pessoas físicas (como autônomo ou aluguel): o imposto é calculado e pago mês a mês, pelo próprio site da receita.',
  },
];

export default function Imposto() {
  const todayDate = useToday();
  const status = irpfStatus(todayDate);
  const { cycle } = status;
  const irpf = useIrpf();
  const [openBasic, setOpenBasic] = useState<string | null>(null);

  const answers = irpf.answersFor(cycle.year);
  const result = answers ? evaluate(answers, cycle) : null;
  const items = checklist(irpf.situations);
  const checked = irpf.checkedFor(cycle.year);
  const done = items.filter((i) => checked.has(i.id)).length;

  return (
    <Screen width="medium" back title="imposto de renda">
      <FadeIn>
        <Card tone="cream" style={styles.status}>
          <View style={styles.statusHead}>
            <Text variant="heading" style={{ flex: 1 }}>
              {status.title}
            </Text>
            {!cycle.official ? <Badge label="datas previstas" tone="atencao" /> : null}
          </View>
          <Text color={colors.textSoft}>{status.message}</Text>
          <View style={styles.dates}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.textSoft}>
                abre
              </Text>
              <Text variant="bodyStrong">{formatDay(cycle.opens)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.textSoft}>
                prazo final
              </Text>
              <Text variant="bodyStrong">{formatDay(cycle.closes)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={colors.textSoft}>
                sobre o ano
              </Text>
              <Text variant="bodyStrong">{cycle.baseYear}</Text>
            </View>
          </View>
        </Card>
      </FadeIn>

      <Section title="preciso declarar?">
        {result ? (
          <Card style={{ gap: space.md }}>
            <View style={styles.resultHead}>
              <Mascot size={44} mood={result.mustDeclare ? 'pensativo' : 'feliz'} />
              <Text variant="heading" style={{ flex: 1 }}>
                {result.mustDeclare ? 'sim, você precisa declarar' : 'pelo jeito, você não precisa'}
              </Text>
            </View>
            {result.mustDeclare ? (
              result.reasons.map((r) => (
                <View key={r} style={styles.reason}>
                  <Icon as={Check} size={16} color={colors.primary} />
                  <Text variant="small" color={colors.textSoft} style={{ flex: 1 }}>
                    {r}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="small" color={colors.textSoft}>
                mas atenção: se teve imposto descontado do salário durante o ano, pode valer a pena declarar mesmo assim. é
                assim que você recebe a restituição.
              </Text>
            )}
            {!cycle.official ? (
              <Text variant="caption" color={colors.textFaint}>
                calculado com as regras de {cycle.year - 1}. quando a receita publicar as regras de {cycle.year}, o teo
                atualiza.
              </Text>
            ) : null}
            <Button label="responder de novo" variant="ghost" small onPress={() => router.push('/imposto-quiz')} style={{ alignSelf: 'flex-start' }} />
          </Card>
        ) : (
          <Card style={{ gap: space.md }}>
            <Text color={colors.textSoft}>
              responda 8 perguntas rápidas sobre {cycle.baseYear} e o teo diz se você é obrigado a declarar. leva uns 2 minutos.
            </Text>
            <Button label="descobrir agora" onPress={() => router.push('/imposto-quiz')} />
          </Card>
        )}
      </Section>

      <Section title="seus documentos">
        <Text variant="small" color={colors.textSoft}>
          marque o que tem a ver com você e o teo monta sua lista.
        </Text>
        <View style={styles.chips}>
          {SITUATIONS.map((s) => (
            <Chip key={s.id} label={s.label} selected={irpf.situations.includes(s.id)} onPress={() => irpf.toggleSituation(s.id)} />
          ))}
        </View>
        <Card style={{ gap: space.md, marginTop: space.sm }}>
          <View style={styles.progressHead}>
            <Text variant="bodyStrong">
              {done} de {items.length} separados
            </Text>
            {done === items.length ? <Badge label="tudo pronto!" tone="ok" /> : null}
          </View>
          <ProgressBar value={items.length ? done / items.length : 0} height={6} />
          {items.map((item) => {
            const on = checked.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => irpf.toggleChecked(cycle.year, item.id)}
                style={styles.item}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                scaleTo={0.99}
              >
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Icon as={Check} size={14} color={colors.white} strokeWidth={2.6} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="smallStrong" color={on ? colors.textSoft : colors.text} style={on ? styles.strike : undefined}>
                    {item.title}
                  </Text>
                  <Text variant="small" color={colors.textFaint}>
                    {item.detail}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>
      </Section>

      <Section title="o básico, sem complicação">
        <Card padded={false}>
          {BASICS.map((b, i) => {
            const open = openBasic === b.title;
            return (
              <View key={b.title} style={[styles.basic, i < BASICS.length - 1 && styles.sep]}>
                <Pressable onPress={() => setOpenBasic(open ? null : b.title)} style={styles.basicHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {b.title}
                  </Text>
                  <Icon as={open ? ChevronUp : ChevronDown} size={18} color={colors.textFaint} />
                </Pressable>
                {open ? (
                  <Text color={colors.textSoft} style={{ paddingBottom: space.lg }}>
                    {b.text}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="onde declarar">
        <Card style={{ gap: space.md }}>
          <Text color={colors.textSoft}>
            a declaração é feita no site ou no app oficial “meu imposto de renda”, da receita federal. o teo te ajuda a chegar lá
            com tudo em ordem.
          </Text>
          <Button label="abrir o meu imposto de renda" icon={ExternalLink} variant="secondary" onPress={() => Linking.openURL(MEU_IR_URL)} />
        </Card>
      </Section>

      <View style={styles.disclaimer}>
        <Icon as={Info} size={16} color={colors.textFaint} />
        <Text variant="small" color={colors.textFaint} style={{ flex: 1 }}>
          o teo ajuda a se organizar, mas não substitui a receita federal nem um contador. em casos mais complexos, vale
          conversar com um profissional. fonte: {cycle.source}.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { gap: space.sm, marginTop: space.md },
  statusHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  dates: { flexDirection: 'row', gap: space.md, marginTop: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.creamDeep },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reason: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.xs },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  strike: { textDecorationLine: 'line-through' },
  basic: { paddingHorizontal: space.lg },
  basicHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.lg },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  disclaimer: { flexDirection: 'row', gap: 6, marginTop: space.xxl },
});
