import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect } from 'react-native-svg';
import { AdhanPlayer } from '../../src/services/adhanPlayer';
import { usePreferencesStore } from '../../src/store/usePreferencesStore';
import { COLORS } from '../../constants/theme';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import ScreenBackground from '../../components/ui/ScreenBackground';

const SOUNDS = [
  { id: 'Makkah', name: 'Adhan Makkah', sub: 'Traditional Makkah Al-Mukarramah Haram' },
  { id: 'Madinah', name: 'Adhan Madinah', sub: 'Soothing Al-Masjid an-Nabawi' },
  { id: 'Simple', name: 'Simple Tone', sub: 'Short, clean prayer alert beep' },
  { id: 'Vibrate', name: 'Vibrate Only', sub: 'Silent vibration pattern' },
  { id: 'Silent', name: 'Silent', sub: 'Visual system banner only' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { setNotificationsEnabled } = usePreferencesStore();
  const [step, setStep] = useState<'permission' | 'sound'>('permission');
  const [selectedSound, setSelectedSound] = useState<'Makkah' | 'Madinah' | 'Simple' | 'Vibrate' | 'Silent'>('Makkah');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState('');
  const [scheduling, setScheduling] = useState(false);

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
            useNativeDriver: false,
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
      await setNotificationsEnabled(granted);

      if (!granted) {
        setError('Permissions not fully approved. Skipping sound preview...');
        setTimeout(() => {
          router.push('/onboarding/personalize');
        }, 1500);
        return;
      }

      // Move to step 2: Sound choice configuration
      setStep('sound');
    } catch (err: any) {
      console.warn('Notification setup error:', err);
      router.push('/onboarding/personalize');
    }
  };

  const handleSkip = async () => {
    await setNotificationsEnabled(false);
    router.push('/onboarding/personalize');
  };

  const handlePlaySound = async () => {
    if (isPlaying) {
      AdhanPlayer.stopAdhan();
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      await AdhanPlayer.playAdhan(selectedSound);
    } catch (e: any) {
      console.warn('Failed to play sound:', e);
      setIsPlaying(false);
    }
  };

  // Stop sound when changing selection
  const handleSelectSound = (soundId: typeof selectedSound) => {
    if (isPlaying) {
      AdhanPlayer.stopAdhan();
      setIsPlaying(false);
    }
    setSelectedSound(soundId);
  };

  // Test local OS banner alert (with versioned channels)
  const handleTestNotification = async () => {
    try {
      let soundFile: string | undefined = 'default';
      let channelId = 'default';
      if (selectedSound === 'Silent') {
        soundFile = undefined;
        channelId = 'channel_silent_v2';
      } else if (selectedSound === 'Simple') {
        soundFile = 'simple_tone.mp3';
        channelId = 'channel_simple_v2';
      } else if (selectedSound === 'Madinah') {
        soundFile = 'adhan_madinah.mp3';
        channelId = 'channel_madinah_v2';
      } else if (selectedSound === 'Makkah') {
        soundFile = 'adhan.mp3';
        channelId = 'channel_makkah_v2';
      } else if (selectedSound === 'Vibrate') {
        soundFile = 'default';
        channelId = 'channel_vibrate_v2';
      }

      // Create Android channel dynamically if on Android
      if (Platform.OS === 'android') {
        try {
          if (selectedSound === 'Silent') {
            await Notifications.setNotificationChannelAsync(channelId, {
              name: 'Silent Notifications',
              importance: Notifications.AndroidImportance.LOW,
              sound: null,
              enableVibrate: false,
            });
          } else if (selectedSound === 'Vibrate') {
            await Notifications.setNotificationChannelAsync(channelId, {
              name: 'Vibrate Only',
              importance: Notifications.AndroidImportance.DEFAULT,
              sound: null,
              enableVibrate: true,
            });
          } else {
            const androidSoundName = soundFile ? soundFile.split('.')[0] : undefined;
            await Notifications.setNotificationChannelAsync(channelId, {
              name: `Adhan Alerts (${selectedSound})`,
              importance: Notifications.AndroidImportance.MAX,
              sound: androidSoundName,
              enableVibrate: true,
              vibrationPattern: [0, 250, 250, 250],
            });
          }
        } catch (err) {
          console.warn('Native channel registration failed, testing with default:', err);
          await Notifications.setNotificationChannelAsync(channelId, {
            name: `Adhan Alerts (${selectedSound})`,
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            enableVibrate: true,
          });
        }
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Adhan Notification 🕌',
          body: `Hayya 'ala-s-Salah. Selected tone configuration: ${selectedSound}.`,
          sound: soundFile,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
          repeats: false,
          channelId: channelId,
        },
      });

      Alert.alert('Test Scheduled', 'Test notification scheduled. Keep app backgrounded or lock screen to see banner.');
    } catch (e: any) {
      Alert.alert('Test Failed', e.message || 'Unable to schedule test notification.');
    }
  };

  const handleContinue = async () => {
    // Save selected sound locally to config settings
    try {
      setScheduling(true);
      if (isPlaying) {
        AdhanPlayer.stopAdhan();
        setIsPlaying(false);
      }

      const settings = {
        enabledPrayers: { Fajr: true, Sunrise: false, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
        offsetMinutes: 0,
        sound: selectedSound,
      };

      await AsyncStorage.setItem('noor360_notification_settings', JSON.stringify(settings));
      router.push('/onboarding/personalize');
    } catch (err) {
      console.warn('Error saving sound preference:', err);
      router.push('/onboarding/personalize');
    } finally {
      setScheduling(false);
    }
  };

  useEffect(() => {
    return () => {
      AdhanPlayer.stopAdhan();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      <ArabicGeometricBg size={350} style={styles.bgGeometric} />

      {step === 'permission' ? (
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

          <View style={styles.textBlock}>
            <Text style={styles.title}>Never Miss a Prayer</Text>
            <Text style={styles.subtitle}>
              Receive timely, beautifully configured Adhan notifications and audio warnings when it is time for prayer in your local region.
            </Text>
          </View>

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
      ) : (
        <View style={styles.content}>
          {/* Progress Dots */}
          <View style={styles.progress}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>

          <View style={styles.soundHeader}>
            <Text style={styles.title}>Choose Adhan Notification Sound</Text>
            <Text style={styles.subtitle}>Select the tone you want played when it is time for prayer.</Text>
          </View>

          {/* Sound choice list */}
          <View style={styles.soundList}>
            {SOUNDS.map((item) => {
              const isSelected = selectedSound === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.soundRow,
                    isSelected && styles.soundRowSelected,
                  ]}
                  onPress={() => handleSelectSound(item.id as any)}
                  activeOpacity={0.8}
                >
                  <View style={styles.soundMeta}>
                    <Text
                      style={[
                        styles.soundName,
                        isSelected && styles.soundNameSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text style={styles.soundSub}>{item.sub}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      isSelected && styles.radioSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preview buttons */}
          {selectedSound !== 'Silent' && selectedSound !== 'Vibrate' && (
            <View style={styles.previewGroup}>
              <TouchableOpacity style={styles.previewBtn} onPress={handlePlaySound} activeOpacity={0.7}>
                <Ionicons name={isPlaying ? 'square' : 'play'} size={18} color={COLORS.gold} />
                <Text style={styles.previewBtnText}>
                  {isPlaying ? 'Stop Playback' : 'Listen Live Preview'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.previewBtn} onPress={handleTestNotification} activeOpacity={0.7}>
                <Ionicons name={Platform.OS === 'ios' ? 'phone-portrait-outline' : 'notifications-outline'} size={18} color={COLORS.gold} />
                <Text style={styles.previewBtnText}>Test OS Banner</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.buttonGroup}>
            {scheduling ? (
              <ActivityIndicator size="large" color={COLORS.gold} />
            ) : (
              <PrimaryButton
                title="Continue"
                onPress={handleContinue}
                style={styles.allowBtn}
              />
            )}
          </View>
        </View>
      )}
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
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '180deg' }], // Waves grow downwards originally, rotate so they grow upwards!
  },
  textBlock: {
    alignItems: 'center',
  },
  soundHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.text2,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
    marginTop: 6,
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
  soundList: {
    width: '100%',
    paddingHorizontal: 4,
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  soundRowSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
  },
  soundMeta: {
    flex: 1,
  },
  soundName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  soundNameSelected: {
    color: COLORS.gold,
  },
  soundSub: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  radioSelected: {
    borderColor: COLORS.gold,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
  previewGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 8,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  previewBtnText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});
