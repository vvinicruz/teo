import { router, type Href } from 'expo-router';
import { ChevronDown, ChevronUp, Mail, PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, CategoryIcon, FadeIn, Icon, Mascot, Pressable, Screen, Text, useTour } from '../components';
import { LEGAL_CONTACT } from '../content/legal';
import { HELP_TOPICS } from '../content/help';
import { FIRST_TOUR, HELP_TOURS, TOURS } from '../content/tours';
import { colors, space } from '../theme';

export default function Ajuda() {
  const [open, setOpen] = useState<string | null>(null);
  const tour = useTour();

  return (
    <Screen back title="como usar o teo">
      <FadeIn style={styles.hero}>
        <Mascot size={56} />
        <Text variant="heading" center>
          oi! tá com alguma dúvida?
        </Text>
        <Text color={colors.textSoft} center style={{ maxWidth: 320 }}>
          aqui tem o básico de cada parte do teo, bem explicadinho. toque em um assunto pra abrir.
        </Text>
      </FadeIn>

      <Text variant="heading" style={styles.sectionTitle}>
        passo a passo
      </Text>
      <Text variant="small" color={colors.textSoft} style={{ marginBottom: space.md }}>
        o teo te mostra, na própria tela, como cada parte funciona. dá pra pular quando quiser.
      </Text>
      <Card padded={false} style={{ marginBottom: space.xl }}>
        {TOURS.map((t, i) => (
          <Pressable
            key={t.id}
            onPress={() => tour.start(t.id)}
            style={[styles.head, styles.topic, i < TOURS.length - 1 && styles.sep]}
            accessibilityRole="button"
            accessibilityLabel={`começar o passo a passo: ${t.title}`}
            scaleTo={0.99}
          >
            <CategoryIcon icon={t.icon} size={40} tone={t.id === FIRST_TOUR ? 'primary' : 'cream'} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{t.title}</Text>
              <Text variant="small" color={colors.textSoft}>
                {t.summary}
              </Text>
            </View>
            <Icon as={PlayCircle} size={22} color={colors.primary} />
          </Pressable>
        ))}
      </Card>

      <Text variant="heading" style={styles.sectionTitle}>
        dúvidas
      </Text>
      <Card padded={false}>
        {HELP_TOPICS.map((t, i) => {
          const expanded = open === t.id;
          return (
            <View key={t.id} style={[styles.topic, i < HELP_TOPICS.length - 1 && styles.sep]}>
              <Pressable
                onPress={() => setOpen(expanded ? null : t.id)}
                style={styles.head}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                scaleTo={0.99}
              >
                <CategoryIcon icon={t.icon} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{t.title}</Text>
                  {!expanded ? (
                    <Text variant="small" color={colors.textSoft}>
                      {t.summary}
                    </Text>
                  ) : null}
                </View>
                <Icon as={expanded ? ChevronUp : ChevronDown} size={18} color={colors.textFaint} />
              </Pressable>
              {expanded ? (
                <FadeIn style={styles.body}>
                  {t.paragraphs.map((p, j) => (
                    <Text key={j} color={colors.textSoft}>
                      {p}
                    </Text>
                  ))}
                  {HELP_TOURS[t.id] ? (
                    <Pressable onPress={() => tour.start(HELP_TOURS[t.id])} accessibilityRole="button" style={styles.tourLink}>
                      <Icon as={PlayCircle} size={16} color={colors.primary} />
                      <Text variant="smallStrong" color={colors.primary}>
                        ver o passo a passo na tela
                      </Text>
                    </Pressable>
                  ) : null}
                  {t.action ? (
                    <Pressable onPress={() => router.push(t.action!.href as Href)} accessibilityRole="link">
                      <Text variant="smallStrong" color={colors.primary}>
                        {t.action.label} →
                      </Text>
                    </Pressable>
                  ) : null}
                </FadeIn>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card tone="cream" style={styles.contact}>
        <Icon as={Mail} color={colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">ainda com dúvida?</Text>
          <Pressable onPress={() => Linking.openURL(`mailto:${LEGAL_CONTACT}`)} accessibilityRole="link">
            <Text variant="small" color={colors.textSoft}>
              escreve pra gente: <Text variant="smallStrong" color={colors.primary}>{LEGAL_CONTACT}</Text>
            </Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  topic: { paddingHorizontal: space.lg },
  sep: { borderBottomWidth: 1, borderBottomColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  body: { gap: space.md, paddingBottom: space.lg, paddingLeft: 40 + space.md },
  sectionTitle: { marginBottom: space.xs },
  tourLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl },
});
