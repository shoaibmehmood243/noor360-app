import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useTrackerStore, PrayerStatus, DayRecord } from '../../src/store/trackerStore';
import { COLORS } from '../../constants/theme';
import { useThemeContext } from '../../src/context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../../components/ui/Card';
import ArabicGeometricBg from '../../components/ui/ArabicGeometricBg';
import DuaShareModal, { ShareData } from '../../components/ui/DuaShareModal';
import ScreenBackground from '../../components/ui/ScreenBackground';

const { width } = Dimensions.get('window');

const PRAYERS: { key: keyof DayRecord; label: string; arabic: string }[] = [
  { key: 'fajr', label: 'Fajr', arabic: 'الفجر' },
  { key: 'dhuhr', label: 'Dhuhr', arabic: 'الظهر' },
  { key: 'asr', label: 'Asr', arabic: 'العصر' },
  { key: 'maghrib', label: 'Maghrib', arabic: 'المغرب' },
  { key: 'isha', label: 'Isha', arabic: 'العشاء' },
];

export default function SalahTrackerScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  const STATUSES: { value: PrayerStatus; label: string; icon: string; color: string; bg: string }[] = [
    { value: 'prayed', label: 'Prayed on Time', icon: 'checkmark-circle', color: '#10B981', bg: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.06)' },
    { value: 'qadha', label: 'Qadha (Late)', icon: 'time', color: COLORS.gold, bg: isDark ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.06)' },
    { value: 'missed', label: 'Missed', icon: 'close-circle', color: '#EF4444', bg: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)' },
    { value: 'pending', label: 'Not Logged', icon: 'ellipse-outline', color: COLORS.text3, bg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
  ];

  const trackerStore = useTrackerStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Modals status
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activePrayerKey, setActivePrayerKey] = useState<keyof DayRecord | null>(null);
  
  // Past day detail modal
  const [pastDayModalVisible, setPastDayModalVisible] = useState(false);
  const [pastDayTarget, setPastDayTarget] = useState<string>('');

  // Share Streak State
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [streakToShare, setStreakToShare] = useState<ShareData | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    trackerStore.initializeToday(todayStr);
    trackerStore.calculateStreak();
  }, []);

  const handleShareStreak = () => {
    const activeRate = stats.weekPct;
    setStreakToShare({
      title: 'Salah Devotion Streak',
      arabic: 'عَلَيْكُمْ بِالصَّلَاةِ فِي أَوْقَاتِهَا',
      transliteration: `${trackerStore.streak} Days`,
      translation: `Current streak: ${trackerStore.streak} days • Personal best: ${trackerStore.longestStreak} days\nWeekly Devotion Completion Rate: ${activeRate}%`,
      reference: 'Spiritual Consistency Log • Noor360 Salah Tracker',
      contentType: 'streak',
    });
    setShareModalVisible(true);
  };

  const getRecordForDate = (date: string): DayRecord => {
    return trackerStore.records[date] || {
      fajr: 'pending',
      dhuhr: 'pending',
      asr: 'pending',
      maghrib: 'pending',
      isha: 'pending',
    };
  };

  const activeRecord = getRecordForDate(selectedDate);

  // Toggle prayed status on single tap
  const handleSingleTap = (prayerKey: keyof DayRecord) => {
    const currentStatus = activeRecord[prayerKey];
    const newStatus: PrayerStatus = currentStatus === 'prayed' ? 'pending' : 'prayed';
    trackerStore.markPrayer(selectedDate, prayerKey, newStatus);
  };

  // Open detail status selector modal
  const handleLongPress = (prayerKey: keyof DayRecord) => {
    setActivePrayerKey(prayerKey);
    setSheetVisible(true);
  };

  const handleSelectStatus = (status: PrayerStatus) => {
    if (activePrayerKey) {
      trackerStore.markPrayer(selectedDate, activePrayerKey, status);
      setSheetVisible(false);
      setActivePrayerKey(null);
    }
  };

  // Stats Calculator
  const getStats = () => {
    const records = trackerStore.records;
    
    // Today
    const todayRec = records[todayStr] || { fajr: 'pending', dhuhr: 'pending', asr: 'pending', maghrib: 'pending', isha: 'pending' };
    const todayPrayed = Object.values(todayRec).filter(v => v === 'prayed' || v === 'qadha').length;
    
    // This Week (last 7 days)
    let weekLogged = 0;
    let weekPrayed = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const rec = records[dStr];
      if (rec) {
        Object.values(rec).forEach(v => {
          if (v !== 'pending') weekLogged++;
          if (v === 'prayed' || v === 'qadha') weekPrayed++;
        });
      }
    }

    // This Month (last 30 days)
    let monthLogged = 0;
    let monthPrayed = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const rec = records[dStr];
      if (rec) {
        Object.values(rec).forEach(v => {
          if (v !== 'pending') monthLogged++;
          if (v === 'prayed' || v === 'qadha') monthPrayed++;
        });
      }
    }

    return {
      todayPrayed,
      weekPct: weekLogged > 0 ? Math.round((weekPrayed / weekLogged) * 100) : 0,
      monthPct: monthLogged > 0 ? Math.round((monthPrayed / monthLogged) * 100) : 0,
    };
  };

  const stats = getStats();

  // Generate last 7 days list for weekly grid
  const getWeeklyDates = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push({
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
      });
    }
    return dates;
  };

  const weeklyDates = getWeeklyDates();

  // Generate current month days for calendar
  const getMonthlyCalendarDays = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // First day of current month
    const firstDay = new Date(year, month, 1);
    const startDayIndex = (firstDay.getDay() + 6) % 7; // Align Mon=0 to Sun=6
    
    // Total days in month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const calendar = [];
    
    // Pad previous month empty slots
    for (let i = 0; i < startDayIndex; i++) {
      calendar.push(null);
    }
    
    // Actual days
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month, day);
      const dateStr = dateObj.toISOString().split('T')[0];
      calendar.push({
        dayNum: day,
        dateStr,
      });
    }
    
    return calendar;
  };

  const calendarDays = getMonthlyCalendarDays();

  // Color mappings
  const getStatusColor = (status: PrayerStatus) => {
    if (status === 'prayed') return '#10B981';
    if (status === 'qadha') return COLORS.gold;
    if (status === 'missed') return '#EF4444';
    return COLORS.bg3;
  };

  const renderStatusIcon = (status: PrayerStatus) => {
    if (status === 'prayed') return <Ionicons name="checkmark" size={24} color="#FFFFFF" />;
    if (status === 'qadha') return <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' }}>~</Text>;
    if (status === 'missed') return <Ionicons name="close" size={24} color="#FFFFFF" />;
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      <ScreenBackground />
      {/* Background patterns */}
      <ArabicGeometricBg size={420} style={styles.backgroundOverlay} />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/prayer');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Salah Tracker</Text>
        <TouchableOpacity 
          style={styles.streakBadge} 
          onPress={handleShareStreak}
          activeOpacity={0.8}
        >
          <Text style={styles.streakText}>🔥 {trackerStore.streak}d  <Ionicons name="share-social-outline" size={10} color={COLORS.gold} /></Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Streak & Motivation Card */}
        <Card style={styles.motivationCard}>
          <View style={styles.motivationRow}>
            <View>
              <Text style={styles.motivationTitle}>Daily Spiritual Devotion</Text>
              <Text style={styles.motivationSubtitle}>
                "Indeed, prayer prohibits immorality and wrongdoing."
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.statCircleBox}
              onPress={handleShareStreak}
              activeOpacity={0.8}
            >
              <Text style={styles.longestStreakLabel}>Max Streak</Text>
              <Text style={styles.longestStreakVal}>{trackerStore.longestStreak} days</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="share-social-outline" size={10} color={COLORS.gold} />
                <Text style={{ fontSize: 9, color: COLORS.gold, marginLeft: 2, fontWeight: '700' }}>SHARE</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Animated Completion Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>{stats.todayPrayed} of 5 prayers completed today</Text>
              <Text style={styles.progressPct}>{Math.round((stats.todayPrayed / 5) * 100)}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${(stats.todayPrayed / 5) * 100}%` }]} />
            </View>
          </View>
        </Card>

        {/* 5 Today Prayer Nodes */}
        <Text style={styles.sectionTitle}>Today's Log</Text>
        <Card style={styles.todayCard}>
          <Text style={styles.todayDesc}>Tap to quickly mark prayed, or long press for status details.</Text>
          <View style={styles.nodesContainer}>
            {PRAYERS.map((p) => {
              const status = activeRecord[p.key];
              const activeColor = getStatusColor(status);
              
              return (
                <View key={p.key} style={styles.prayerRow}>
                  <View style={styles.prayerMetaCol}>
                    <Text style={styles.prayerName}>{p.label}</Text>
                    <Text style={styles.prayerArabic}>{p.arabic}</Text>
                  </View>
                  
                  <TouchableOpacity
                    onPress={() => handleSingleTap(p.key)}
                    onLongPress={() => handleLongPress(p.key)}
                    delayLongPress={400}
                    style={[
                      styles.circleNode,
                      { borderColor: activeColor },
                      status === 'prayed' && { backgroundColor: '#10B981' },
                      status === 'qadha' && { backgroundColor: COLORS.gold },
                      status === 'missed' && { backgroundColor: '#EF4444' },
                    ]}
                  >
                    {renderStatusIcon(status)}
                  </TouchableOpacity>

                  {/* Status Indicator Tag */}
                  <TouchableOpacity 
                    onPress={() => handleLongPress(p.key)}
                    style={[styles.statusTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}
                  >
                    <Text style={[styles.statusTagText, { color: status !== 'pending' ? activeColor : COLORS.text3 }]}>
                      {status === 'pending' ? 'log status' : status.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Weekly Micro-Grid */}
        <Text style={styles.sectionTitle}>Weekly Devotion Grid</Text>
        <Card style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyDesc}>Log of the past 7 days. Tap any day row to backfill missed records.</Text>
          </View>
          <View style={styles.weeklyGrid}>
            {weeklyDates.map((day) => {
              const dayRec = getRecordForDate(day.dateStr);
              
              return (
                <TouchableOpacity
                  key={day.dateStr}
                  onPress={() => {
                    setPastDayTarget(day.dateStr);
                    setPastDayModalVisible(true);
                  }}
                  style={[
                    styles.weeklyCol,
                    day.dateStr === todayStr && styles.weeklyColToday,
                  ]}
                >
                  <Text style={styles.weeklyDayName}>{day.dayName}</Text>
                  <Text style={styles.weeklyDayNum}>{day.dayNum}</Text>
                  
                  {/* Dots stack */}
                  <View style={styles.dotsStack}>
                    {PRAYERS.map((p) => {
                      const st = dayRec[p.key];
                      return (
                        <View
                          key={p.key}
                          style={[
                            styles.microDot,
                            { backgroundColor: getStatusColor(st) },
                          ]}
                        />
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Stats Cards Section */}
        <Text style={styles.sectionTitle}>Devotion Metrics</Text>
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>Today Log</Text>
            <Text style={styles.statVal}>{Math.round((stats.todayPrayed / 5) * 100)}%</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>This Week</Text>
            <Text style={styles.statVal}>{stats.weekPct}%</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statLabel}>This Month</Text>
            <Text style={styles.statVal}>{stats.monthPct}%</Text>
          </Card>
        </View>

        {/* Monthly Calendar View */}
        <Text style={styles.sectionTitle}>Monthly Calendar Matrix</Text>
        <Card style={styles.calendarCard}>
          <View style={styles.calendarHeaderRow}>
            <Text style={styles.calendarMonthName}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.calendarMonthStats}>{stats.monthPct}% logged</Text>
          </View>
          
          <View style={styles.calendarGrid}>
            {/* Week Headers */}
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => (
              <Text key={w} style={styles.weekHeaderCell}>{w}</Text>
            ))}
            
            {/* Grid days */}
            {calendarDays.map((cell, idx) => {
              if (!cell) {
                return <View key={`empty_${idx}`} style={styles.calendarDayCellEmpty} />;
              }
              
              const isToday = cell.dateStr === todayStr;
              const dayRec = getRecordForDate(cell.dateStr);
              
              return (
                <TouchableOpacity
                  key={cell.dateStr}
                  onPress={() => {
                    setPastDayTarget(cell.dateStr);
                    setPastDayModalVisible(true);
                  }}
                  style={[
                    styles.calendarDayCell,
                    isToday && styles.calendarDayCellToday,
                  ]}
                >
                  <Text style={[styles.calendarDayNum, isToday && { color: COLORS.teal, fontWeight: 'bold' }]}>
                    {cell.dayNum}
                  </Text>
                  
                  {/* Row of 5 mini indicators */}
                  <View style={styles.calendarDotsRow}>
                    {PRAYERS.map((p) => {
                      const st = dayRec[p.key];
                      return (
                        <View
                          key={p.key}
                          style={[
                            styles.nanoDot,
                            { backgroundColor: getStatusColor(st) },
                          ]}
                        />
                      );
                    })}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

      </ScrollView>

      {/* 4-Option Status Bottom Sheet Dialog */}
      <Modal
        visible={sheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setSheetVisible(false)}>
          <View style={styles.sheetContent} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              Log status for {activePrayerKey ? activePrayerKey.toUpperCase() : ''}
            </Text>
            
            <View style={styles.optionsList}>
              {STATUSES.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => handleSelectStatus(item.value)}
                  style={[styles.optionRow, { backgroundColor: item.bg }]}
                >
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                  <Text style={[styles.optionLabel, { color: item.color }]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Past Day Backfill Record Editor Modal */}
      <Modal
        visible={pastDayModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPastDayModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Devotion Record</Text>
              <Text style={styles.modalDate}>
                {pastDayTarget ? new Date(pastDayTarget).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''}
              </Text>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {pastDayTarget && PRAYERS.map((p) => {
                const dayRec = getRecordForDate(pastDayTarget);
                const st = dayRec[p.key];
                
                return (
                  <View key={p.key} style={styles.modalPrayerRow}>
                    <View style={styles.modalPrayerMeta}>
                      <Text style={styles.modalPrayerLabel}>{p.label}</Text>
                      <Text style={styles.modalPrayerArabic}>{p.arabic}</Text>
                    </View>
                    
                    <View style={styles.modalOptionsGrid}>
                      {(['prayed', 'qadha', 'missed', 'pending'] as PrayerStatus[]).map((opt) => {
                        const active = st === opt;
                        const optMeta = STATUSES.find(s => s.value === opt)!;
                        return (
                          <TouchableOpacity
                            key={opt}
                            onPress={() => {
                              trackerStore.markPrayer(pastDayTarget, p.key, opt);
                            }}
                            style={[
                              styles.modalOptPill,
                              active && { borderColor: optMeta.color, backgroundColor: optMeta.bg },
                            ]}
                          >
                            <Text style={[styles.modalOptPillText, active && { color: optMeta.color, fontWeight: 'bold' }]}>
                              {opt.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPastDayModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Save and Close</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>

      <DuaShareModal
        visible={shareModalVisible}
        shareData={streakToShare}
        onClose={() => {
          setShareModalVisible(false);
          setStreakToShare(null);
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
  backgroundOverlay: {
    opacity: 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  streakBadge: {
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 24,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  motivationCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  motivationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  motivationTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  motivationSubtitle: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.text2,
    maxWidth: width * 0.58,
    lineHeight: 18,
  },
  statCircleBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg3,
    borderRadius: 10,
    padding: 8,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
  },
  longestStreakLabel: {
    fontSize: 8,
    color: COLORS.text3,
    textTransform: 'uppercase',
  },
  longestStreakVal: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 2,
  },
  progressSection: {
    marginTop: 18,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.text2,
  },
  progressPct: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.bg3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },
  todayCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 16,
    padding: 16,
  },
  todayDesc: {
    fontSize: 12,
    color: COLORS.text2,
    marginBottom: 16,
  },
  nodesContainer: {
    flexDirection: 'column',
  },
  prayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg3,
  },
  prayerMetaCol: {
    width: '32%',
  },
  prayerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  prayerArabic: {
    fontSize: 11,
    color: COLORS.gold2,
    marginTop: 2,
  },
  circleNode: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  statusTag: {
    width: '36%',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  weeklyCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    borderRadius: 16,
    padding: 16,
  },
  weeklyHeader: {
    marginBottom: 14,
  },
  weeklyDesc: {
    fontSize: 11,
    color: COLORS.text2,
  },
  weeklyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyCol: {
    alignItems: 'center',
    width: '12%',
    paddingVertical: 8,
    borderRadius: 8,
  },
  weeklyColToday: {
    backgroundColor: 'rgba(201,168,76,0.08)',
    borderWidth: 0.5,
    borderColor: COLORS.gold,
  },
  weeklyDayName: {
    fontSize: 9,
    color: COLORS.text3,
    fontWeight: 'bold',
  },
  weeklyDayNum: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 10,
  },
  dotsStack: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  microDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginVertical: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '31%',
    backgroundColor: COLORS.bg2,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  statLabel: {
    fontSize: 10,
    color: COLORS.text3,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 4,
  },
  calendarCard: {
    backgroundColor: COLORS.bg2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarMonthName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  calendarMonthStats: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  weekHeaderCell: {
    width: '13%',
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.text3,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  calendarDayCell: {
    width: '13%',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.bg3,
    borderWidth: 0.5,
    borderColor: COLORS.bg3,
    marginBottom: 6,
  },
  calendarDayCellToday: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  calendarDayCellEmpty: {
    width: '13%',
    height: 48,
    marginBottom: 6,
  },
  calendarDayNum: {
    fontSize: 11,
    color: COLORS.text2,
    fontWeight: '500',
  },
  calendarDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 4,
  },
  nanoDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: 0.5,
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
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.bg3,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.bg3,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 18,
    textAlign: 'center',
  },
  optionsList: {
    flexDirection: 'column',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg3,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalDate: {
    fontSize: 12,
    color: COLORS.gold,
    marginTop: 4,
  },
  modalScroll: {
    marginBottom: 16,
  },
  modalPrayerRow: {
    flexDirection: 'column',
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.bg3,
    paddingBottom: 12,
  },
  modalPrayerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPrayerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalPrayerArabic: {
    fontSize: 12,
    color: COLORS.gold2,
  },
  modalOptionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalOptPill: {
    width: '23%',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.bg3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalOptPillText: {
    fontSize: 8,
    color: COLORS.text3,
    fontWeight: '600',
  },
  modalCloseBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
