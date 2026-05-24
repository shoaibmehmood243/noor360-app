import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import Svg, { Rect } from 'react-native-svg';
import { usePreferencesStore } from '../../src/store/usePreferencesStore';
import { COLORS } from '../../constants/theme';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';

export default function NotificationsScreen() {
  const router = useRouter();
  const { setNotificationsEnabled } = usePreferencesStore();
  const [error, setError] = useState('');

  // Animation values for sound wave pulses
  const wave1 = useRef(new Animated.Value(10)).current;
  const wave2 = useRef(new Animated.Value(25)).current;
  const wave3 = useRef(new Animated.Value(15)).current;
  const wave4 = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const animateWave = (anim: Animated.Value, max: number, min: number, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: max,
            duration: duration,
            useNativeDriver: false, // height cannot be animated with native driver
          }),
          Animated.timing(anim, {
            toValue: min,
            duration: duration,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };

    animateWave(wave1, 40, 10, 600);
    animateWave(wave2, 60, 15, 750);
    animateWave(wave3, 45, 12, 500);
    animateWave(wave4, 70, 20, 900);
  }, []);

  const handleRequestNotifications = async () => {
    try {
      setError('');
      
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });

      const granted = status === 'granted';
      setNotificationsEnabled(granted);

      if (!granted) {
        setError('Permissions not fully approved. Continuing...');
        setTimeout(() => router.push('/onboarding/personalize'), 1500);
        return;
      }

      router.push('/onboarding/personalize');
    } catch (err: any) {
      console.warn('Notification setup error:', err);
      router.push('/onboarding/personalize');
    }
  };

  const handleSkip = () => {
    setNotificationsEnabled(false);
    router.push('/onboarding/personalize');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ArabicGeometricBg size={350} style={styles.bgGeometric} />

      <View style={styles.content}>
        {/* Progress Dots */}
        <View style={styles.progress}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        {/* Animated Soundwave SVG */}
        <View style={styles.illustration}>
          <Svg width="200" height="100" viewBox="0 0 100 100" fill="none">
            <AnimatedRect x="20" y="50" width="8" height={wave1} fill={COLORS.gold} rx="4" />
            <AnimatedRect x="36" y="50" width="8" height={wave2} fill={COLORS.teal} rx="4" />
            <AnimatedRect x="52" y="50" width="8" height={wave3} fill={COLORS.gold} rx="4" />
            <AnimatedRect x="68" y="50" width="8" height={wave4} fill={COLORS.teal} rx="4" />
          </Svg>
        </View>

        <Text style={styles.title}>Never Miss a Prayer</Text>
        <Text style={styles.subtitle}>
          Receive timely, beautifully configured Adhan notifications and audio warnings when it is time for prayer in your local region.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttonGroup}>
          <PrimaryButton
            title="Enable Adhan Notifications"
            onPress={handleRequestNotifications}
            style={styles.allowBtn}
          />

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Convert Rect to an Animated component
const AnimatedRect = Animated.createAnimatedComponent(Rect);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  bgGeometric: {
    opacity: 0.03,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.bg3,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: COLORS.gold,
    width: 16,
  },
  illustration: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '180deg' }], // Waves grow downwards originally, rotate so they grow upwards!
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.text2,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  errorText: {
    color: COLORS.teal,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
  buttonGroup: {
    width: '100%',
    alignItems: 'center',
  },
  allowBtn: {
    marginBottom: 16,
  },
  skipBtn: {
    paddingVertical: 12,
  },
  skipText: {
    color: COLORS.text3,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
