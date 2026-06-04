import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Share,
  Dimensions,
  Image,
} from 'react-native';

const RECITER_IMAGES: Record<string, any> = {
  'ar.alafasy': require('../../assets/reciters/alafasy.jpeg'),
  'ar.mahermuaiqly': require('../../assets/reciters/mahermuaiqly.jpeg'),
  'ar.hudhaify': require('../../assets/reciters/hudhaify.jpeg'),
  'ar.shaatree': require('../../assets/reciters/shaatree.jpeg'),
};
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePreferencesStore, TextSize, PrayerMethod, AsrMethod, AIResponseLang } from '../../src/store/usePreferencesStore';
import { useThemeContext } from '../../src/context/ThemeContext';
import { COLORS } from '../../constants/theme';
import client, { getOrCreateDeviceId, getBookmarks } from '../../src/api/client';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import { getOfflineStorageSize, clearAllOfflineAudio } from '../../src/services/quranOfflineManager';
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

const TARGET_RECITERS = [
  { identifier: 'ar.alafasy', englishName: 'Alafasy', name: 'مشاري العفاسي' },
  { identifier: 'ar.mahermuaiqly', englishName: 'Maher Al Muaiqly', name: 'ماهر المعيقلي' },
  { identifier: 'ar.hudhaify', englishName: 'Hudhaify', name: 'علي بن عبدالرحمن الحذيفي' },
  { identifier: 'ar.shaatree', englishName: 'Abu Bakr Ash-Shaatree', name: 'أبو بكر الشاطري' },
];

const getLanguageFlag = (langCode: string): string => {
  const flags: Record<string, string> = {
    en: '🇬🇧',
    ur: '🇵🇰',
    ar: '🇸🇦',
    fr: '🇫🇷',
    tr: '🇹🇷',
    id: '🇮🇩',
    ms: '🇲🇾',
    fa: '🇮🇷',
    es: '🇪🇸',
    de: '🇩🇪',
    ru: '🇷🇺',
    zh: '🇨🇳',
    bn: '🇧🇩',
    hi: '🇮🇳',
  };
  return flags[langCode.toLowerCase()] || '🏳️';
};

export default function SettingsScreen() {
  const router = useRouter();
  const themeContext = useThemeContext();

  const prefs = usePreferencesStore();

  const [translations, setTranslations] = useState<{ identifier: string; name: string; language?: string }[]>([]);
  const [reciters, setReciters] = useState<{ identifier: string; englishName: string; name?: string }[]>(TARGET_RECITERS);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [offlineAudioSize, setOfflineAudioSize] = useState<number>(0);

  const loadOfflineSize = async () => {
    try {
      const sizeBytes = await getOfflineStorageSize();
      const sizeMB = parseFloat((sizeBytes / (1024 * 1024)).toFixed(1));
      setOfflineAudioSize(sizeMB);
    } catch (e) {
      console.warn('Failed to read offline audio size:', e);
    }
  };

  useEffect(() => {
    loadOfflineSize();
  }, []);

  const handleClearOfflineAudio = () => {
    Alert.alert(
      'Clear Offline Audio',
      'Are you sure you want to delete all downloaded Quran verse audio files from your device? This will free up storage space.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              await clearAllOfflineAudio();
              await loadOfflineSize();
              Alert.alert('Cleared', 'All offline Quran audio files have been deleted.');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not delete offline files.');
            } finally {
              setUpdating(false);
            }
          }
        }
      ]
    );
  };

  // Fetch dynamic translations based on active language choice
  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        setLoadingTranslations(true);
        const res = await client.get('/quran/translations', { params: { lang: prefs.language } });
        if (res.data && res.data.data && res.data.data.length > 0) {
          setTranslations(res.data.data);

          // Auto-select first translation if current translation is not in the list
          const hasCurrent = res.data.data.some((t: any) => t.identifier === prefs.selectedTranslation);
          if (!hasCurrent && res.data.data[0]) {
            await prefs.setSelectedTranslation(res.data.data[0].identifier);
          }
        } else {
          // Fallback to general list if no translations found for selected language
          const fallbackRes = await client.get('/quran/translations');
          if (fallbackRes.data && fallbackRes.data.data) {
            setTranslations(fallbackRes.data.data);
          }
        }
      } catch (err) {
        console.warn('Failed to load translations for lang:', prefs.language, err);
      } finally {
        setLoadingTranslations(false);
      }
    };

    fetchTranslations();
  }, [prefs.language]);

  // Update text size in both context & zustand preferences store
  const handleTextSizeChange = async (size: TextSize) => {
    setUpdating(true);
    await themeContext.setTextSize(size);
    await prefs.setTextSize(size);
    setUpdating(false);
  };

  // Toggle notifications (and sync with store)
  const handleNotificationsToggle = async (val: boolean) => {
    setUpdating(true);
    await prefs.setNotificationsEnabled(val);
    setUpdating(false);
  };

  // Clear Chat History (confirm + DELETE /api/user/chats/all/:deviceId)
  const handleClearChatHistory = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you absolutely sure you want to clear your conversation history with the AI Scholar? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              const deviceId = await getOrCreateDeviceId();
              await client.delete(`/user/chats/all/${deviceId}`);
              await prefs.resetQuestionsUsed();
              Alert.alert('Cleared', 'Your chat history has been cleared successfully.');
            } catch (err: any) {
              console.error('Failed to clear chats:', err);
              Alert.alert('Error', err.message || 'Could not clear chat history.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  // Clear all Bookmarks (confirm + DELETE /api/user/bookmarks/all/:deviceId)
  const handleClearBookmarks = () => {
    Alert.alert(
      'Delete All Bookmarks',
      'Are you absolutely sure you want to delete all your saved ayahs, hadiths, and supplications? This will sync across your devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              const deviceId = await getOrCreateDeviceId();
              await client.delete(`/user/bookmarks/all/${deviceId}`);
              Alert.alert('Deleted', 'All saved bookmarks have been removed.');
            } catch (err: any) {
              console.error('Failed to clear bookmarks:', err);
              Alert.alert('Error', err.message || 'Could not clear bookmarks.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  // Export User Data (Bookmarks + Chats) to a JSON structure for cross-device export
  const handleExportData = async () => {
    try {
      setUpdating(true);
      const deviceId = await getOrCreateDeviceId();

      // Fetch bookmarks
      const bookmarks = await getBookmarks().catch(() => []);

      // Fetch chats from server route
      const chatsRes = await client.get(`/user/chats/${deviceId}`).catch(() => ({ data: { data: [] } }));
      const chats = chatsRes.data?.data || [];

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        deviceId,
        preferences: {
          language: prefs.language,
          selectedTranslation: prefs.selectedTranslation,
          selectedReciter: prefs.selectedReciter,
          textSize: prefs.textSize,
          autoplayAudio: prefs.autoplayAudio,
          wordByWord: prefs.wordByWord,
          calculationMethod: prefs.calculationMethod,
          asrMethod: prefs.asrMethod,
          responseLanguage: prefs.responseLanguage,
        },
        bookmarks,
        chats,
      };

      const shareContent = JSON.stringify(exportPayload, null, 2);

      await Share.share({
        title: 'Noor360 Exported Data',
        message: shareContent,
      });

    } catch (err: any) {
      console.error('Failed to export data:', err);
      Alert.alert('Export Error', err.message || 'Failed to assemble export payload.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ArabicGeometricBg size={320} style={styles.bgGeometric} />

      {/* Sticky Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/home');
            }
          }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Noor Settings</Text>
        <View style={styles.headerPlaceholder}>
          {updating && <ActivityIndicator size="small" color={COLORS.gold} />}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* SECTION 1: APPEARANCE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="eye-outline" size={20} color={COLORS.gold} />
            <Text style={styles.sectionTitle}>Appearance & Theme</Text>
          </View>

          <View style={styles.card}>
            {/* Language grid selection */}
            <Text style={styles.cardLabel}>Application Language</Text>
            <View style={styles.langGrid}>
              {LANGUAGES.map((lang) => {
                const isSelected = prefs.language === lang.code;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.langCard,
                      isSelected && styles.langCardSelected,
                    ]}
                    onPress={() => prefs.setLanguage(lang.code)}
                  >
                    <Text style={styles.langFlag}>{lang.flag}</Text>
                    <Text style={[styles.langName, isSelected && styles.langNameSelected]}>
                      {lang.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Text size selector */}
            <Text style={styles.cardLabel}>Quranic & Translation Font Size</Text>
            <View style={styles.textSizeRow}>
              {(['Small', 'Medium', 'Large'] as TextSize[]).map((size) => {
                const isSelected = prefs.textSize === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[
                      styles.sizeSegment,
                      isSelected && styles.sizeSegmentSelected,
                    ]}
                    onPress={() => handleTextSizeChange(size)}
                  >
                    <Text style={[styles.sizeText, isSelected && styles.sizeTextSelected]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Theme selection */}
            <Text style={styles.cardLabel}>Visual Theme Mode</Text>
            <View style={styles.textSizeRow}>
              {(['dark', 'light'] as ('dark' | 'light')[]).map((t) => {
                const isSelected = themeContext.theme === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.sizeSegment,
                      isSelected && styles.sizeSegmentSelected,
                    ]}
                    onPress={() => themeContext.setTheme(t)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons
                        name={t === 'dark' ? 'moon' : 'sunny'}
                        size={14}
                        color={isSelected ? COLORS.bg : COLORS.text2}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.sizeText, isSelected && styles.sizeTextSelected, isSelected && { color: COLORS.bg }]}>
                        {t === 'dark' ? 'Dark Mode' : 'Light Mode'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* SECTION 2: QURAN SETTINGS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={20} color={COLORS.gold} />
            <Text style={styles.sectionTitle}>Quran Configurations</Text>
          </View>

          <View style={styles.card}>
            {/* Translations list dropdown */}
            <Text style={styles.cardLabel}>Default Translation</Text>
            {loadingTranslations ? (
              <ActivityIndicator size="small" color={COLORS.gold} style={{ marginVertical: 10 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
                {translations.map((trans) => {
                  const isSelected = prefs.selectedTranslation === trans.identifier;
                  const langFlag = getLanguageFlag(trans.language || prefs.language);
                  return (
                    <TouchableOpacity
                      key={trans.identifier}
                      style={[
                        styles.optionChip,
                        isSelected && styles.optionChipActive,
                      ]}
                      onPress={() => prefs.setSelectedTranslation(trans.identifier)}
                    >
                      <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                        {langFlag}  {trans.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.divider} />

            {/* Reciter selector */}
            <Text style={styles.cardLabel}>Preferred Reciter Voice</Text>
            <View style={styles.recitersList}>
              {reciters.map((rec) => {
                const isSelected = prefs.selectedReciter === rec.identifier;
                return (
                  <TouchableOpacity
                    key={rec.identifier}
                    style={[
                      styles.reciterRowCard,
                      isSelected && styles.reciterRowCardActive,
                    ]}
                    onPress={() => prefs.setSelectedReciter(rec.identifier)}
                  >
                    <View style={styles.reciterCardLeft}>
                      <View style={[styles.reciterAvatarCircle, isSelected && styles.reciterAvatarCircleActive]}>
                        {RECITER_IMAGES[rec.identifier] ? (
                          <Image
                            source={RECITER_IMAGES[rec.identifier]}
                            style={styles.reciterAvatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Ionicons
                            name="mic"
                            size={18}
                            color={isSelected ? COLORS.bg : COLORS.gold}
                          />
                        )}
                      </View>
                      <View style={styles.reciterInfo}>
                        <Text style={[styles.reciterEnglishName, isSelected && styles.reciterEnglishNameActive]}>
                          {rec.englishName}
                        </Text>
                        <Text style={styles.reciterArabicName}>
                          {rec.name}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.gold} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Autoplay toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Auto-Play Verse Audio</Text>
                <Text style={styles.subtext}>Automatically queue and read the next verse</Text>
              </View>
              <Switch
                value={prefs.autoplayAudio}
                onValueChange={(val) => prefs.setAutoplayAudio(val)}
                trackColor={{ false: COLORS.bg3, true: 'rgba(45, 212, 191, 0.4)' }}
                thumbColor={prefs.autoplayAudio ? COLORS.teal : COLORS.text3}
              />
            </View>

            <View style={styles.divider} />

            {/* Word by word mode toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Word-by-Word Mode</Text>
                <Text style={styles.subtext}>Press words to read translations individually</Text>
              </View>
              <Switch
                value={prefs.wordByWord}
                onValueChange={(val) => prefs.setWordByWord(val)}
                trackColor={{ false: COLORS.bg3, true: 'rgba(45, 212, 191, 0.4)' }}
                thumbColor={prefs.wordByWord ? COLORS.teal : COLORS.text3}
              />
            </View>
          </View>
        </View>

        {/* SECTION 3: PRAYER SETTINGS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={COLORS.gold} />
            <Text style={styles.sectionTitle}>Prayer & Calibrations</Text>
          </View>

          <View style={styles.card}>
            {/* Calculation methods */}
            <Text style={styles.cardLabel}>Calculation Convention</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsScroll}>
              {(['MWL', 'ISNA', 'Egypt', 'Makkah', 'Karachi', 'Tehran', 'Shia'] as PrayerMethod[]).map((m) => {
                const isSelected = prefs.calculationMethod === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.optionChip,
                      isSelected && styles.optionChipActive,
                    ]}
                    onPress={() => prefs.setCalculationMethod(m)}
                  >
                    <Text style={[styles.optionChipText, isSelected && styles.optionChipTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.divider} />

            {/* Asr Hanafi / Shafi */}
            <Text style={styles.cardLabel}>Asr Jurisprudence Method</Text>
            <View style={styles.textSizeRow}>
              {(['Standard', 'Hanafi'] as AsrMethod[]).map((method) => {
                const isSelected = prefs.asrMethod === method;
                return (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.sizeSegment,
                      isSelected && styles.sizeSegmentSelected,
                    ]}
                    onPress={() => prefs.setAsrMethod(method)}
                  >
                    <Text style={[styles.sizeText, isSelected && styles.sizeTextSelected]}>
                      {method === 'Standard' ? 'Shafi\'i / Standard' : 'Hanafi'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Notification settings link */}
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/prayer/notifications')}
            >
              <View>
                <Text style={styles.toggleLabel}>Configure Adhan Notifications</Text>
                <Text style={styles.subtext}>Individually enable audio alerts for prayers</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.text2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 4: AI SCHOLAR (Temporarily disabled) */}
        {/*
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="chatbubbles-outline" size={20} color={COLORS.gold} />
            <Text style={styles.sectionTitle}>AI Scholar Portal</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.usageRow}>
              <View>
                <Text style={styles.cardLabel}>Daily Inquiry Limit</Text>
                <Text style={styles.subtext}>Usage resets every 24 hours at midnight</Text>
              </View>
              <Text style={styles.usageCount}>
                {prefs.dailyQuestionsUsed} of {prefs.dailyQuestionsMax} used
              </Text>
            </View>

            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(prefs.dailyQuestionsUsed / prefs.dailyQuestionsMax) * 100}%` },
                ]}
              />
            </View>

            <View style={styles.divider} />

            <Text style={styles.cardLabel}>Scholar Response Language</Text>
            <View style={styles.segmentContainer}>
              {(['Auto-detect', 'Always English', 'Always Arabic'] as AIResponseLang[]).map((lang) => {
                const isSelected = prefs.responseLanguage === lang;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.segmentItem,
                      isSelected && styles.segmentItemSelected,
                    ]}
                    onPress={() => prefs.setResponseLanguage(lang)}
                  >
                    <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                      {lang === 'Auto-detect' ? 'Auto' : lang.replace('Always ', '')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.dangerButton} onPress={handleClearChatHistory}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.dangerButtonText}>Clear Chat History</Text>
            </TouchableOpacity>
          </View>
        </View>
        */}

        {/* SECTION 5: DATA AND PRIVACY */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.gold} />
            <Text style={styles.sectionTitle}>Data & Privacy</Text>
          </View>

          <View style={styles.card}>
            {/* Clear all Bookmarks */}
            <TouchableOpacity style={styles.dangerButton} onPress={handleClearBookmarks}>
              <Ionicons name="bookmark-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.dangerButtonText}>Clear All Bookmarks</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Export my data */}
            <TouchableOpacity style={styles.linkButton} onPress={handleExportData}>
              <View>
                <Text style={styles.toggleLabel}>Export My Data</Text>
                <Text style={styles.subtext}>Generate a backup JSON file of bookmarks + chats</Text>
              </View>
              <Ionicons name="share-social-outline" size={18} color={COLORS.gold} />
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Offline Audio Storage Control */}
            <View style={styles.offlineStorageRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.toggleLabel}>Offline Quran Audio Storage</Text>
                <Text style={styles.subtext}>
                  {offlineAudioSize > 0
                    ? `Occupying ${offlineAudioSize} MB of local device storage`
                    : 'No downloaded audio files'}
                </Text>
              </View>
              {offlineAudioSize > 0 && (
                <TouchableOpacity
                  style={styles.clearDownloadsBtn}
                  onPress={handleClearOfflineAudio}
                >
                  <Text style={styles.clearDownloadsBtnText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            {/* About metadata */}
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Noor360 Companion</Text>
              <Text style={styles.aboutVal}>v1.0.0 Stable</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Publisher Credits</Text>
              <Text style={styles.aboutVal}>Islamic Network & Noor AI Team</Text>
            </View>

            <TouchableOpacity
              style={[styles.aboutRow, { marginTop: 12 }]}
              onPress={() => Alert.alert('Privacy Policy', 'Noor360 respects your spiritual journey. All bookmark, audio preference, and chat data remains locally encrypted in AsyncStorage and strictly private to your registered unique Device ID.')}
            >
              <Text style={[styles.aboutLabel, { color: COLORS.gold, textDecorationLine: 'underline' }]}>
                View Privacy Policy
              </Text>
              <Ionicons name="open-outline" size={14} color={COLORS.gold} />
            </TouchableOpacity>
          </View>
        </View>

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
    opacity: 0.02,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(201, 168, 76, 0.1)',
    backgroundColor: COLORS.bg,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerPlaceholder: {
    width: 36,
    alignItems: 'flex-end',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 16,
    padding: 16,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtext: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.bg3,
    marginVertical: 16,
  },
  langGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  langCard: {
    width: '23%',
    backgroundColor: COLORS.bg3,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  langCardSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  langFlag: {
    fontSize: 18,
    marginBottom: 4,
  },
  langName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text2,
  },
  langNameSelected: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  textSizeRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg3,
    borderRadius: 10,
    padding: 3,
    marginTop: 6,
  },
  sizeSegment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  sizeSegmentSelected: {
    backgroundColor: COLORS.gold,
  },
  sizeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text2,
  },
  sizeTextSelected: {
    color: COLORS.bg,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201, 168, 76, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  themeBadgeText: {
    fontSize: 10,
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  optionsScroll: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 2,
  },
  optionChip: {
    backgroundColor: COLORS.bg3,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  optionChipActive: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text2,
  },
  optionChipTextActive: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  recitersList: {
    marginTop: 8,
  },
  reciterRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg3,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  reciterRowCardActive: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.06)',
  },
  reciterCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reciterAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bg2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  reciterAvatarCircleActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  reciterInfo: {
    justifyContent: 'center',
  },
  reciterEnglishName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  reciterEnglishNameActive: {
    color: COLORS.gold,
  },
  reciterArabicName: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
  },
  reciterAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  linkButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg3,
    borderRadius: 10,
    padding: 3,
    marginTop: 6,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentItemSelected: {
    backgroundColor: COLORS.gold,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text2,
  },
  segmentTextSelected: {
    color: COLORS.bg,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  dangerButtonText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  usageCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.bg3,
    borderRadius: 3,
    width: '100%',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aboutLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text2,
  },
  aboutVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  offlineStorageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearDownloadsBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearDownloadsBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
