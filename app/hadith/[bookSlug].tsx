import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useHadith } from '../../src/hooks/useHadith';
import { COLORS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';
import ScreenBackground from '../../components/ui/ScreenBackground';

const COLLECTION_COLORS: Record<string, { bg: string; text: string; icon: string; name: string; arabic: string }> = {
  'sahih-bukhari': { bg: 'rgba(201, 168, 76, 0.12)', text: '#C9A84C', icon: 'book', name: 'Sahih Al-Bukhari', arabic: 'صحيح البخاري' },
  'sahih-muslim': { bg: 'rgba(45, 212, 191, 0.12)', text: '#2DD4BF', icon: 'shield-checkmark', name: 'Sahih Muslim', arabic: 'صحيح مسلم' },
  'sunan-abi-dawud': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', icon: 'ribbon', name: 'Sunan Abi Dawud', arabic: 'سنن أبي داود' },
  'jami-al-tirmidhi': { bg: 'rgba(236, 72, 153, 0.12)', text: '#EC4899', icon: 'star', name: 'Jami Al-Tirmidhi', arabic: 'جامع الترمذي' },
  'sunan-ibn-majah': { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6', icon: 'heart', name: 'Sunan Ibn Majah', arabic: 'سنن ابن ماجه' },
  'sunan-an-nasai': { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', icon: 'bookmark', name: "Sunan An-Nasa'i", arabic: 'سنن النسائي' },
};

const getThemeMeta = (bookKey: any) => {
  const rawKey = typeof bookKey === 'object' ? (bookKey.bookSlug || bookKey.bookName || '') : bookKey;
  const normalized = (rawKey || '').toLowerCase().replace(/_/g, '-');
  for (const [key, value] of Object.entries(COLLECTION_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  return {
    bg: 'rgba(201, 168, 76, 0.12)',
    text: COLORS.gold,
    icon: 'book',
    name: rawKey || 'Hadith Collection',
    arabic: 'الحديث الشريف',
  };
};

export default function BookChaptersScreen() {
  const router = useRouter();
  const { bookSlug } = useLocalSearchParams<{ bookSlug: string }>();
  const hadithStore = useHadith();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const themeMeta = getThemeMeta(bookSlug);

  useEffect(() => {
    if (bookSlug) {
      hadithStore.fetchChapters(bookSlug);
    }
  }, [bookSlug]);

  // Debounced search within this book
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      try {
        setSearching(true);
        // Call global search API
        const results = await hadithStore.searchHadiths(searchQuery);
        // Filter results only belonging to this book
        const filtered = (hadithStore.hadiths || []).filter((item: any) => {
          const rawBook = item.book || item.bookName || '';
          const bookStr = typeof rawBook === 'object' ? (rawBook.bookSlug || rawBook.bookName || '') : rawBook;
          const itemBook = (bookStr || '').toLowerCase().replace(/_/g, '-');
          return itemBook.includes(bookSlug.toLowerCase()) || bookSlug.toLowerCase().includes(itemBook);
        });
        setSearchResults(filtered);
      } catch (e) {
        console.warn('Search failed:', e);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const handleSelectChapter = (chapter: any) => {
    const chapterNo = parseInt(chapter.chapterNumber || chapter.id, 10);
    router.push(`/hadith/${bookSlug}/${chapterNo}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* <ScreenBackground /> */}
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/hadith');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{themeMeta.name}</Text>
          <Text style={styles.headerSubtitle}>{themeMeta.arabic}</Text>
        </View>
        <View style={[styles.bookIconBadge, { backgroundColor: themeMeta.bg }]}>
          <Ionicons name={themeMeta.icon as any} size={20} color={themeMeta.text} />
        </View>
      </View>

      {/* Book Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.text3} style={styles.searchIcon} />
          <TextInput
            placeholder={`Search within ${themeMeta.name}...`}
            placeholderTextColor={COLORS.text3}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={COLORS.text3} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Chapters or Search Results List */}
      <FlatList
        data={searchQuery.trim() ? searchResults : hadithStore.chapters}
        keyExtractor={(item, index) => item.chapterNumber || item.id || index.toString()}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => {
          const chapterNo = parseInt(item.chapterNumber || item.id, 10);
          const cleanName = item.chapterName || item.name || `Chapter ${chapterNo}`;
          return (
            <TouchableOpacity
              onPress={() => handleSelectChapter(item)}
              style={styles.chapterCard}
            >
              <View style={styles.chapterCardContent}>
                <View style={[styles.chapterNumberBadge, { backgroundColor: themeMeta.bg }]}>
                  <Text style={[styles.chapterNumberBadgeText, { color: themeMeta.text }]}>
                    {chapterNo}
                  </Text>
                </View>
                <View style={styles.chapterMetaInfo}>
                  <Text style={styles.chapterNameText}>{cleanName}</Text>
                  {item.chapterArabic && (
                    <Text style={styles.chapterArabicText} numberOfLines={1}>
                      {item.chapterArabic}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.text3} style={{ alignSelf: 'center' }} />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          hadithStore.isLoading || searching ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
              <SkeletonLoader width="100%" height={74} style={styles.skeleton} />
              <SkeletonLoader width="100%" height={74} style={styles.skeleton} />
              <SkeletonLoader width="100%" height={74} style={styles.skeleton} />
              <SkeletonLoader width="100%" height={74} style={styles.skeleton} />
            </View>
          ) : (
            <EmptyState
              iconName="journal-outline"
              title="No Chapters Found"
              subtitle="Unable to retrieve chapters list. Please check your internet connection and try again."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bg2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.bg3,
    marginRight: 14,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 2,
    fontFamily: 'Amiri_400Regular',
  },
  bookIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg2,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },
  listPadding: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  chapterCard: {
    backgroundColor: COLORS.bg2,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  chapterCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapterNumberBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  chapterNumberBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  chapterMetaInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chapterNameText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  chapterArabicText: {
    color: COLORS.gold,
    fontSize: 14,
    fontFamily: 'Amiri_400Regular',
    textAlign: 'left',
  },
  skeleton: {
    marginBottom: 12,
  },
});
