import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { useDuasStore } from '../../../src/store/duasStore';
import { COLORS } from '../../../constants/theme';
import Card from '../../../components/ui/Card';
import ArabicGeometricBg from '../../../components/ui/ArabicGeometricBg';
import { Dua } from '../../../src/api/client';
import DuaShareModal from '../../../components/ui/DuaShareModal';

export default function DuaCategoryDetailScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const store = useDuasStore();
  
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [duaToShare, setDuaToShare] = useState<Dua | null>(null);
  
  // Audio state & Ref
  const [playingDuaId, setPlayingDuaId] = useState<number | null>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (category) {
      store.fetchDuas(category);
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.release();
      }
    };
  }, [category]);

  const handleShareDua = (dua: Dua) => {
    setDuaToShare(dua);
    setShareModalVisible(true);
  };

  const handlePlayAudio = async (dua: Dua) => {
    try {
      if (playingDuaId === dua.id) {
        // Stop current
        if (playerRef.current) {
          playerRef.current.pause();
          playerRef.current.release();
          playerRef.current = null;
        }
        setPlayingDuaId(null);
        return;
      }

      // Stop any other sound playing
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.release();
        playerRef.current = null;
      }

      setPlayingDuaId(dua.id);

      // Set audio modes using expo-audio
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      // Serene meditative sound track URL
      const sereneAudioUrl = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav';

      const player = createAudioPlayer(sereneAudioUrl);
      playerRef.current = player;

      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          setPlayingDuaId(null);
          playerRef.current = null;
          subscription.remove();
          player.release();
        }
      });

      player.play();
    } catch (err: any) {
      Alert.alert('Audio Error', 'Unable to play supplication recitation.');
      setPlayingDuaId(null);
    }
  };

  const getCategoryTitle = () => {
    if (store.duas.length > 0) {
      const first = store.duas[0];
      const match = store.categories.find(c => c.id === first.category);
      if (match) return match.name;
    }
    return category ? category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Supplications';
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* Background patterns */}
      <ArabicGeometricBg size={420} style={styles.backgroundOverlay} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{getCategoryTitle()}</Text>
          <Text style={styles.headerSubtitle}>{store.duas.length} divine supplications</Text>
        </View>
      </View>

      {store.isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>Fetching holy recitations...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {store.duas.map((item) => {
            const isBookmarked = store.bookmarkedDuaIds.includes(item.id);
            const isPlaying = playingDuaId === item.id;
            
            return (
              <Card key={item.id} style={styles.duaCard}>
                <View style={styles.duaHeaderBar}>
                  <Text style={styles.duaTitleText}>{item.title}</Text>
                  
                  {/* Play audio button */}
                  <TouchableOpacity
                    style={[styles.audioPlayBtn, isPlaying && styles.audioPlayBtnActive]}
                    onPress={() => handlePlayAudio(item)}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'volume-high-outline'}
                      size={16}
                      color={isPlaying ? COLORS.bg : COLORS.teal}
                    />
                    <Text style={[styles.audioPlayText, isPlaying && { color: COLORS.bg }]}>
                      {isPlaying ? 'Playing' : 'Listen'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Arabic Script */}
                <Text style={styles.duaArabicText}>{item.arabic}</Text>

                {/* Transliteration */}
                <Text style={styles.translitText}>{item.transliteration}</Text>

                {/* English Translation */}
                <Text style={styles.translationText}>{item.translation}</Text>

                {/* Actions and Reference row */}
                <View style={styles.footerRow}>
                  <Text style={styles.refText}>Reference: {item.reference}</Text>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => store.toggleBookmark(item)}
                    >
                      <Ionicons
                        name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                        size={18}
                        color={isBookmarked ? COLORS.gold : COLORS.text2}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleShareDua(item)}>
                      <Ionicons name="share-social-outline" size={18} color={COLORS.text2} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}

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
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
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
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  duaCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  duaHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.02)',
    paddingBottom: 10,
    marginBottom: 12,
  },
  duaTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.teal,
    maxWidth: '68%',
  },
  audioPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45,212,191,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(45,212,191,0.15)',
  },
  audioPlayBtnActive: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  audioPlayText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.teal,
    marginLeft: 4,
  },
  duaArabicText: {
    fontSize: 20,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    textAlign: 'right',
    lineHeight: 32,
    marginBottom: 14,
  },
  translitText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.text3,
    lineHeight: 17,
    marginBottom: 8,
  },
  translationText: {
    fontSize: 12.5,
    color: COLORS.text,
    lineHeight: 18,
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.02)',
    paddingTop: 12,
  },
  refText: {
    fontSize: 10,
    color: COLORS.text3,
    fontWeight: '500',
    maxWidth: '65%',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionIconBtn: {
    marginLeft: 14,
    padding: 2,
  },
});
