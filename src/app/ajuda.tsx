import { router, type Href } from 'expo-router';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Card, CategoryIcon, FadeIn, Icon, Mascot, Pressable, Screen, Text } from '../components';
import { LEGAL_CONTACT } from '../content/legal';
import { HELP_TOPICS } from '../content/help';
import { colors, space } from '../theme';

export default function Ajuda() {
  const [open, setOpen] = useState<string | null>(null);

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
  contact: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xl },
});
