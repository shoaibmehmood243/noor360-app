import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { ThemeProvider } from '../src/context/ThemeContext';

import { View } from 'react-native';
import { useThemeContext } from '../src/context/ThemeContext';

// Keep splash screen visible until fonts load
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  useEffect(() => {
    // Deep-linking notification response listener
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data && data.actionRoute) {
        setTimeout(() => {
          try {
            router.push(data.actionRoute as any);
          } catch (err) {
            console.warn('Deep-linking navigation failed:', err);
          }
        }, 300);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }} key={theme}>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={COLORS.bg} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: COLORS.bg }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
