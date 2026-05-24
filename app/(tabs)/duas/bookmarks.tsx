import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  Animated,
  PanResponder,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { useDuasStore } from '../../../src/store/duasStore';
import { COLORS } from '../../../constants/theme';
import Card from '../../../components/ui/Card';
import ArabicGeometricBg from '../../../components/ui/ArabicGeometricBg';
import { Dua } from '../../../src/api/client';
import DuaShareModal from '../../../components/ui/DuaShareModal';

const { width, height } = Dimensions.get('window');

const CATEGORY_EMOJIS: Record<string, string> = {
  'morning-adhkar': '🌅',
  'evening-adhkar': '🌌',
  'food-eating': '🍲',
  'before-sleep': '🌙',
  'upon-waking': '☀️',
  'travel': '🚗',
  'protection': '🛡️',
  'entering-home': '🏡',
  'stress-anxiety': '🌀',
  'gratitude': '💖',
};

const CATEGORY_NAMES: Record<string, string> = {
  'morning-adhkar': 'Morning Adhkar',
  'evening-adhkar': 'Evening Adhkar',
  'food-eating': 'Food & Eating',
  'before-sleep': 'Before Sleep',
  'upon-waking': 'Upon Waking',
  'travel': 'Travel',
  'protection': 'Protection',
  'entering-home': 'Entering Home',
  'stress-anxiety': 'Stress & Anxiety',
  'gratitude': 'Gratitude',
};

// Custom Native Swipeable Item Component using PanResponder & Animated APIs
interface SwipeableItemProps {
  bookmark: any;
  duaDetail: Dua | null;
  onPress: () => void;
  onDelete: () => void;
}

const SwipeableItem = React.memo<SwipeableItemProps>(function SwipeableItem({ bookmark, duaDetail, onPress, onDelete }: SwipeableItemProps) {
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const isSwiped = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only set pan responder if swiping horizontally to the left
        return Math.abs(gestureState.dx) > 10 && gestureState.dx < 0 && Math.abs(gestureState.dy) < 8;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          // Clamp swipe to max 80 pixels
          const val = Math.max(gestureState.dx, -80);
          swipeAnim.setValue(val);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          // Snap open
          Animated.spring(swipeAnim, {
            toValue: -80,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          isSwiped.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          // Snap closed
          Animated.spring(swipeAnim, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
          isSwiped.current = false;
        }
      },
    })
  ).current;

  const resetSwipe = () => {
    Animated.spring(swipeAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    isSwiped.current = false;
  };

  const handleDeletePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.timing(swipeAnim, {
      toValue: -width,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  };

  const title = duaDetail?.title || bookmark.reference || 'Supplication';
  const category = duaDetail?.category || 'general';
  const emoji = CATEGORY_EMOJIS[category] || '🕌';
  const catName = CATEGORY_NAMES[category] || 'General Supplication';
  const dateStr = bookmark.savedAt
    ? new Date(bookmark.savedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently Saved';

  // Truncate Arabic snippet to 2 lines
  const arabicSnippet = bookmark.arabicText;

  return (
    <View style={styles.itemWrapper}>
      {/* Background Delete Button */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePress}>
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Foreground Card */}
      <Animated.View
        style={[styles.foregroundCard, { transform: [{ translateX: swipeAnim }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (isSwiped.current) {
              resetSwipe();
            } else {
              onPress();
            }
          }}
          style={styles.cardTouchBody}
        >
          <View style={styles.cardHeader}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {emoji} {catName}
              </Text>
            </View>
            <Text style={styles.saveDate}>{dateStr}</Text>
          </View>

          <Text style={styles.duaTitle} numberOfLines={1}>
            {title}
          </Text>

          <Text style={styles.arabicSnippet} numberOfLines={2}>
            {arabicSnippet}
          </Text>

          <View style={styles.translationRow}>
            <Text style={styles.translationSnippet} numberOfLines={1}>
              {bookmark.translation}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.text3} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}, (prev, next) => {
  return (
    prev.bookmark._id === next.bookmark._id &&
    prev.bookmark.savedAt === next.bookmark.savedAt &&
    prev.bookmark.arabicText === next.bookmark.arabicText &&
    prev.bookmark.translation === next.bookmark.translation &&
    prev.duaDetail?.title === next.duaDetail?.title
  );
});

export default function BookmarksScreen() {
  const store = useDuasStore();
  const [loading, setLoading] = useState(true);
  const [selectedDua, setSelectedDua] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [duaToShare, setDuaToShare] = useState<Dua | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await store.syncBookmarks();
      await store.fetchAllDuas();
    } catch (e) {
      console.warn('Failed to load bookmarks details:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBookmark = async (id: string, refId: number) => {
    try {
      await store.removeBookmark(id, refId);
    } catch (e) {
      Alert.alert('Error', 'Unable to remove bookmark. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* Background ornament */}
      <ArabicGeometricBg size={350} style={styles.backgroundOverlay} />

      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>My Bookmarks</Text>
          <Text style={styles.headerSubtitle}>Saved Supplications & Dhikr</Text>
        </View>
        <View style={styles.counterBadge}>
          <Text style={styles.counterBadgeText}>{store.bookmarkedDuas.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Syncing saved duas...</Text>
        </View>
      ) : store.bookmarkedDuas.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color="rgba(201,168,76,0.15)" />
          <Text style={styles.emptyTitle}>No Bookmarks Found</Text>
          <Text style={styles.emptySubtitle}>
            Tapping the bookmark icon on any supplication card will save it here for offline reading!
          </Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.back()}>
            <Text style={styles.exploreBtnText}>Browse Supplications</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={store.bookmarkedDuas}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          windowSize={10}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          renderItem={({ item }) => {
            const refIdNum = parseInt(item.refId);
            const duaDetail = store.allDuas[refIdNum] || null;

            return (
              <SwipeableItem
                bookmark={item}
                duaDetail={duaDetail}
                onPress={() => {
                  setSelectedDua({
                    ...item,
                    title: duaDetail?.title || item.reference || 'Supplication',
                    transliteration: duaDetail?.transliteration || '',
                    category: duaDetail?.category || 'general',
                  });
                  setModalVisible(true);
                }}
                onDelete={() => handleDeleteBookmark(item._id, refIdNum)}
              />
            );
          }}
        />
      )}

      {/* Dua Detail Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          {selectedDua && (
            <TouchableOpacity
              style={styles.sheetContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.sheetHandle} />

              <View style={styles.sheetHeader}>
                <Text style={styles.sheetCategory}>
                  {CATEGORY_EMOJIS[selectedDua.category] || '🕌'}{' '}
                  {CATEGORY_NAMES[selectedDua.category] || 'Supplication'}
                </Text>
                <TouchableOpacity
                  style={styles.sheetCloseBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.scrollContainer}>
                <Text style={styles.sheetDuaTitle}>{selectedDua.title}</Text>

                {/* Arabic Panel */}
                <View style={styles.arabicPanel}>
                  <Text style={styles.sheetArabic}>{selectedDua.arabicText}</Text>
                </View>

                {/* Transliteration */}
                {selectedDua.transliteration ? (
                  <View style={styles.textBlock}>
                    <Text style={styles.sheetSectionHeading}>Transliteration</Text>
                    <Text style={styles.sheetTranslit}>{selectedDua.transliteration}</Text>
                  </View>
                ) : null}

                {/* Translation */}
                <View style={styles.textBlock}>
                  <Text style={styles.sheetSectionHeading}>Translation</Text>
                  <Text style={styles.sheetTranslation}>"{selectedDua.translation}"</Text>
                </View>

                {/* Reference */}
                <View style={styles.textBlock}>
                  <Text style={styles.sheetSectionHeading}>Reference</Text>
                  <Text style={styles.sheetRefText}>{selectedDua.reference}</Text>
                </View>

                {/* Share as Image Button */}
                <TouchableOpacity
                  style={styles.sheetShareBtn}
                  onPress={() => {
                    setModalVisible(false);
                    setDuaToShare({
                      id: parseInt(selectedDua.refId),
                      category: selectedDua.category,
                      title: selectedDua.title,
                      arabic: selectedDua.arabicText,
                      transliteration: selectedDua.transliteration,
                      translation: selectedDua.translation,
                      reference: selectedDua.reference
                    });
                    setShareModalVisible(true);
                  }}
                >
                  <Ionicons name="image-outline" size={18} color={COLORS.bg} style={{ marginRight: 8 }} />
                  <Text style={styles.sheetShareBtnText}>Share Supplication Card</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Modal>

      <DuaShareModal
        visible={shareModalVisible}
        dua={duaToShare}
        onClose={() => setShareModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  backgroundOverlay: {
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  backBtn: {
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
  headerTitleContainer: {
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
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(201,168,76,0.3)',
  },
  counterBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: COLORS.text3,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 24,
  },
  exploreBtn: {
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 10,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exploreBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.bg,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemWrapper: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  deleteButtonText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  foregroundCard: {
    backgroundColor: COLORS.bg2,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  cardTouchBody: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  categoryBadgeText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: COLORS.teal,
  },
  saveDate: {
    fontSize: 10,
    color: COLORS.text3,
  },
  duaTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  arabicSnippet: {
    fontSize: 15,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    lineHeight: 22,
    textAlign: 'right',
    marginBottom: 10,
  },
  translationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.02)',
    paddingTop: 8,
  },
  translationSnippet: {
    flex: 1,
    fontSize: 11,
    color: COLORS.text3,
    marginRight: 8,
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
    height: height * 0.75,
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
    marginBottom: 14,
  },
  sheetCategory: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: COLORS.teal,
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
  scrollContainer: {
    flex: 1,
  },
  sheetDuaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  arabicPanel: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetArabic: {
    fontSize: 22,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    lineHeight: 38,
    textAlign: 'center',
  },
  textBlock: {
    marginBottom: 14,
  },
  sheetSectionHeading: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sheetTranslit: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  sheetTranslation: {
    fontSize: 13,
    color: COLORS.text2,
    lineHeight: 18,
  },
  sheetRefText: {
    fontSize: 11,
    color: COLORS.text3,
  },
  sheetShareBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.gold,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sheetShareBtnText: {
    color: COLORS.bg,
    fontWeight: 'bold',
    fontSize: 13,
  },
});
