import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Text as SvgText, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { usePrayer } from '../../src/hooks/usePrayer';
import { getQiblaBearing } from '../../src/api/client';
import { COLORS } from '../../constants/theme';
import Card from '../../components/ui/Card';
import AppHeader from '../../components/AppHeader';
import { router } from 'expo-router';
import { useThemeContext } from '../../src/context/ThemeContext';

export default function PrayerTabScreen() {
  const { theme } = useThemeContext();
  const isDark = theme === 'dark';

  const heroGradient = isDark
    ? ['#131C2E', '#0B0F19'] as const
    : ['#FFFFFF', '#EAECEF'] as const;
  const prayerStore = usePrayer();

  // Modal Visibility States
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [qiblaModalVisible, setQiblaModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  // Inputs and Calculations
  const [searchCity, setSearchCity] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [loadingQibla, setLoadingQibla] = useState(false);

  // Settings State
  const [adhanNotifications, setAdhanNotifications] = useState(true);
  const [calcMethod, setCalcMethod] = useState('ISNA');

  // Fetch coordinates on mount and trigger countdown timer
  useEffect(() => {
    if (prayerStore.prayerTimes) {
      prayerStore.startCountdown();
    }
  }, [prayerStore.prayerTimes]);

  // Compute live progress percentage
  const getProgressPercentage = () => {
    if (!prayerStore.prayerTimes || !prayerStore.nextPrayer) return 0;
    const times = prayerStore.prayerTimes;
    const now = new Date();

    const parseTime = (timeStr: string, addDays = 0) => {
      const cleanTime = timeStr.split(' ')[0];
      const [hours, minutes] = cleanTime.split(':').map(Number);
      const d = new Date();
      d.setDate(d.getDate() + addDays);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const list = [
      { name: 'Fajr', time: parseTime(times.Fajr) },
      { name: 'Sunrise', time: parseTime(times.Sunrise) },
      { name: 'Dhuhr', time: parseTime(times.Dhuhr) },
      { name: 'Asr', time: parseTime(times.Asr) },
      { name: 'Maghrib', time: parseTime(times.Maghrib) },
      { name: 'Isha', time: parseTime(times.Isha) },
    ];

    let nextIndex = list.findIndex((p) => p.name === prayerStore.nextPrayer);
    let prevIndex = nextIndex - 1;

    let prevTime: Date;
    let nextTime = list[nextIndex].time;

    if (prevIndex < 0) {
      prevTime = parseTime(times.Isha, -1);
    } else {
      prevTime = list[prevIndex].time;
    }

    if (prayerStore.nextPrayer === 'Fajr' && nextTime < now) {
      nextTime = parseTime(times.Fajr, 1);
      prevTime = parseTime(times.Isha);
    }

    const total = nextTime.getTime() - prevTime.getTime();
    const elapsed = now.getTime() - prevTime.getTime();

    return Math.max(0, Math.min(1, elapsed / total));
  };

  // Convert minutes into hours and minutes
  const formatCountdown = (minutes: number | null) => {
    if (minutes === null) return '--:--';
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  // Determine active prayer (the one currently in effect)
  const getActivePrayerName = () => {
    if (!prayerStore.nextPrayer) return '';
    const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const nextIdx = order.indexOf(prayerStore.nextPrayer);
    if (nextIdx === 0) return 'Isha';
    return order[nextIdx - 1];
  };

  const handleCitySearch = async () => {
    if (!searchCity.trim() || !searchCountry.trim()) {
      Alert.alert('Incomplete Fields', 'Please specify both City and Country names.');
      return;
    }
    try {
      await prayerStore.fetchByCity(searchCity, searchCountry);
      setCityModalVisible(false);
      setSearchCity('');
      setSearchCountry('');
    } catch (e: any) {
      Alert.alert('Retrieval Failure', e.message || 'Unable to locate prayer timings.');
    }
  };

  const handleOpenQibla = async () => {
    setQiblaModalVisible(true);
    setLoadingQibla(true);
    try {
      const bearing = await getQiblaBearing(prayerStore.location.lat, prayerStore.location.lon);
      setQiblaBearing(bearing);
    } catch (e) {
      console.warn('Failed to load Qibla direction:', e);
      setQiblaBearing(21.42); // Default to Makkah orientation relative north
    } finally {
      setLoadingQibla(false);
    }
  };

  const activePrayer = getActivePrayerName();
  const times = prayerStore.prayerTimes;

  const prayerCells = times
    ? [
      { name: 'Fajr', time: times.Fajr, icon: 'sunny-outline', arabic: 'الفجر' },
      { name: 'Sunrise', time: times.Sunrise, icon: 'partly-sunny-outline', arabic: 'الشروق' },
      { name: 'Dhuhr', time: times.Dhuhr, icon: 'sunny', arabic: 'الظهر' },
      { name: 'Asr', time: times.Asr, icon: 'cloudy-night-outline', arabic: 'العصر' },
      { name: 'Maghrib', time: times.Maghrib, icon: 'moon-outline', arabic: 'المغرب' },
      { name: 'Isha', time: times.Isha, icon: 'moon', arabic: 'العشاء' },
    ]
    : [];

  const progress = getProgressPercentage();
  const radius = 60;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Brand App Header */}
      <AppHeader onSettingsPress={() => router.push('/settings')} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Navigation Action icons */}
        <View style={styles.quickNavigationRow}>
          <Text style={styles.tabSectionTitle}>Daily Schedule</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/prayer/qibla')}>
              <Ionicons name="compass-outline" size={20} color={COLORS.gold} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/prayer/tracker')}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.teal} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/prayer/notifications')}>
              <Ionicons name="settings-outline" size={20} color={COLORS.text2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Location & Hijri Calendar Card */}
        <Card style={styles.locationCalendarCard}>
          <View style={styles.locationBox}>
            <Ionicons name="location" size={18} color={COLORS.teal} />
            <View style={styles.locationDetails}>
              <Text style={styles.cityNameText}>{prayerStore.location.city}</Text>
              <Text style={styles.coordsText}>
                {prayerStore.location.lat.toFixed(4)}° N • {prayerStore.location.lon.toFixed(4)}° E
              </Text>
            </View>
            <TouchableOpacity style={styles.changeLocationBtn} onPress={() => setCityModalVisible(true)}>
              <Text style={styles.changeLocationBtnText}>Change</Text>
            </TouchableOpacity>
          </View>

          {prayerStore.hijriDate && (
            <View style={styles.hijriBox}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.gold} />
              <Text style={styles.hijriDateText}>
                {prayerStore.hijriDate.day} {prayerStore.hijriDate.month.en} {prayerStore.hijriDate.year} AH
              </Text>
              <Text style={styles.hijriArabicText}>
                {prayerStore.hijriDate.month.ar} {prayerStore.hijriDate.year} هـ
              </Text>
            </View>
          )}
        </Card>

        {/* Live Loading Overlay */}
        {prayerStore.isLoading && !times ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={styles.loaderText}>Calculating coordinates & prayer timelines...</Text>
          </View>
        ) : times ? (
          <>
            {/* Hero Live Countdown Card */}
            <Card style={styles.countdownHeroCard}>
              <LinearGradient
                colors={heroGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.countdownGradient}
              >
                {/* Radial SVG Gauge */}
                <View style={styles.gaugeContainer}>
                  <Svg width={150} height={150} viewBox="0 0 150 150">
                    <Circle
                      cx="75"
                      cy="75"
                      r={radius}
                      stroke="#1E293B"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />
                    <Circle
                      cx="75"
                      cy="75"
                      r={radius}
                      stroke={COLORS.teal}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      transform="rotate(-90 75 75)"
                    />
                  </Svg>
                  {/* Inside Text */}
                  <View style={styles.gaugeInnerText}>
                    <Text style={styles.gaugePrayerName}>{prayerStore.nextPrayer}</Text>
                    <Text style={styles.gaugeCountdownTime}>
                      {formatCountdown(prayerStore.minutesUntilNext)}
                    </Text>
                    <Text style={styles.gaugeSubText}>remaining</Text>
                  </View>
                </View>

                {/* Hero Details */}
                <View style={styles.heroDescription}>
                  <Text style={styles.heroAlertTitle}>Next Prayer Inflow</Text>
                  <Text style={styles.heroAlertSubtitle}>
                    Prepare for <Text style={{ color: COLORS.teal, fontWeight: 'bold' }}>{prayerStore.nextPrayer}</Text> prayer congregation.
                  </Text>
                  <View style={styles.activeIndicatorRow}>
                    <View style={styles.pulseDot} />
                    <Text style={styles.activeStatusText}>
                      Current: {activePrayer}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Card>

            {/* 6-cell Timetable Grid */}
            <Text style={styles.gridSectionTitle}>Congregation Timetable</Text>
            <View style={styles.prayerTimesGrid}>
              {prayerCells.map((cell) => {
                const isActive = cell.name === activePrayer;
                return (
                  <View
                    key={cell.name}
                    style={[
                      styles.gridItem,
                      isActive && styles.gridItemActive,
                    ]}
                  >
                    <View style={styles.gridHeaderRow}>
                      <Ionicons
                        name={cell.icon as any}
                        size={20}
                        color={isActive ? COLORS.teal : COLORS.gold}
                      />
                      <Text style={[styles.gridTimeArabic, isActive && { color: COLORS.teal }]}>
                        {cell.arabic}
                      </Text>
                    </View>
                    <Text style={[styles.gridNameText, isActive && styles.gridTextActive]}>
                      {cell.name}
                    </Text>
                    <Text style={[styles.gridTimeText, isActive && { color: COLORS.teal }]}>
                      {cell.time.split(' ')[0]}
                    </Text>
                    {isActive && (
                      <View style={styles.activeBadgeIndicator}>
                        <Text style={styles.activeBadgeText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={32} color={COLORS.text3} />
            <Text style={styles.errorText}>
              {prayerStore.error || 'Failed to fetch prayer calculations.'}
            </Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() =>
                prayerStore.fetchPrayerTimes(prayerStore.location.lat, prayerStore.location.lon)
              }
            >
              <Text style={styles.retryBtnText}>Retry Fetch</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 1. City Change Search Overlay Modal */}
      <Modal
        visible={cityModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>Search Location</Text>
              <TouchableOpacity onPress={() => setCityModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text3} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>City Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Lahore, London, New York"
              placeholderTextColor={COLORS.text3}
              value={searchCity}
              onChangeText={setSearchCity}
            />

            <Text style={styles.inputLabel}>Country Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Pakistan, UK, USA"
              placeholderTextColor={COLORS.text3}
              value={searchCountry}
              onChangeText={setSearchCountry}
            />

            <TouchableOpacity style={styles.modalActionBtn} onPress={handleCitySearch}>
              <Text style={styles.modalActionBtnText}>Find Times</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>

      {/* 2. Qibla Bearing compass Overlay Modal */}
      <Modal
        visible={qiblaModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQiblaModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>Qibla Compass</Text>
              <TouchableOpacity onPress={() => setQiblaModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text3} />
              </TouchableOpacity>
            </View>

            {loadingQibla ? (
              <View style={styles.qiblaLoaderBox}>
                <ActivityIndicator size="small" color={COLORS.gold} />
                <Text style={styles.qiblaLoaderText}>Resolving direction metrics...</Text>
              </View>
            ) : (
              <View style={styles.qiblaContentBox}>
                <View style={styles.compassWrapper}>
                  {/* Static elegant decorative compass bearing graphic */}
                  <Svg width={180} height={180} viewBox="0 0 100 100">
                    <Circle cx="50" cy="50" r="46" stroke={COLORS.bg3} strokeWidth="2" fill="none" />
                    <Circle cx="50" cy="50" r="42" stroke={COLORS.gold} strokeWidth="1" fill="none" />
                    <Circle cx="50" cy="50" r="2" fill={COLORS.teal} />

                    {/* Cardinal coordinates */}
                    <SvgText x="48" y="12" fill={COLORS.text} fontSize="7" fontWeight="bold">N</SvgText>
                    <SvgText x="48" y="93" fill={COLORS.text3} fontSize="7" fontWeight="bold">S</SvgText>
                    <SvgText x="88" y="52" fill={COLORS.text3} fontSize="7" fontWeight="bold">E</SvgText>
                    <SvgText x="8" y="52" fill={COLORS.text3} fontSize="7" fontWeight="bold">W</SvgText>

                    {/* Orient needle toward bearing direction */}
                    <Circle
                      cx="50"
                      cy="50"
                      r="36"
                      stroke={COLORS.teal}
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      fill="none"
                    />

                    {/* Rotating needle pointer line */}
                    <Line
                      x1="50"
                      y1="50"
                      x2="50"
                      y2="18"
                      stroke={COLORS.teal}
                      strokeWidth="2.5"
                      transform={`rotate(${qiblaBearing || 0} 50 50)`}
                    />
                  </Svg>
                </View>
                <Text style={styles.qiblaBearingNumber}>
                  {qiblaBearing?.toFixed(2)}°
                </Text>
                <Text style={styles.qiblaSubtitle}>
                  Angle from North to Makkah Al-Mukarramah Kaaba.
                </Text>
              </View>
            )}
          </Card>
        </View>
      </Modal>

      {/* 3. Settings Preferences Overlay Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitleText}>Calculation Settings</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text3} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingNameText}>Adhan Sound Alert</Text>
                <Text style={styles.settingDescText}>Play full audio caller notification</Text>
              </View>
              <TouchableOpacity
                onPress={() => setAdhanNotifications(!adhanNotifications)}
                style={[
                  styles.toggleContainer,
                  adhanNotifications ? { backgroundColor: COLORS.teal } : { backgroundColor: COLORS.bg3 },
                ]}
              >
                <View style={[styles.toggleThumb, adhanNotifications && { alignSelf: 'flex-end' }]} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingNameText}>Calculation Method</Text>
                <Text style={styles.settingDescText}>ISNA, Egypt or Muslim World League</Text>
              </View>
              <View style={styles.dropdownDisplay}>
                <Text style={styles.dropdownSelectedText}>{calcMethod}</Text>
              </View>
            </View>

            <View style={styles.calcMethodsGrid}>
              {['ISNA', 'MWL', 'EGYPT', 'KARACHI'].map((method) => (
                <TouchableOpacity
                  key={method}
                  onPress={() => setCalcMethod(method)}
                  style={[
                    styles.methodPill,
                    calcMethod === method && { borderColor: COLORS.teal, backgroundColor: 'rgba(45,212,191,0.06)' },
                  ]}
                >
                  <Text style={[styles.methodPillText, calcMethod === method && { color: COLORS.teal, fontWeight: 'bold' }]}>
                    {method}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.modalActionBtn} onPress={() => setSettingsModalVisible(false)}>
              <Text style={styles.modalActionBtnText}>Apply Preferences</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingBottom: 110,
    paddingHorizontal: 20,
  },
  quickNavigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  tabSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  locationCalendarCard: {
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 12,
    marginBottom: 12,
  },
  locationDetails: {
    flex: 1,
    marginLeft: 12,
  },
  cityNameText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  coordsText: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
  },
  changeLocationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.bg3,
  },
  changeLocationBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.teal,
  },
  hijriBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hijriDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gold,
    flex: 1,
    marginLeft: 10,
  },
  hijriArabicText: {
    fontSize: 13,
    color: COLORS.text2,
    fontFamily: 'Amiri_400Regular',
  },
  loaderBox: {
    height: 350,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: COLORS.text3,
    fontSize: 13,
    marginTop: 14,
  },
  countdownHeroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(45,212,191,0.15)',
    marginBottom: 24,
  },
  countdownGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gaugeContainer: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  gaugeInnerText: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugePrayerName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.teal,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  gaugeCountdownTime: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginVertical: 2,
  },
  gaugeSubText: {
    fontSize: 10,
    color: COLORS.text3,
  },
  heroDescription: {
    flex: 1,
    marginLeft: 20,
  },
  heroAlertTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.gold,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroAlertSubtitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 20,
  },
  activeIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.teal,
    marginRight: 8,
  },
  activeStatusText: {
    fontSize: 12,
    color: COLORS.text2,
    fontWeight: '600',
  },
  gridSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prayerTimesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    backgroundColor: COLORS.bg2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    position: 'relative',
  },
  gridItemActive: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(45,212,191,0.04)',
    borderWidth: 1.5,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gridTimeArabic: {
    fontSize: 12,
    color: COLORS.text3,
    fontFamily: 'Amiri_400Regular',
  },
  gridNameText: {
    fontSize: 14,
    color: COLORS.text2,
    fontWeight: '600',
    marginTop: 10,
  },
  gridTextActive: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  gridTimeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 4,
  },
  activeBadgeIndicator: {
    position: 'absolute',
    bottom: -6,
    right: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.teal,
  },
  activeBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.bg,
  },
  errorBox: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.text3,
    textAlign: 'center',
    marginVertical: 14,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.bg3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  retryBtnText: {
    color: COLORS.gold,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.bg2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.bg3,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: COLORS.bg3,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 12,
  },
  modalActionBtn: {
    backgroundColor: COLORS.teal,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  modalActionBtnText: {
    color: COLORS.bg,
    fontWeight: 'bold',
    fontSize: 15,
  },
  qiblaLoaderBox: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qiblaLoaderText: {
    color: COLORS.text3,
    fontSize: 12,
    marginTop: 12,
  },
  qiblaContentBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  compassWrapper: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg3,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  qiblaBearingNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.gold,
    marginTop: 16,
  },
  qiblaSubtitle: {
    fontSize: 12,
    color: COLORS.text3,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  settingTextCol: {
    flex: 1,
    marginRight: 20,
  },
  settingNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  settingDescText: {
    fontSize: 11,
    color: COLORS.text3,
    marginTop: 2,
  },
  toggleContainer: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  dropdownDisplay: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.bg3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  dropdownSelectedText: {
    color: COLORS.teal,
    fontSize: 13,
    fontWeight: 'bold',
  },
  calcMethodsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  methodPill: {
    width: '23%',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.bg3,
  },
  methodPillText: {
    fontSize: 11,
    color: COLORS.text3,
  },
});
