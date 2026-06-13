import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ScrollView, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJuzDetail } from '../../../src/api/client';

import { useQuran } from '../../../src/hooks/useQuran';
import { AudioPlayer } from '../../../src/services/audioPlayer';
import { COLORS } from '../../../constants/theme';
import { useThemeContext } from '../../../src/context/ThemeContext';
import Card from '../../../components/ui/Card';
import GoldBadge from '../../../components/ui/GoldBadge';
import ArabicText from '../../../components/ui/ArabicText';
import AudioPlayerBar from '../../../components/AudioPlayerBar';
import DuaShareModal, { ShareData } from '../../../components/ui/DuaShareModal';

type ReadingMode = 'Normal' | 'Word-by-word' | '15-line';


export default function JuzReaderScreen() {
  const router = useRouter();
  const { juzId } = useLocalSearchParams<{ juzId: string }>();
  const juzNum = parseInt(juzId || '1');

  const quran = useQuran();

  // Component Refs
  const flatListRef = useRef<FlatList>(null);

  // States
  const [juzData, setJuzData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [readingMode, setReadingMode] = useState<ReadingMode>('Normal');
  const [scrollProgress, setScrollProgress] = useState(0);

  // Global Audio Synced States
  const [activePlayingVerse, setActivePlayingVerse] = useState<{ surah: number; verse: number } | null>(null);

  // Action Sheet / Long Press modal
  const [selectedVerseForAction, setSelectedVerseForAction] = useState<any | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  // Share Image State
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [verseToShare, setVerseToShare] = useState<ShareData | null>(null);

  // Mount logic
  useEffect(() => {
    loadJuzDetails();
  }, [juzId, quran.selectedTranslation]);

  // Sync state with global AudioPlayer service to highlight playing verse card
  useEffect(() => {
    const unsubscribe = AudioPlayer.subscribe((state) => {
      if (state.isPlaying && state.currentSurah && state.currentVerse) {
        setActivePlayingVerse({ surah: state.currentSurah, verse: state.currentVerse });
      } else {
        setActivePlayingVerse(null);
      }
    });
    return unsubscribe;
  }, []);

  const loadJuzDetails = async () => {
    const translation = quran.selectedTranslation;
    const cacheKey = `cached_juz_${juzNum}_${translation}`;
    
    try {
      setLoading(true);

      // 1. Try loading from local SQLite database first (Offline-First)
      const { getLocalJuzVerses } = require('../../../src/services/quranLocalDb');
      const localVerses = await getLocalJuzVerses(juzNum);
      if (localVerses && localVerses.length > 0) {
        const juzDetails = {
          number: juzNum,
          ayahs: localVerses,
        };
        setJuzData(juzDetails);
        setLoading(false);

        // If online, refresh silently in the background
        fetchJuzFromApi(juzNum, translation, cacheKey);
        return;
      }

      // 2. Try displaying cached data instantly (Stale-While-Revalidate)
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setJuzData(parsed);
        setLoading(false);
        
        // Background fetch to update silently
        fetchJuzFromApi(juzNum, translation, cacheKey);
        return;
      }

      // 3. Fetch from API if no cache exists
      await fetchJuzFromApi(juzNum, translation, cacheKey);
    } catch (e) {
      console.warn('Failed to load Juz details:', e);
      setLoading(false);
    }
  };

  const fetchJuzFromApi = async (juzNumber: number, translation: string, cacheKey: string) => {
    try {
      const data = await getJuzDetail(juzNumber, translation || 'en.sahih');

      const juzDetails = {
        number: juzNumber,
        ayahs: data.ayahs,
      };

      setJuzData(juzDetails);
      setLoading(false);

      // Save to cache
      await AsyncStorage.setItem(cacheKey, JSON.stringify(juzDetails));
    } catch (err) {
      console.warn('API fetch for Juz failed:', err);
    }
  };

  // Scroll handler computing top progress
  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const containerHeight = event.nativeEvent.layoutMeasurement.height;

    if (contentHeight > containerHeight) {
      const progress = offsetY / (contentHeight - containerHeight);
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    }
  };

  const handlePlayVerse = (item: any) => {
    const state = AudioPlayer.getState();
    const isThisVerseLoaded = state.currentSurah === item.surah.number && state.currentVerse === item.numberInSurah;

    if (isThisVerseLoaded) {
      if (state.isPlaying) {
        AudioPlayer.pause();
      } else {
        AudioPlayer.play();
      }
    } else {
      AudioPlayer.loadVerse(item.surah.number, item.numberInSurah);
    }
  };

  const handleToggleVerseBookmark = async (item: any, isBookmarked: boolean) => {
    const refId = `${item.surah.number}:${item.numberInSurah}`;
    if (isBookmarked) {
      await quran.removeBookmark(refId);
    } else {
      await quran.addBookmark({
        type: 'quran',
        refId,
        arabicText: item.text,
        translation: item.translation || '',
        reference: `${item.surah.englishName} (${item.surah.number}:${item.numberInSurah})`,
      });
    }
  };

  const handleCreateVerseNote = (item: any) => {
    router.push({
      pathname: '/quran/bookmarks',
      params: {
        addNoteRef: `${item.surah.number}:${item.numberInSurah}`,
        arabicText: item.text,
        reference: `${item.surah.englishName} (${item.surah.number}:${item.numberInSurah})`,
      },
    });
  };

  // Actionsheet Triggers
  const handleLongPressVerse = (verse: any) => {
    setSelectedVerseForAction(verse);
    setActionSheetVisible(true);
  };

  const handleToggleBookmark = async () => {
    if (!selectedVerseForAction) return;
    const refId = `${selectedVerseForAction.surah.number}:${selectedVerseForAction.numberInSurah}`;
    const bookmarked = quran.bookmarks.some((b) => b.refId === refId);

    if (bookmarked) {
      await quran.removeBookmark(refId);
    } else {
      await quran.addBookmark({
        type: 'quran',
        refId,
        arabicText: selectedVerseForAction.text,
        translation: selectedVerseForAction.translation || '',
        reference: `${selectedVerseForAction.surah.englishName} (${selectedVerseForAction.surah.number}:${selectedVerseForAction.numberInSurah})`,
      });
    }
    setActionSheetVisible(false);
  };

  const handleShareVerse = (verse: any) => {
    setVerseToShare({
      title: `${verse.surah.englishName}`,
      arabic: verse.text,
      translation: verse.translation || '',
      reference: `${verse.surah.englishName} (${verse.surah.number}:${verse.numberInSurah})`,
      contentType: 'ayah',
    });
    setShareModalVisible(true);
  };

  const handleShare = () => {
    if (!selectedVerseForAction) return;
    setActionSheetVisible(false);
    handleShareVerse(selectedVerseForAction);
  };

  const handlePlayAudio = () => {
    if (!selectedVerseForAction) return;
    AudioPlayer.loadVerse(selectedVerseForAction.surah.number, selectedVerseForAction.numberInSurah);
    setActionSheetVisible(false);
  };

  const handleAddNote = () => {
    if (!selectedVerseForAction) return;
    setActionSheetVisible(false);
    router.push({
      pathname: '/quran/bookmarks',
      params: {
        addNoteRef: `${selectedVerseForAction.surah.number}:${selectedVerseForAction.numberInSurah}`,
        arabicText: selectedVerseForAction.text,
        reference: `${selectedVerseForAction.surah.englishName} (${selectedVerseForAction.surah.number}:${selectedVerseForAction.numberInSurah})`,
      },
    });
  };

  const themeCtx = useThemeContext();
  const isDark = themeCtx?.theme === 'dark';

  const renderJuzMushafPages = () => {
    if (!juzData?.ayahs) return null;

    // Group ayahs by surah
    const groups: { surah: any; ayahs: any[] }[] = [];
    juzData.ayahs.forEach((ayah: any) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.surah.number === ayah.surah.number) {
        lastGroup.ayahs.push(ayah);
      } else {
        groups.push({
          surah: ayah.surah,
          ayahs: [ayah],
        });
      }
    });

    return groups.map((group) => (
      <View key={group.surah.number} style={{ marginBottom: 30 }}>
        {/* Beautiful Ornate Surah Header */}
        <View style={styles.mushafSurahHeader}>
          <ArabicText text={group.surah.name} size={22} style={styles.mushafSurahTitleAr} />
          <Text style={styles.mushafSurahTitleEn}>Surah {group.surah.englishName}</Text>
        </View>

        {/* Bismillah if not At-Tawbah and starting from Ayah 1 of that Surah */}
        {group.surah.number !== 9 && group.ayahs[0].numberInSurah === 1 && (
          <Text style={styles.mushafBismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
        )}

        <View style={[styles.mushafPaper, { backgroundColor: isDark ? '#141c2c' : '#FDFAF3', borderColor: isDark ? 'rgba(201, 168, 76, 0.25)' : 'rgba(201, 168, 76, 0.5)' }]}>
          <View style={[styles.mushafFrame, { borderColor: isDark ? 'rgba(201, 168, 76, 0.2)' : 'rgba(201, 168, 76, 0.4)' }]}>
            <Text style={[styles.mushafPageText, { color: isDark ? '#F0EAD6' : '#2B2620' }]}>
              {group.ayahs.filter((ayah: any) => ayah.numberInSurah > 1 || group.surah.number === 9).map((ayah: any) => {
                const isPlayingThis =
                  activePlayingVerse?.surah === ayah.surah.number && activePlayingVerse?.verse === ayah.numberInSurah;
                return (
                  <Text
                    key={`${ayah.surah.number}_${ayah.numberInSurah}`}
                    onPress={() => handlePlayVerse(ayah)}
                    onLongPress={() => handleLongPressVerse(ayah)}
                    style={[
                      styles.mushafVerseText,
                      isPlayingThis && styles.mushafVersePlaying,
                      isPlayingThis && { color: COLORS.teal }
                    ]}
                  >
                    {ayah.text}
                    <Text style={styles.mushafVerseNumber}> ﴿{ayah.numberInSurah}﴾ </Text>
                  </Text>
                );
              })}
            </Text>
          </View>
        </View>
      </View>
    ));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Fetching Juz verses...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom', 'top']}>
      {/* Scroll Progress Indicator Bar at Screen Top */}
      <View style={[styles.progressBar, { width: `${scrollProgress * 100}%` }]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/quran');
            }
          }} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitleEnglish}>Juz {juzNum}</Text>
          <Text style={styles.headerSubtitle}>
            {juzData?.ayahs?.length || 0} Verses
          </Text>
        </View>
        <Text style={[styles.headerTitleArabic, { fontSize: 20, color: COLORS.gold2, fontFamily: 'Amiri_700Bold' }]}>الجزء {juzNum}</Text>
      </View>

      {/* Reading Mode Toolbar */}
      <View style={styles.modeToolbar}>
        {(['Normal', 'Word-by-word', '15-line'] as const).map((mode) => {
          const active = readingMode === mode;
          return (
            <TouchableOpacity
              key={mode}
              style={[styles.modeButton, active && styles.modeButtonActive]}
              onPress={() => setReadingMode(mode)}
            >
              <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Verse Rendering Body */}
      {readingMode === '15-line' ? (
        <ScrollView contentContainerStyle={styles.mushafContainer}>
          {renderJuzMushafPages()}
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={juzData?.ayahs}
          keyExtractor={(item) => `${item.surah.number}_${item.numberInSurah}`}
          onScroll={handleScroll}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          contentContainerStyle={styles.listPadding}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          renderItem={({ item }) => {
            const isWordByWord = readingMode === 'Word-by-word';
            const isBookmarked = quran.bookmarks.some(
              (b) => b.refId === `${item.surah.number}:${item.numberInSurah}`
            );
            const isPlayingThis =
              activePlayingVerse?.surah === item.surah.number && activePlayingVerse?.verse === item.numberInSurah;

            return (
              <JuzVerseItem
                item={item}
                isWordByWord={isWordByWord}
                isBookmarked={isBookmarked}
                isPlayingThis={isPlayingThis}
                selectedTranslation={quran.selectedTranslation}
                onLongPress={handleLongPressVerse}
                onPlay={handlePlayVerse}
                onBookmark={handleToggleVerseBookmark}
                onNote={handleCreateVerseNote}
                onShare={handleShareVerse}
              />
            );
          }}
        />
      )}

      {/* Custom Bottom Modal ActionSheet */}
      {actionSheetVisible && selectedVerseForAction && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setActionSheetVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalDragHandle} />
            <Text style={styles.modalTitle}>
              {selectedVerseForAction.surah.englishName} ({selectedVerseForAction.surah.number}:{selectedVerseForAction.numberInSurah}) Options
            </Text>

            <TouchableOpacity style={styles.modalRow} onPress={handleToggleBookmark}>
              <Ionicons
                name={
                  quran.bookmarks.some(
                    (b) => b.refId === `${selectedVerseForAction.surah.number}:${selectedVerseForAction.numberInSurah}`
                  )
                    ? 'bookmark'
                    : 'bookmark-outline'
                }
                size={22}
                color={COLORS.gold}
              />
              <Text style={styles.modalRowText}>
                {quran.bookmarks.some(
                  (b) => b.refId === `${selectedVerseForAction.surah.number}:${selectedVerseForAction.numberInSurah}`
                )
                  ? 'Remove Bookmark'
                  : 'Bookmark Verse'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalRow} onPress={handlePlayAudio}>
              <Ionicons name="play-circle-outline" size={22} color={COLORS.teal} />
              <Text style={styles.modalRowText}>Play Recitation Audio</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalRow} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color={COLORS.gold} />
              <Text style={styles.modalRowText}>Share Verse Text</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalRow} onPress={handleAddNote}>
              <Ionicons name="create-outline" size={22} color={COLORS.teal} />
              <Text style={styles.modalRowText}>Add Study Notes & Reflections</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalRow, styles.modalCloseRow]}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Audio Bar */}
      <View style={styles.floatingAudioBarWrapper}>
        <AudioPlayerBar />
      </View>

      <DuaShareModal
        visible={shareModalVisible}
        shareData={verseToShare}
        onClose={() => {
          setShareModalVisible(false);
          setVerseToShare(null);
        }}
      />
    </SafeAreaView>
  );
}

interface JuzVerseItemProps {
  item: any;
  isWordByWord: boolean;
  isBookmarked: boolean;
  isPlayingThis: boolean;
  selectedTranslation: string;
  onLongPress: (item: any) => void;
  onPlay: (item: any) => void;
  onBookmark: (item: any, isBookmarked: boolean) => void;
  onNote: (item: any) => void;
  onShare: (item: any) => void;
}

const JuzVerseItem = React.memo<JuzVerseItemProps>(({
  item,
  isWordByWord,
  isBookmarked,
  isPlayingThis,
  selectedTranslation,
  onLongPress,
  onPlay,
  onBookmark,
  onNote,
  onShare,
}) => {
  const themeCtx = useThemeContext();
  const multiplier = themeCtx?.multiplier || 1.0;
  const isDark = themeCtx?.theme === 'dark';
  const playingBg = isDark ? 'rgba(20, 184, 166, 0.04)' : '#EBF7F5';

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(item)}
      delayLongPress={300}
      activeOpacity={0.9}
    >
      <Card style={[
        styles.verseCard,
        isPlayingThis && styles.verseCardPlaying,
        isPlayingThis && { backgroundColor: playingBg }
      ]}>
        {/* Card top reference line */}
        <View style={styles.verseHeader}>
          <View style={styles.verseHeaderLeft}>
            <View style={styles.verseNumberBadge}>
              <Text style={styles.verseNumberText}>{item.numberInSurah}</Text>
            </View>
            <Text style={styles.verseRefText}>
              {item.surah.englishName} ({item.surah.number}:{item.numberInSurah})
            </Text>
          </View>
          <View style={styles.cardActionsRow}>
            {isBookmarked && (
              <Ionicons name="bookmark" size={16} color={COLORS.gold} style={styles.actionIcon} />
            )}
            {isPlayingThis && (
              <Ionicons name="volume-high" size={16} color={COLORS.teal} style={styles.actionIcon} />
            )}
          </View>
        </View>

        {/* Words rendering block */}
        {isWordByWord ? (
          <View style={styles.wordsGrid}>
            {item.text.split(' ').map((word: string, wIdx: number) => (
              <View key={wIdx} style={styles.wordBox}>
                <Text style={styles.arabicWord}>{word}</Text>
                <Text style={styles.wordTranslation}>Word {wIdx + 1}</Text>
              </View>
            ))}
          </View>
        ) : (
          <ArabicText text={item.text} size={22} style={styles.arabicVerseText} />
        )}

        {/* Translation Row */}
        {!isWordByWord && selectedTranslation !== 'none' && (
          <Text
            style={[
              styles.translationText,
              { fontSize: (selectedTranslation.toLowerCase().includes('ur') ? 15 : 14) * multiplier },
              selectedTranslation.toLowerCase().includes('ur') && {
                textAlign: 'right',
                writingDirection: 'rtl',
                lineHeight: 24 * multiplier
              }
            ]}
          >
            {item.translation}
          </Text>
        )}

        {/* Discoverable Verse Action Tray */}
        <View style={styles.actionTray}>
          <TouchableOpacity
            style={styles.actionTrayBtn}
            onPress={() => onPlay(item)}
          >
            <Ionicons
              name={isPlayingThis ? 'pause-circle' : 'play-outline'}
              size={16}
              color={isPlayingThis ? COLORS.teal : COLORS.text3}
            />
            <Text style={[styles.actionTrayBtnText, isPlayingThis && { color: COLORS.teal }]}>
              {isPlayingThis ? 'Playing' : 'Play'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTrayBtn}
            onPress={() => onBookmark(item, isBookmarked)}
          >
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isBookmarked ? COLORS.gold : COLORS.text3}
            />
            <Text style={[styles.actionTrayBtnText, isBookmarked && { color: COLORS.gold }]}>
              {isBookmarked ? 'Bookmarked' : 'Bookmark'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTrayBtn}
            onPress={() => onNote(item)}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={COLORS.text3}
            />
            <Text style={styles.actionTrayBtnText}>Note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTrayBtn}
            onPress={() => onShare(item)}
          >
            <Ionicons name="share-social-outline" size={16} color={COLORS.text3} />
            <Text style={styles.actionTrayBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.text2,
    marginTop: 12,
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressBar: {
    height: 3,
    backgroundColor: COLORS.gold,
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(201, 168, 76, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitleEnglish: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  headerTitleArabic: {
    color: COLORS.gold2,
  },
  modeToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.bg2,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
    padding: 4,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: COLORS.bg3,
  },
  modeText: {
    color: COLORS.text3,
    fontSize: 12,
    fontWeight: 'bold',
  },
  modeTextActive: {
    color: COLORS.gold,
  },
  listPadding: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 130,
  },
  verseCard: {
    padding: 18,
    marginBottom: 12,
  },
  verseCardPlaying: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(20, 184, 166, 0.04)',
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  verseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verseRefText: {
    color: COLORS.text2,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  verseNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verseNumberText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: 'bold',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    marginLeft: 8,
  },
  arabicVerseText: {
    color: COLORS.gold,
    lineHeight: 44,
    textAlign: 'right',
  },
  translationText: {
    fontSize: 13,
    color: COLORS.text2,
    lineHeight: 19,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'left',
  },
  wordsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  wordBox: {
    alignItems: 'center',
    margin: 6,
    backgroundColor: COLORS.bg3,
    padding: 8,
    borderRadius: 6,
  },
  arabicWord: {
    fontSize: 18,
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  wordTranslation: {
    fontSize: 9,
    color: COLORS.text3,
    marginTop: 4,
  },
  mushafContainer: {
    padding: 16,
    paddingBottom: 140,
  },
  mushafSurahHeader: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.2)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  mushafSurahTitleAr: {
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  mushafSurahTitleEn: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mushafBismillah: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold2,
    textAlign: 'center',
    marginVertical: 16,
  },
  mushafPaper: {
    borderRadius: 16,
    padding: 5,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 20,
  },
  mushafFrame: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  mushafPageText: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    lineHeight: 52,
    textAlign: 'center',
  },
  mushafVerseText: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold,
  },
  mushafVersePlaying: {
    color: COLORS.teal,
    textShadowColor: 'rgba(20, 184, 166, 0.25)',
    textShadowRadius: 6,
  },
  mushafVerseNumber: {
    color: COLORS.gold,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: COLORS.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.bg3,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.bg3,
  },
  modalRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 16,
  },
  modalCloseRow: {
    borderBottomWidth: 0,
    justifyContent: 'center',
    marginTop: 10,
  },
  modalCloseText: {
    color: COLORS.teal,
    fontWeight: 'bold',
    fontSize: 14,
  },
  floatingAudioBarWrapper: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    zIndex: 999,
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
  actionTrayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  actionTrayBtnText: {
    fontSize: 10,
    color: COLORS.text3,
    marginLeft: 4,
    fontWeight: 'bold',
  },
});
