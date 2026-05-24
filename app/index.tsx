import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/theme';
import { usePreferencesStore } from '../src/store/usePreferencesStore';
import ArabicGeometricBg from '../components/ui/ArabicGeometricBg';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  // Animated values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(30)).current;

  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameTranslateY = useRef(new Animated.Value(20)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Logo Animation (Fade in + Slide up)
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.timing(logoTranslateY, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // 2. Name Animation (Staggered by 400ms)
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(nameOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(nameTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 3. Tagline Animation (Staggered by 800ms)
    Animated.sequence([
      Animated.delay(800),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 4. Navigation trigger after 2.5s total time
    const timer = setTimeout(() => {
      checkOnboardingAndNavigate();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const checkOnboardingAndNavigate = async () => {
    try {
      // Bootstrap preferences from cache + background SWR fetch
      const prefs = usePreferencesStore.getState();
      await prefs.loadAllPreferences().catch((e) => console.warn('Store preload failed:', e));

      const onboardingComplete = await AsyncStorage.getItem('onboarding_complete');
      if (onboardingComplete === 'true') {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      console.warn('Failed to read onboarding state, defaulting to onboarding:', error);
      router.replace('/onboarding');
    }
  };

  return (
    <View style={styles.container}>
      {/* Dynamic Background Pattern */}
      <ArabicGeometricBg size={SCREEN_HEIGHT * 0.75} style={styles.bgGeometric} />

      {/* Main Content Area */}
      <View style={styles.content}>
        {/* Animated Brand Logo */}
        <Animated.View
          style={[
            styles.logoSquare,
            {
              opacity: logoOpacity,
              transform: [{ translateY: logoTranslateY }],
            },
          ]}
        >
          <Text style={styles.logoText}>ن</Text>
        </Animated.View>

        {/* Animated Brand Name */}
        <Animated.View
          style={[
            styles.brandTextWrapper,
            {
              opacity: nameOpacity,
              transform: [{ translateY: nameTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>Noor</Text>
          <Text style={styles.brandSubtitle}>360</Text>
        </Animated.View>

        {/* Animated Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Your Spiritual Quranic Companion
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgGeometric: {
    opacity: 0.04,
  },
  content: {
    alignItems: 'center',
  },
  logoSquare: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },
  logoText: {
    fontSize: 54,
    fontFamily: 'Amiri_700Bold',
    color: '#0A0E1A',
    lineHeight: 64,
  },
  brandTextWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text3,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 4,
  },
});
