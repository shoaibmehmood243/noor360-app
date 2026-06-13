import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Animated, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePreferencesStore } from '../src/store/usePreferencesStore';
import ArabicGeometricBg from '../components/ui/ArabicGeometricBg';
import ScreenBackground from '../components/ui/ScreenBackground';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  // Animated values
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoTranslateY = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;

  const nameOpacity = useRef(new Animated.Value(0)).current;
  const nameTranslateY = useRef(new Animated.Value(20)).current;

  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  const glowScale = useRef(new Animated.Value(0.95)).current;
  const glowOpacity = useRef(new Animated.Value(0.15)).current;

  // Initialization states
  const [status, setStatus] = useState('Starting up...');
  const [showWarning, setShowWarning] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    // 1. Logo Animation (Fade in + Slide up + Spring Scale)
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // Breathing Glow Aura Animation (infinite loop)
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.35,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 0.95,
            duration: 2200,
            useNativeDriver: true,
          })
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.35,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.15,
            duration: 2200,
            useNativeDriver: true,
          })
        ])
      ])
    ).start();

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

    // 4. Loading Spinner Loop
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      })
    ).start();

    // 5. Navigation trigger after 2.5s total time
    const timer = setTimeout(() => {
      checkOnboardingAndNavigate();
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const checkOnboardingAndNavigate = async () => {
    try {
      setStatus('Loading local database...');
      // Initialize offline SQLite tables and populate default assets
      const { initializeDatabase } = require('../src/services/quranLocalDb');
      await initializeDatabase().catch((e: any) => {
        console.warn('Local SQLite initialization failed:', e);
      });

      const prefs = usePreferencesStore.getState();
      await prefs.loadAllPreferences().catch((e) => {
        console.warn('Store preload failed (offline fallback active):', e);
      });

      setStatus('Syncing user profile...');
      const onboardingComplete = await AsyncStorage.getItem('onboarding_complete');

      // Subtle artificial delay to keep transitions smooth
      setTimeout(() => {
        if (onboardingComplete === 'true') {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/onboarding');
        }
      }, 500);
    } catch (error: any) {
      console.error('Failed to read onboarding state:', error);
      setErrorDetails(error.message || 'Storage initialization failed.');
      setShowWarning(true);
    }
  };

  if (showWarning) {
    return (
      <View style={styles.container}>
        <ScreenBackground />
        <ArabicGeometricBg size={SCREEN_HEIGHT * 0.75} style={styles.bgGeometric} />
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.gold} />
          <Text style={styles.errorTitle}>Startup Recovery</Text>
          <Text style={styles.errorSubtitle}>
            An unexpected error occurred while launching Noor360.
          </Text>
          {errorDetails && <Text style={styles.errorText}>{errorDetails}</Text>}

          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setShowWarning(false);
              setErrorDetails(null);
              checkOnboardingAndNavigate();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Retry Initialization</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetBtn}
            onPress={async () => {
              Alert.alert(
                'Reset App Settings?',
                'This will clear all bookmarks, logs, and preferences to start fresh.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Reset Settings',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await AsyncStorage.clear();
                        setShowWarning(false);
                        setErrorDetails(null);
                        checkOnboardingAndNavigate();
                      } catch (e) {
                        Alert.alert('Reset Failed', 'Could not clear preferences.');
                      }
                    }
                  }
                ]
              );
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.resetBtnText}>Reset Application Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenBackground />
      {/* Dynamic Background Pattern */}
      <ArabicGeometricBg size={SCREEN_HEIGHT * 0.75} style={styles.bgGeometric} />

      {/* Main Content Area */}
      <View style={styles.content}>
        {/* Logo and Aura Container */}
        <View style={styles.logoContainer}>
          {/* Pulsating Spiritual Light Aura */}
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: Animated.multiply(logoOpacity, glowOpacity),
                transform: [{ scale: glowScale }],
              }
            ]}
          />

          {/* Animated Brand Logo */}
          <Animated.View
            style={[
              styles.logoSquare,
              {
                opacity: logoOpacity,
                transform: [
                  { translateY: logoTranslateY },
                  { scale: logoScale }
                ],
              },
            ]}
          >
            <Text style={styles.logoText}>ن</Text>
          </Animated.View>
        </View>

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

        {/* Rotating Loading Animation */}
        <Animated.View
          style={[
            styles.spinnerWrapper,
            {
              opacity: taglineOpacity,
              transform: [{ rotate: spin }],
            }
          ]}
        >
          <Ionicons name="aperture-outline" size={26} color={COLORS.gold} />
        </Animated.View>

        {/* Dynamic Status Text */}
        <Animated.Text style={[styles.statusText, { opacity: taglineOpacity }]}>
          {status}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgGeometric: {
    opacity: 0.04,
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
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
  spinnerWrapper: {
    marginTop: 32,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    marginTop: 12,
    fontSize: 12,
    color: COLORS.text3,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  errorCard: {
    width: SCREEN_WIDTH * 0.85,
    backgroundColor: COLORS.bg2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.25)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: COLORS.text2,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.2)',
    color: '#FF8A8A',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryBtn: {
    backgroundColor: COLORS.gold,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  retryBtnText: {
    color: '#0A0E1A',
    fontWeight: 'bold',
    fontSize: 14,
  },
  resetBtn: {
    paddingVertical: 8,
  },
  resetBtnText: {
    color: COLORS.text3,
    fontSize: 12,
    fontWeight: 'bold',
  },
});
