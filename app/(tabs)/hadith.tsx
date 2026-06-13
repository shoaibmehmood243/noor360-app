import React, { useEffect, useState, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';

import { useHadith } from '../../src/hooks/useHadith';
import { usePreferencesStore } from '../../src/store/usePreferencesStore';
import DuaShareModal, { ShareData } from '../../components/ui/DuaShareModal';
import { getHadithOfDay } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenBackground from '../../components/ui/ScreenBackground';
import AppHeader from '../../components/AppHeader';
import Card from '../../components/ui/Card';
import GoldBadge from '../../components/ui/GoldBadge';
import ArabicText from '../../components/ui/ArabicText';
import SkeletonLoader from '../../components/ui/SkeletonLoader';
import EmptyState from '../../components/ui/EmptyState';

const BOOK_METADATA: Array<{
  slug: string;
  name: string;
  arabicName: string;
  desc: string;
  hadithCount: string;
  chapterCount: string;
  accent: string;
  icon: string;
}> = [
    {
      slug: 'sahih-bukhari',
      name: 'Sahih Al-Bukhari',
      arabicName: 'صحيح البخاري',
      desc: 'The most authentic compilation of Hadith, compiled by Imam Al-Bukhari.',
      hadithCount: '7,563',
      chapterCount: '97',
      accent: '#C9A84C',
      icon: 'book',
    },
    {
      slug: 'sahih-muslim',
      name: 'Sahih Muslim',
      arabicName: 'صحيح مسلم',
      desc: 'Considered the second most authentic collection, compiled by Imam Muslim.',
      hadithCount: '7,500',
      chapterCount: '56',
      accent: '#2DD4BF',
      icon: 'shield-checkmark',
    },
    {
      slug: 'sunan-abi-dawud',
      name: 'Sunan Abi Dawud',
      arabicName: 'سنن أبي داود',
      desc: 'Focuses primarily on legal traditions (Ahkam), compiled by Imam Abu Dawud.',
      hadithCount: '5,274',
      chapterCount: '43',
      accent: '#3B82F6',
      icon: 'ribbon',
    },
    {
      slug: 'jami-al-tirmidhi',
      name: 'Jami Al-Tirmidhi',
      arabicName: 'جامع الترمذي',
      desc: 'Famous for its commentary on legal rulings, compiled by Imam Al-Tirmidhi.',
      hadithCount: '4,400',
      chapterCount: '49',
      accent: '#EC4899',
      icon: 'star',
    },
    {
      slug: 'sunan-an-nasai',
      name: "Sunan An-Nasa'i",
      arabicName: 'سنن النسائي',
      desc: "Famous for its high standards of critique, compiled by Imam An-Nasa'i.",
      hadithCount: '5,758',
      chapterCount: '51',
      accent: '#F59E0B',
      icon: 'bookmark',
    },
    {
      slug: 'sunan-ibn-majah',
      name: 'Sunan Ibn Majah',
      arabicName: 'سنن ابن ماجه',
      desc: 'One of the six major Hadith collections, compiled by Imam Ibn Majah.',
      hadithCount: '4,341',
      chapterCount: '37',
      accent: '#8B5CF6',
      icon: 'heart',
    },
  ];

const getBookKey = (book: any): string => {
  if (!book) return '';
  if (typeof book === 'string') return book;
  if (typeof book === 'object') {
    return book.bookSlug || book.bookName || '';
  }
  return '';
};

const getThemeMeta = (bookKey: any) => {
  const normalizedKey = getBookKey(bookKey);
  const normalized = (normalizedKey || '').toLowerCase().replace(/_/g, '-');
  const match = BOOK_METADATA.find(b => normalized.includes(b.slug) || b.slug.includes(normalized));
  if (match) {
    return {
      bg: 'rgba(201, 168, 76, 0.12)',
      text: match.accent,
      icon: match.icon,
      name: match.name,
    };
  }
  return {
    bg: 'rgba(201, 168, 76, 0.12)',
    text: COLORS.gold,
    icon: 'book',
    name: normalizedKey || 'Hadith Collection',
  };
};

export default function HadithTabScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  const router = useRouter();
  const isFocused = useIsFocused();
  const [hasRendered, setHasRendered] = useState(false);

  useEffect(() => {
    if (isFocused && !hasRendered) {
      const timer = setTimeout(() => setHasRendered(true), 50);
      return () => clearTimeout(timer);
    }
  }, [isFocused, hasRendered]);

  const hadithStore = useHadith();
  const { language } = usePreferencesStore();

  // Local states
  const [hadithOfDay, setHadithOfDay] = useState<any | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Share Image State
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [hadithToShare, setHadithToShare] = useState<ShareData | null>(null);

  // Audio Playback
  const [narratingHadith, setNarratingHadith] = useState<any | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);
  const [waveHeight, setWaveHeight] = useState([12, 22, 18, 28, 8]);

  useEffect(() => {
    if (!hasRendered) return;
    fetchDailyHadith();
  }, [hasRendered]);

  // Debounced global search trigger
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const delayDebounce = setTimeout(async () => {
      try {
        setSearching(true);
        await hadithStore.searchHadiths(searchQuery);
      } catch (e) {
        console.warn('Search failed:', e);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Waveform animation simulator
  useEffect(() => {
    let timer: any;
    if (narratingHadith && isNarrating) {
      timer = setInterval(() => {
        setWaveHeight([
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
        ]);
      }, 120);
    }
    return () => clearInterval(timer);
  }, [narratingHadith, isNarrating]);

  const fetchDailyHadith = async () => {
    try {
      setLoadingDaily(true);
      const data = await getHadithOfDay();
      setHadithOfDay(data);
    } catch (e) {
      console.warn('Failed to load daily Hadith:', e);
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleTriggerNarration = (hadith: any) => {
    const currentBookKey = getBookKey(narratingHadith?.book || narratingHadith?.bookName);
    const newBookKey = getBookKey(hadith.book || hadith.bookName);
    if (narratingHadith?.hadithNumber === hadith.hadithNumber && currentBookKey === newBookKey) {
      setIsNarrating(!isNarrating);
    } else {
      setNarratingHadith(hadith);
      setIsNarrating(true);
    }
  };

  const handleShareHadith = (item: any) => {
    const themeMeta = getThemeMeta(item.book || item.bookName);
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
    const itemBookKey = getBookKey(item.book || item.bookName);
    router.push({
      pathname: '/quran/bookmarks',
      params: {
        addNoteRef: `${itemBookKey}:${item.hadithNumber}`,
        arabicText: item.hadithArabic,
        reference: `${getThemeMeta(item.book || item.bookName).name} #${item.hadithNumber}`,
      },
    });
  };

  if (!hasRendered) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenBackground />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  const isSearching = searchQuery.trim().length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScreenBackground />
      {/* Brand Header */}
      <AppHeader onSettingsPress={() => router.push('/settings')} />

      {/* Main Container */}
      <FlatList
        data={isSearching ? hadithStore.hadiths : BOOK_METADATA}
        keyExtractor={(item, index) => isSearching ? `${getBookKey(item.book || item.bookName)}_${item.hadithNumber}_${index}` : item.slug}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item }) => {
          if (isSearching) {
            const themeMeta = getThemeMeta(item.book || item.bookName);
            const itemBookKey = getBookKey(item.book || item.bookName);
            const isBookmarked = hadithStore.isBookmarked(`${itemBookKey}:${item.hadithNumber}`);
            const isCurrentlyNarrating = narratingHadith?.hadithNumber === item.hadithNumber &&
              getBookKey(narratingHadith?.book || narratingHadith?.bookName) === itemBookKey;

            return (
              <HadithItem
                item={item}
                themeMeta={themeMeta}
                isBookmarked={isBookmarked}
                isCurrentlyNarrating={isCurrentlyNarrating}
                isNarrating={isNarrating}
                language={language}
                onTriggerNarration={handleTriggerNarration}
                onToggleBookmark={async () => {
                  const refId = `${itemBookKey}:${item.hadithNumber}`;
                  if (isBookmarked) {
                    await hadithStore.removeBookmark(refId);
                  } else {
                    const isUrdu = language === 'ur';
                    const translationText = (isUrdu && item.hadithUrdu) ? item.hadithUrdu : item.hadithEnglish;
                    await hadithStore.addBookmark({
                      type: 'hadith',
                      refId,
                      arabicText: item.hadithArabic,
                      translation: translationText,
                      reference: `${themeMeta.name} #${item.hadithNumber}`,
                    });
                  }
                }}
                onCreateNote={handleCreateHadithNote}
                onShare={handleShareHadith}
              />
            );
          }

          // Render Hadith Book Card
          return (
            <TouchableOpacity
              onPress={() => router.push(`/hadith/${item.slug}`)}
              style={styles.bookCard}
              activeOpacity={0.9}
            >
              <View style={styles.bookCardLeft}>
                <View style={[styles.bookIconContainer, { backgroundColor: `${item.accent}15` }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.accent} />
                </View>
                <View style={styles.bookMetaContainer}>
                  <Text style={styles.bookTitleText}>{item.name}</Text>
                  <Text style={styles.bookDescText} numberOfLines={2}>{item.desc}</Text>
                  <Text style={styles.bookCountsText}>{item.hadithCount} Hadiths • {item.chapterCount} Chapters</Text>
                </View>
              </View>
              <View style={styles.bookCardRight}>
                <Text style={styles.bookArabicName}>{item.arabicName}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.text3} style={styles.chevron} />
              </View>
            </TouchableOpacity>
          );
        }}
        ListHeaderComponent={
          <View style={styles.headerSegment}>
            {/* Hadith of the Day */}
            {!isSearching && (
              <>
                <Text style={styles.sectionTitle}>Hadith of the Day</Text>
                {loadingDaily ? (
                  <View style={styles.dailyLoader}>
                    <ActivityIndicator size="small" color={COLORS.gold} />
                  </View>
                ) : hadithOfDay ? (
                  <Card style={styles.dailyCard}>
                    <Text style={styles.quoteBgText}>“</Text>
                    <View style={styles.dailyHeaderRow}>
                      <View style={[styles.dailyBookBadge, { backgroundColor: getThemeMeta(hadithOfDay.book || hadithOfDay.bookName).bg }]}>
                        <Text style={[styles.dailyBookBadgeText, { color: getThemeMeta(hadithOfDay.book || hadithOfDay.bookName).text }]}>
                          {getThemeMeta(hadithOfDay.book || hadithOfDay.bookName).name}
                        </Text>
                      </View>
                      <Text style={styles.dailyNumber}>#{hadithOfDay.hadithNumber}</Text>
                    </View>
                    <ArabicText text={hadithOfDay.hadithArabic} size={18} style={styles.dailyArabic} />
                    {((language === 'ur') && hadithOfDay.urduNarrator) ? (
                      <Text style={[styles.dailyEnglish, styles.dailyNarrator, styles.rtlText]}>
                        {hadithOfDay.urduNarrator}
                      </Text>
                    ) : hadithOfDay.englishNarrator ? (
                      <Text style={[styles.dailyEnglish, styles.dailyNarrator]}>
                        {hadithOfDay.englishNarrator}
                      </Text>
                    ) : null}
                    <Text style={[styles.dailyEnglish, (language === 'ur') && styles.rtlText, (language === 'ur') && styles.urduScript]}>
                      {((language === 'ur') && hadithOfDay.hadithUrdu) ? hadithOfDay.hadithUrdu : hadithOfDay.hadithEnglish}
                    </Text>
                  </Card>
                ) : null}
              </>
            )}

            {/* Global Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color={COLORS.text3} style={styles.searchIcon} />
                <TextInput
                  placeholder="Search Hadiths across all collections..."
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

            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              {isSearching ? 'Search Results' : 'Hadith Collections'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          hadithStore.isLoading || searching ? (
            <View style={{ paddingHorizontal: 20 }}>
              <SkeletonLoader width="100%" height={160} style={styles.skeleton} />
              <SkeletonLoader width="100%" height={160} style={styles.skeleton} />
            </View>
          ) : (
            <EmptyState
              iconName="journal-outline"
              title="No Content Found"
              subtitle="Unable to find Hadiths matching your criteria. Please verify connection or try another search query."
            />
          )
        }
      />

      {/* Dynamic Simulated Audio Narration Widget */}
      {narratingHadith && (
        <View style={styles.simulatedAudioWidget}>
          <View style={styles.widgetMeta}>
            <View style={styles.avatarNarrator}>
              <Ionicons name="mic" size={16} color="#0A0E1A" />
            </View>
            <View style={styles.narratorMetaBox}>
              <Text style={styles.narratingTitle}>Oral Narration</Text>
              <Text style={styles.narratingSubtitle}>
                {getThemeMeta(narratingHadith.book || narratingHadith.bookName).name} • #{narratingHadith.hadithNumber}
              </Text>
            </View>
          </View>

          <View style={styles.visualizerRow}>
            {waveHeight.map((h, i) => (
              <View
                key={i}
                style={[
                  styles.visualizerBar,
                  {
                    height: isNarrating ? h : 4,
                    backgroundColor: isNarrating ? COLORS.teal : COLORS.text3,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.playerPlayBtn}
              onPress={() => setIsNarrating(!isNarrating)}
            >
              <Ionicons name={isNarrating ? 'pause' : 'play'} size={18} color="#0A0E1A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playerCloseBtn}
              onPress={() => {
                setIsNarrating(false);
                setNarratingHadith(null);
              }}
            >
              <Ionicons name="close" size={18} color={COLORS.text2} />
            </TouchableOpacity>
          </View>
        </View>
      )}

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

interface HadithItemProps {
  item: any;
  themeMeta: any;
  isBookmarked: boolean;
  isCurrentlyNarrating: boolean;
  isNarrating: boolean;
  language: string;
  onTriggerNarration: (item: any) => void;
  onToggleBookmark: () => Promise<void>;
  onCreateNote: (item: any) => void;
  onShare: (item: any) => void;
}

const HadithItem = React.memo<HadithItemProps>(({
  item,
  themeMeta,
  isBookmarked,
  isCurrentlyNarrating,
  isNarrating,
  language,
  onTriggerNarration,
  onToggleBookmark,
  onCreateNote,
  onShare,
}) => {
  const isUrdu = language === 'ur';
  const narratorText = (isUrdu && item.urduNarrator) ? item.urduNarrator : item.englishNarrator;
  const translationText = (isUrdu && item.hadithUrdu) ? item.hadithUrdu : item.hadithEnglish;

  return (
    <Card style={[styles.hadithCard, isCurrentlyNarrating && styles.hadithCardNarrating]}>
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
          onPress={() => onTriggerNarration(item)}
        >
          <Ionicons
            name={isCurrentlyNarrating && isNarrating ? 'pause-circle' : 'volume-high-outline'}
            size={16}
            color={isCurrentlyNarrating && isNarrating ? COLORS.teal : COLORS.text3}
          />
          <Text style={[styles.actionBtnText, isCurrentlyNarrating && isNarrating && { color: COLORS.teal }]}>
            {isCurrentlyNarrating && isNarrating ? 'Narrating' : 'Audio'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onToggleBookmark}
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

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onCreateNote(item)}
        >
          <Ionicons name="create-outline" size={16} color={COLORS.text3} />
          <Text style={styles.actionBtnText}>Note</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onShare(item)}
        >
          <Ionicons name="share-social-outline" size={16} color={COLORS.text3} />
          <Text style={styles.actionBtnText}>Share</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}, (prev, next) => {
  return (
    prev.item.hadithArabic === next.item.hadithArabic &&
    prev.item.hadithEnglish === next.item.hadithEnglish &&
    prev.isBookmarked === next.isBookmarked &&
    prev.isCurrentlyNarrating === next.isCurrentlyNarrating &&
    prev.isNarrating === next.isNarrating &&
    prev.themeMeta.text === next.themeMeta.text &&
    prev.language === next.language
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  listPadding: {
    paddingBottom: 110,
  },
  headerSegment: {
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dailyCard: {
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.15)',
    position: 'relative',
    overflow: 'hidden',
  },
  quoteBgText: {
    position: 'absolute',
    right: 16,
    top: -24,
    fontSize: 120,
    color: 'rgba(201, 168, 76, 0.05)',
    fontFamily: 'Amiri_700Bold',
  },
  dailyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  dailyBookBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dailyBookBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  dailyNumber: {
    color: COLORS.text3,
    fontSize: 12,
    fontWeight: 'bold',
  },
  dailyArabic: {
    color: COLORS.gold,
    lineHeight: 34,
    textAlign: 'right',
    marginBottom: 12,
  },
  dailyEnglish: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'left',
  },
  dailyLoader: {
    height: 120,
    marginHorizontal: 20,
    backgroundColor: COLORS.bg2,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 18,
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
  bookCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bg2,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.3,
  },
  bookIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bookMetaContainer: {
    flex: 1,
    paddingRight: 8,
  },
  bookTitleText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  bookDescText: {
    fontSize: 11,
    color: COLORS.text3,
    lineHeight: 15,
    marginBottom: 4,
  },
  bookCountsText: {
    fontSize: 10,
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  bookCardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flex: 0.7,
  },
  bookArabicName: {
    fontSize: 16,
    color: COLORS.text2,
    fontFamily: 'Amiri_700Bold',
    marginBottom: 4,
  },
  chevron: {
    marginTop: 2,
  },
  hadithCard: {
    marginHorizontal: 20,
    padding: 18,
    marginBottom: 12,
    backgroundColor: COLORS.bg2,
  },
  hadithCardNarrating: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(20, 184, 166, 0.03)',
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
    color: COLORS.text,
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
  dailyNarrator: {
    fontWeight: '600',
    color: COLORS.gold,
    marginBottom: 6,
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
    justifyContent: 'space-between',
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
  simulatedAudioWidget: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.25)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  widgetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.2,
  },
  avatarNarrator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  narratorMetaBox: {
    marginLeft: 10,
  },
  narratingTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  narratingSubtitle: {
    fontSize: 9,
    color: COLORS.text3,
    fontWeight: '600',
    marginTop: 2,
  },
  visualizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 30,
    marginHorizontal: 8,
  },
  visualizerBar: {
    width: 3,
    borderRadius: 1.5,
    marginHorizontal: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 0.8,
  },
  playerPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playerCloseBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
});
