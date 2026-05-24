import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { usePrayerStore } from '../../../src/store/prayerStore';
import { schedulePrayerNotifications, NotificationSettings } from '../../../src/services/notificationService';
import { COLORS } from '../../../constants/theme';
import Card from '../../../components/ui/Card';
import ArabicGeometricBg from '../../../components/ui/ArabicGeometricBg';

export default function NotificationSettingsScreen() {
  const prayerStore = usePrayerStore();
  const [loading, setLoading] = useState(false);

  // Enabled Toggles for each prayer
  const [enabledPrayers, setEnabledPrayers] = useState<Record<string, boolean>>({
    Fajr: true,
    Sunrise: false,
    Dhuhr: true,
    Asr: true,
    Maghrib: true,
    Isha: true,
  });

  // Offset Minutes (0 = On Time, -5 = 5m before, -10 = 10m before)
  const [offsetMinutes, setOffsetMinutes] = useState<number>(0);

  // Selected Adhan Sound
  const [sound, setSound] = useState<'Makkah' | 'Madinah' | 'Simple' | 'Vibrate' | 'Silent'>('Makkah');

  // Adhkar Toggles State
  const [morningAdhkarEnabled, setMorningAdhkarEnabled] = useState<boolean>(false);
  const [eveningAdhkarEnabled, setEveningAdhkarEnabled] = useState<boolean>(false);
  const [jummahReminderEnabled, setJummahReminderEnabled] = useState<boolean>(true);
  const [hadithDigestEnabled, setHadithDigestEnabled] = useState<boolean>(true);
  const [tasbeehReminderEnabled, setTasbeehReminderEnabled] = useState<boolean>(true);
  const [fastingAlertsEnabled, setFastingAlertsEnabled] = useState<boolean>(true);

  // Load existing settings on mount
  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('noor360_notification_settings');
      if (saved) {
        const parsed: NotificationSettings = JSON.parse(saved);
        setEnabledPrayers(parsed.enabledPrayers);
        setOffsetMinutes(parsed.offsetMinutes);
        setSound(parsed.sound);
        setMorningAdhkarEnabled(parsed.morningAdhkarEnabled ?? false);
        setEveningAdhkarEnabled(parsed.eveningAdhkarEnabled ?? false);
        setJummahReminderEnabled(parsed.jummahReminderEnabled ?? true);
        setHadithDigestEnabled(parsed.hadithDigestEnabled ?? true);
        setTasbeehReminderEnabled(parsed.tasbeehReminderEnabled ?? true);
        setFastingAlertsEnabled(parsed.fastingAlertsEnabled ?? true);
      }
    } catch (e) {
      console.warn('Failed to load notification settings:', e);
    }
  };

  const handleTogglePrayer = (name: string) => {
    setEnabledPrayers((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSaveSettings = async () => {
    if (!prayerStore.prayerTimes) {
      Alert.alert('Failed to Sync', 'No active prayer timings loaded. Please go back and calculate timings first.');
      return;
    }

    setLoading(true);
    try {
      const settings: NotificationSettings = {
        enabledPrayers,
        offsetMinutes,
        sound,
        morningAdhkarEnabled,
        eveningAdhkarEnabled,
        jummahReminderEnabled,
        hadithDigestEnabled,
        tasbeehReminderEnabled,
        fastingAlertsEnabled,
      };

      // Reschedule all local daily notifications
      await schedulePrayerNotifications(prayerStore.prayerTimes as any, settings);
      
      Alert.alert(
        'Preferences Saved',
        'Your daily Adhan notifications have been successfully scheduled and synced.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Unable to register notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestAlert = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          Alert.alert('Permission Denied', 'Please grant notification access to test alerts.');
          return;
        }
      }

      let soundFile: string | undefined = 'default';
      let soundUrl = 'https://github.com/AalianKhan/adhans/blob/master/adhan.mp3?raw=true';

      if (sound === 'Silent') {
        soundFile = undefined;
        soundUrl = '';
      } else if (sound === 'Simple') {
        soundFile = 'simple_tone.wav';
        soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav';
      } else if (sound === 'Madinah') {
        soundFile = 'adhan_madinah.wav';
        soundUrl = 'https://github.com/AalianKhan/adhans/blob/master/adhan_fajr.mp3?raw=true';
      } else if (sound === 'Makkah') {
        soundFile = 'adhan.wav';
        soundUrl = 'https://github.com/AalianKhan/adhans/blob/master/adhan.mp3?raw=true';
      } else if (sound === 'Vibrate') {
        soundFile = 'default';
        soundUrl = '';
      }

      // 1. Schedule local OS banner notification (triggers in 2s)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Test Adhan Notification 🕌',
          body: `Hayya 'ala-s-Salah. Testing selected sound configuration: ${sound}.`,
          sound: soundFile,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 2,
          repeats: false,
        },
      });

      // 2. Play live audio stream using expo-audio for instant high-fidelity developer experience
      if (soundUrl) {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
        });

        const player = createAudioPlayer(soundUrl);
        player.play();

        // Auto release player after 12 seconds to prevent memory leaks
        setTimeout(() => {
          player.release();
        }, 12000);
      }

      Alert.alert(
        'Test Adhan Playing',
        `A test banner notification is queued and your selected ${sound} Adhan is playing live!`
      );
    } catch (e: any) {
      Alert.alert('Test Failed', e.message || 'Unable to trigger alert.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'top']}>
      {/* Arabic Geometric Overlay Background */}
      <ArabicGeometricBg size={400} style={styles.backgroundOverlay} />

      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Adhan Alerts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Timing Offset Section */}
        <Text style={styles.sectionTitle}>Timing Offsets</Text>
        <Card style={styles.offsetCard}>
          <Text style={styles.cardDesc}>Trigger notifications slightly before the actual time to prepare for ablution (Wudu).</Text>
          <View style={styles.offsetGrid}>
            {[
              { label: 'On Time', value: 0 },
              { label: '5m Before', value: -5 },
              { label: '10m Before', value: -10 },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => setOffsetMinutes(item.value)}
                style={[
                  styles.offsetPill,
                  offsetMinutes === item.value && styles.offsetPillActive,
                ]}
              >
                <Text style={[styles.offsetPillText, offsetMinutes === item.value && styles.offsetTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Adhan Sound picker */}
        <Text style={styles.sectionTitle}>Adhan Sound configuration</Text>
        <Card style={styles.soundCard}>
          <Text style={styles.cardDesc}>Select a bundled voice track to play at congregational alerts.</Text>
          <View style={styles.soundGrid}>
            {[
              { label: 'Makkah', val: 'Makkah' },
              { label: 'Madinah', val: 'Madinah' },
              { label: 'Simple Tone', val: 'Simple' },
              { label: 'Vibrate Only', val: 'Vibrate' },
              { label: 'Silent', val: 'Silent' },
            ].map((item) => (
              <TouchableOpacity
                key={item.val}
                onPress={() => setSound(item.val as any)}
                style={[
                  styles.soundPill,
                  sound === item.val && styles.soundPillActive,
                ]}
              >
                <Ionicons
                  name={sound === item.val ? 'radio-button-on' : 'radio-button-off'}
                  size={16}
                  color={sound === item.val ? COLORS.teal : COLORS.text3}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.soundPillText, sound === item.val && styles.soundTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Prayer Alerts Switches Grid */}
        <Text style={styles.sectionTitle}>Enable Alerts Per Prayer</Text>
        <Card style={styles.switchesCard}>
          {['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((prayer) => (
            <View key={prayer} style={styles.switchRow}>
              <View style={styles.switchLabelBox}>
                <Ionicons
                  name={prayer === 'Sunrise' ? 'partly-sunny-outline' : 'moon-outline'}
                  size={18}
                  color={COLORS.gold}
                />
                <Text style={styles.switchLabelText}>{prayer}</Text>
              </View>
              <Switch
                trackColor={{ false: COLORS.bg3, true: COLORS.teal }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={COLORS.bg3}
                value={enabledPrayers[prayer] ?? false}
                onValueChange={() => handleTogglePrayer(prayer)}
              />
            </View>
          ))}
        </Card>

        {/* Daily Adhkar Reminders */}
        <Text style={styles.sectionTitle}>Daily Adhkar Reminders</Text>
        <Card style={styles.switchesCard}>
          {/* Morning Adhkar Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBox}>
              <Ionicons
                name="sunny-outline"
                size={18}
                color={COLORS.gold}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.switchLabelText}>Morning Adhkar</Text>
                <Text style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>Daily reminder at 6:00 AM</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.bg3, true: COLORS.teal }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.bg3}
              value={morningAdhkarEnabled}
              onValueChange={setMorningAdhkarEnabled}
            />
          </View>

          {/* Evening Adhkar Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBox}>
              <Ionicons
                name="moon-outline"
                size={18}
                color={COLORS.gold}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.switchLabelText}>Evening Adhkar</Text>
                <Text style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>Daily reminder at Sunset (Maghrib)</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.bg3, true: COLORS.teal }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.bg3}
              value={eveningAdhkarEnabled}
              onValueChange={setEveningAdhkarEnabled}
            />
          </View>

          {/* Jummah Reminder Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBox}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={COLORS.gold}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.switchLabelText}>Jummah Reminders</Text>
                <Text style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>Surah Al-Kahf reminders on Friday mornings</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.bg3, true: COLORS.teal }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.bg3}
              value={jummahReminderEnabled}
              onValueChange={setJummahReminderEnabled}
            />
          </View>

          {/* Hadith Digest Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBox}>
              <Ionicons
                name="book-outline"
                size={18}
                color={COLORS.gold}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.switchLabelText}>Daily Hadith Digest</Text>
                <Text style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>Daily reading reminders at 12:00 PM</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.bg3, true: COLORS.teal }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.bg3}
              value={hadithDigestEnabled}
              onValueChange={setHadithDigestEnabled}
            />
          </View>

          {/* Tasbeeh Reminders Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBox}>
              <Ionicons
                name="finger-print-outline"
                size={18}
                color={COLORS.gold}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.switchLabelText}>Tasbeeh Reminders</Text>
                <Text style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>Evening reminder to finish daily goals</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.bg3, true: COLORS.teal }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.bg3}
              value={tasbeehReminderEnabled}
              onValueChange={setTasbeehReminderEnabled}
            />
          </View>

          {/* Fasting Alerts Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchLabelBox}>
              <Ionicons
                name="time-outline"
                size={18}
                color={COLORS.gold}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.switchLabelText}>Fasting (Suhur & Iftar) Alerts</Text>
                <Text style={{ fontSize: 10, color: COLORS.text3, marginTop: 2 }}>Countdown notifications for Suhur & Iftar</Text>
              </View>
            </View>
            <Switch
              trackColor={{ false: COLORS.bg3, true: COLORS.teal }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={COLORS.bg3}
              value={fastingAlertsEnabled}
              onValueChange={setFastingAlertsEnabled}
            />
          </View>
        </Card>

        {/* Action Trays */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.testBtn} onPress={handleTestAlert}>
            <Ionicons name="notifications-outline" size={18} color={COLORS.gold} style={{ marginRight: 6 }} />
            <Text style={styles.testBtnText}>Test Alert</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.bg} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.bg} style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Preferences</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  cardDesc: {
    fontSize: 12,
    color: COLORS.text3,
    lineHeight: 18,
    marginBottom: 14,
  },
  offsetCard: {
    backgroundColor: COLORS.bg2,
    borderColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  offsetGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  offsetPill: {
    width: '31%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.bg3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  offsetPillActive: {
    borderColor: COLORS.teal,
    backgroundColor: 'rgba(45,212,191,0.06)',
  },
  offsetPillText: {
    fontSize: 12,
    color: COLORS.text2,
    fontWeight: '600',
  },
  offsetTextActive: {
    color: COLORS.teal,
    fontWeight: 'bold',
  },
  soundCard: {
    backgroundColor: COLORS.bg2,
    borderColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  soundGrid: {
    flexDirection: 'column',
  },
  soundPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  soundPillActive: {
    borderBottomColor: 'rgba(45,212,191,0.15)',
  },
  soundPillText: {
    fontSize: 13,
    color: COLORS.text2,
    fontWeight: '500',
  },
  soundTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  switchesCard: {
    backgroundColor: COLORS.bg2,
    borderColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  switchLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  testBtn: {
    width: '38%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testBtnText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: 'bold',
  },
  saveBtn: {
    width: '58%',
    backgroundColor: COLORS.teal,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: COLORS.bg,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
