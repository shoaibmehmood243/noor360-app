import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import ScreenBackground from '../../components/ui/ScreenBackground';

import { useQuran } from '../../src/hooks/useQuran';
import { getVerseOfDay, searchQuran, Surah } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';
import { AppHeader } from '../../components/AppHeader';
import Card from '../../components/ui/Card';
import GoldBadge from '../../components/ui/GoldBadge';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import ArabicText from '../../components/ui/ArabicText';
import EmptyState from '../../components/ui/EmptyState';
import { getDownloadedSurahsList } from '../../src/services/quranOfflineManager';

const TRANSLATIONS = [
  { id: 'en.sahih', name: 'English 🇬🇧' },
  { id: 'ur.jalandhry', name: 'Urdu 🇵🇰' },
  { id: 'fr.hamidullah', name: 'French 🇫🇷' },
  { id: 'none', name: 'Arabic Only 🇸🇦' },
];

const JUZ_LIST = [
  { number: 1, name: "Alif-Lam-Meem", nameAr: "آلم", startAyah: "Al-Fatihah 1:1" },
  { number: 2, name: "Sayaqool", nameAr: "سيقول", startAyah: "Al-Baqarah 2:142" },
  { number: 3, name: "Tilkal Rusul", nameAr: "تلك الرسل", startAyah: "Al-Baqarah 2:253" },
  { number: 4, name: "Lan Tanaloo", nameAr: "لن تنالوا", startAyah: "Ali 'Imran 3:93" },
  { number: 5, name: "Wal Muhsanat", nameAr: "والمحصنات", startAyah: "An-Nisa 4:24" },
  { number: 6, name: "La Yuhibbullah", nameAr: "لا يحب الله", startAyah: "An-Nisa 4:148" },
  { number: 7, name: "Wa Iza Sami'oo", nameAr: "وإذا سمعوا", startAyah: "Al-Ma'idah 5:82" },
  { number: 8, name: "Wa Lau Annana", nameAr: "ولو أننا", startAyah: "Al-An'am 6:111" },
  { number: 9, name: "Qal Al-Mala'u", nameAr: "قال الملأ", startAyah: "Al-A'raf 7:88" },
  { number: 10, name: "Wa'lamoo", nameAr: "واعلموا", startAyah: "Al-Anfal 8:41" },
  { number: 11, name: "Ya'taziroon", nameAr: "يعتذرون", startAyah: "At-Tawbah 9:93" },
  { number: 12, name: "Wa Mamin Da'abbah", nameAr: "وما من دابة", startAyah: "Hud 11:6" },
  { number: 13, name: "Wa Ma Ubarri'u", nameAr: "وما أبرئ", startAyah: "Yusuf 12:53" },
  { number: 14, name: "Rubama", nameAr: "ربما", startAyah: "Al-Hijr 15:1" },
  { number: 15, name: "Subhanallazi", nameAr: "سبحان الذي", startAyah: "Al-Isra 17:1" },
  { number: 16, name: "Qal Alam", nameAr: "قال ألم", startAyah: "Al-Kahf 18:75" },
  { number: 17, name: "Aqtaraba", nameAr: "اقترب", startAyah: "Al-Anbiya 21:1" },
  { number: 18, name: "Qad Aflaha", nameAr: "قد أفلح", startAyah: "Al-Mu'minun 23:1" },
  { number: 19, name: "Wa Qalallazina", nameAr: "وقال الذين", startAyah: "Al-Furqan 25:21" },
  { number: 20, name: "Aman Khalaqa", nameAr: "أمن خلق", startAyah: "An-Naml 27:56" },
  { number: 21, name: "Utlu Ma Oohiya", nameAr: "اتل ما أوحي", startAyah: "Al-Ankabut 29:46" },
  { number: 22, name: "Wa Man Yaqnut", nameAr: "ومن يقنت", startAyah: "Al-Ahzab 33:31" },
  { number: 23, name: "Wa Maliya", nameAr: "وما لي", startAyah: "Yaseen 36:28" },
  { number: 24, name: "Faman Azlamu", nameAr: "فمن أظلم", startAyah: "Az-Zumar 39:32" },
  { number: 25, name: "Ilaihi Yuraddu", nameAr: "إليه يرد", startAyah: "Fussilat 41:47" },
  { number: 26, name: "Ha Meem", nameAr: "حم", startAyah: "Al-Ahqaf 46:1" },
  { number: 27, name: "Qala Fama Khatbukum", nameAr: "قال فما خطبكم", startAyah: "Az-Zariyat 51:31" },
  { number: 28, name: "Qad Sami'allah", nameAr: "قد سمع الله", startAyah: "Al-Mujadilah 58:1" },
  { number: 29, name: "Tabarakallazi", nameAr: "تبارك الذي", startAyah: "Al-Mulk 67:1" },
  { number: 30, name: "Amma Yatasa'aloon", nameAr: "عم يتساءلون", startAyah: "An-Naba 78:1" },
];

export default function QuranHomeScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  const router = useRouter();
  const quran = useQuran();

  // Local state
  const [verseOfDay, setVerseOfDay] = useState<any | null>(null);
  const [vodLoading, setVodLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const lastReadItem = quran.recentlyRead[0];
  const matchedSurah = lastReadItem
    ? quran.surahs.find((s) => s.number === lastReadItem.surahId)
    : null;
  const [activeFilter, setActiveFilter] = useState<'All' | 'Meccan' | 'Medinan' | 'Bookmarked'>('All');
  const [activeTab, setActiveTab] = useState<'surah' | 'para' | 'favourites'>('surah');
  const [favouriteSurahs, setFavouriteSurahs] = useState<number[]>([]);
  const [favouriteJuz, setFavouriteJuz] = useState<number[]>([]);

  const isFocused = useIsFocused();
  const [downloadedSurahs, setDownloadedSurahs] = useState<number[]>([]);

  // Load downloaded surahs whenever screen becomes focused
  const loadDownloadedSurahs = async () => {
    let activeReciter = 'ar.alafasy';
    try {
      const { usePreferencesStore } = require('../../src/store/usePreferencesStore');
      activeReciter = usePreferencesStore.getState().selectedReciter || 'ar.alafasy';
    } catch (e) { }
    const list = await getDownloadedSurahsList(activeReciter);
    setDownloadedSurahs(list);
  };

  useEffect(() => {
    if (isFocused) {
      loadDownloadedSurahs();
    }
  }, [isFocused]);

  // Load initial datasets
  useEffect(() => {
    fetchDailyVerse();
    loadFavourites();
  }, []);

  const loadFavourites = async () => {
    try {
      const favSurahs = await AsyncStorage.getItem('favourite_surahs');
      const favJuz = await AsyncStorage.getItem('favourite_juz');
      if (favSurahs) {
        setFavouriteSurahs(JSON.parse(favSurahs));
      } else {
        // Set default favorites: Kahf (18), Yaseen (36), Rehman (55), Waqia (56), Mulk (67), Naba (78)
        const defaultSurahs = [18, 36, 55, 56, 67, 78];
        setFavouriteSurahs(defaultSurahs);
        await AsyncStorage.setItem('favourite_surahs', JSON.stringify(defaultSurahs));
      }
      if (favJuz) setFavouriteJuz(JSON.parse(favJuz));
    } catch (e) {
      console.warn('Failed to load favourites:', e);
    }
  };

  const toggleFavouriteSurah = async (surahNumber: number) => {
    try {
      const updated = favouriteSurahs.includes(surahNumber)
        ? favouriteSurahs.filter(id => id !== surahNumber)
        : [...favouriteSurahs, surahNumber];
      setFavouriteSurahs(updated);
      await AsyncStorage.setItem('favourite_surahs', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save favourite surah:', e);
    }
  };

  const toggleFavouriteJuz = async (juzNumber: number) => {
    try {
      const updated = favouriteJuz.includes(juzNumber)
        ? favouriteJuz.filter(num => num !== juzNumber)
        : [...favouriteJuz, juzNumber];
      setFavouriteJuz(updated);
      await AsyncStorage.setItem('favourite_juz', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save favourite juz:', e);
    }
  };



  const fetchDailyVerse = async () => {
    try {
      setVodLoading(true);
      const data = await getVerseOfDay();
      setVerseOfDay(data);
    } catch (e) {
      console.warn('Failed to load daily verse:', e);
    } finally {
      setVodLoading(false);
    }
  };

  // Client-side Surah Search handler
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      setSearchResults([]);
      return;
    }

    const filtered = quran.surahs.filter((s: Surah) => {
      const numStr = s.number.toString();
      const englishName = s.englishName.toLowerCase();
      const englishTranslation = s.englishNameTranslation.toLowerCase();
      const arabicName = s.name;

      return (
        englishName.includes(query) ||
        englishTranslation.includes(query) ||
        numStr === query ||
        arabicName.includes(query)
      );
    });

    setSearchResults(filtered);
  }, [searchQuery, quran.surahs]);

  // Filters logic
  const getFilteredSurahs = () => {
    let list = quran.surahs;

    if (activeFilter === 'Meccan') {
      list = list.filter((s: Surah) => s.revelationType === 'Meccan');
    } else if (activeFilter === 'Medinan') {
      list = list.filter((s: Surah) => s.revelationType === 'Medinan');
    } else if (activeFilter === 'Bookmarked') {
      // Filter surahs that have any bookmarked verses
      const bookmarkedSurahs = new Set(
        quran.bookmarks
          .filter((b: any) => b.type === 'quran')
          .map((b: any) => parseInt(b.refId.split(':')[0]))
      );
      list = list.filter((s: Surah) => bookmarkedSurahs.has(s.number));
    }

    return list;
  };

  // Navigations
  const handleSelectSurah = (surah: Surah) => {
    // Record last read track locally on click
    quran.setLastRead(surah.number, 1);
    router.push({
      pathname: `/quran/${surah.number}` as any,
    });
  };

  const handleSearchResultPress = (item: Surah) => {
    setSearchQuery('');
    setSearchResults([]);
    handleSelectSurah(item);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenBackground />
      {/* Shared branding App Header with Bismillah */}
      <AppHeader onSettingsPress={() => router.push('/settings')} />

      <ScrollView contentContainerStyle={styles.scroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {/* Bookmarks & Reflections Companion Banner */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.companionBanner}
            onPress={() => router.push('/quran/bookmarks')}
          >
            <View style={styles.companionLeft}>
              <Ionicons name="journal-outline" size={22} color={COLORS.gold} />
              <View style={styles.companionMeta}>
                <Text style={styles.companionTitle}>Bookmarks & Reflections</Text>
                <Text style={styles.companionSubtitle}>Access your saved verses and study notes</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.gold} />
          </TouchableOpacity>
        </View>

        {/* 1. Verse of the Day Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Verse of the Day</Text>
            <TouchableOpacity onPress={fetchDailyVerse} disabled={vodLoading}>
              <Ionicons name="refresh" size={18} color={COLORS.gold} />
            </TouchableOpacity>
          </View>

          {vodLoading ? (
            <SkeletonLoader width="100%" height={140} borderRadius={16} />
          ) : verseOfDay ? (
            <Card style={styles.vodCard}>
              <LinearGradient
                colors={['rgba(201, 168, 76, 0.04)', 'transparent']}
                style={StyleSheet.absoluteFillObject}
              />
              <ArabicText
                text={verseOfDay.text}
                size={20}
                style={styles.vodArabic}
              />
              <Text style={styles.vodTranslation}>
                "{verseOfDay.translation || 'Verify translation details...'}"
              </Text>
              <View style={styles.vodFooter}>
                <GoldBadge text={`Surah ${verseOfDay.surah.englishName} • Verse ${verseOfDay.numberInSurah}`} />
              </View>
            </Card>
          ) : (
            <Text style={styles.fallbackText}>Preloading daily scripture details...</Text>
          )}
        </View>

        {/* 2. Interactive Search Bar with overlay */}
        <View style={[styles.section, { zIndex: 10 }]}>
          <Text style={styles.sectionTitle}>Explore Surahs</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.text3} style={styles.searchIcon} />
            <TextInput
              placeholder="Search Surah by name or number..."
              placeholderTextColor={COLORS.text3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 350)}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close" size={20} color={COLORS.text3} />
              </TouchableOpacity>
            )}
          </View>

          {/* Search Dropdown Overlay */}
          {searchFocused && searchResults.length > 0 && (
            <View style={styles.searchResultsDropdown}>
              <ScrollView style={styles.dropdownScroll} keyboardShouldPersistTaps="handled">
                {searchResults.map((item: Surah) => (
                  <TouchableOpacity
                    key={item.number}
                    style={styles.searchResultRow}
                    onPress={() => handleSearchResultPress(item)}
                  >
                    <View style={styles.searchResultMeta}>
                      <Text style={styles.searchResultRef}>
                        {item.number}. {item.englishName} ({item.name})
                      </Text>
                      <Text numberOfLines={1} style={styles.searchResultText}>
                        {item.numberOfAyahs} Verses • {item.englishNameTranslation}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color={COLORS.gold} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* 3. Continue Reading card */}
        {lastReadItem && matchedSurah && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Reading</Text>
            <Card style={styles.continueCard}>
              <View style={styles.continueLeft}>
                <Ionicons name="book-outline" size={24} color={COLORS.gold} />
                <View style={styles.continueMeta}>
                  <Text style={styles.continueName}>Surah {matchedSurah.englishName}</Text>
                  <Text style={styles.continueVerse}>Last read Verse {lastReadItem.verseNumber}</Text>
                </View>
              </View>
              <View style={styles.continueButtons}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => router.push({
                    pathname: `/quran/${lastReadItem.surahId}` as any,
                    params: { highlightVerse: lastReadItem.verseNumber.toString() }
                  })}
                >
                  <Text style={styles.continueBtnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}

        {/* 4. Translation Selector Pills Row */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quran translation</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.translationRow}>
            {TRANSLATIONS.map((t) => {
              const isSelected = quran.selectedTranslation === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.transPill,
                    isSelected && styles.transPillSelected,
                  ]}
                  onPress={() => quran.setTranslation(t.id)}
                >
                  <Text
                    style={[
                      styles.transPillText,
                      isSelected && styles.transPillTextSelected,
                    ]}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Tabs Selection */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'surah' && styles.tabButtonActive]}
            onPress={() => setActiveTab('surah')}
          >
            <Ionicons
              name="book-outline"
              size={18}
              color={activeTab === 'surah' ? COLORS.gold : COLORS.text3}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'surah' && styles.tabButtonTextActive]}>
              By Surah
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'para' && styles.tabButtonActive]}
            onPress={() => setActiveTab('para')}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={activeTab === 'para' ? COLORS.gold : COLORS.text3}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'para' && styles.tabButtonTextActive]}>
              By Para
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'favourites' && styles.tabButtonActive]}
            onPress={() => setActiveTab('favourites')}
          >
            <Ionicons
              name={activeTab === 'favourites' ? "star" : "star-outline"}
              size={18}
              color={activeTab === 'favourites' ? COLORS.gold : COLORS.text3}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'favourites' && styles.tabButtonTextActive]}>
              Favourites
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Contents */}
        <View style={styles.section}>
          {activeTab === 'surah' && (
            <View>
              <View style={styles.filterRow}>
                {(['All', 'Meccan', 'Medinan', 'Bookmarked'] as const).map((filter) => {
                  const isActive = activeFilter === filter;
                  return (
                    <TouchableOpacity
                      key={filter}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                      onPress={() => setActiveFilter(filter)}
                    >
                      <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                        {filter}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {quran.isLoading && quran.surahs.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <SkeletonLoader width="100%" height={70} borderRadius={12} style={styles.skeletonItem} />
                  <SkeletonLoader width="100%" height={70} borderRadius={12} style={styles.skeletonItem} />
                  <SkeletonLoader width="100%" height={70} borderRadius={12} style={styles.skeletonItem} />
                </View>
              ) : (
                <View style={styles.surahList}>
                  {getFilteredSurahs().map((item: Surah) => (
                    <TouchableOpacity
                      key={item.number}
                      style={styles.surahRow}
                      onPress={() => handleSelectSurah(item)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.surahLeft}>
                        <View style={styles.numberBox}>
                          <Text style={styles.numberText}>{item.number}</Text>
                        </View>
                        <View style={styles.metaBox}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.englishName}>{item.englishName}</Text>
                            {downloadedSurahs.includes(item.number) && (
                              <Ionicons
                                name="cloud-done"
                                size={14}
                                color={COLORS.gold}
                                style={{ marginLeft: 6 }}
                              />
                            )}
                          </View>
                          <Text style={styles.subMeta}>
                            {item.numberOfAyahs} Verses • {item.englishNameTranslation}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.surahRight}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ marginRight: 8, alignItems: 'flex-end' }}>
                            <ArabicText text={item.name} size={18} bold style={styles.arabicName} />
                            <GoldBadge
                              text={item.revelationType}
                              style={styles.revelationBadge}
                              textStyle={styles.revelationBadgeText}
                            />
                          </View>
                          <TouchableOpacity
                            onPress={() => toggleFavouriteSurah(item.number)}
                            style={{ padding: 6 }}
                          >
                            <Ionicons
                              name={favouriteSurahs.includes(item.number) ? "star" : "star-outline"}
                              size={20}
                              color={favouriteSurahs.includes(item.number) ? COLORS.gold : COLORS.text3}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'para' && (
            <View style={styles.surahList}>
              {JUZ_LIST.map((item) => (
                <TouchableOpacity
                  key={item.number}
                  style={styles.surahRow}
                  onPress={() => router.push(`/quran/juz/${item.number}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.surahLeft}>
                    <View style={styles.numberBox}>
                      <Text style={styles.numberText}>{item.number}</Text>
                    </View>
                    <View style={styles.metaBox}>
                      <Text style={styles.englishName}>{item.name}</Text>
                      <Text style={styles.subMeta}>
                        Starts at {item.startAyah}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.surahRight}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ marginRight: 8, alignItems: 'flex-end' }}>
                        <Text style={[styles.arabicName, { fontSize: 18, fontWeight: 'bold', fontFamily: 'Amiri_700Bold', color: COLORS.gold }]}>
                          {item.nameAr}
                        </Text>
                        <GoldBadge
                          text={`Juz ${item.number}`}
                          style={styles.revelationBadge}
                          textStyle={styles.revelationBadgeText}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleFavouriteJuz(item.number)}
                        style={{ padding: 6 }}
                      >
                        <Ionicons
                          name={favouriteJuz.includes(item.number) ? "star" : "star-outline"}
                          size={20}
                          color={favouriteJuz.includes(item.number) ? COLORS.gold : COLORS.text3}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeTab === 'favourites' && (
            <View>
              {favouriteSurahs.length === 0 && favouriteJuz.length === 0 ? (
                <EmptyState
                  iconName="star-outline"
                  title="No Favourites"
                  subtitle="Mark Surahs or Paras as favourites to easily read them here."
                  style={{ marginTop: 20 }}
                />
              ) : (
                <View>
                  {favouriteSurahs.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                      <Text style={styles.favSectionTitle}>Favourited Surahs</Text>
                      <View style={styles.surahList}>
                        {quran.surahs
                          .filter((s: Surah) => favouriteSurahs.includes(s.number))
                          .map((item: Surah) => (
                            <TouchableOpacity
                              key={item.number}
                              style={styles.surahRow}
                              onPress={() => handleSelectSurah(item)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.surahLeft}>
                                <View style={styles.numberBox}>
                                  <Text style={styles.numberText}>{item.number}</Text>
                                </View>
                                <View style={styles.metaBox}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.englishName}>{item.englishName}</Text>
                                    {downloadedSurahs.includes(item.number) && (
                                      <Ionicons
                                        name="cloud-done"
                                        size={14}
                                        color={COLORS.gold}
                                        style={{ marginLeft: 6 }}
                                      />
                                    )}
                                  </View>
                                  <Text style={styles.subMeta}>
                                    {item.numberOfAyahs} Verses • {item.englishNameTranslation}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.surahRight}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <View style={{ marginRight: 8, alignItems: 'flex-end' }}>
                                    <ArabicText text={item.name} size={18} bold style={styles.arabicName} />
                                    <GoldBadge
                                      text={item.revelationType}
                                      style={styles.revelationBadge}
                                      textStyle={styles.revelationBadgeText}
                                    />
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => toggleFavouriteSurah(item.number)}
                                    style={{ padding: 6 }}
                                  >
                                    <Ionicons
                                      name="star"
                                      size={20}
                                      color={COLORS.gold}
                                    />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </TouchableOpacity>
                          ))}
                      </View>
                    </View>
                  )}

                  {favouriteJuz.length > 0 && (
                    <View>
                      <Text style={styles.favSectionTitle}>Favourited Paras (Juz)</Text>
                      <View style={styles.surahList}>
                        {JUZ_LIST
                          .filter((j) => favouriteJuz.includes(j.number))
                          .map((item) => (
                            <TouchableOpacity
                              key={item.number}
                              style={styles.surahRow}
                              onPress={() => router.push(`/quran/juz/${item.number}`)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.surahLeft}>
                                <View style={styles.numberBox}>
                                  <Text style={styles.numberText}>{item.number}</Text>
                                </View>
                                <View style={styles.metaBox}>
                                  <Text style={styles.englishName}>{item.name}</Text>
                                  <Text style={styles.subMeta}>
                                    Starts at {item.startAyah}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.surahRight}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <View style={{ marginRight: 8, alignItems: 'flex-end' }}>
                                    <Text style={[styles.arabicName, { fontSize: 18, fontWeight: 'bold', fontFamily: 'Amiri_700Bold', color: COLORS.gold2 }]}>
                                      {item.nameAr}
                                    </Text>
                                    <GoldBadge
                                      text={`Juz ${item.number}`}
                                      style={styles.revelationBadge}
                                      textStyle={styles.revelationBadgeText}
                                    />
                                  </View>
                                  <TouchableOpacity
                                    onPress={() => toggleFavouriteJuz(item.number)}
                                    style={{ padding: 6 }}
                                  >
                                    <Ionicons
                                      name="star"
                                      size={20}
                                      color={COLORS.gold}
                                    />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            </TouchableOpacity>
                          ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
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
  scroll: {
    paddingBottom: 100, // accommodate bottom absolute tab bar height
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vodCard: {
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  vodArabic: {
    color: COLORS.gold,
    lineHeight: 34,
    marginBottom: 12,
  },
  vodTranslation: {
    fontSize: 13,
    color: COLORS.text2,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 16,
  },
  vodFooter: {
    alignItems: 'flex-start',
  },
  fallbackText: {
    color: COLORS.text3,
    fontSize: 13,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg2,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  searchResultsDropdown: {
    position: 'absolute',
    top: 92,
    left: 20,
    right: 20,
    backgroundColor: COLORS.bg2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  dropdownScroll: {
    padding: 8,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.bg3,
  },
  searchResultMeta: {
    flex: 1,
    marginRight: 12,
  },
  searchResultRef: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginBottom: 2,
  },
  searchResultText: {
    fontSize: 12,
    color: COLORS.text2,
  },
  continueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  continueLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  continueMeta: {
    marginLeft: 12,
  },
  continueName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  continueVerse: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  continueButtons: {
    flexDirection: 'row',
  },
  continueBtn: {
    backgroundColor: COLORS.teal,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  continueBtnText: {
    color: COLORS.bg,
    fontSize: 12,
    fontWeight: 'bold',
  },
  translationRow: {
    paddingVertical: 8,
  },
  transPill: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
  },
  transPillSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.08)',
  },
  transPillText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text2,
  },
  transPillTextSelected: {
    color: COLORS.gold,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: COLORS.bg2,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  filterPillActive: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text3,
  },
  filterPillTextActive: {
    color: COLORS.gold,
  },
  loadingContainer: {
    paddingVertical: 20,
  },
  skeletonItem: {
    marginBottom: 12,
  },
  surahList: {
    marginTop: 8,
  },
  surahRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.bg2,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  surahLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  numberBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: 'bold',
  },
  metaBox: {
    justifyContent: 'center',
  },
  englishName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subMeta: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  surahRight: {
    alignItems: 'flex-end',
  },
  arabicName: {
    color: COLORS.gold,
    marginBottom: 4,
  },
  revelationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  revelationBadgeText: {
    fontSize: 8,
  },
  companionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.15)',
    borderRadius: 14,
    padding: 16,
  },
  companionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companionMeta: {
    marginLeft: 12,
  },
  companionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  companionSubtitle: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg2,
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: COLORS.bg3,
    borderWidth: 0.5,
    borderColor: 'rgba(201, 168, 76, 0.2)',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text3,
  },
  tabButtonTextActive: {
    color: COLORS.gold,
  },
  favSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 10,
  },
});
