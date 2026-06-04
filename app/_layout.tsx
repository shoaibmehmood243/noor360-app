import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { ThemeProvider } from '../src/context/ThemeContext';

import { View, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useThemeContext } from '../src/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AdhanPlayer } from '../src/services/adhanPlayer';

// Keep splash screen visible until fonts load
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  useEffect(() => {
    // Stop Adhan if user interacts with any notification
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      AdhanPlayer.stopAdhan();
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

    // Play complete Adhan if prayer notification arrives in foreground
    const receiveSubscription = Notifications.addNotificationReceivedListener(async (notification) => {
      const data = notification.request.content.data as any;
      if (data && data.prayerName) {
        try {
          const saved = await AsyncStorage.getItem('noor360_notification_settings');
          const settings = saved ? JSON.parse(saved) : null;
          const sound = settings?.sound || 'Makkah';
          if (sound !== 'Silent' && sound !== 'Vibrate') {
            await AdhanPlayer.playAdhan(sound);
          }
        } catch (e) {
          console.warn('Failed to trigger foreground Adhan:', e);
        }
      }
    });

    return () => {
      responseSubscription.remove();
      receiveSubscription.remove();
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

export function ErrorBoundary({ error, retry }: any) {
  return (
    <View style={layoutStyles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={COLORS.gold} />
      <Text style={layoutStyles.errorTitle}>Noor360 Recovery</Text>
      <Text style={layoutStyles.errorDescription}>
        An unexpected issue has interrupted the app runtime. You can try restarting or resetting the app settings.
      </Text>
      <Text style={layoutStyles.errorMessage}>{error?.message || 'Unknown error code'}</Text>
      
      <TouchableOpacity style={layoutStyles.retryBtn} onPress={retry} activeOpacity={0.8}>
        <Text style={layoutStyles.retryText}>Restart Noor360</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={layoutStyles.resetBtn} 
        onPress={() => {
          Alert.alert(
            'Clear App Cache?',
            'This clears storage preferences and local database configurations to resolve persistent startup crashes.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset Data',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await AsyncStorage.clear();
                    retry();
                  } catch (e) {
                    Alert.alert('Error', 'Unable to reset configurations.');
                  }
                }
              }
            ]
          );
        }}
        activeOpacity={0.8}
      >
        <Text style={layoutStyles.resetText}>Reset Application Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const layoutStyles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 20,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 13,
    color: COLORS.text2,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  errorMessage: {
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.2)',
    color: '#FF8A8A',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    textAlign: 'center',
    marginBottom: 28,
  },
  retryBtn: {
    backgroundColor: COLORS.gold,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  retryText: {
    color: '#0A0E1A',
    fontWeight: 'bold',
    fontSize: 14,
  },
  resetBtn: {
    paddingVertical: 8,
  },
  resetText: {
    color: COLORS.text3,
    fontSize: 12,
    fontWeight: 'bold',
  },
});

