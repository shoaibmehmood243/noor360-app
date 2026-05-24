import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreferencesStore } from '../../src/store/usePreferencesStore';
import { saveUserPreferences } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';

const LEVELS: ('Beginner' | 'Learning' | 'Fluent')[] = ['Beginner', 'Learning', 'Fluent'];

const STATIC_RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Rashid Alafasy', sub: 'Balanced, high clarity' },
  { id: 'ar.abdulbasitmurattal', name: 'Abdul Basit Abdus Samad', sub: 'Traditional, melodic' },
  { id: 'ar.maheralmuaiqly', name: 'Mahir Al-Muayqali', sub: 'Makkah Al-Mukarramah Haram' },
  { id: 'en.sahih', name: 'English Recitation', sub: 'Sahih International Audio' },
];

export default function PersonalizeScreen() {
  const router = useRouter();
  const {
    language,
    notificationsEnabled,
    quranLevel,
    selectedReciter,
    setQuranLevel,
    setSelectedReciter,
    saveAllPreferences,
  } = usePreferencesStore();

  const [lvl, setLvl] = useState(quranLevel);
  const [reciter, setReciter] = useState(selectedReciter);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async () => {
    try {
      setLoading(true);
      setError('');

      // Commit choices to store
      setQuranLevel(lvl);
      setSelectedReciter(reciter);

      // Post preferences block to Mongo backend
      try {
        await saveUserPreferences({
          language: language || 'en',
          selectedTranslation: 'en.sahih',
          selectedReciter: reciter,
          notificationsEnabled: notificationsEnabled,
        });
      } catch (backendErr) {
        console.warn('Backend sync failed but continuing onboarding locally:', backendErr);
      }

      // Commit onboarding complete flag
      await saveAllPreferences();

      // Clear routing tree and land inside tabs
      router.replace('/(tabs)/quran');
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ArabicGeometricBg size={350} style={styles.bgGeometric} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress Dots */}
        <View style={styles.progress}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Personalize Your Journey</Text>
          <Text style={styles.subtitle}>Help us customize the Quranic content to match your current experience.</Text>
        </View>

        {/* 1. Quran Level Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quranic Reading Experience</Text>
          <View style={styles.levelGroup}>
            {LEVELS.map((item) => {
              const isSelected = lvl === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.levelCard,
                    isSelected && styles.levelCardSelected,
                  ]}
                  onPress={() => setLvl(item)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.levelText,
                      isSelected && styles.levelTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Reciters Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferred Reciter Voice</Text>
          {STATIC_RECITERS.map((item) => {
            const isSelected = reciter === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.reciterRow,
                  isSelected && styles.reciterRowSelected,
                ]}
                onPress={() => setReciter(item.id)}
                activeOpacity={0.8}
              >
                <View style={styles.reciterMeta}>
                  <Text
                    style={[
                      styles.reciterName,
                      isSelected && styles.reciterNameSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text style={styles.reciterSub}>{item.sub}</Text>
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

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.gold} style={styles.spinner} />
        ) : (
          <PrimaryButton
            title="Complete Setup"
            onPress={handleFinish}
            style={styles.finishBtn}
          />
        )}
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
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
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
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.text2,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  levelGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelCard: {
    flex: 1,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  levelCardSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
  },
  levelText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text2,
  },
  levelTextSelected: {
    color: COLORS.gold,
  },
  reciterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  reciterRowSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
  },
  reciterMeta: {
    flex: 1,
  },
  reciterName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  reciterNameSelected: {
    color: COLORS.gold,
  },
  reciterSub: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.gold,
  },
  errorText: {
    color: COLORS.teal,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 16,
  },
  spinner: {
    marginVertical: 16,
  },
  finishBtn: {
    marginTop: 10,
  },
});
