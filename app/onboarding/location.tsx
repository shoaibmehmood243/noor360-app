import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import Svg, { Path, Rect } from 'react-native-svg';
import { usePreferencesStore } from '../../src/store/usePreferencesStore';
import { getPrayerTimes } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';

export default function LocationScreen() {
  const router = useRouter();
  const { setLocation, language, setLanguage } = usePreferencesStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRequestLocation = async () => {
    try {
      setLoading(true);
      setError('');

      // Request native permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Location permission was denied. Skipping...');
        setTimeout(() => handleSkip(), 1500);
        return;
      }

      // Get precise position
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;

      // Update Zustand & AsyncStorage
      setLocation(latitude, longitude);

      // Auto-detect country to set default language (Urdu if in Pakistan)
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocode && reverseGeocode.length > 0) {
          const countryCode = reverseGeocode[0].isoCountryCode || '';
          const countryName = reverseGeocode[0].country || '';
          if (countryCode.toUpperCase() === 'PK' || countryName.toLowerCase().includes('pakistan')) {
            if (language === 'en') {
              await setLanguage('ur');
            }
          }
        }
      } catch (geoErr) {
        console.warn('Silent fallback: Reverse geocoding failed.', geoErr);
      }

      // Preload prayer times from central client
      try {
        await getPrayerTimes(latitude, longitude);
      } catch (apiErr) {
        console.warn('Silent fallback: Preloading failed but continuing onboarding.', apiErr);
      }

      // Advance flow
      router.push('/onboarding/notifications');
    } catch (err: any) {
      setError(err.message || 'Failed to acquire location. Skipping...');
      setTimeout(() => handleSkip(), 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Standard Makkah coordinates as fallback
    setLocation(21.4225, 39.8262);
    router.push('/onboarding/notifications');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ArabicGeometricBg size={350} style={styles.bgGeometric} />

      <View style={styles.content}>
        {/* Progress Dots */}
        <View style={styles.progress}>
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Mosque SVG Vector */}
        <View style={styles.illustration}>
          <Svg width="180" height="180" viewBox="0 0 100 100" fill="none">
            <Path
              d="M50 10 C50 10 38 25 38 35 C38 45 42 45 42 55 L58 55 C58 45 62 45 62 35 C62 25 50 10 50 10 Z"
              fill={COLORS.gold}
              opacity="0.15"
            />
            {/* Minarets and central arch */}
            <Rect x="46" y="55" width="8" height="25" fill={COLORS.gold} opacity="0.3" />
            <Path d="M42 55 L42 80 L58 80 L58 55 Z" stroke={COLORS.gold} strokeWidth="1.5" />
            <Path d="M25 40 L25 80 M75 40 L75 80" stroke={COLORS.gold} strokeWidth="1.5" />
            <Path d="M22 40 L28 40 M72 40 L78 40" stroke={COLORS.gold} strokeWidth="1.5" />
            <Path d="M50 10 L50 2" stroke={COLORS.gold} strokeWidth="1.5" />
            <Path d="M48 2 L52 2" stroke={COLORS.gold} strokeWidth="1.5" />
          </Svg>
        </View>

        <Text style={styles.title}>Enable Location Services</Text>
        <Text style={styles.subtitle}>
          Allows Noor360 to accurately compute astronomical prayer schedules (Fajr, Dhuhr, Asr, Maghrib, Isha) and calculate exact Qibla Kaaba direction based on your coordinates.
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loadingText}>Acquiring coordinates...</Text>
          </View>
        ) : (
          <View style={styles.buttonGroup}>
            <PrimaryButton
              title="Allow Location Access"
              onPress={handleRequestLocation}
              style={styles.allowBtn}
            />

            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

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
  loadingBox: {
    alignItems: 'center',
    height: 100,
  },
  loadingText: {
    color: COLORS.text2,
    fontSize: 14,
    marginTop: 12,
    fontWeight: 'bold',
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
