import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useQuran } from '../../src/hooks/useQuran';
import { getVerseOfDay, searchQuran, Surah } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import { AppHeader } from '../../components/AppHeader';
import Card from '../../components/ui/Card';
import GoldBadge from '../../components/ui/GoldBadge';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import ArabicText from '../../components/ui/ArabicText';

const TRANSLATIONS = [
  { id: 'en.sahih', name: 'English 🇬🇧' },
  { id: 'ur.jalandhry', name: 'Urdu 🇵🇰' },
  { id: 'fr.hamidullah', name: 'French 🇫🇷' },
  { id: 'none', name: 'Arabic Only 🇸🇦' },
];

export default function QuranHomeScreen() {
  const router = useRouter();
  const quran = useQuran();

  // Local state
  const [verseOfDay, setVerseOfDay] = useState<any | null>(null);
  const [vodLoading, setVodLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [lastRead, setLastRead] = useState<{ surahId: number; surahName: string; verseNumber: number } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Meccan' | 'Medinan' | 'Bookmarked'>('All');

  // Load initial datasets
  useEffect(() => {
    fetchDailyVerse();
    loadLastRead();
  }, []);

  // Sync Last Read on focus/load
  const loadLastRead = async () => {
    try {
      const cached = await AsyncStorage.getItem('last_read');
      if (cached) {
        setLastRead(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Failed to parse last read coordinate:', e);
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

  // Debounced Search handler (400ms)
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchQuran(searchQuery);
        setSearchResults(results || []);
      } catch (err) {
        console.warn('Search query failed:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    setLastRead({
      surahId: surah.number,
      surahName: surah.englishName,
      verseNumber: 1,
    });
    router.push({
      pathname: `/quran/${surah.number}` as any,
    });
  };

  const handleSearchResultPress = (item: any) => {
    setSearchQuery('');
    setSearchResults([]);
    router.push({
      pathname: `/quran/${item.surah.number}` as any,
      params: { highlightVerse: item.numberInSurah },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Shared branding App Header with Bismillah */}
      <AppHeader onSettingsPress={() => router.push('/settings')} />

      <ScrollView contentContainerStyle={styles.scroll} nestedScrollEnabled>
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
          <Text style={styles.sectionTitle}>Explore Holy Verses</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.text3} style={styles.searchIcon} />
            <TextInput
              placeholder="Search by keywords or topics..."
              placeholderTextColor={COLORS.text3}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
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
                {searchResults.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.searchResultRow}
                    onPress={() => handleSearchResultPress(item)}
                  >
                    <View style={styles.searchResultMeta}>
                      <Text style={styles.searchResultRef}>
                        {item.surah.englishName} ({item.surah.number}:{item.numberInSurah})
                      </Text>
                      <Text numberOfLines={1} style={styles.searchResultText}>
                        {item.text}
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
        {lastRead && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Reading</Text>
            <Card style={styles.continueCard}>
              <View style={styles.continueLeft}>
                <Ionicons name="book-outline" size={24} color={COLORS.gold} />
                <View style={styles.continueMeta}>
                  <Text style={styles.continueName}>Surah {lastRead.surahName}</Text>
                  <Text style={styles.continueVerse}>Last read Verse {lastRead.verseNumber}</Text>
                </View>
              </View>
              <View style={styles.continueButtons}>
                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => router.push({ pathname: `/quran/${lastRead.surahId}` as any })}
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

        {/* 5. Surah Grid Matrix Header Filter Pills */}
        <View style={styles.section}>
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

          {/* Surah List */}
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
                      <Text style={styles.englishName}>{item.englishName}</Text>
                      <Text style={styles.subMeta}>
                        {item.numberOfAyahs} Verses • {item.englishNameTranslation}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.surahRight}>
                    <ArabicText text={item.name} size={20} bold style={styles.arabicName} />
                    <GoldBadge
                      text={item.revelationType}
                      style={styles.revelationBadge}
                      textStyle={styles.revelationBadgeText}
                    />
                  </View>
                </TouchableOpacity>
              ))}
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
    color: COLORS.gold2,
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
    color: COLORS.gold2,
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
});
