import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserPreferences } from '../api/client';

const CATEGORY_PRAYER = 'prayer-notification';

// Set up foreground notification configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestPermissions = async (): Promise<boolean> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
};

export const setupNotificationCategories = async () => {
  await Notifications.setNotificationCategoryAsync(CATEGORY_PRAYER, [
    {
      identifier: 'mark-as-prayed',
      buttonTitle: 'Mark as prayed 🕌',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
};

export interface NotificationSettings {
  enabledPrayers: Record<string, boolean>;
  offsetMinutes: number; // 0 = On Time, -5 = 5m before, -10 = 10m before
  sound: 'Makkah' | 'Madinah' | 'Simple' | 'Vibrate' | 'Silent';
  morningAdhkarEnabled?: boolean;
  eveningAdhkarEnabled?: boolean;
  jummahReminderEnabled?: boolean;
  hadithDigestEnabled?: boolean;
  tasbeehReminderEnabled?: boolean;
  fastingAlertsEnabled?: boolean;
}

export const schedulePrayerNotifications = async (
  prayerTimes: {
    Fajr: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
    [key: string]: string;
  },
  settings: NotificationSettings
) => {
  try {
    // 1. Cancel all existing scheduled notifications first to avoid double entries
    await cancelAll();

    // 2. Setup action categories
    await setupNotificationCategories();

    // 3. Map out obligatories
    const obligatories = [
      { name: 'Fajr', time: prayerTimes.Fajr, arabic: 'الفجر' },
      { name: 'Dhuhr', time: prayerTimes.Dhuhr, arabic: 'الظهر' },
      { name: 'Asr', time: prayerTimes.Asr, arabic: 'العصر' },
      { name: 'Maghrib', time: prayerTimes.Maghrib, arabic: 'المغرب' },
      { name: 'Isha', time: prayerTimes.Isha, arabic: 'العشاء' },
    ];

    // Configure sound & notification channels for Android
    let soundName: string | undefined = undefined;
    let channelId = 'default';

    if (settings.sound === 'Simple') {
      soundName = 'simple_tone.wav';
      channelId = 'channel_simple';
    } else if (settings.sound === 'Madinah') {
      soundName = 'adhan_madinah.wav';
      channelId = 'channel_madinah';
    } else if (settings.sound === 'Makkah') {
      soundName = 'adhan.wav';
      channelId = 'channel_makkah';
    } else if (settings.sound === 'Vibrate') {
      channelId = 'channel_vibrate';
    } else if (settings.sound === 'Silent') {
      channelId = 'channel_silent';
    }

    if (Platform.OS === 'android') {
      if (settings.sound === 'Silent') {
        await Notifications.setNotificationChannelAsync(channelId, {
          name: 'Silent Notifications',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          enableVibrate: false,
        });
      } else if (settings.sound === 'Vibrate') {
        await Notifications.setNotificationChannelAsync(channelId, {
          name: 'Vibrate Only',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: null,
          enableVibrate: true,
        });
      } else {
        await Notifications.setNotificationChannelAsync(channelId, {
          name: `Adhan Alerts (${settings.sound})`,
          importance: Notifications.AndroidImportance.MAX,
          sound: soundName,
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
        });
      }
    }

    // 4. Schedule each enabled prayer
    for (const prayer of obligatories) {
      const isEnabled = settings.enabledPrayers[prayer.name] ?? true;
      if (!isEnabled) continue;

      const cleanTime = prayer.time.split(' ')[0];
      let [hours, minutes] = cleanTime.split(':').map(Number);

      // Apply offset minutes (e.g. 5 minutes before -> offsetMinutes = -5)
      if (settings.offsetMinutes !== 0) {
        let totalMinutes = hours * 60 + minutes + settings.offsetMinutes;
        if (totalMinutes < 0) totalMinutes += 24 * 60; // handle wrap around
        hours = Math.floor(totalMinutes / 60) % 24;
        minutes = totalMinutes % 60;
      }

      const trigger: Notifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Time for ${prayer.name} 🕌`,
          body: `${prayer.arabic} — Hayya 'ala-s-Salah. It is now time for the congregation.`,
          sound: settings.sound === 'Silent' ? undefined : (settings.sound === 'Vibrate' ? 'default' : soundName),
          categoryIdentifier: CATEGORY_PRAYER,
          data: {
            prayerName: prayer.name,
            actionRoute: '/(tabs)/prayer',
          },
        },
        trigger,
      });
    }

    // 4b. Schedule Morning Adhkar Reminder if enabled
    const morningEnabled = settings.morningAdhkarEnabled ?? false;
    if (morningEnabled) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌅 Morning Adhkar Reminder',
          body: 'Dua of the Morning: Start your day with divine light, remembrance, and protection.',
          sound: 'default',
          data: {
            actionRoute: '/duas/tasbeeh',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 6,
          minute: 0,
        },
      });
    }

    // 4c. Schedule Evening Adhkar Reminder (at Sunset/Maghrib) if enabled
    const eveningEnabled = settings.eveningAdhkarEnabled ?? false;
    if (eveningEnabled && prayerTimes.Maghrib) {
      const cleanMaghrib = prayerTimes.Maghrib.split(' ')[0];
      const [mHours, mMinutes] = cleanMaghrib.split(':').map(Number);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌌 Evening Adhkar Reminder',
          body: 'Dua of the Evening: Seek blessings, protection, and serene peace at sunset.',
          sound: 'default',
          data: {
            actionRoute: '/duas/tasbeeh',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: mHours,
          minute: mMinutes,
        },
      });
    }

    // 4d. Jummah (Friday) Reminder to read Surah Al-Kahf
    const jummahEnabled = settings.jummahReminderEnabled ?? true;
    if (jummahEnabled) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🕌 Jummah Mubarak Reminder',
          body: "It's Friday! Remember to read Surah Al-Kahf for light and peace from this Friday to the next.",
          sound: 'default',
          data: {
            actionRoute: '/quran/18',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 6, // 6 = Friday (in Expo Weekday enum 1=Sunday... 6=Friday)
          hour: 9,
          minute: 0,
        },
      });
    }

    // 4e. Quran Verse of the Day Alert (Scheduled daily at 10:00 AM)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📖 Quran Verse of the Day',
        body: 'Read today\'s verse: "Indeed, with hardship [will be] ease." (94:6). Click to open.',
        sound: 'default',
        data: {
          actionRoute: '/quran/94?highlightVerse=6',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 10,
        minute: 0,
      },
    });

    // 4f. Tasbeeh Count Reminders (Gentle reminder at 8:00 PM if tasbeeh daily goal incomplete)
    const tasbeehReminderEnabled = settings.tasbeehReminderEnabled ?? true;
    if (tasbeehReminderEnabled) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📿 Daily Tasbeeh Reminder',
          body: 'Keep your tongue moist with the remembrance of Allah. Tap here to complete your daily tasbeeh goals.',
          sound: 'default',
          data: {
            actionRoute: '/duas/tasbeeh',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 20,
          minute: 0,
        },
      });
    }

    // 4g. Daily Hadith Digest (Daily reminder at 12:00 PM)
    const hadithEnabled = settings.hadithDigestEnabled ?? true;
    if (hadithEnabled) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📜 Daily Hadith Digest',
          body: 'Read today\'s Hadith: Expand your knowledge of the Sunnah. Click to open.',
          sound: 'default',
          data: {
            actionRoute: '/(tabs)/hadith',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 12,
          minute: 0,
        },
      });
    }

    // 4h. Fasting (Suhur & Iftar) Alerts
    const fastingEnabled = settings.fastingAlertsEnabled ?? true;
    if (fastingEnabled && prayerTimes.Fajr && prayerTimes.Maghrib) {
      // 10 minutes before Fajr for Suhur Ending
      const cleanFajr = prayerTimes.Fajr.split(' ')[0];
      const [fHours, fMinutes] = cleanFajr.split(':').map(Number);
      let suhurTotal = fHours * 60 + fMinutes - 10;
      if (suhurTotal < 0) suhurTotal += 24 * 60;
      const suhurHours = Math.floor(suhurTotal / 60) % 24;
      const suhurMinutes = suhurTotal % 60;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Suhur Ending Alert',
          body: 'Suhur time is ending in 10 minutes. Wudu up and prepare for Fajr prayer.',
          sound: 'default',
          data: {
            actionRoute: '/(tabs)/prayer',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: suhurHours,
          minute: suhurMinutes,
        },
      });

      // At Maghrib for Iftar Time
      const cleanMaghrib = prayerTimes.Maghrib.split(' ')[0];
      const [mHours, mMinutes] = cleanMaghrib.split(':').map(Number);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✨ Iftar Time (Maghrib) Alert',
          body: 'The fast is completed! Tap here to view the Iftar Duas and evening prayers.',
          sound: 'default',
          data: {
            actionRoute: '/(tabs)/prayer',
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: mHours,
          minute: mMinutes,
        },
      });
    }

    // 5. POST to server for tracking sync
    const deviceId = (await AsyncStorage.getItem('noor360_device_id')) || 'unknown';
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.16.78:5000/api';
    
    // Save locally
    await AsyncStorage.setItem('noor360_notification_settings', JSON.stringify(settings));

    await fetch(`${baseUrl}/prayer/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        prayerTimes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    });

    // Sync preferences with user sync endpoint
    await saveUserPreferences({
      language: 'en',
      selectedTranslation: 'en.sahih',
      selectedReciter: 'ar.alafasy',
      notificationsEnabled: true,
    });
  } catch (err) {
    console.warn('Notification scheduling error:', err);
  }
};

export const rescheduleDaily = async (prayerTimes: any) => {
  try {
    const saved = await AsyncStorage.getItem('noor360_notification_settings');
    const settings = saved
      ? JSON.parse(saved)
      : {
          enabledPrayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
          offsetMinutes: 0,
          sound: 'Makkah',
        };
    await schedulePrayerNotifications(prayerTimes, settings);
  } catch (err) {
    console.warn('RescheduleDaily failed to load settings:', err);
  }
};

export const cancelAll = async () => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
