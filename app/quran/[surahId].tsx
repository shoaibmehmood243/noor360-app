import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ScrollView, TouchableOpacity, Share, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useQuran } from '../../src/hooks/useQuran';
import { AudioPlayer } from '../../src/services/audioPlayer';
import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';
import Card from '../../components/ui/Card';
import GoldBadge from '../../components/ui/GoldBadge';
import ArabicText from '../../components/ui/ArabicText';
import AudioPlayerBar from '../../components/AudioPlayerBar';
import DuaShareModal, { ShareData } from '../../components/ui/DuaShareModal';

type ReadingMode = 'Normal' | 'Word-by-word' | '15-line';

export default function SurahReaderScreen() {
  const router = useRouter();
  const { surahId, highlightVerse } = useLocalSearchParams<{ surahId: string; highlightVerse?: string }>();
  const surahNum = parseInt(surahId || '1');

  const quran = useQuran();

  // Component Refs
  const flatListRef = useRef<FlatList>(null);

  // States
  const [surahData, setSurahData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [readingMode, setReadingMode] = useState<ReadingMode>('Normal');
  const [scrollProgress, setScrollProgress] = useState(0);

  // Global Audio Synced States
  const [activePlayingVerse, setActivePlayingVerse] = useState<number | null>(null);

  // Action Sheet / Long Press modal
  const [selectedVerseForAction, setSelectedVerseForAction] = useState<any | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  // Share Image State
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [verseToShare, setVerseToShare] = useState<ShareData | null>(null);

  // Mount logic
  useEffect(() => {
    loadSurahDetails();
  }, [surahId, quran.selectedTranslation]);

  // Sync state with global AudioPlayer service to highlight playing verse card
  useEffect(() => {
    const unsubscribe = AudioPlayer.subscribe((state) => {
      if (state.currentSurah === surahNum && state.isPlaying) {
        setActivePlayingVerse(state.currentVerse);
      } else {
        setActivePlayingVerse(null);
      }
    });
    return unsubscribe;
  }, [surahNum]);

  const loadSurahDetails = async () => {
    try {
      setLoading(true);
      const data = await quran.fetchSurah(surahNum);

      // Manually remove the first index in the array (Bismillah) if not Surah 9 (At-Tawba)
      // if (surahNum !== 9 && data?.ayahs?.length > 0) {
      //   data.ayahs.shift();
      //   data.ayahs.forEach((ayah: any, index: number) => {
      //     ayah.numberInSurah = index + 1;
      //   });
      // }

      setSurahData(data);

      // Auto scroll logic to highlighted verse or lastRead
      setTimeout(() => {
        let targetIndex = 0;
        if (highlightVerse) {
          targetIndex = parseInt(highlightVerse) - 1;
        } else {
          const matched = quran.recentlyRead.find((r) => r.surahId === surahNum);
          if (matched) {
            targetIndex = matched.verseNumber - 1;
          }
        }

        if (targetIndex > 0 && data?.ayahs?.length > targetIndex) {
          flatListRef.current?.scrollToIndex({
            index: targetIndex,
            animated: true,
            viewPosition: 0.3,
          });
        }
      }, 700);
    } catch (e) {
      console.warn('Failed to load Surah details:', e);
    } finally {
      setLoading(false);
    }
  };

  // Scroll handler computing top progress and saving position every 5 verses
  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const containerHeight = event.nativeEvent.layoutMeasurement.height;

    if (contentHeight > containerHeight) {
      const progress = offsetY / (contentHeight - containerHeight);
      setScrollProgress(Math.max(0, Math.min(1, progress)));
    }
  };

  // Tracking current viewable verses to save position every 5 verses
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const topItem = viewableItems[0];
      const verseNumber = topItem.index + 1;

      // Save reading position at intervals of 5 verses
      if (verseNumber % 5 === 0 && surahData) {
        quran.setLastRead(surahNum, verseNumber);
      }
    }
  }).current;

  const handlePlayVerse = (item: any) => {
    const state = AudioPlayer.getState();
    const isThisVerseLoaded = state.currentSurah === surahNum && state.currentVerse === item.numberInSurah;

    if (isThisVerseLoaded) {
      if (state.isPlaying) {
        AudioPlayer.pause();
      } else {
        AudioPlayer.play();
      }
    } else {
      AudioPlayer.loadVerse(surahNum, item.numberInSurah);
    }
  };

  const handleToggleVerseBookmark = async (item: any, isBookmarked: boolean) => {
    const refId = `${surahNum}:${item.numberInSurah}`;
    if (isBookmarked) {
      await quran.removeBookmark(refId);
    } else {
      await quran.addBookmark({
        type: 'quran',
        refId,
        arabicText: item.text,
        translation: item.translation || '',
        reference: `Surah ${surahData?.englishName || ''} (${surahNum}:${item.numberInSurah})`,
      });
    }
  };

  const handleCreateVerseNote = (item: any) => {
    router.push({
      pathname: '/quran/bookmarks',
      params: {
        addNoteRef: `${surahNum}:${item.numberInSurah}`,
        arabicText: item.text,
        reference: `Surah ${surahData?.englishName || ''} (${surahNum}:${item.numberInSurah})`,
      },
    });
  };

  // Actionsheet Triggers
  const handleLongPressVerse = (verse: any) => {
    setSelectedVerseForAction(verse);
    setActionSheetVisible(true);
  };

  const handleToggleBookmark = async () => {
    if (!selectedVerseForAction || !surahData) return;
    const refId = `${surahNum}:${selectedVerseForAction.numberInSurah}`;
    const bookmarked = quran.bookmarks.some((b) => b.refId === refId);

    if (bookmarked) {
      await quran.removeBookmark(refId);
    } else {
      await quran.addBookmark({
        type: 'quran',
        refId,
        arabicText: selectedVerseForAction.text,
        translation: selectedVerseForAction.translation || '',
        reference: `Surah ${surahData.englishName} (${surahNum}:${selectedVerseForAction.numberInSurah})`,
      });
    }
    setActionSheetVisible(false);
  };

  const handleShareVerse = (verse: any) => {
    if (!surahData) return;
    setVerseToShare({
      title: `Surah ${surahData.englishName}`,
      arabic: verse.text,
      translation: verse.translation || '',
      reference: `Surah ${surahData.englishName} (${surahNum}:${verse.numberInSurah})`,
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
    AudioPlayer.loadVerse(surahNum, selectedVerseForAction.numberInSurah);
    setActionSheetVisible(false);
  };

  const handleAddNote = () => {
    if (!selectedVerseForAction || !surahData) return;
    setActionSheetVisible(false);
    router.push({
      pathname: '/quran/bookmarks',
      params: {
        addNoteRef: `${surahNum}:${selectedVerseForAction.numberInSurah}`,
        arabicText: selectedVerseForAction.text,
        reference: `Surah ${surahData.englishName} (${surahNum}:${selectedVerseForAction.numberInSurah})`,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.gold} />
        <Text style={styles.loadingText}>Fetching divine script...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom', 'top']}>
      {/* Scroll Progress Indicator Bar at Screen Top */}
      <View style={[styles.progressBar, { width: `${scrollProgress * 100}%` }]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gold} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitleEnglish}>{surahData?.englishName}</Text>
          <Text style={styles.headerSubtitle}>
            {surahData?.numberOfAyahs} Ayahs • {surahData?.revelationType}
          </Text>
        </View>
        <ArabicText text={surahData?.name} size={22} style={styles.headerTitleArabic} />
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
          {/* {surahNum !== 9 && (
            <Text style={styles.bismillahArabic}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          )} */}
          <View style={styles.mushafPage}>
            {surahData?.ayahs?.map((ayah: any) => (
              <Text key={ayah.numberInSurah} style={styles.mushafVerseText}>
                {ayah.text}
                <Text style={styles.mushafVerseNumber}> ﴿{ayah.numberInSurah}﴾ </Text>
              </Text>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={flatListRef}
          data={surahData?.ayahs}
          keyExtractor={(item) => item.numberInSurah.toString()}
          onScroll={handleScroll}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }}
          contentContainerStyle={styles.listPadding}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          getItemLayout={(data, index) => ({ length: 180, offset: 180 * index, index })}
          ListHeaderComponent={null}
          renderItem={({ item }) => {
            const isWordByWord = readingMode === 'Word-by-word';
            const isBookmarked = quran.bookmarks.some(
              (b) => b.refId === `${surahNum}:${item.numberInSurah}`
            );
            const isPlayingThis = activePlayingVerse === item.numberInSurah;

            return (
              <VerseItem
                item={item}
                surahNum={surahNum}
                englishName={surahData?.englishName || ''}
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
              Verse {selectedVerseForAction.numberInSurah} Options
            </Text>

            <TouchableOpacity style={styles.modalRow} onPress={handleToggleBookmark}>
              <Ionicons
                name={
                  quran.bookmarks.some(
                    (b) => b.refId === `${surahNum}:${selectedVerseForAction.numberInSurah}`
                  )
                    ? 'bookmark'
                    : 'bookmark-outline'
                }
                size={22}
                color={COLORS.gold}
              />
              <Text style={styles.modalRowText}>
                {quran.bookmarks.some(
                  (b) => b.refId === `${surahNum}:${selectedVerseForAction.numberInSurah}`
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

      {/* Integrated Centralized AudioPlayerBar Component */}
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

interface VerseItemProps {
  item: any;
  surahNum: number;
  englishName: string;
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

const VerseItem = React.memo<VerseItemProps>(({
  item,
  surahNum,
  englishName,
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
          <View style={styles.verseNumberBadge}>
            <Text style={styles.verseNumberText}>{item.numberInSurah}</Text>
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
}, (prev, next) => {
  return (
    prev.item.text === next.item.text &&
    prev.item.translation === next.item.translation &&
    prev.isWordByWord === next.isWordByWord &&
    prev.isBookmarked === next.isBookmarked &&
    prev.isPlayingThis === next.isPlayingThis &&
    prev.selectedTranslation === next.selectedTranslation
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
    paddingBottom: 130, // accommodates floating bottom audio player controller
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
    padding: 24,
    paddingBottom: 130,
  },
  bismillahArabic: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold2,
    textAlign: 'center',
    marginVertical: 18,
  },
  bismillahHeaderCard: {
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg2,
    borderColor: 'rgba(201, 168, 76, 0.1)',
    borderWidth: 0.5,
  },
  bismillahArabicText: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold2,
    textAlign: 'center',
    marginBottom: 8,
  },
  bismillahTranslationText: {
    fontSize: 12,
    color: COLORS.text3,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  mushafPage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  mushafVerseText: {
    fontSize: 22,
    fontFamily: 'Amiri_700Bold',
    color: COLORS.gold,
    lineHeight: 48,
    textAlign: 'center',
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
