import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button, FeedbackProvider, Logo, Text } from '../components';
import { AuthProvider, useAuth } from '../data/AuthProvider';
import { DataProvider, useData } from '../data/DataProvider';
import { colors, space } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <DataProvider>
          <FeedbackProvider>
            <Gate />
          </FeedbackProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/** decide o que a pessoa pode ver: login, boas-vindas ou o app. */
function Gate() {
  const auth = useAuth();
  const { status, data, retry } = useData();

  if (auth.status === 'loading' || (auth.status === 'signedIn' && status === 'loading')) {
    return (
      <View style={styles.center}>
        <Logo height={48} />
        <ActivityIndicator color={colors.primary} style={{ marginTop: space.xl }} />
      </View>
    );
  }

  if (auth.status === 'signedIn' && status === 'error') {
    return (
      <View style={styles.center}>
        <Logo height={40} />
        <Text variant="heading" center style={{ marginTop: space.xl }}>
          não conseguimos carregar seus dados
        </Text>
        <Text color={colors.textSoft} center style={{ marginTop: space.sm, maxWidth: 300 }}>
          confere sua conexão e tenta de novo. seus dados estão seguros.
        </Text>
        <Button label="tentar de novo" onPress={retry} style={{ marginTop: space.xl }} />
      </View>
    );
  }

  const signedIn = auth.status === 'signedIn';
  const onboarded = signedIn && data.settings.onboarded;
  // para onde cada pessoa deve ir agora. usado quando a tela atual deixa de valer
  // (ex.: ao criar a conta, o login some e a pessoa vai para as boas-vindas).
  // sem isso, o roteador escolhe sozinho e pode cair nos termos de uso.
  const home = !signedIn ? '/entrar' : !onboarded ? '/boas-vindas' : '/';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }}>
      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="entrar" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded} redirectTo={home}>
        <Stack.Screen name="boas-vindas" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded} redirectTo={home}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="movimentacao" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="recorrencia" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="meta" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="recorrencias" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="planejamento" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="perfil" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="categorias" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cartoes" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cartao" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cartao-form" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="importar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      {/* termos e privacidade ficam acessíveis sempre, inclusive antes do login. */}
      <Stack.Screen name="termos" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="privacidade" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: space.xl },
});
