import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Animated, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AudioPlayer, PlaybackState } from '../src/services/audioPlayer';
import { usePreferencesStore } from '../src/store/usePreferencesStore';
import { COLORS } from '../constants/theme';

const RECITER_IMAGES: Record<string, any> = {
  'ar.alafasy': require('../assets/reciters/alafasy.jpeg'),
  'ar.mahermuaiqly': require('../assets/reciters/mahermuaiqly.jpeg'),
  'ar.hudhaify': require('../assets/reciters/hudhaify.jpeg'),
  'ar.shaatree': require('../assets/reciters/shaatree.jpeg'),
};

const FALLBACK_RECITERS = [
  { identifier: 'ar.alafasy', englishName: 'Alafasy', name: 'مشاري العفاسي' },
  { identifier: 'ar.mahermuaiqly', englishName: 'Maher Al Muaiqly', name: 'ماهر المعيقلي' },
  { identifier: 'ar.hudhaify', englishName: 'Hudhaify', name: 'علي بن عبدالرحمن الحذيفي' },
  { identifier: 'ar.shaatree', englishName: 'Abu Bakr Ash-Shaatree', name: 'أبو بكر الشاطري' },
];

export default function AudioPlayerBar() {
  const preferences = usePreferencesStore();
  const [playback, setPlayback] = useState<PlaybackState>(AudioPlayer.getState());
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [reciters, setReciters] = useState<{ identifier: string; englishName: string; name?: string }[]>(FALLBACK_RECITERS);

  // Staggered waveform bars
  const pulse1 = useRef(new Animated.Value(4)).current;
  const pulse2 = useRef(new Animated.Value(4)).current;
  const pulse3 = useRef(new Animated.Value(4)).current;
  const pulse4 = useRef(new Animated.Value(4)).current;
  const pulse5 = useRef(new Animated.Value(4)).current;

  const pulses = [pulse1, pulse2, pulse3, pulse4, pulse5];

  // Sync state with global AudioPlayer service
  useEffect(() => {
    const unsubscribe = AudioPlayer.subscribe((state) => {
      setPlayback(state);
    });
    return unsubscribe;
  }, []);

  // Sync reciter preference with audio player service on load/change
  useEffect(() => {
    if (preferences.selectedReciter && preferences.selectedReciter !== playback.reciter) {
      AudioPlayer.setReciter(preferences.selectedReciter);
    }
  }, [preferences.selectedReciter]);

  // Parallel wave animation loops
  useEffect(() => {
    if (playback.isPlaying) {
      const anims = pulses.map((pulse, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 24 - index * 3, duration: 250 + index * 40, useNativeDriver: false }),
            Animated.timing(pulse, { toValue: 4, duration: 250 + index * 40, useNativeDriver: false }),
          ])
        );
      });
      Animated.parallel(anims).start();
    } else {
      pulses.forEach((pulse) => pulse.setValue(4));
    }
  }, [playback.isPlaying]);

  // Formatter for time strings
  const formatTime = (millis: number) => {
    if (isNaN(millis) || millis <= 0) return '00:00';
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Scrub bar calculation
  const getProgress = () => {
    if (playback.durationMillis > 0) {
      return playback.positionMillis / playback.durationMillis;
    }
    return 0;
  };

  const handleReciterSelect = (code: string) => {
    preferences.setSelectedReciter(code);
    AudioPlayer.setReciter(code);
    setSelectorVisible(false);
  };

  const activeReciter = (reciters.length > 0 ? reciters : FALLBACK_RECITERS).find(
    (r) => r.identifier === playback.reciter
  ) || (reciters.length > 0 ? reciters[0] : FALLBACK_RECITERS[0]);

  if (!playback.currentSurah || !playback.currentVerse) {
    return null; // hide floating bar if nothing loaded yet
  }

  return (
    <View style={styles.container}>
      {/* 1. Scrub progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${getProgress() * 100}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Left segment: Reciter Info + Waveform */}
        <TouchableOpacity style={styles.reciterMeta} onPress={() => setSelectorVisible(true)}>
          <View style={styles.avatarCircle}>
            {RECITER_IMAGES[activeReciter.identifier] ? (
              <Image
                source={RECITER_IMAGES[activeReciter.identifier]}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarInitial}>{activeReciter.englishName[0]}</Text>
            )}
          </View>
          <View style={styles.textBox}>
            <Text numberOfLines={1} style={styles.reciterName}>{activeReciter.englishName}</Text>
            <Text style={styles.verseLabel}>
              Surah {playback.currentSurah} • Ayah {playback.currentVerse}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Waveform Visualization segment */}
        <View style={styles.waveformContainer}>
          {pulses.map((pulse, idx) => (
            <Animated.View key={idx} style={[styles.waveBar, { height: pulse }]} />
          ))}
        </View>

        {/* Right segment: Control Triggers */}
        <View style={styles.controls}>
          {/* Loop toggle */}
          <TouchableOpacity
            onPress={() => AudioPlayer.setLooping(!playback.isLooping)}
            style={styles.modeBtn}
          >
            <Ionicons
              name={playback.isLooping ? 'repeat' : 'repeat-outline'}
              size={18}
              color={playback.isLooping ? COLORS.gold : COLORS.text3}
            />
          </TouchableOpacity>

          {/* Auto advance toggle */}
          <TouchableOpacity
            onPress={() => AudioPlayer.setAutoAdvance(!playback.isAutoAdvance)}
            style={styles.modeBtn}
          >
            <Ionicons
              name="play-forward-circle"
              size={18}
              color={playback.isAutoAdvance ? COLORS.gold : COLORS.text3}
            />
          </TouchableOpacity>

          {/* Prev Verse skip */}
          <TouchableOpacity onPress={() => AudioPlayer.playPrevious()} style={styles.controlBtn}>
            <Ionicons name="play-skip-back" size={18} color={COLORS.text} />
          </TouchableOpacity>

          {/* Play/Pause Gold button */}
          <TouchableOpacity
            onPress={() => (playback.isPlaying ? AudioPlayer.pause() : AudioPlayer.play())}
            style={styles.playPauseBtn}
          >
            {playback.isLoading ? (
              <Ionicons name="sync-outline" size={18} color={COLORS.bg} style={styles.spinningIcon} />
            ) : (
              <Ionicons name={playback.isPlaying ? 'pause' : 'play'} size={18} color={COLORS.bg} />
            )}
          </TouchableOpacity>

          {/* Next Verse skip */}
          <TouchableOpacity onPress={() => AudioPlayer.playNext()} style={styles.controlBtn}>
            <Ionicons name="play-skip-forward" size={18} color={COLORS.text} />
          </TouchableOpacity>

          {/* Close Player bar */}
          <TouchableOpacity onPress={() => AudioPlayer.stop()} style={styles.closeBtn}>
            <Ionicons name="close" size={18} color={COLORS.text3} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dynamic Duration Labels */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(playback.positionMillis)}</Text>
        <Text style={styles.timeText}>{formatTime(playback.durationMillis)}</Text>
      </View>

      {/* Reciter Selector Bottom Modal sheet */}
      <Modal
        animationType="slide"
        transparent
        visible={selectorVisible}
        onRequestClose={() => setSelectorVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismiss} onPress={() => setSelectorVisible(false)} />
          <View style={styles.modalContent}>
            <View style={styles.dragHandle} />
            <Text style={styles.modalTitle}>Choose Reciter Voice</Text>

            <ScrollView style={styles.reciterScroll}>
              {(reciters.length > 0 ? reciters : FALLBACK_RECITERS).map((item) => {
                const isSelected = playback.reciter === item.identifier;
                return (
                  <TouchableOpacity
                    key={item.identifier}
                    style={[styles.reciterRow, isSelected && styles.reciterRowActive]}
                    onPress={() => handleReciterSelect(item.identifier)}
                  >
                    <View style={styles.reciterMetaLeft}>
                      <View style={[styles.avatarCircle, isSelected && styles.avatarCircleActive]}>
                        {RECITER_IMAGES[item.identifier] ? (
                          <Image
                            source={RECITER_IMAGES[item.identifier]}
                            style={styles.avatarImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={[styles.avatarInitial, isSelected && styles.avatarInitialActive]}>
                            {item.englishName[0]}
                          </Text>
                        )}
                      </View>
                      <View style={styles.reciterLabelBox}>
                        <Text style={[styles.reciterRowName, isSelected && styles.reciterRowNameActive]}>
                          {item.englishName}
                        </Text>
                        <Text style={styles.reciterRowDesc}>Quranic Reciter Voice</Text>
                      </View>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.gold} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(10, 14, 26, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.15)',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: COLORS.bg3,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reciterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarCircleActive: {
    backgroundColor: COLORS.gold,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarInitial: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: 'bold',
  },
  avatarInitialActive: {
    color: COLORS.bg,
  },
  textBox: {
    flex: 1,
    justifyContent: 'center',
  },
  reciterName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  verseLabel: {
    fontSize: 9,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: 28,
    height: 24,
    marginRight: 10,
  },
  waveBar: {
    width: 2.5,
    backgroundColor: COLORS.gold,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  modeBtn: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 1,
  },
  playPauseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  spinningIcon: {
    transform: [{ rotate: '0deg' }], // simple standard fallback
  },
  closeBtn: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  timeText: {
    fontSize: 8,
    color: COLORS.text3,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: COLORS.bg2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    maxHeight: '60%',
  },
  dragHandle: {
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
  reciterScroll: {
    marginBottom: 10,
  },
  reciterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.bg3,
  },
  reciterRowActive: {
    borderBottomColor: COLORS.gold,
  },
  reciterMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reciterLabelBox: {
    marginLeft: 12,
    flex: 1,
  },
  reciterRowName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  reciterRowNameActive: {
    color: COLORS.gold,
  },
  reciterRowDesc: {
    fontSize: 10,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '600',
  },
});
