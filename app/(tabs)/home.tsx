import React, { useState, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Share,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { usePrayer } from '../../src/hooks/usePrayer';
import { usePrayerStore } from '../../src/store/prayerStore';
import { useTrackerStore, DayRecord, PrayerStatus } from '../../src/store/trackerStore';
import { useQuranStore } from '../../src/store/quranStore';
import { usePreferencesStore } from '../../src/store/usePreferencesStore';
import { COLORS } from '../../constants/theme';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import { useThemeContext } from '../../src/context/ThemeContext';
import ScreenBackground from '../../components/ui/ScreenBackground';
import Card from '../../components/ui/Card';
import { NamesIcon } from '../../components/icons/NamesIcon';
import { TasbeehIcon } from '../../components/icons/TasbeehIcon';
import { DuasShortcutIcon } from '../../components/icons/DuasShortcutIcon';
import { QuranBookIcon } from '../../components/icons/QuranBookIcon';

import { getVerseOfDay, getHadithOfDay } from '../../src/api/client';
import { useDuasStore } from '../../src/store/duasStore';
import DuaShareModal, { ShareData } from '../../components/ui/DuaShareModal';
import SkeletonLoader from '../../components/ui/SkeletonLoader';

const COLLECTION_COLORS: Record<string, { bg: string; text: string; icon: string; name: string }> = {
  'sahih-bukhari': { bg: 'rgba(201, 168, 76, 0.12)', text: '#C9A84C', icon: 'book', name: 'Sahih Al-Bukhari' },
  'sahih-muslim': { bg: 'rgba(45, 212, 191, 0.12)', text: '#2DD4BF', icon: 'shield-checkmark', name: 'Sahih Muslim' },
  'sunan-abi-dawud': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', icon: 'ribbon', name: 'Sunan Abi Dawud' },
  'jami-al-tirmidhi': { bg: 'rgba(236, 72, 153, 0.12)', text: '#EC4899', icon: 'star', name: 'Jami Al-Tirmidhi' },
  'sunan-ibn-majah': { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6', icon: 'heart', name: 'Sunan Ibn Majah' },
  'sunan-an-nasai': { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', icon: 'bookmark', name: 'Sunan An-Nasa\'i' },
};

const getThemeMeta = (bookKey: any) => {
  let normalized = '';
  if (typeof bookKey === 'string') {
    normalized = bookKey.toLowerCase();
  } else if (bookKey && typeof bookKey === 'object') {
    normalized = (bookKey.bookSlug || bookKey.bookName || '').toLowerCase();
  }
  normalized = normalized.replace(/_/g, '-');

  for (const [key, value] of Object.entries(COLLECTION_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  const displayName = typeof bookKey === 'object'
    ? (bookKey.bookName || bookKey.bookSlug || 'Hadith Collection')
    : (bookKey || 'Hadith Collection');

  return {
    bg: 'rgba(201, 168, 76, 0.12)',
    text: COLORS.gold,
    icon: 'book',
    name: displayName,
  };
};

const STATIC_FALLBACK_VERSE = {
  text: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
  translation: 'For indeed, with hardship [will be] ease.',
  surah: { englishName: 'Ash-Sharh', number: 94 },
  numberInSurah: 5,
};

const STATIC_FALLBACK_HADITH = {
  hadithArabic: 'الطهور شطر الإيمان',
  hadithEnglish: 'Purity is half of faith (Iman).',
  book: 'sahih-muslim',
  bookName: 'Sahih Muslim',
  hadithNumber: '223',
};

const STATIC_FALLBACK_DUA = {
  arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا طَيِّبًا وَعَمَلاً مُتَقَبَّلاً',
  translation: 'O Allah, indeed I ask You for beneficial knowledge, good provision, and accepted deeds.',
  transliteration: 'Allahumma inni as-aluka ilman nafi-an, wa rizqan tayyiban, wa amalan mutaqabbalan',
  reference: 'Sunan Ibn Majah',
};

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const prayerStore = usePrayer();
  const trackerStore = useTrackerStore();
  const quranStore = useQuranStore();
  const duasStore = useDuasStore();

  const { theme } = useThemeContext();
  const { language } = usePreferencesStore();
  const isDark = theme === 'dark';

  const heroGradient = isDark
    ? ['#151F32', '#0C1220'] as const
    : ['#FFFFFF', '#EAECEF'] as const;

  const gridGradientColors = isDark
    ? ['#161E2E', '#101624'] as const
    : ['#FFFFFF', '#F3F4F6'] as const;

  const getTrackerColors = (isPrayed: boolean) => {
    if (isPrayed) return [COLORS.gold, '#A88028'] as const;
    return isDark
      ? ['#1C253B', '#121927'] as const
      : ['#E5E7EB', '#D1D5DB'] as const;
  };

  const [greeting, setGreeting] = useState('Assalamu Alaikum');
  const isFocused = useIsFocused();
  const [tasbeehCount, setTasbeehCount] = useState(0);
  const [quranVersesRead, setQuranVersesRead] = useState(0);
  const todayStr = new Date().toISOString().split('T')[0];

  // Dynamic daily inspired items states
  const [verseOfDay, setVerseOfDay] = useState<any>(STATIC_FALLBACK_VERSE);
  const [hadithOfDay, setHadithOfDay] = useState<any>(STATIC_FALLBACK_HADITH);
  const [duaOfDay, setDuaOfDay] = useState<any>(STATIC_FALLBACK_DUA);

  const [loadingVerse, setLoadingVerse] = useState(true);
  const [loadingHadith, setLoadingHadith] = useState(true);
  const [loadingDua, setLoadingDua] = useState(true);

  // Sharing Card Image Modal States
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  // Location Selector Modal States
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [manualCity, setManualCity] = useState('');
  const [manualCountry, setManualCountry] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);

  // 1. Initialize today's tracker record & load Quran recently read history
  useEffect(() => {
    trackerStore.initializeToday(todayStr);
    trackerStore.syncWithBackend().catch((e) => console.warn('Salah tracker sync failed:', e));
    quranStore.loadLocalData().catch((e) => console.warn('Quran store load failed:', e));

    const loadGreetingAndName = async () => {
      try {
        const storedFirstName = await AsyncStorage.getItem('user_first_name');
        const suffix = storedFirstName ? `, ${storedFirstName}` : '';
        const hour = new Date().getHours();
        if (hour < 12) {
          setGreeting(`Sabah Al-Khair${suffix}`); // Good Morning
        } else if (hour < 17) {
          setGreeting(`Assalamu Alaikum${suffix}`); // Peace be upon you
        } else {
          setGreeting(`Masa'a Al-Khair${suffix}`); // Good Evening
        }
      } catch (e) {
        console.warn('Failed to load user name for greeting:', e);
      }
    };

    if (isFocused) {
      loadGreetingAndName();
    }

    // Load dynamic content
    loadDailyScriptures();
  }, [isFocused]);

  // Load progress counts on mount and whenever screen focuses
  useEffect(() => {
    if (isFocused) {
      const loadProgressCounts = async () => {
        try {
          const todayStr = new Date().toISOString().split('T')[0];

          // 1. Tasbeeh today count
          const storedStats = await AsyncStorage.getItem('tasbeeh_counter_stats');
          if (storedStats) {
            const parsed = JSON.parse(storedStats);
            if (parsed.lastUpdatedDate === todayStr) {
              setTasbeehCount(parsed.today || 0);
            } else {
              setTasbeehCount(0);
            }
          } else {
            setTasbeehCount(0);
          }

          // 2. Quran daily verses read
          const quranRead = await AsyncStorage.getItem('quran_daily_verses_read');
          if (quranRead) {
            const parsed = JSON.parse(quranRead);
            if (parsed.date === todayStr) {
              setQuranVersesRead(parsed.count || 0);
            } else {
              setQuranVersesRead(0);
            }
          } else {
            setQuranVersesRead(0);
          }
        } catch (e) {
          console.warn('Failed to load home progress counts:', e);
        }
      };
      loadProgressCounts();
    }
  }, [isFocused]);

  const loadDailyScriptures = async () => {
    try {
      setLoadingVerse(true);
      const vod = await getVerseOfDay();
      if (vod) setVerseOfDay(vod);
    } catch (e) {
      console.warn('Failed to load dynamic verse of day:', e);
    } finally {
      setLoadingVerse(false);
    }

    try {
      setLoadingHadith(true);
      const hod = await getHadithOfDay();
      if (hod) setHadithOfDay(hod);
    } catch (e) {
      console.warn('Failed to load dynamic hadith of day:', e);
    } finally {
      setLoadingHadith(false);
    }

    try {
      setLoadingDua(true);
      await duasStore.fetchDuaOfDay();
      if (duasStore.duaOfDay) {
        setDuaOfDay(duasStore.duaOfDay);
      }
    } catch (e) {
      console.warn('Failed to load dynamic dua of day:', e);
    } finally {
      setLoadingDua(false);
    }
  };

  // 2. Keep countdown timer ticking for the live countdown card
  useEffect(() => {
    if (prayerStore.prayerTimes) {
      prayerStore.startCountdown();
    }
  }, [prayerStore.prayerTimes]);

  const todayRecord = trackerStore.records[todayStr] || {
    fajr: 'pending',
    dhuhr: 'pending',
    asr: 'pending',
    maghrib: 'pending',
    isha: 'pending',
  };

  const getSalahPrayedCount = () => {
    let count = 0;
    (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).forEach((prayer) => {
      if (todayRecord[prayer] === 'prayed' || todayRecord[prayer] === 'qadha') {
        count++;
      }
    });
    return count;
  };
  const salahPrayedCount = getSalahPrayedCount();

  // Convert minutes into hours and minutes
  const formatCountdown = (minutes: number | null) => {
    if (minutes === null) return '--:--';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Toggle prayer status on single tap (pending <-> prayed)
  const handleTogglePrayer = (prayerKey: keyof DayRecord) => {
    const currentStatus = todayRecord[prayerKey];
    const newStatus: PrayerStatus = currentStatus === 'prayed' ? 'pending' : 'prayed';
    trackerStore.markPrayer(todayStr, prayerKey, newStatus);
  };

  // Resolve recently read Surah details for the Resume Bar
  const lastReadItem = quranStore.recentlyRead[0];
  const matchedSurah = lastReadItem
    ? quranStore.surahs.find((s) => s.number === lastReadItem.surahId)
    : null;

  const handleResumeReading = () => {
    if (lastReadItem) {
      router.push({
        pathname: '/quran/[surahId]',
        params: { surahId: lastReadItem.surahId.toString() },
      });
    } else {
      // Default to Surah Al-Fatihah
      router.push({
        pathname: '/quran/[surahId]',
        params: { surahId: '1' },
      });
    }
  };

  const handleShareText = async (title: string, arabic: string, translation: string, source: string) => {
    try {
      const message = `✨ *${title}* ✨\n\n📖 *Arabic*:\n${arabic}\n\n📝 *Translation*:\n"${translation}"\n\n📍 *Source*:\n— ${source}\n\n🟢 *Shared via Noor360 App*`;
      await Share.share({
        message,
      });
    } catch (error) {
      console.warn('Share error:', error);
    }
  };

  const handleShareImage = (data: ShareData) => {
    setShareData(data);
    setShareModalVisible(true);
  };

  const handleAutoDetectLocation = async () => {
    try {
      setDetectingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant location permissions in device settings.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      await prayerStore.fetchPrayerTimes(latitude, longitude);
      setLocationModalVisible(false);
      const updatedLoc = usePrayerStore.getState().location;
      Alert.alert('Success', `Location updated: ${updatedLoc.city || 'Detected Location'}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not detect current location.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleSaveManualCity = async () => {
    if (!manualCity.trim()) {
      Alert.alert('Error', 'Please enter a city name.');
      return;
    }
    try {
      setDetectingLocation(true);
      await prayerStore.fetchByCity(manualCity.trim(), manualCountry.trim());
      setLocationModalVisible(false);
      const updatedLoc = usePrayerStore.getState().location;
      Alert.alert('Success', `Location set to ${updatedLoc.city || manualCity.trim()}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not find prayer times for entered city.');
    } finally {
      setDetectingLocation(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenBackground />
      <ArabicGeometricBg size={width * 0.95} style={styles.bgGeometric} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Greeting Banner */}
          <View style={styles.header}>
            <View>
              <View style={styles.brandContainer}>
                <View style={styles.logoSquare}>
                  <Text style={styles.logoLetter}>ن</Text>
                </View>
                <View style={styles.brandText}>
                  <Text style={styles.brandTitle}>Noor</Text>
                  <Text style={styles.brandSubtitle}>360</Text>
                </View>
              </View>
              <Text style={styles.greetingText}>{greeting}</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={22} color={COLORS.gold} />
            </TouchableOpacity>
          </View>

          {/* Hero Card: Next Prayer & Hijri Calendar */}
          <LinearGradient
            colors={heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroRow}>
              <View>
                <Text style={styles.hijriText}>
                  {prayerStore.hijriDate
                    ? `${prayerStore.hijriDate.day} ${prayerStore.hijriDate.month.ar} ${prayerStore.hijriDate.year} AH`
                    : 'Loading Hijri Date...'}
                </Text>
                <Text style={styles.gregorianText}>
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.locBadge}
                onPress={() => {
                  setManualCity(prayerStore.location.city || '');
                  setManualCountry(prayerStore.location.country || '');
                  setLocationModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="location-sharp" size={14} color={COLORS.gold} />
                <Text style={styles.locText} numberOfLines={1}>
                  {prayerStore.location.city || 'Makkah'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <View style={styles.countdownRow}>
              <View>
                <Text style={styles.countdownLabel}>Next Salah</Text>
                <Text style={styles.nextPrayerName}>
                  {prayerStore.nextPrayer ? prayerStore.nextPrayer : 'Fajr'}
                </Text>
              </View>
              <View style={styles.timerWrapper}>
                <Ionicons name="time-outline" size={20} color={COLORS.gold} style={styles.timerIcon} />
                <Text style={styles.timerText}>
                  {formatCountdown(prayerStore.minutesUntilNext)}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Quick Resume last-read Section */}
          <TouchableOpacity onPress={handleResumeReading} activeOpacity={0.85}>
            <LinearGradient
              colors={[COLORS.gold2, COLORS.gold]}
              style={styles.resumeCard}
            >
              {/* Bismillah Calligraphy in background/top-right */}
              <Text style={styles.bismillahText}>
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </Text>

              {/* Top Row: "Last Read" and Book Icon */}
              <View style={styles.resumeHeaderRow}>
                <MaterialCommunityIcons name="book-open-outline" size={16} color="#1C1B1F" />
                <Text style={styles.resumeLabel}>Last Read</Text>
              </View>

              {/* Content Area */}
              <View style={styles.resumeContentRow}>
                {/* Left Details */}
                <View style={styles.resumeDetails}>
                  <Text style={styles.resumeSurahName} numberOfLines={1}>
                    {matchedSurah ? matchedSurah.englishName : 'Al-Fatihah'}
                  </Text>
                  <Text style={styles.resumeAyahNo}>
                    Ayah No: {lastReadItem ? lastReadItem.verseNumber : 1}
                  </Text>
                </View>

                {/* Right Quran/Rehal Vector Graphic */}
                <View style={styles.quranIllustrationContainer}>
                  <Svg width={100} height={80} viewBox="0 0 100 80" fill="none">
                    {/* Rehal Stand (Darker Wood Gold) */}
                    <Path
                      d="M20 70 L50 45 L80 70"
                      stroke="#8A5A16"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M32 70 L50 45 L68 70"
                      stroke="#633F0D"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Open Quran Pages (White/Cream Book) */}
                    {/* Left Page */}
                    <Path
                      d="M50 45 C40 38, 25 35, 12 40 L12 20 C25 15, 40 18, 50 25 Z"
                      fill="#FFFBF0"
                      stroke="#8A5A16"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    {/* Right Page */}
                    <Path
                      d="M50 45 C60 38, 75 35, 88 40 L88 20 C75 15, 60 18, 50 25 Z"
                      fill="#FFFBF0"
                      stroke="#8A5A16"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    {/* Book Spine Line */}
                    <Path
                      d="M50 25 V45"
                      stroke="#633F0D"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    {/* Page Lines Detail (Left Page) */}
                    <Path
                      d="M20 27 C28 24, 38 26, 44 29 M20 32 C28 29, 38 31, 44 34 M20 37 C28 34, 38 36, 44 39"
                      stroke="#D3C1A5"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    {/* Page Lines Detail (Right Page) */}
                    <Path
                      d="M80 27 C72 24, 62 26, 56 29 M80 32 C72 29, 62 31, 56 34 M80 37 C72 34, 62 36, 56 39"
                      stroke="#D3C1A5"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    {/* Green Ribbon Bookmark hanging from center */}
                    <Path
                      d="M50 38 C52 46, 55 52, 53 58"
                      stroke="#2E7D32"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </Svg>
                </View>
              </View>

              {/* Floating Bookmark Ribbon Badge bottom right */}
              <View style={styles.bookmarkRibbonBadge}>
                <Ionicons name="bookmark" size={16} color="#FFF" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Interactive Salah Tracker Section */}
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Salah Habit Tracker</Text>
              {trackerStore.streak > 0 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {trackerStore.streak} Day Streak</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>Tap a prayer circle below to log your completed salah</Text>

            <View style={styles.trackerRow}>
              {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((prayer) => {
                const isPrayed = todayRecord[prayer] === 'prayed';
                return (
                  <TouchableOpacity
                    key={prayer}
                    style={styles.trackerItem}
                    onPress={() => handleTogglePrayer(prayer)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={getTrackerColors(isPrayed)}
                      style={styles.trackerCircle}
                    >
                      {isPrayed ? (
                        <Ionicons name="checkmark-sharp" size={20} color={COLORS.bg} />
                      ) : (
                        <Text style={[styles.trackerCircleLetter, { color: COLORS.text3 }]}>
                          {prayer.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </LinearGradient>
                    <Text style={[styles.trackerName, isPrayed && styles.trackerNameActive]}>
                      {prayer.charAt(0).toUpperCase() + prayer.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Daily Progress Widget */}
          <Card style={styles.progressCard}>
            <Text style={styles.progressTitle}>Daily Spiritual Goals</Text>

            {/* Salah Progress */}
            <View style={styles.progressRow}>
              <View style={styles.progressHeader}>
                <View style={styles.progressInfo}>
                  <Ionicons name="time" size={18} color={COLORS.teal} style={styles.progressIcon} />
                  <Text style={styles.progressLabel}>Prayers Logged</Text>
                </View>
                <Text style={styles.progressValue}>{salahPrayedCount}/5</Text>
              </View>
              <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
                <View style={[styles.progressBarFill, { width: `${(salahPrayedCount / 5) * 100}%`, backgroundColor: COLORS.teal }]} />
              </View>
            </View>

            {/* Tasbeeh Progress */}
            <View style={styles.progressRow}>
              <View style={styles.progressHeader}>
                <View style={styles.progressInfo}>
                  <Ionicons name="finger-print" size={18} color={COLORS.gold} style={styles.progressIcon} />
                  <Text style={styles.progressLabel}>Tasbeeh Counter</Text>
                </View>
                <Text style={styles.progressValue}>{tasbeehCount}/100</Text>
              </View>
              <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, (tasbeehCount / 100) * 100)}%`, backgroundColor: COLORS.gold }]} />
              </View>
            </View>

            {/* Quran Progress */}
            <View style={styles.progressRowLast}>
              <View style={styles.progressHeader}>
                <View style={styles.progressInfo}>
                  <Ionicons name="book" size={18} color="#8B5CF6" style={styles.progressIcon} />
                  <Text style={styles.progressLabel}>Quran Verses Read</Text>
                </View>
                <Text style={styles.progressValue}>{quranVersesRead}/10</Text>
              </View>
              <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}>
                <View style={[styles.progressBarFill, { width: `${Math.min(100, (quranVersesRead / 10) * 100)}%`, backgroundColor: '#8B5CF6' }]} />
              </View>
            </View>
          </Card>

          {/* Quick Actions 2x2 Grid */}
          <Text style={styles.sectionGridTitle}>Spiritual Shortcuts</Text>
          <View style={styles.gridContainer}>
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => router.push('/(tabs)/quran')}
              activeOpacity={0.8}
            >
              <LinearGradient colors={gridGradientColors} style={styles.gridGradient}>
                <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(201,168,76,0.1)' }]}>
                  <QuranBookIcon color={COLORS.gold} size={24} />
                </View>
                <Text style={styles.gridItemLabel}>Holy Quran</Text>
                <Text style={styles.gridItemDesc}>Read & Listen</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => router.push('/duas/tasbeeh')}
              activeOpacity={0.8}
            >
              <LinearGradient colors={gridGradientColors} style={styles.gridGradient}>
                <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(201,168,76,0.1)' }]}>
                  <TasbeehIcon color={COLORS.gold} size={24} />
                </View>
                <Text style={styles.gridItemLabel}>Tasbeeh</Text>
                <Text style={styles.gridItemDesc}>Dhikr & Counter</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => router.push('/duas/names')}
              activeOpacity={0.8}
            >
              <LinearGradient colors={gridGradientColors} style={styles.gridGradient}>
                <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(201,168,76,0.1)' }]}>
                  <NamesIcon color={COLORS.gold} size={24} />
                </View>
                <Text style={styles.gridItemLabel}>99 Names</Text>
                <Text style={styles.gridItemDesc}>Asma al-Husna</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => router.push('/duas')}
              activeOpacity={0.8}
            >
              <LinearGradient colors={gridGradientColors} style={styles.gridGradient}>
                <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(201,168,76,0.1)' }]}>
                  <DuasShortcutIcon color={COLORS.gold} size={24} />
                </View>
                <Text style={styles.gridItemLabel}>Supplications</Text>
                <Text style={styles.gridItemDesc}>Hisn al-Muslim</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Daily Inspiration Cards Deck */}
          <Text style={styles.sectionGridTitle}>Spiritual Inspiration</Text>

          {/* Verse of the Day */}
          {loadingVerse ? (
            <SkeletonLoader width="100%" height={160} borderRadius={20} style={{ marginBottom: 12 }} />
          ) : (
            <Card style={styles.inspirationCard}>
              <View style={styles.inspirationHeader}>
                <View style={styles.badgeRow}>
                  <View style={styles.inspirationBadge}>
                    <Text style={styles.inspirationBadgeText}>VERSE OF THE DAY</Text>
                  </View>
                </View>
                <View style={styles.actionIconsRow}>
                  <TouchableOpacity
                    onPress={() => handleShareText(
                      'Verse of the Day',
                      verseOfDay.text,
                      verseOfDay.translation,
                      `Surah ${verseOfDay.surah?.englishName || 'Quran'} (${verseOfDay.surah?.number || ''}:${verseOfDay.numberInSurah || ''})`
                    )}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="share-social-outline" size={18} color={COLORS.text2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShareImage({
                      title: 'Verse of the Day',
                      arabic: verseOfDay.text,
                      translation: verseOfDay.translation,
                      reference: `Surah ${verseOfDay.surah?.englishName || 'Quran'} (${verseOfDay.surah?.number || ''}:${verseOfDay.numberInSurah || ''})`,
                      contentType: 'ayah'
                    })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                    style={{ marginLeft: 14 }}
                  >
                    <Ionicons name="image-outline" size={18} color={COLORS.text2} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.arabicInspirationText}>
                {verseOfDay.text}
              </Text>
              <Text style={styles.translationInspirationText}>
                "{verseOfDay.translation || 'Verify translation details...'}"
              </Text>
              <Text style={styles.inspirationSource}>
                Surah {verseOfDay.surah?.englishName || ''} ({verseOfDay.surah?.number || ''}:{verseOfDay.numberInSurah || ''})
              </Text>
            </Card>
          )}

          {/* Hadith of the Day */}
          {loadingHadith ? (
            <SkeletonLoader width="100%" height={160} borderRadius={20} style={{ marginBottom: 12 }} />
          ) : (
            (() => {
              const isUrdu = language === 'ur';
              const translationText = (isUrdu && hadithOfDay.hadithUrdu) ? hadithOfDay.hadithUrdu : hadithOfDay.hadithEnglish;
              const narratorText = (isUrdu && hadithOfDay.urduNarrator) ? hadithOfDay.urduNarrator : hadithOfDay.englishNarrator;
              return (
                <Card style={styles.inspirationCard}>
                  <View style={styles.inspirationHeader}>
                    <View style={styles.badgeRow}>
                      <View style={[styles.inspirationBadge]}>
                        <Text style={[styles.inspirationBadgeText]}>HADITH OF THE DAY</Text>
                      </View>
                    </View>
                    <View style={styles.actionIconsRow}>
                      <TouchableOpacity
                        onPress={() => handleShareText(
                          'Hadith of the Day',
                          hadithOfDay.hadithArabic,
                          translationText,
                          `${getThemeMeta(hadithOfDay.book || hadithOfDay.bookName).name} #${hadithOfDay.hadithNumber}`
                        )}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="share-social-outline" size={18} color={COLORS.text2} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleShareImage({
                          title: 'Hadith of the Day',
                          arabic: hadithOfDay.hadithArabic,
                          translation: translationText,
                          reference: `${getThemeMeta(hadithOfDay.book || hadithOfDay.bookName).name} #${hadithOfDay.hadithNumber}`,
                          contentType: 'hadith'
                        })}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        activeOpacity={0.6}
                        style={{ marginLeft: 14 }}
                      >
                        <Ionicons name="image-outline" size={18} color={COLORS.text2} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={styles.arabicInspirationText}>
                    {hadithOfDay.hadithArabic}
                  </Text>
                  {narratorText ? (
                    <Text style={[styles.narratorText, isUrdu && styles.rtlText]}>
                      {narratorText}
                    </Text>
                  ) : null}
                  <Text style={[styles.translationInspirationText, isUrdu && styles.rtlText, isUrdu && styles.urduScript]}>
                    "{translationText}"
                  </Text>
                  <Text style={[styles.inspirationSource, isUrdu && styles.rtlTextSource]}>
                    {getThemeMeta(hadithOfDay.book || hadithOfDay.bookName).name} (Hadith {hadithOfDay.hadithNumber})
                  </Text>
                </Card>
              );
            })()
          )}

          {/* Dua of the Day */}
          {loadingDua ? (
            <SkeletonLoader width="100%" height={160} borderRadius={20} style={{ marginBottom: 30 }} />
          ) : (
            <Card style={[styles.inspirationCard, { marginBottom: 30 }]}>
              <View style={styles.inspirationHeader}>
                <View style={styles.badgeRow}>
                  <View style={styles.inspirationBadge}>
                    <Text style={styles.inspirationBadgeText}>DUA OF THE DAY</Text>
                  </View>
                </View>
                <View style={styles.actionIconsRow}>
                  <TouchableOpacity
                    onPress={() => handleShareText(
                      'Dua of the Day',
                      duaOfDay.arabic,
                      duaOfDay.translation,
                      duaOfDay.reference
                    )}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="share-social-outline" size={18} color={COLORS.text2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleShareImage({
                      title: 'Dua of the Day',
                      arabic: duaOfDay.arabic,
                      transliteration: duaOfDay.transliteration,
                      translation: duaOfDay.translation,
                      reference: duaOfDay.reference,
                      contentType: 'dua'
                    })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                    style={{ marginLeft: 14 }}
                  >
                    <Ionicons name="image-outline" size={18} color={COLORS.text2} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.arabicInspirationText}>
                {duaOfDay.arabic}
              </Text>
              {duaOfDay.transliteration ? (
                <Text style={[styles.translationInspirationText, { marginBottom: 8, color: COLORS.text3 }]}>
                  {duaOfDay.transliteration}
                </Text>
              ) : null}
              <Text style={styles.translationInspirationText}>
                "{duaOfDay.translation}"
              </Text>
              <Text style={styles.inspirationSource}>
                {duaOfDay.reference}
              </Text>
            </Card>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* Dynamic Card Generation & Image Sharing Modal */}
      <DuaShareModal
        visible={shareModalVisible}
        shareData={shareData}
        onClose={() => {
          setShareModalVisible(false);
          setShareData(null);
        }}
      />

      {/* Location Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={locationModalVisible}
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Update location coordinates to get accurate prayer times.
            </Text>

            {detectingLocation ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.gold} />
                <Text style={styles.loaderText}>Updating prayer timetable...</Text>
              </View>
            ) : (
              <View>
                {/* Auto GPS Option */}
                <TouchableOpacity
                  style={styles.gpsBtn}
                  onPress={handleAutoDetectLocation}
                >
                  <Ionicons name="navigate-outline" size={20} color={COLORS.bg} />
                  <Text style={styles.gpsBtnText}>Use Current GPS Location</Text>
                </TouchableOpacity>

                <View style={styles.modalOrRow}>
                  <View style={styles.modalOrLine} />
                  <Text style={styles.modalOrText}>OR</Text>
                  <View style={styles.modalOrLine} />
                </View>

                {/* Manual Inputs */}
                <Text style={styles.inputLabel}>City Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Islamabad"
                  placeholderTextColor={COLORS.text3}
                  value={manualCity}
                  onChangeText={setManualCity}
                />

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Country Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Pakistan"
                  placeholderTextColor={COLORS.text3}
                  value={manualCountry}
                  onChangeText={setManualCountry}
                />

                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleSaveManualCity}
                >
                  <Text style={styles.saveBtnText}>Save Location</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  actionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bgGeometric: {
    opacity: 0.05,
    top: 80,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.text2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoSquare: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  logoLetter: {
    color: '#0A0E1A',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Amiri_700Bold',
  },
  brandText: {
    flexDirection: 'row',
    marginLeft: 10,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  brandSubtitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginLeft: 4,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(201,168,76,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.12)',
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hijriText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.gold2,
  },
  gregorianText: {
    fontSize: 12,
    color: COLORS.text2,
    marginTop: 4,
  },
  locBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    maxWidth: 130,
  },
  locText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(201,168,76,0.15)',
    marginVertical: 16,
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextPrayerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 2,
  },
  timerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  timerIcon: {
    marginRight: 6,
  },
  timerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  resumeCard: {
    padding: 16,
    borderRadius: 24,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  bismillahText: {
    position: 'absolute',
    top: 6,
    right: 14,
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: '#1C1B1F',
    opacity: 0.12,
  },
  resumeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resumeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1C1B1F',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    opacity: 0.85,
  },
  resumeContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resumeDetails: {
    flex: 1,
    paddingRight: 10,
  },
  resumeSurahName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1B1F',
  },
  resumeAyahNo: {
    fontSize: 13,
    color: 'rgba(28,27,31,0.7)',
    fontWeight: '600',
    marginTop: 2,
  },
  quranIllustrationContainer: {
    width: 100,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkRibbonBadge: {
    position: 'absolute',
    bottom: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionCard: {
    padding: 20,
    marginBottom: 20,
    backgroundColor: '#111827',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  streakBadge: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  streakText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 4,
    marginBottom: 16,
  },
  trackerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackerItem: {
    alignItems: 'center',
    flex: 1,
  },
  trackerCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  trackerCircleLetter: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trackerName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text2,
    marginTop: 8,
  },
  trackerNameActive: {
    color: COLORS.gold,
    fontWeight: '700',
  },
  sectionGridTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 10,
    marginBottom: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridItem: {
    width: (width - 50) / 2,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  gridGradient: {
    padding: 16,
    alignItems: 'flex-start',
  },
  gridIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridItemLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  gridItemDesc: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
  },
  inspirationCard: {
    padding: 20,
    marginBottom: 12,
    backgroundColor: '#111827',
  },
  inspirationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  inspirationBadge: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inspirationBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  arabicInspirationText: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold,
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 34,
  },
  translationInspirationText: {
    fontSize: 13,
    color: COLORS.text2,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  narratorText: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 6,
    lineHeight: 18,
    textAlign: 'center',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  urduScript: {
    fontSize: 15,
    lineHeight: 24,
  },
  rtlTextSource: {
    textAlign: 'left',
  },
  inspirationSource: {
    fontSize: 10,
    color: COLORS.text3,
    textAlign: 'right',
    marginTop: 10,
    fontWeight: '700',
  },
  progressCard: {
    padding: 20,
    marginBottom: 20,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  progressRow: {
    marginBottom: 20,
  },
  progressRowLast: {
    marginBottom: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressIcon: {
    marginRight: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text2,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.text2,
    lineHeight: 18,
    marginBottom: 20,
  },
  gpsBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  gpsBtnText: {
    color: '#0A0E1A',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  modalOrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalOrLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalOrText: {
    color: COLORS.text3,
    fontSize: 11,
    fontWeight: 'bold',
    marginHorizontal: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: 'rgba(201, 168, 76, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: COLORS.gold,
    fontWeight: 'bold',
    fontSize: 14,
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  loaderText: {
    color: COLORS.text2,
    fontSize: 13,
    marginTop: 12,
    fontWeight: 'bold',
  },
});
