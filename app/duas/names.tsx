import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { COLORS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import { useThemeContext } from '../../src/context/ThemeContext';
import { getNamesOfAllah } from '../../src/api/client';

const { height, width } = Dimensions.get('window');

interface NameOfAllah {
  number: number;
  arabic: string;
  transliteration: string;
  meaning: string;
  description: string;
}

const BG_VARIANTS = [
  '#1B172E', // Subtle dark amethyst
  '#161326', // Deep purple-black
  '#201B36', // Rich violet-black
];

export default function NamesOfAllahScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';
  const [names, setNames] = useState<NameOfAllah[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'number' | 'memorized' | 'unmemorized'>('number');
  const [memorizedIds, setMemorizedIds] = useState<number[]>([]);

  // Detail Modal
  const [selectedName, setSelectedName] = useState<NameOfAllah | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Complete Audio Playback State
  const playerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);

  // Name of the Day
  const [nameOfDay, setNameOfDay] = useState<NameOfAllah | null>(null);

  useEffect(() => {
    fetchNames();
    loadMemorizedState();
    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.release();
      }
    };
  }, []);

  const fetchNames = async () => {
    try {
      setLoading(true);
      const data = await getNamesOfAllah();
      if (data) {
        setNames(data);
        calculateNameOfDay(data);
      }
    } catch (err) {
      console.warn('Failed to load names of Allah:', err);
      Alert.alert('Connection Error', 'Could not load names from backend.');
    } finally {
      setLoading(false);
    }
  };

  const loadMemorizedState = async () => {
    try {
      const stored = await AsyncStorage.getItem('allah_names_memorized');
      if (stored) {
        setMemorizedIds(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load memorized state:', e);
    }
  };

  const toggleMemorized = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = memorizedIds.includes(id)
      ? memorizedIds.filter((mId) => mId !== id)
      : [...memorizedIds, id];

    setMemorizedIds(updated);
    await AsyncStorage.setItem('allah_names_memorized', JSON.stringify(updated));
  };

  const calculateNameOfDay = (allNames: NameOfAllah[]) => {
    if (allNames.length === 0) return;
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = +today - +start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Deterministic selection based on day of the year
    const index = (dayOfYear + today.getFullYear()) % allNames.length;
    setNameOfDay(allNames[index]);
  };

  // Complete Audio Playback Controls
  const handleToggleCompleteAudio = async () => {
    try {
      if (playerRef.current) {
        if (isPlaying) {
          playerRef.current.pause();
          setIsPlaying(false);
        } else {
          playerRef.current.play();
          setIsPlaying(true);
        }
        return;
      }

      setAudioLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      const player = createAudioPlayer(require('../../assets/audio/asmaul-husna.mp3'));
      playerRef.current = player;

      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        setPlaybackPosition(status.currentTime);
        setPlaybackDuration(status.duration || 0);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPlaybackPosition(0);
          playerRef.current = null;
          subscription.remove();
          player.release();
        }
      });

      player.play();
      setIsPlaying(true);
      setAudioLoading(false);
    } catch (err) {
      console.warn('Complete Audio play error:', err);
      setAudioLoading(false);
      setIsPlaying(false);
      Alert.alert('Audio Error', 'Unable to play collective recitation.');
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleAddToDhikr = (item: NameOfAllah) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Daily Dhikr',
      `"${item.transliteration}" has been added to your daily tasbeeh rotation!`
    );
  };

  // Filter and sort computation
  const getProcessedNames = () => {
    let result = [...names];

    // Search query matching
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.transliteration.toLowerCase().includes(query) ||
          n.meaning.toLowerCase().includes(query) ||
          n.arabic.includes(query)
      );
    }

    // Sort matching
    if (sortBy === 'memorized') {
      result.sort((a, b) => {
        const aM = memorizedIds.includes(a.number) ? 1 : 0;
        const bM = memorizedIds.includes(b.number) ? 1 : 0;
        return bM - aM || a.number - b.number;
      });
    } else if (sortBy === 'unmemorized') {
      result.sort((a, b) => {
        const aM = memorizedIds.includes(a.number) ? 1 : 0;
        const bM = memorizedIds.includes(b.number) ? 1 : 0;
        return aM - bM || a.number - b.number;
      });
    } else {
      result.sort((a, b) => a.number - b.number);
    }

    return result;
  };

  const processedNames = getProcessedNames();
  const memorizedPercent = names.length > 0 ? memorizedIds.length / names.length : 0;
  const audioProgressPercent = playbackDuration > 0 ? playbackPosition / playbackDuration : 0;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* Background decoration */}
      <ArabicGeometricBg size={400} style={styles.backgroundOverlay} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/duas/index');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>99 Names of Allah</Text>
          <Text style={styles.headerSubtitle}>Al-Asma-ul-Husna • Beautiful Attributes</Text>
        </View>
      </View>

      {/* Progress Bar Container */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressLabel}>Memorization Progress</Text>
          <Text style={styles.progressCount}>
            {memorizedIds.length} of {names.length} memorized
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${memorizedPercent * 100}%` }]} />
        </View>
      </View>

      {/* Filters, search and sort toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBarBg}>
          <Ionicons name="search" size={16} color={COLORS.text3} style={styles.searchIcon} />
          <TextInput
            placeholder="Search attributes..."
            placeholderTextColor={COLORS.text3}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={16} color={COLORS.text3} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.sortOptions}>
          {(['number', 'memorized', 'unmemorized'] as const).map((mode) => {
            const active = sortBy === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.sortBtn, active && styles.sortBtnActive]}
                onPress={() => setSortBy(mode)}
              >
                <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>
                  {mode === 'number' ? 'Order' : mode === 'memorized' ? 'Memorized' : 'Pending'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Fetching attributes...</Text>
        </View>
      ) : (
        <FlatList
          data={processedNames}
          numColumns={2}
          keyExtractor={(item) => item.number.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          getItemLayout={(data, index) => ({ length: 140, offset: 140 * index, index })}
          ListHeaderComponent={
            <>
              {/* Name of the Day Hero segment */}
              {nameOfDay && !searchQuery && (
                <Card style={styles.heroCard}>
                  <View style={styles.heroHeader}>
                    <View style={styles.heroBadge}>
                      <Ionicons name="sparkles" size={12} color={COLORS.gold} />
                      <Text style={styles.heroBadgeText}>ATTRIBUTE OF THE DAY</Text>
                    </View>
                    <Text style={styles.heroNumber}>#{nameOfDay.number}</Text>
                  </View>

                  <View style={styles.heroBody}>
                    <Text style={styles.heroArabic}>{nameOfDay.arabic}</Text>
                    <View style={styles.heroTextContent}>
                      <Text style={styles.heroTranslit}>{nameOfDay.transliteration}</Text>
                      <Text style={styles.heroMeaning}>{nameOfDay.meaning}</Text>
                    </View>
                  </View>

                  <Text style={styles.heroDesc} numberOfLines={2}>
                    {nameOfDay.description}
                  </Text>

                  <TouchableOpacity
                    style={styles.heroActionBtn}
                    onPress={() => {
                      setSelectedName(nameOfDay);
                      setModalVisible(true);
                    }}
                  >
                    <Text style={styles.heroActionText}>Read Deep Meaning & Explain</Text>
                    <Ionicons name="arrow-forward" size={14} color={COLORS.gold} />
                  </TouchableOpacity>
                </Card>
              )}
              <Text style={styles.gridSectionTitle}>All Attributes</Text>
            </>
          }
          renderItem={({ item, index }) => {
            const isMemorized = memorizedIds.includes(item.number);
            const cardBg = isDark ? BG_VARIANTS[index % BG_VARIANTS.length] : COLORS.bg2;

            return (
              <AsmaItem
                item={item}
                index={index}
                isMemorized={isMemorized}
                cardBg={cardBg}
                onPress={(selectedItem) => {
                  setSelectedName(selectedItem);
                  setModalVisible(true);
                }}
              />
            );
          }}
        />
      )}

      {/* Persistent Collective Audio Playback Console at Bottom */}
      <View style={styles.collectiveAudioConsole}>
        <View style={styles.consoleMainRow}>
          <TouchableOpacity
            style={styles.consolePlayBtn}
            onPress={handleToggleCompleteAudio}
            disabled={audioLoading}
          >
            {audioLoading ? (
              <ActivityIndicator size="small" color={COLORS.bg} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={20}
                color={COLORS.bg}
              />
            )}
          </TouchableOpacity>

          <View style={styles.consoleTextPanel}>
            <Text style={styles.consoleTitle} numberOfLines={1}>
              Asma-ul-Husna Recitation
            </Text>
            <Text style={styles.consoleSubtitle} numberOfLines={1}>
              {isPlaying ? 'Playing Complete Recitation' : 'Listen to all 99 names together'}
            </Text>
          </View>

          <Text style={styles.consoleDuration}>
            {playbackDuration > 0
              ? `${formatTime(playbackPosition)} / ${formatTime(playbackDuration)}`
              : '0:00 / 3:00'}
          </Text>
        </View>

        {/* Custom Progress duration bar */}
        <View style={styles.consoleProgressTrack}>
          <View style={[styles.consoleProgressFill, { width: `${audioProgressPercent * 100}%` }]} />
        </View>
      </View>

      {/* Name Detail Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          {selectedName && (
            <TouchableOpacity
              style={styles.sheetContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetIndex}>No. {selectedName.number} of 99</Text>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Arabic display */}
              <View style={styles.arabicHeroPanel}>
                <Text style={styles.sheetArabicName}>{selectedName.arabic}</Text>
              </View>

              {/* Meaning headers */}
              <Text style={styles.sheetTranslit}>{selectedName.transliteration}</Text>
              <Text style={styles.sheetMeaning}>{selectedName.meaning}</Text>

              {/* Description body */}
              <Text style={styles.sheetSectionHeading}>Spiritual Reality & Depth</Text>
              <Text style={styles.sheetDescText}>{selectedName.description}</Text>

              {/* Settings selectors */}
              <View style={styles.toggleRow}>
                <View style={styles.toggleLabelGroup}>
                  <Ionicons name="bookmark-outline" size={18} color={COLORS.gold} />
                  <Text style={styles.toggleLabel}>Mark as memorized</Text>
                </View>
                <Switch
                  value={memorizedIds.includes(selectedName.number)}
                  onValueChange={() => toggleMemorized(selectedName.number)}
                  trackColor={{ false: '#2D3748', true: COLORS.teal }}
                  thumbColor={memorizedIds.includes(selectedName.number) ? COLORS.gold : '#718096'}
                />
              </View>

              {/* Add to daily rotation */}
              <TouchableOpacity
                style={styles.actionDailyDhikrBtn}
                onPress={() => handleAddToDhikr(selectedName)}
              >
                <Ionicons name="add-circle-outline" size={18} color={COLORS.bg} />
                <Text style={styles.actionDailyDhikrBtnText}>Add to daily dhikr list</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

interface AsmaItemProps {
  item: any;
  index: number;
  isMemorized: boolean;
  cardBg: string;
  onPress: (item: any) => void;
}

const AsmaItem = React.memo<AsmaItemProps>(({
  item,
  index,
  isMemorized,
  cardBg,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.nameGridCard, { backgroundColor: cardBg }]}
      onPress={() => onPress(item)}
    >
      {/* Badge indicator */}
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardIndexNum}>#{item.number}</Text>
        {isMemorized && (
          <View style={styles.memorizedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={COLORS.teal} />
          </View>
        )}
      </View>

      <Text style={styles.cardArabic}>{item.cardArabic || item.arabic}</Text>
      <Text style={styles.cardTranslit} numberOfLines={1}>
        {item.transliteration}
      </Text>
      <Text style={styles.cardMeaning} numberOfLines={1}>
        {item.meaning}
      </Text>
    </TouchableOpacity>
  );
}, (prev, next) => {
  return (
    prev.item.number === next.item.number &&
    prev.item.arabic === next.item.arabic &&
    prev.item.transliteration === next.item.transliteration &&
    prev.item.meaning === next.item.meaning &&
    prev.isMemorized === next.isMemorized &&
    prev.cardBg === next.cardBg
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg, // Dynamic background
  },
  backgroundOverlay: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
    marginRight: 14,
  },
  headerTitleRow: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text3,
    textTransform: 'uppercase',
  },
  progressCount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.03)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.teal,
    borderRadius: 3,
  },
  toolbar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBarBg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
  },
  sortOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sortBtn: {
    flex: 0.31,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  sortBtnActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  sortBtnText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: COLORS.text2,
  },
  sortBtnTextActive: {
    color: COLORS.bg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 190, // Room for bottom player console
  },
  heroCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.18)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginLeft: 4,
  },
  heroNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text3,
  },
  heroBody: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroArabic: {
    fontSize: 32,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
  },
  heroTextContent: {
    alignItems: 'flex-start',
  },
  heroTranslit: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  heroMeaning: {
    fontSize: 12,
    color: COLORS.teal,
    marginTop: 2,
  },
  heroDesc: {
    fontSize: 11,
    color: COLORS.text2,
    lineHeight: 15,
    marginBottom: 14,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  heroActionText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  gridSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  nameGridCard: {
    flex: 1,
    margin: 5,
    borderRadius: 14,
    padding: 12,
    height: 120,
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardIndexNum: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: COLORS.text3,
  },
  memorizedBadge: {
    position: 'absolute',
    right: 0,
  },
  cardArabic: {
    fontSize: 20,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    textAlign: 'right',
  },
  cardTranslit: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardMeaning: {
    fontSize: 10.5,
    color: COLORS.text3,
  },
  collectiveAudioConsole: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 20,
    left: 20,
    right: 20,
    backgroundColor: COLORS.bg2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.15)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  consoleMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  consolePlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.teal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  consoleTextPanel: {
    flex: 1,
  },
  consoleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  consoleSubtitle: {
    fontSize: 10,
    color: COLORS.text3,
    marginTop: 2,
  },
  consoleDuration: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gold,
    marginLeft: 10,
  },
  consoleProgressTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 12,
    overflow: 'hidden',
  },
  consoleProgressFill: {
    height: '100%',
    backgroundColor: COLORS.teal,
    borderRadius: 1.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: COLORS.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
    height: height * 0.8, // 80% height requirement
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetIndex: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text3,
    textTransform: 'uppercase',
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arabicHeroPanel: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  sheetArabicName: {
    fontSize: 36, // 36px requirement
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    textAlign: 'center',
  },
  sheetTranslit: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  sheetMeaning: {
    fontSize: 13,
    color: COLORS.teal,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  sheetSectionHeading: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  sheetDescText: {
    fontSize: 12.5,
    color: COLORS.text2,
    lineHeight: 18,
    marginBottom: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
    marginBottom: 16,
  },
  toggleLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 8,
  },
  actionDailyDhikrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
    borderRadius: 12,
    height: 48,
  },
  actionDailyDhikrBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.bg,
    marginLeft: 8,
  },
});
