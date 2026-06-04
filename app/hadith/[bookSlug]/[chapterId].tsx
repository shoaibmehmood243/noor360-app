import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useHadith } from '../../../src/hooks/useHadith';
import { usePreferencesStore } from '../../../src/store/usePreferencesStore';
import DuaShareModal, { ShareData } from '../../../components/ui/DuaShareModal';
import { COLORS } from '../../../constants/theme';
import Card from '../../../components/ui/Card';
import GoldBadge from '../../../components/ui/GoldBadge';
import ArabicText from '../../../components/ui/ArabicText';
import SkeletonLoader from '../../../components/ui/SkeletonLoader';
import EmptyState from '../../../components/ui/EmptyState';

const COLLECTION_COLORS: Record<string, { bg: string; text: string; icon: string; name: string }> = {
  'sahih-bukhari': { bg: 'rgba(201, 168, 76, 0.12)', text: '#C9A84C', icon: 'book', name: 'Sahih Al-Bukhari' },
  'sahih-muslim': { bg: 'rgba(45, 212, 191, 0.12)', text: '#2DD4BF', icon: 'shield-checkmark', name: 'Sahih Muslim' },
  'sunan-abi-dawud': { bg: 'rgba(59, 130, 246, 0.12)', text: '#3B82F6', icon: 'ribbon', name: 'Sunan Abi Dawud' },
  'jami-al-tirmidhi': { bg: 'rgba(236, 72, 153, 0.12)', text: '#EC4899', icon: 'star', name: 'Jami Al-Tirmidhi' },
  'sunan-ibn-majah': { bg: 'rgba(139, 92, 246, 0.12)', text: '#8B5CF6', icon: 'heart', name: 'Sunan Ibn Majah' },
  'sunan-an-nasai': { bg: 'rgba(245, 158, 11, 0.12)', text: '#F59E0B', icon: 'bookmark', name: "Sunan An-Nasa'i" },
};

const getThemeMeta = (bookKey: string) => {
  const normalized = (bookKey || '').toLowerCase().replace(/_/g, '-');
  for (const [key, value] of Object.entries(COLLECTION_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  return {
    bg: 'rgba(201, 168, 76, 0.12)',
    text: COLORS.gold,
    icon: 'book',
    name: bookKey,
  };
};

export default function ChapterHadithListScreen() {
  const router = useRouter();
  const { bookSlug, chapterId } = useLocalSearchParams<{ bookSlug: string; chapterId: string }>();
  const hadithStore = useHadith();
  const { language } = usePreferencesStore();

  const [nextPageLoading, setNextPageLoading] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [hadithToShare, setHadithToShare] = useState<ShareData | null>(null);

  const themeMeta = getThemeMeta(bookSlug);
  const chapterNo = parseInt(chapterId || '1', 10);

  useEffect(() => {
    if (bookSlug && chapterId) {
      hadithStore.fetchChapters(bookSlug); // Populate chapters to find name
      hadithStore.fetchHadiths(bookSlug, 1, chapterNo);
    }
  }, [bookSlug, chapterId]);

  // Load next paginated page
  const handleLoadMore = async () => {
    if (
      hadithStore.hadiths.length === 0 ||
      hadithStore.isLoading ||
      nextPageLoading
    ) {
      return;
    }

    if (hadithStore.hadiths.length % 20 !== 0) {
      return;
    }

    try {
      setNextPageLoading(true);
      const nextPage = hadithStore.currentPage + 1;
      await hadithStore.fetchHadiths(bookSlug, nextPage, chapterNo);
    } catch (e) {
      console.warn('Failed to load next page of hadiths:', e);
    } finally {
      setNextPageLoading(false);
    }
  };

  const handleShareHadith = (item: any) => {
    const isUrdu = language === 'ur';
    const translationText = (isUrdu && item.hadithUrdu) ? item.hadithUrdu : item.hadithEnglish;
    setHadithToShare({
      title: 'Prophetic Guidance',
      arabic: item.hadithArabic,
      translation: translationText,
      reference: `${themeMeta.name} #${item.hadithNumber}`,
      contentType: 'hadith',
    });
    setShareModalVisible(true);
  };

  const handleCreateHadithNote = (item: any) => {
    router.push({
      pathname: '/quran/bookmarks',
      params: {
        addNoteRef: `${item.book || item.bookName}:${item.hadithNumber}`,
        arabicText: item.hadithArabic,
        reference: `${themeMeta.name} #${item.hadithNumber}`,
      },
    });
  };

  // Find current chapter details
  const activeChapterData = hadithStore.chapters.find(
    (ch: any) => parseInt(ch.chapterNumber || ch.id, 10) === chapterNo
  );

  const chapterName = activeChapterData
    ? activeChapterData.chapterName || activeChapterData.name
    : `Chapter ${chapterNo}`;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace({ pathname: '/hadith/[bookSlug]', params: { bookSlug } });
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{chapterName}</Text>
          <Text style={styles.headerSubtitle}>{themeMeta.name} • Chapter {chapterNo}</Text>
        </View>
      </View>

      {/* Hadiths FlatList */}
      <FlatList
        data={hadithStore.hadiths}
        keyExtractor={(item, index) => `${item.hadithNumber || index}_${index}`}
        contentContainerStyle={styles.listPadding}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item }) => {
          const isUrdu = language === 'ur';
          const narratorText = (isUrdu && item.urduNarrator) ? item.urduNarrator : item.englishNarrator;
          const translationText = (isUrdu && item.hadithUrdu) ? item.hadithUrdu : item.hadithEnglish;
          const refId = `${item.book || item.bookName}:${item.hadithNumber}`;
          const isBookmarked = hadithStore.isBookmarked(refId);

          return (
            <Card style={styles.hadithCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.bookTag, { backgroundColor: themeMeta.bg }]}>
                  <Ionicons name={themeMeta.icon as any} size={12} color={themeMeta.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.bookTagText, { color: themeMeta.text }]}>{themeMeta.name}</Text>
                </View>
                <GoldBadge text={`Hadith #${item.hadithNumber}`} />
              </View>

              <ArabicText text={item.hadithArabic} size={18} style={styles.arabicScript} />
              
              {narratorText ? (
                <Text style={[styles.narratorText, isUrdu && styles.rtlText]}>
                  {narratorText}
                </Text>
              ) : null}

              <Text style={[styles.translationText, isUrdu && styles.rtlText, isUrdu && styles.urduScript]}>
                {translationText}
              </Text>

              <View style={styles.actionTray}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={async () => {
                    if (isBookmarked) {
                      await hadithStore.removeBookmark(refId);
                    } else {
                      await hadithStore.addBookmark({
                        type: 'hadith',
                        refId,
                        arabicText: item.hadithArabic,
                        translation: translationText,
                        reference: `${themeMeta.name} #${item.hadithNumber}`,
                      });
                    }
                  }}
                >
                  <Ionicons
                    name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={16}
                    color={isBookmarked ? COLORS.gold : COLORS.text3}
                  />
                  <Text style={[styles.actionBtnText, isBookmarked && { color: COLORS.gold }]}>
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => handleCreateHadithNote(item)}>
                  <Ionicons name="create-outline" size={16} color={COLORS.text3} />
                  <Text style={styles.actionBtnText}>Note</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => handleShareHadith(item)}>
                  <Ionicons name="share-social-outline" size={16} color={COLORS.text3} />
                  <Text style={styles.actionBtnText}>Share</Text>
                </TouchableOpacity>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          hadithStore.isLoading ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <SkeletonLoader width="100%" height={160} style={styles.skeleton} />
              <SkeletonLoader width="100%" height={160} style={styles.skeleton} />
              <SkeletonLoader width="100%" height={160} style={styles.skeleton} />
            </View>
          ) : (
            <EmptyState
              iconName="journal-outline"
              title="No Narrations Found"
              subtitle="Could not find Hadiths for this chapter. Please check your internet connection."
            />
          )
        }
        ListFooterComponent={
          nextPageLoading ? (
            <View style={styles.listFooterSpinner}>
              <ActivityIndicator size="small" color={COLORS.gold} />
              <Text style={styles.listFooterText}>Retrieving next narrations...</Text>
            </View>
          ) : null
        }
      />

      <DuaShareModal
        visible={shareModalVisible}
        shareData={hadithToShare}
        onClose={() => {
          setShareModalVisible(false);
          setHadithToShare(null);
        }}
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
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 2,
  },
  listPadding: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  hadithCard: {
    marginHorizontal: 20,
    padding: 18,
    marginBottom: 12,
    backgroundColor: COLORS.bg2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  bookTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bookTagText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  arabicScript: {
    color: COLORS.gold2,
    lineHeight: 34,
    textAlign: 'right',
    marginBottom: 12,
  },
  narratorText: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 6,
    lineHeight: 18,
  },
  translationText: {
    fontSize: 13,
    color: COLORS.text2,
    lineHeight: 19,
    textAlign: 'left',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  urduScript: {
    fontSize: 15,
    lineHeight: 24,
  },
  actionTray: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.bg3,
    paddingTop: 12,
    marginTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    fontSize: 10,
    color: COLORS.text3,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  skeleton: {
    marginBottom: 12,
  },
  listFooterSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  listFooterText: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 6,
    fontWeight: 'bold',
  },
});
