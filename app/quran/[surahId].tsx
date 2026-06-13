import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ScrollView, TouchableOpacity, Share, ActivityIndicator, Alert } from 'react-native';
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
import ScreenBackground from '../../components/ui/ScreenBackground';
import {
  isSurahDownloaded,
  downloadFullSurah,
  deleteDownloadedSurah,
  cancelSurahDownload
} from '../../src/services/quranOfflineManager';

type ReadingMode = 'Normal' | 'Word-by-word' | '15-line';


export default function SurahReaderScreen() {
  const router = useRouter();
  const { surahId, highlightVerse } = useLocalSearchParams<{ surahId: string; highlightVerse?: string }>();
  const surahNum = parseInt(surahId || '1');

  const quran = useQuran();

  // Component Refs
  const flatListRef = useRef<FlatList>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // States
  const [surahData, setSurahData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [readingMode, setReadingMode] = useState<ReadingMode>('Normal');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeVisibleVerse, setActiveVisibleVerse] = useState<number | null>(null);

  // Global Audio Synced States
  const [activePlayingVerse, setActivePlayingVerse] = useState<number | null>(null);

  // Action Sheet / Long Press modal
  const [selectedVerseForAction, setSelectedVerseForAction] = useState<any | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  // Share Image State
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [verseToShare, setVerseToShare] = useState<ShareData | null>(null);

  // Offline Playback / Downloads States
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Mount logic
  useEffect(() => {
    loadSurahDetails();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [surahId, quran.selectedTranslation]);

  // Check offline status on data load or change
  const checkOfflineStatus = async () => {
    if (!surahNum) return;
    let activeReciter = 'ar.alafasy';
    try {
      const { usePreferencesStore } = require('../../src/store/usePreferencesStore');
      activeReciter = usePreferencesStore.getState().selectedReciter || 'ar.alafasy';
    } catch (e) {}
    const downloaded = await isSurahDownloaded(surahNum, activeReciter);
    setIsDownloaded(downloaded);
  };

  useEffect(() => {
    if (surahData) {
      checkOfflineStatus();
    }
  }, [surahData]);

  const handleToggleOffline = async () => {
    if (!surahData) return;
    let activeReciter = 'ar.alafasy';
    try {
      const { usePreferencesStore } = require('../../src/store/usePreferencesStore');
      activeReciter = usePreferencesStore.getState().selectedReciter || 'ar.alafasy';
    } catch (e) {}

    if (isDownloaded) {
      Alert.alert(
        'Delete Offline Audio',
        `Are you sure you want to remove offline audio files for Surah ${surahData.englishName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteDownloadedSurah(surahNum, surahData.numberOfAyahs, activeReciter);
                setIsDownloaded(false);
              } catch (e) {
                console.warn('Failed to delete offline audio:', e);
              }
            }
          }
        ]
      );
    } else {
      if (isDownloading) {
        cancelSurahDownload(surahNum, activeReciter);
        setIsDownloading(false);
        setDownloadProgress(0);
        return;
      }

      setIsDownloading(true);
      setDownloadProgress(0);
      try {
        await downloadFullSurah(
          surahNum,
          surahData.numberOfAyahs,
          activeReciter,
          (progress) => {
            setDownloadProgress(progress);
          }
        );
        setIsDownloaded(true);
        Alert.alert('Download Complete', `Surah ${surahData.englishName} is now available offline!`);
      } catch (e: any) {
        if (e.message !== 'Download cancelled by user.') {
          Alert.alert('Download Failed', e.message || 'Unable to download surah audio.');
        }
      } finally {
        setIsDownloading(false);
        setDownloadProgress(0);
      }
    }
  };

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
          setActiveVisibleVerse(targetIndex + 1);
        } else {
          setActiveVisibleVerse(1);
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

  // Tracking current viewable verses to save position
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0 && surahData) {
      const topItem = viewableItems[0];
      const verseNumber = topItem.index + 1;
      
      setActiveVisibleVerse(verseNumber);

      // Debounce the store/DB write to make scrolling buttery smooth at 60 FPS
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        quran.setLastRead(surahNum, verseNumber);
      }, 1500);
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

  const themeCtx = useThemeContext();
  const isDark = themeCtx?.theme === 'dark';

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
      <ScreenBackground />
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
          <Text style={styles.headerTitleEnglish}>{surahData?.englishName}</Text>
          <Text style={styles.headerSubtitle}>
            {surahData?.numberOfAyahs} Ayahs • {surahData?.revelationType}
          </Text>
        </View>
        <TouchableOpacity onPress={handleToggleOffline} style={styles.downloadButton}>
          {isDownloading ? (
            <View style={styles.downloadProgressContainer}>
              <ActivityIndicator size="small" color={COLORS.gold} />
              <Text style={styles.progressText}>{Math.round(downloadProgress * 100)}%</Text>
            </View>
          ) : (
            <Ionicons
              name={isDownloaded ? "cloud-done" : "cloud-download-outline"}
              size={22}
              color={isDownloaded ? COLORS.gold : COLORS.text3}
            />
          )}
        </TouchableOpacity>
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
          {/* Beautiful Ornate Surah Header */}
          <View style={styles.mushafSurahHeader}>
            <ArabicText text={surahData?.name} size={22} style={styles.mushafSurahTitleAr} />
            <Text style={styles.mushafSurahTitleEn}>Surah {surahData?.englishName}</Text>
          </View>

          {/* Bismillah if not At-Tawbah */}
          {surahNum !== 9 && (
            <Text style={styles.mushafBismillah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
          )}

          <View style={[styles.mushafPaper, { backgroundColor: isDark ? '#141c2c' : '#FDFAF3', borderColor: isDark ? 'rgba(201, 168, 76, 0.25)' : 'rgba(201, 168, 76, 0.5)' }]}>
            <View style={[styles.mushafFrame, { borderColor: isDark ? 'rgba(201, 168, 76, 0.2)' : 'rgba(201, 168, 76, 0.4)' }]}>
              <Text style={[styles.mushafPageText, { color: isDark ? '#F0EAD6' : '#2B2620' }]}>
                {surahData?.ayahs?.filter((ayah: any) => ayah.numberInSurah > 1 || surahNum === 9).map((ayah: any) => {
                  const isPlayingThis = activePlayingVerse === ayah.numberInSurah;
                  return (
                    <Text
                      key={ayah.numberInSurah}
                      onPress={() => handlePlayVerse(ayah)}
                      onLongPress={() => handleLongPressVerse(ayah)}
                      style={[
                        styles.mushafVerseText,
                        isPlayingThis && styles.mushafVersePlaying,
                        isPlayingThis && { color: COLORS.gold }
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
            const isActive = activeVisibleVerse === item.numberInSurah;

            return (
              <VerseItem
                item={item}
                surahNum={surahNum}
                englishName={surahData?.englishName || ''}
                isWordByWord={isWordByWord}
                isBookmarked={isBookmarked}
                isPlayingThis={isPlayingThis}
                isActive={isActive}
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
  isActive: boolean;
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
  isActive,
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
  const activeBg = isDark ? 'rgba(201, 168, 76, 0.03)' : '#FAF9F2';

  return (
    <TouchableOpacity
      onLongPress={() => onLongPress(item)}
      delayLongPress={300}
      activeOpacity={0.9}
      style={{ opacity: isActive ? 1.0 : 0.8 }}
    >
      <Card style={[
        styles.verseCard,
        isActive && styles.verseCardActive,
        isActive && { backgroundColor: activeBg },
        isPlayingThis && styles.verseCardPlaying,
        isPlayingThis && { backgroundColor: playingBg }
      ]}>
        {/* Card top reference line */}
        <View style={styles.verseHeader}>
          <View style={styles.verseNumberBadge}>
            <Text style={styles.verseNumberText}>{item.numberInSurah}</Text>
          </View>
          <View style={styles.cardActionsRow}>
            {isActive && (
              <View style={styles.lastReadBadge}>
                <Ionicons name="book" size={10} color="#0A0E1A" style={{ marginRight: 3 }} />
                <Text style={styles.lastReadBadgeText}>Reading</Text>
              </View>
            )}
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
              color={isPlayingThis ? COLORS.gold : COLORS.text3}
            />
            <Text style={[styles.actionTrayBtnText, isPlayingThis && { color: COLORS.gold }]}>
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
  downloadButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  downloadProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 10,
    color: COLORS.gold,
    fontWeight: 'bold',
    marginLeft: 4,
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
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201, 168, 76, 0.05)',
  },
  verseCardActive: {
    borderColor: COLORS.gold,
    borderLeftWidth: 4,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  lastReadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
  },
  lastReadBadgeText: {
    color: '#0A0E1A',
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
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
    color: COLORS.gold,
    textShadowColor: 'rgba(201, 168, 76, 0.25)',
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
    color: COLORS.gold,
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
