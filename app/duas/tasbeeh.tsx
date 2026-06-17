import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import ScreenBackground from '../../components/ui/ScreenBackground';

import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';
import { saveUserPreferences } from '../../src/api/client';
import Card from '../../components/ui/Card';

const { width, height } = Dimensions.get('window');

interface BeadTheme {
  primary: string;
  secondary: string;
  bgTranslucent: string;
  name: string;
}

const BEAD_THEMES: Record<'sandalwood' | 'amber' | 'gold' | 'clay', BeadTheme> = {
  sandalwood: {
    primary: '#8B5A2B',
    secondary: '#D2B48C',
    bgTranslucent: 'rgba(139, 90, 43, 0.15)',
    name: 'Sandalwood',
  },
  amber: {
    primary: '#FFBF00',
    secondary: '#D97706',
    bgTranslucent: 'rgba(255, 191, 0, 0.15)',
    name: 'Amber',
  },
  gold: {
    primary: '#C9A84C',
    secondary: '#B58920',
    bgTranslucent: 'rgba(201, 168, 76, 0.15)',
    name: 'Royal Gold',
  },
  clay: {
    primary: '#E2725B',
    secondary: '#C2B280',
    bgTranslucent: 'rgba(226, 114, 91, 0.15)',
    name: 'Terracotta',
  },
};

interface DhikrItem {
  name: string;
  arabic: string;
  defaultTarget: number;
}

const DEFAULT_DHIKRS: DhikrItem[] = [
  { name: 'SubhanAllah', arabic: 'سُبْحَانَ اللَّهِ', defaultTarget: 33 },
  { name: 'Alhamdulillah', arabic: 'الْحَمْدُ لِلَّهِ', defaultTarget: 33 },
  { name: 'AllahuAkbar', arabic: 'اللَّهُ أَكْبَرُ', defaultTarget: 34 },
  { name: 'Astaghfirullah', arabic: 'أَسْتَغْفِرُ اللَّهَ', defaultTarget: 33 },
  { name: 'La ilaha illallah', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', defaultTarget: 33 },
];

export default function TasbeehScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  // Counter States
  const [count, setCount] = useState(0);
  const [dhikrIndex, setDhikrIndex] = useState(0);
  const [customDhikrs, setCustomDhikrs] = useState<DhikrItem[]>([]);
  const [activeDhikr, setActiveDhikr] = useState<DhikrItem>(DEFAULT_DHIKRS[0]);

  // Target States
  const [targetType, setTargetType] = useState<'auto' | '33' | '99' | '100' | 'custom'>('auto');
  const [customTargetVal, setCustomTargetVal] = useState(33);
  const [customInputVisible, setCustomInputVisible] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState('');

  // Dhikr Custom Input Modal
  const [newDhikrName, setNewDhikrName] = useState('');
  const [newDhikrArabic, setNewDhikrArabic] = useState('');
  const [newDhikrVisible, setNewDhikrVisible] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    allTime: 0,
  });

  // Reset Modal
  const [resetModalVisible, setResetModalVisible] = useState(false);

  // Interactive Customizations
  const [beadThemeKey, setBeadThemeKey] = useState<'sandalwood' | 'amber' | 'gold' | 'clay'>('gold');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticMode, setHapticMode] = useState<'light' | 'medium' | 'heavy' | 'off'>('light');

  // Preloaded audio players
  const clickPlayer = useRef<any>(null);
  const successPlayer = useRef<any>(null);

  useEffect(() => {
    try {
      clickPlayer.current = createAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav');
      successPlayer.current = createAudioPlayer('https://assets.mixkit.co/active_storage/sfx/2019/2019-84.wav');
    } catch (err) {
      console.warn('Audio preloading failed:', err);
    }
    return () => {
      try { clickPlayer.current?.release(); } catch(e){}
      try { successPlayer.current?.release(); } catch(e){}
    };
  }, []);

  // Animations
  const fillAnim = useRef(new Animated.Value(0)).current;
  const burstScale = useRef(new Animated.Value(1)).current;
  const burstOpacity = useRef(new Animated.Value(0)).current;

  // Active target calculation
  const getActiveTarget = () => {
    if (targetType === 'auto') {
      return activeDhikr.defaultTarget;
    }
    if (targetType === '33') return 33;
    if (targetType === '99') return 99;
    if (targetType === '100') return 100;
    return customTargetVal;
  };

  const activeTarget = getActiveTarget();
  const beadTheme = BEAD_THEMES[beadThemeKey];

  // Load state and stats
  useEffect(() => {
    loadDhikrState();
    loadStats();
    loadPreferences();
  }, []);

  // Update ring progress animate
  useEffect(() => {
    const progress = activeTarget > 0 ? count / activeTarget : 0;
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 120,
      useNativeDriver: false,
    }).start();
  }, [count, activeTarget]);

  const loadPreferences = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('tasbeeh_bead_theme');
      if (savedTheme && (savedTheme === 'sandalwood' || savedTheme === 'amber' || savedTheme === 'gold' || savedTheme === 'clay')) {
        setBeadThemeKey(savedTheme);
      }
      
      const savedSound = await AsyncStorage.getItem('tasbeeh_sound_enabled');
      if (savedSound !== null) {
        setSoundEnabled(JSON.parse(savedSound));
      }
      
      const savedHaptic = await AsyncStorage.getItem('tasbeeh_haptic_mode');
      if (savedHaptic && (savedHaptic === 'light' || savedHaptic === 'medium' || savedHaptic === 'heavy' || savedHaptic === 'off')) {
        setHapticMode(savedHaptic);
      }
    } catch(e) {
      console.warn('Failed to load tasbeeh preferences:', e);
    }
  };

  // Load initial states
  const loadDhikrState = async () => {
    try {
      const stored = await AsyncStorage.getItem('tasbeeh_custom_dhikrs');
      if (stored) {
        setCustomDhikrs(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to load custom dhikrs:', e);
    }
  };

  const loadStats = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const storedStats = await AsyncStorage.getItem('tasbeeh_counter_stats');
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        // Check if today matches, otherwise reset today total
        if (parsed.lastUpdatedDate === todayStr) {
          setStats({
            today: parsed.today || 0,
            week: parsed.week || 0,
            allTime: parsed.allTime || 0,
          });
        } else {
          // If a new day, clear today but keep week/allTime
          setStats({
            today: 0,
            week: parsed.week || 0,
            allTime: parsed.allTime || 0,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
  };

  // Save and increment stats
  const incrementStats = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const newStats = {
        today: stats.today + 1,
        week: stats.week + 1,
        allTime: stats.allTime + 1,
        lastUpdatedDate: todayStr,
      };
      setStats(newStats);
      await AsyncStorage.setItem('tasbeeh_counter_stats', JSON.stringify(newStats));

      // Backup to MongoDB async
      syncStatsToCloud(newStats.today, newStats.allTime);
    } catch (e) {
      console.warn('Failed to save stats:', e);
    }
  };

  const syncStatsToCloud = async (todayCount: number, allTimeCount: number) => {
    try {
      await saveUserPreferences({
        language: 'en',
        selectedTranslation: 'en-trans',
        selectedReciter: 'reciter1',
        notificationsEnabled: true,
        metadata: {
          tasbeeh: {
            today: todayCount,
            allTime: allTimeCount,
            lastSync: new Date().toISOString(),
          },
        },
      });
    } catch (err) {
      console.warn('Cloud stats sync failed:', err);
    }
  };

  // Perform counter increment
  const handleIncrement = () => {
    // Play haptic feedback if not disabled
    if (hapticMode !== 'off') {
      const style = hapticMode === 'light' ? Haptics.ImpactFeedbackStyle.Light
                  : hapticMode === 'medium' ? Haptics.ImpactFeedbackStyle.Medium
                  : Haptics.ImpactFeedbackStyle.Heavy;
      Haptics.impactAsync(style).catch(() => {});
    }

    // Play tactile mechanical click sound
    if (soundEnabled && clickPlayer.current) {
      try {
        clickPlayer.current.seekTo(0);
        clickPlayer.current.play();
      } catch (err) {
        console.warn('Audio click failed:', err);
      }
    }

    incrementStats();

    const target = getActiveTarget();
    const nextCount = count + 1;

    if (nextCount >= target) {
      // Goal hit!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      // Play target success chime sound
      if (soundEnabled && successPlayer.current) {
        try {
          successPlayer.current.seekTo(0);
          successPlayer.current.play();
        } catch (err) {
          console.warn('Audio chime failed:', err);
        }
      }

      triggerCelebration();

      if (targetType === 'auto') {
        // Auto-cycle through SubhanAllah (33) -> Alhamdulillah (33) -> AllahuAkbar (34)
        if (dhikrIndex === 0) {
          // Cycle to Alhamdulillah
          setDhikrIndex(1);
          setActiveDhikr(DEFAULT_DHIKRS[1]);
          setCount(0);
        } else if (dhikrIndex === 1) {
          // Cycle to AllahuAkbar
          setDhikrIndex(2);
          setActiveDhikr(DEFAULT_DHIKRS[2]);
          setCount(0);
        } else if (dhikrIndex === 2) {
          // Finished the 100 cycle! Reset to SubhanAllah
          setDhikrIndex(0);
          setActiveDhikr(DEFAULT_DHIKRS[0]);
          setCount(0);
          Alert.alert('Tasbeeh Complete', 'May Allah reward you for completing the 100 Dhikr cycle!');
        } else {
          // Astaghfirullah, La ilaha illallah, and custom Dhikrs reset to 0 to repeat
          setCount(0);
        }
      } else {
        // Simple Reset
        setCount(0);
      }
    } else {
      setCount(nextCount);
    }
  };

  // Celebration animations
  const triggerCelebration = () => {
    burstScale.setValue(0.6);
    burstOpacity.setValue(1);
    
    Animated.parallel([
      Animated.timing(burstScale, {
        toValue: 2.2,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(burstOpacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Reset counters
  const handleReset = () => {
    setCount(0);
    setResetModalVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleSelectDhikr = (item: DhikrItem, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveDhikr(item);
    setDhikrIndex(index);
    setCount(0);
  };

  const handleAddCustomDhikr = async () => {
    if (!newDhikrName.trim() || !newDhikrArabic.trim()) {
      Alert.alert('Validation Error', 'Please fill both Name and Arabic text.');
      return;
    }

    const newItem: DhikrItem = {
      name: newDhikrName.trim(),
      arabic: newDhikrArabic.trim(),
      defaultTarget: 33,
    };

    const updated = [...customDhikrs, newItem];
    setCustomDhikrs(updated);
    await AsyncStorage.setItem('tasbeeh_custom_dhikrs', JSON.stringify(updated));
    setActiveDhikr(newItem);
    setCount(0);
    setNewDhikrName('');
    setNewDhikrArabic('');
    setNewDhikrVisible(false);
  };

  const handleSetCustomTarget = () => {
    const val = parseInt(customTargetInput);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Number', 'Please enter a target greater than 0.');
      return;
    }
    setCustomTargetVal(val);
    setTargetType('custom');
    setCustomInputVisible(false);
    setCustomTargetInput('');
    setCount(0);
  };

  const handleDeleteCustomDhikr = async (customIndex: number) => {
    Alert.alert(
      'Delete Custom Dhikr',
      'Are you sure you want to delete this custom Dhikr?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = [...customDhikrs];
            updated.splice(customIndex, 1);
            setCustomDhikrs(updated);
            await AsyncStorage.setItem('tasbeeh_custom_dhikrs', JSON.stringify(updated));
            
            const deletedItemName = customDhikrs[customIndex].name;
            if (activeDhikr.name === deletedItemName) {
              setActiveDhikr(DEFAULT_DHIKRS[0]);
              setDhikrIndex(0);
              setCount(0);
            } else {
              const newAllDhikrs = [...DEFAULT_DHIKRS, ...updated];
              const newIndex = newAllDhikrs.findIndex(d => d.name === activeDhikr.name);
              if (newIndex !== -1) {
                setDhikrIndex(newIndex);
              }
            }
          }
        }
      ]
    );
  };

  // SVG parameters
  const radius = 100;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const allAvailableDhikrs = [...DEFAULT_DHIKRS, ...customDhikrs];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      <ScreenBackground />
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
        <Text style={styles.headerTitle}>Tasbeeh Counter</Text>
        <TouchableOpacity style={styles.resetIconBtn} onPress={() => setResetModalVisible(true)}>
          <Ionicons name="refresh-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Target Selector Toolbar */}
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>Target:</Text>
        <View style={styles.targetPills}>
          {(['auto', '33', '99', '100', 'custom'] as const).map((type) => {
            const active = targetType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.targetPill, active && { backgroundColor: beadTheme.primary, borderColor: beadTheme.primary }]}
                onPress={() => {
                  if (type === 'custom') {
                    setCustomInputVisible(true);
                  } else {
                    setTargetType(type);
                    setCount(0);
                  }
                }}
              >
                <Text style={[styles.targetPillText, active && styles.targetPillTextActive]}>
                  {type === 'auto' ? 'Auto' : type === 'custom' ? `${customTargetVal}` : type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Interactive Customizations Row (Theme Dots, Audio Mute, Haptics Mode) */}
      <View style={styles.controlsRow}>
        <View style={styles.controlGroup}>
          <Text style={styles.controlLabel}>Beads:</Text>
          <View style={styles.themePills}>
            {(['sandalwood', 'amber', 'gold', 'clay'] as const).map((tKey) => {
              const active = beadThemeKey === tKey;
              return (
                <TouchableOpacity
                  key={tKey}
                  style={[
                    styles.themeDot,
                    { backgroundColor: BEAD_THEMES[tKey].primary },
                    active && { borderColor: '#FFFFFF', borderWidth: 1.5 }
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setBeadThemeKey(tKey);
                    AsyncStorage.setItem('tasbeeh_bead_theme', tKey);
                  }}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.controlGroupRight}>
          <TouchableOpacity
            style={styles.iconControlBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSoundEnabled(!soundEnabled);
              AsyncStorage.setItem('tasbeeh_sound_enabled', JSON.stringify(!soundEnabled));
            }}
          >
            <Ionicons
              name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
              size={18}
              color={soundEnabled ? beadTheme.primary : COLORS.text3}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.hapticCycleBtn, hapticMode === 'off' && styles.hapticCycleBtnOff]}
            onPress={() => {
              const modes: ('light' | 'medium' | 'heavy' | 'off')[] = ['light', 'medium', 'heavy', 'off'];
              const nextIdx = (modes.indexOf(hapticMode) + 1) % modes.length;
              const nextMode = modes[nextIdx];
              setHapticMode(nextMode);
              AsyncStorage.setItem('tasbeeh_haptic_mode', nextMode);
              
              if (nextMode !== 'off') {
                const style = nextMode === 'light' ? Haptics.ImpactFeedbackStyle.Light
                            : nextMode === 'medium' ? Haptics.ImpactFeedbackStyle.Medium
                            : Haptics.ImpactFeedbackStyle.Heavy;
                Haptics.impactAsync(style);
              }
            }}
          >
            <Ionicons name="finger-print-outline" size={13} color={hapticMode === 'off' ? COLORS.text3 : beadTheme.primary} />
            <Text style={[styles.hapticModeText, { color: hapticMode === 'off' ? COLORS.text3 : beadTheme.primary }]}>
              {hapticMode.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Selector Scrollbar for Dhikr */}
      <View style={styles.dhikrSelectBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dhikrScroll}>
          {allAvailableDhikrs.map((item, idx) => {
            const active = activeDhikr.name === item.name;
            const isCustom = idx >= DEFAULT_DHIKRS.length;
            return (
              <TouchableOpacity
                key={`${item.name}_${idx}`}
                style={[
                  styles.dhikrPill,
                  active && { backgroundColor: beadTheme.primary, borderColor: beadTheme.primary },
                  isCustom && { flexDirection: 'row', alignItems: 'center', paddingRight: 8 }
                ]}
                onPress={() => handleSelectDhikr(item, idx)}
              >
                <Text style={[styles.dhikrPillText, active && styles.dhikrPillTextActive]}>
                  {item.name}
                </Text>
                {isCustom && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomDhikr(idx - DEFAULT_DHIKRS.length);
                    }}
                    style={{ marginLeft: 6 }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={14}
                      color={active ? '#FFFFFF' : COLORS.text3}
                    />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.addDhikrBtn} onPress={() => setNewDhikrVisible(true)}>
            <Ionicons name="add" size={16} color={COLORS.gold} />
            <Text style={styles.addDhikrText}>Custom</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Core Tap area representing bottom 60% of the screen */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handleIncrement}
        style={styles.mainTappingArea}
      >
        <View style={styles.gaugeContainer}>
          {/* Svg Radial Ring */}
          <Svg width={240} height={240} viewBox="0 0 240 240">
            <Circle
              cx="120"
              cy="120"
              r={radius}
              stroke={COLORS.bg3}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <AnimatedCircle
              cx="120"
              cy="120"
              r={radius}
              stroke={beadTheme.primary}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 120 120)"
            />
          </Svg>

          {/* Burst Celebration Glow */}
          <Animated.View
            style={[
              styles.burstRing,
              {
                opacity: burstOpacity,
                transform: [{ scale: burstScale }],
                borderColor: beadTheme.primary,
              },
            ]}
          />

          {/* Counter Text overlay inside ring */}
          <View style={styles.counterTextOverlay}>
            <Text style={styles.currentCount}>{count}</Text>
            <Text style={styles.targetProgress}>of {activeTarget}</Text>
          </View>
        </View>

        {/* Current Dhikr in Arabic script */}
        <View style={styles.dhikrArabicWrapper}>
          <Text style={styles.dhikrArabic}>{activeDhikr.arabic}</Text>
          <Text style={styles.dhikrNameSub}>{activeDhikr.name}</Text>
        </View>

        {/* Action instruction */}
        <Text style={styles.tapInstruction}>Tap anywhere below to increment</Text>

        {/* Giant Circle Tap button in center */}
        <View style={[styles.giantCircleBtn, { backgroundColor: beadTheme.primary, shadowColor: beadTheme.primary }]}>
          <Ionicons name="finger-print" size={32} color={COLORS.bg} />
        </View>
      </TouchableOpacity>

      {/* Stats Footer Summary */}
      <View style={styles.statsFooter}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Today</Text>
          <Text style={styles.statVal}>{stats.today}</Text>
        </View>
        <View style={styles.statCellBorder} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>This Week</Text>
          <Text style={styles.statVal}>{stats.week}</Text>
        </View>
        <View style={styles.statCellBorder} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>All Time</Text>
          <Text style={styles.statVal}>{stats.allTime}</Text>
        </View>
      </View>

      {/* Target input dialog */}
      <Modal visible={customInputVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Custom Target</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="e.g. 33, 100, 1000..."
              placeholderTextColor={COLORS.text3}
              value={customTargetInput}
              onChangeText={setCustomTargetInput}
              style={styles.modalInput}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.bg3 }]}
                onPress={() => setCustomInputVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={handleSetCustomTarget}>
                <Text style={styles.modalBtnText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Custom Dhikr Creator Modal */}
      <Modal visible={newDhikrVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Custom Dhikr</Text>
            
            <Text style={styles.fieldLabel}>Dhikr Name (English)</Text>
            <TextInput
              placeholder="e.g. Astaghfirullah Al-Adheem"
              placeholderTextColor={COLORS.text3}
              value={newDhikrName}
              onChangeText={setNewDhikrName}
              style={styles.modalInput}
            />

            <Text style={styles.fieldLabel}>Arabic Supplication Script</Text>
            <TextInput
              placeholder="e.g. أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ"
              placeholderTextColor={COLORS.text3}
              value={newDhikrArabic}
              onChangeText={setNewDhikrArabic}
              style={[styles.modalInput, { textAlign: 'right' }]}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: COLORS.bg3 }]}
                onPress={() => setNewDhikrVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={handleAddCustomDhikr}>
                <Text style={styles.modalBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Reset confirmation Bottom Sheet */}
      <Modal visible={resetModalVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setResetModalVisible(false)}
        >
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Reset Active Count?</Text>
            <Text style={styles.sheetDesc}>
              This will clear your current count of {count} for {activeDhikr.name}.
            </Text>

            <TouchableOpacity style={styles.resetConfirmBtn} onPress={handleReset}>
              <Text style={styles.resetConfirmBtnText}>Clear Count</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetCancelBtn} onPress={() => setResetModalVisible(false)}>
              <Text style={styles.resetCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  resetIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  targetLabel: {
    fontSize: 12,
    color: COLORS.text3,
    marginRight: 10,
    textTransform: 'uppercase',
  },
  targetPills: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  targetPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  targetPillActive: {
    backgroundColor: COLORS.teal,
    borderColor: COLORS.teal,
  },
  targetPillText: {
    fontSize: 11,
    color: COLORS.text3,
    fontWeight: 'bold',
  },
  targetPillTextActive: {
    color: COLORS.bg,
  },
  dhikrSelectBar: {
    paddingVertical: 10,
  },
  dhikrScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dhikrPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginRight: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dhikrPillActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  dhikrPillText: {
    fontSize: 12,
    color: COLORS.text2,
    fontWeight: 'bold',
  },
  dhikrPillTextActive: {
    color: COLORS.bg,
  },
  addDhikrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(201,168,76,0.15)',
  },
  addDhikrText: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  mainTappingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  gaugeContainer: {
    width: 240,
    height: 240,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  burstRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: COLORS.teal,
    backgroundColor: 'transparent',
  },
  counterTextOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentCount: {
    fontSize: 64, // 64px requirement
    fontWeight: 'bold',
    color: COLORS.text,
    fontFamily: 'Amiri_400Regular',
  },
  targetProgress: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 2,
    fontWeight: '500',
  },
  dhikrArabicWrapper: {
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 30,
  },
  dhikrArabic: {
    fontSize: 24,
    fontFamily: 'Amiri_400Regular',
    color: COLORS.gold2,
    textAlign: 'center',
    lineHeight: 36,
  },
  dhikrNameSub: {
    fontSize: 12,
    color: COLORS.text3,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tapInstruction: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    marginTop: 30,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  giantCircleBtn: {
    width: 80, // 80px requirement
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  controlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 11,
    color: COLORS.text3,
    marginRight: 8,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  themePills: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginHorizontal: 4,
    borderColor: 'transparent',
    borderWidth: 1.5,
  },
  controlGroupRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconControlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  hapticCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  hapticCycleBtnOff: {
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  hapticModeText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  statsFooter: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statCellBorder: {
    width: 1,
    height: '70%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.text3,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  statVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  modalContent: {
    backgroundColor: COLORS.bg2,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: 20,
    borderRadius: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    color: COLORS.gold,
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    color: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    marginBottom: 12,
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalBtn: {
    flex: 0.48,
    height: 44,
    backgroundColor: COLORS.gold,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.bg,
  },
  sheetOverlay: {
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
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  sheetDesc: {
    fontSize: 13,
    color: COLORS.text3,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  resetConfirmBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  resetConfirmBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  resetCancelBtn: {
    width: '100%',
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetCancelBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text2,
  },
});
