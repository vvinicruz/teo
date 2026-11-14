import { StyleSheet, View } from 'react-native';
import { LEGAL_UPDATED_AT, type LegalSection } from '../content/legal';
import { colors, space } from '../theme';
import { Screen } from './Screen';
import { Text } from './Text';

/** página de texto jurídico, com leitura confortável. */
export function LegalDocument({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <Screen back title={title}>
      <Text variant="small" color={colors.textFaint} style={{ marginTop: space.md }}>
        última atualização: {LEGAL_UPDATED_AT}
      </Text>
      <Text color={colors.textSoft} style={{ marginTop: space.md }}>
        {intro}
      </Text>
      {sections.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text variant="bodyStrong">{s.title}</Text>
          {s.paragraphs.map((p, i) => (
            <Text key={i} color={colors.textSoft}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xxl, gap: space.sm },
});
