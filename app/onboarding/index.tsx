import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreferencesStore } from '../../src/store/usePreferencesStore';
import { COLORS } from '../../constants/theme';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import ScreenBackground from '../../components/ui/ScreenBackground';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ur', name: 'اردو', flag: '🇵🇰' },
  { code: 'ar', name: 'عربي', flag: '🇸🇦' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'id', name: 'Bahasa', flag: '🇮🇩' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'বাংলা', flag: '🇧🇩' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { language, setLanguage } = usePreferencesStore();
  const [selected, setSelected] = useState(language);

  // Animations
  const bismillahAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(bismillahAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(contentAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSelectLanguage = (code: string) => {
    setSelected(code);
    setLanguage(code);
  };

  const handleContinue = () => {
    if (selected) {
      router.push('/onboarding/walkthrough');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenBackground />
      <ArabicGeometricBg size={350} style={styles.bgGeometric} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Animated Bismillah */}
        <Animated.View style={[styles.bismillahBox, { opacity: bismillahAnim }]}>
          <Text style={styles.bismillahText}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        </Animated.View>

        <Animated.View style={[styles.content, { opacity: contentAnim }]}>
          {/* Logo emblem */}
          <View style={styles.logoSquare}>
            <Text style={styles.logoText}>ن</Text>
          </View>

          <Text style={styles.appName}>Noor360</Text>
          <Text style={styles.tagline}>Your complete Islamic companion</Text>

          <Text style={styles.gridTitle}>Choose Your Language</Text>

          {/* Language grid */}
          <View style={styles.grid}>
            {LANGUAGES.map((lang) => {
              const isSelected = selected === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.langCard,
                    isSelected && styles.langCardSelected,
                  ]}
                  onPress={() => handleSelectLanguage(lang.code)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <Text
                    style={[
                      styles.langName,
                      isSelected && styles.langNameSelected,
                    ]}
                  >
                    {lang.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <PrimaryButton
            title="Continue"
            onPress={handleContinue}
            disabled={!selected}
            style={styles.btn}
          />
        </Animated.View>
      </ScrollView>
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
  scroll: {
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  bismillahBox: {
    alignItems: 'center',
    marginVertical: 20,
  },
  bismillahText: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold2,
  },
  content: {
    alignItems: 'center',
  },
  logoSquare: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: COLORS.gold,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 40,
    fontFamily: 'Amiri_700Bold',
    color: '#0A0E1A',
    marginTop: -25,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tagline: {
    fontSize: 13,
    color: COLORS.text2,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 36,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
  },
  langCard: {
    width: '48%',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  langCardSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
  },
  langFlag: {
    fontSize: 24,
    marginBottom: 6,
  },
  langName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text2,
  },
  langNameSelected: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  btn: {
    marginTop: 10,
  },
});
