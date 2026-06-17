import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { saveUserPreferences } from '../api/client';
import { usePrayerStore } from '../store/prayerStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { calculateOfflinePrayerTimes } from './prayerCalculations';
import { getDbConnection } from './quranLocalDb';

const CATEGORY_PRAYER = 'prayer-notification';

const addMinutesToTime = (timeStr: string, minutesToAdd: number) => {
  const cleanTime = timeStr.split(' ')[0];
  const [hours, minutes] = cleanTime.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes + minutesToAdd;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMinutes = totalMinutes % 60;
  return { hour: newHours, minute: newMinutes };
};

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

// Fallback lists in case the SQLite tables are not seeded or populated yet

const FALLBACK_HADITHS = [
  {
    title: '📜 Hadith of the Day',
    bodyEnglish: 'The Prophet (ﷺ) said: "The best among you are those who have the best manners and character." (Bukhari)',
    bodyUrdu: 'رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: ”تم میں سے سب سے بہتر وہ ہے جس کے اخلاق اور کردار سب سے اچھے ہوں۔“ (بخاری)',
    route: '/(tabs)/hadith'
  },
  {
    title: '📜 Hadith of the Day',
    bodyEnglish: 'The Prophet (ﷺ) said: "Verily, actions are judged by intentions." (Bukhari)',
    bodyUrdu: 'رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: ”اعمال کا دارومدار نیتوں پر ہے۔“ (بخاری)',
    route: '/(tabs)/hadith'
  },
  {
    title: '📜 Hadith of the Day',
    bodyEnglish: 'The Prophet (ﷺ) said: "None of you believes until he loves for his brother what he loves for himself." (Bukhari)',
    bodyUrdu: 'رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: ”تم میں سے کوئی اس وقت تک کامل مومن نہیں ہو سکتا جب تک وہ اپنے بھائی کے لیے بھی وہی پسند نہ کرے جو اپنے لیے کرتا ہے۔“ (بخاری)',
    route: '/(tabs)/hadith'
  },
  {
    title: '📜 Hadith of the Day',
    bodyEnglish: 'The Prophet (ﷺ) said: "The most beloved of deeds to Allah are those that are most consistent, even if they are small." (Bukhari)',
    bodyUrdu: 'رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: ”اللہ کے نزدیک سب سے پسندیدہ عمل وہ ہے جو مستقل ہو، چاہے وہ تھوڑا ہی کیوں نہ ہو۔“ (بخاری)',
    route: '/(tabs)/hadith'
  },
  {
    title: '📜 Hadith of the Day',
    bodyEnglish: 'The Prophet (ﷺ) said: "Cleanliness is half of faith (Iman)." (Muslim)',
    bodyUrdu: 'رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: ”پاکیزگی آدھا ایمان ہے۔“ (مسلم)',
    route: '/(tabs)/hadith'
  },
  {
    title: '📜 Hadith of the Day',
    bodyEnglish: 'The Prophet (ﷺ) said: "Make things easy, and do not make them difficult; give glad tidings, and do not scare people away." (Bukhari)',
    bodyUrdu: 'رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: ”آسانیاں پیدا کرو، اور تنگیاں نہ کرو، اور خوشخبریاں سناؤ اور لوگوں کو متنفر نہ کرو۔“ (بخاری)',
    route: '/(tabs)/hadith'
  },
  {
    title: '📜 Hadith of the Day',
    bodyEnglish: 'The Prophet (ﷺ) said: "Whoever guides someone to goodness will have a reward like one who did it." (Muslim)',
    bodyUrdu: 'رسول اللہ صلی اللہ علیہ وسلم نے فرمایا: ”جس نے بھلائی کی طرف رہنمائی کی، اسے اس بھلائی کرنے والے کے برابر اجر ملے گا۔“ (مسلم)',
    route: '/(tabs)/hadith'
  }
];

const FALLBACK_DUAS = [
  {
    title: '🤲 Dua of the Day',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا طَيِّبًا وَعَمَلاً مُتَقَبَّلاً',
    translation: 'O Allah, I ask You for beneficial knowledge, good provision, and accepted deeds.',
    route: '/duas'
  },
  {
    title: '🤲 Dua of the Day',
    arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
    translation: 'Our Lord, give us in this world [that which is] good and in the Hereafter [that which is] good and protect us from the punishment of the Fire.',
    route: '/duas'
  },
  {
    title: '🤲 Dua of the Day',
    arabic: 'يَا مُقَلِّبَ الْقُلُوبِ ثَبِّتْ قَلْبِي عَلَى دِينِكَ',
    translation: 'O Controller of the hearts, make my heart steadfast in Your religion.',
    route: '/duas'
  },
  {
    title: '🤲 Dua of the Day',
    arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
    translation: 'O Allah, You are forgiving and love forgiveness, so forgive me.',
    route: '/duas'
  },
  {
    title: '🤲 Dua of the Day',
    arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
    translation: 'O Allah, suffice me with Your lawful things from Your unlawful things, and make me independent of all others besides You.',
    route: '/duas'
  },
  {
    title: '🤲 Dua of the Day',
    arabic: 'رَّبِّ زِدْنِي عِلْمًا',
    translation: 'My Lord, increase me in knowledge.',
    route: '/duas'
  },
  {
    title: '🤲 Dua of the Day',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ وَالْعَجْزِ وَالْكَسَلِ وَالْبُخْلِ وَالْجُبْنِ وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
    translation: 'O Allah, I seek refuge in You from anxiety, sorrow, weakness, laziness, miserliness, cowardice, and the burden of debt.',
    route: '/duas'
  }
];



// Helper: Query dynamic Hadith from SQLite
const getHadithForDay = async (date: Date, offset: number) => {
  const isUrdu = usePreferencesStore.getState().language === 'ur';
  try {
    const db = await getDbConnection();
    const row = await db.getFirstAsync<{ bookSlug: string; hadithEnglish: string; hadithUrdu?: string | null; englishNarrator: string; urduNarrator?: string | null }>(
      'SELECT bookSlug, hadithEnglish, hadithUrdu, englishNarrator, urduNarrator FROM hadiths ORDER BY RANDOM() LIMIT 1'
    );
    if (row) {
      let displayHadith = (isUrdu && row.hadithUrdu) ? row.hadithUrdu : row.hadithEnglish;
      let displayNarrator = (isUrdu && row.urduNarrator) ? row.urduNarrator : row.englishNarrator;
      if (displayHadith.length > 150) {
        displayHadith = displayHadith.substring(0, 147) + '...';
      }
      const bookTitle = row.bookSlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        title: '📜 Hadith of the Day',
        body: `"${displayHadith}" — ${displayNarrator} (${bookTitle})`,
        route: '/(tabs)/hadith'
      };
    }
  } catch (e) {
    console.warn('Failed to query local SQLite hadith, falling back:', e);
  }
  const fallbackIndex = (date.getDate() + date.getMonth() + offset) % FALLBACK_HADITHS.length;
  const fallback = FALLBACK_HADITHS[fallbackIndex];
  return {
    title: fallback.title,
    body: isUrdu ? fallback.bodyUrdu : fallback.bodyEnglish,
    route: fallback.route
  };
};

// Helper: Query dynamic Dua from SQLite
const getDuaForDay = async (date: Date, offset: number) => {
  try {
    const db = await getDbConnection();
    const totalRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM duas');
    const totalCount = totalRes?.count ?? 0;
    if (totalCount > 0) {
      const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const index = ((dayOfYear + date.getFullYear() + offset) % totalCount) + 1;
      const row = await db.getFirstAsync<{ title: string; arabic: string; id: number }>('SELECT title, arabic, id FROM duas WHERE id = ?', [index]);
      if (row) {
        let displayDua = row.arabic;
        if (displayDua.length > 150) {
          displayDua = displayDua.substring(0, 147) + '...';
        }
        return {
          title: '🤲 Dua of the Day',
          body: `${row.title}: "${displayDua}"`,
          route: `/duas?id=${row.id}`
        };
      }
    }
  } catch (e) {
    console.warn('Failed to query local SQLite dua, falling back:', e);
  }
  const fallbackIndex = (date.getDate() + date.getMonth() + offset) % FALLBACK_DUAS.length;
  const fallback = FALLBACK_DUAS[fallbackIndex];
  return {
    title: fallback.title,
    body: fallback.arabic,
    route: fallback.route
  };
};

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

    // 3. Resolve location and calculation settings
    const lat = usePrayerStore.getState().location?.lat ?? 21.4225;
    const lon = usePrayerStore.getState().location?.lon ?? 39.8262;
    const savedMethod = usePreferencesStore.getState().calculationMethod;

    let calculationMethod: 'ISNA' | 'MWL' | 'Karachi' | 'Makkah' = 'ISNA';
    if (savedMethod === 'MWL' || savedMethod === 'Karachi' || savedMethod === 'Makkah' || savedMethod === 'ISNA') {
      calculationMethod = savedMethod;
    } else if (savedMethod === 'Egypt') {
      calculationMethod = 'MWL';
    }

    // Configure sound & notification channels for Android
    let soundName: string | undefined = undefined;
    let channelId = 'default';

    if (settings.sound === 'Simple') {
      soundName = 'simple_tone.mp3';
      channelId = 'channel_simple_v2';
    } else if (settings.sound === 'Madinah') {
      soundName = 'adhan_madinah.mp3';
      channelId = 'channel_madinah_v2';
    } else if (settings.sound === 'Makkah') {
      soundName = 'adhan.mp3';
      channelId = 'channel_makkah_v2';
    } else if (settings.sound === 'Vibrate') {
      channelId = 'channel_vibrate_v2';
    } else if (settings.sound === 'Silent') {
      channelId = 'channel_silent_v2';
    }

    if (Platform.OS === 'android') {
      try {
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
          // Strip extension for Android resource lookup (res/raw/filename)
          const androidSoundName = soundName ? soundName.split('.')[0] : undefined;
          await Notifications.setNotificationChannelAsync(channelId, {
            name: `Adhan Alerts (${settings.sound})`,
            importance: Notifications.AndroidImportance.MAX,
            sound: androidSoundName,
            enableVibrate: true,
            vibrationPattern: [0, 250, 250, 250],
          });
        }
      } catch (channelError) {
        console.warn('Failed to set custom notification channel, falling back to default:', channelError);
        try {
          await Notifications.setNotificationChannelAsync(channelId, {
            name: `Adhan Alerts (${settings.sound})`,
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            enableVibrate: true,
          });
        } catch (innerError) {
          console.warn('Failed fallback channel setup:', innerError);
        }
      }
    }

    // 4. Pre-fetch dynamic content from SQLite for the next 3 days
    const dailyHadiths: any[] = [];
    const dailyDuas: any[] = [];

    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);

      const hadith = await getHadithForDay(targetDate, dayOffset);
      const dua = await getDuaForDay(targetDate, dayOffset);

      dailyHadiths.push(hadith);
      dailyDuas.push(dua);
    }

    // 5. Schedule dynamic notifications for the next 3 days
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + dayOffset);

      // Dynamically calculate prayer times for this specific day
      const dayPrayerTimes = calculateOfflinePrayerTimes(lat, lon, currentDate, calculationMethod);

      const obligatories = [
        { name: 'Fajr', time: dayPrayerTimes.Fajr, arabic: 'الفجر' },
        { name: 'Dhuhr', time: dayPrayerTimes.Dhuhr, arabic: 'الظهر' },
        { name: 'Asr', time: dayPrayerTimes.Asr, arabic: 'العصر' },
        { name: 'Maghrib', time: dayPrayerTimes.Maghrib, arabic: 'المغرب' },
        { name: 'Isha', time: dayPrayerTimes.Isha, arabic: 'العشاء' },
      ];

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

        const triggerDate = new Date(currentDate);
        triggerDate.setHours(hours, minutes, 0, 0);

        if (triggerDate > new Date()) {
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
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: channelId,
            } as any,
          });
        }

        // Salah Tracker Reminder (30 minutes after prayer)
        const trackerTime = addMinutesToTime(prayer.time, 30);
        const trackerTriggerDate = new Date(currentDate);
        trackerTriggerDate.setHours(trackerTime.hour, trackerTime.minute, 0, 0);

        if (trackerTriggerDate > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Salah Tracker: ${prayer.name} Log 🕌`,
              body: `Did you pray ${prayer.name}? Tap here to log your prayer status and keep your streak active!`,
              sound: 'default',
              data: {
                actionRoute: '/(tabs)/prayer/tracker',
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: trackerTriggerDate,
            },
          });
        }

        // Quran / Surah reminders
        if (prayer.name === 'Fajr') {
          const yaseenTime = addMinutesToTime(prayer.time, 45);
          const yaseenTriggerDate = new Date(currentDate);
          yaseenTriggerDate.setHours(yaseenTime.hour, yaseenTime.minute, 0, 0);

          if (yaseenTriggerDate > new Date()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '📖 Read Surah Yaseen after Fajr',
                body: 'Benefit: The heart of the Quran. Recite it after Fajr to fulfill your needs for the day.',
                sound: 'default',
                data: {
                  actionRoute: '/quran/36',
                },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: yaseenTriggerDate,
              },
            });
          }
        } else if (prayer.name === 'Maghrib') {
          const waqiahTime = addMinutesToTime(prayer.time, 45);
          const waqiahTriggerDate = new Date(currentDate);
          waqiahTriggerDate.setHours(waqiahTime.hour, waqiahTime.minute, 0, 0);

          if (waqiahTriggerDate > new Date()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '💰 Read Surah Al-Waqiah after Maghrib',
                body: 'Benefit: The Surah of Wealth. Recite Al-Waqiah after Maghrib to ward off poverty and secure Rizq.',
                sound: 'default',
                data: {
                  actionRoute: '/quran/56',
                },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: waqiahTriggerDate,
              },
            });
          }
        } else if (prayer.name === 'Isha') {
          const mulkTime = addMinutesToTime(prayer.time, 45);
          const mulkTriggerDate = new Date(currentDate);
          mulkTriggerDate.setHours(mulkTime.hour, mulkTime.minute, 0, 0);

          if (mulkTriggerDate > new Date()) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🛡️ Read Surah Al-Mulk after Isha',
                body: 'Benefit: Saving from Hellfire. Recite it after Isha to protect yourself from grave punishment.',
                sound: 'default',
                data: {
                  actionRoute: '/quran/67',
                },
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: mulkTriggerDate,
              },
            });
          }
        }
      }

      // Morning Adhkar
      const morningEnabled = settings.morningAdhkarEnabled ?? false;
      if (morningEnabled) {
        const morningTriggerDate = new Date(currentDate);
        morningTriggerDate.setHours(6, 0, 0, 0);

        if (morningTriggerDate > new Date()) {
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
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: morningTriggerDate,
            },
          });
        }
      }

      // Evening Adhkar
      const eveningEnabled = settings.eveningAdhkarEnabled ?? false;
      if (eveningEnabled && dayPrayerTimes.Maghrib) {
        const cleanMaghrib = dayPrayerTimes.Maghrib.split(' ')[0];
        const [mHours, mMinutes] = cleanMaghrib.split(':').map(Number);
        const eveningTriggerDate = new Date(currentDate);
        eveningTriggerDate.setHours(mHours, mMinutes, 0, 0);

        if (eveningTriggerDate > new Date()) {
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
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: eveningTriggerDate,
            },
          });
        }
      }

      // Jummah (Friday) Reminder
      const jummahEnabled = settings.jummahReminderEnabled ?? true;
      if (jummahEnabled && currentDate.getDay() === 5) {
        const jummahTriggerDate = new Date(currentDate);
        jummahTriggerDate.setHours(9, 0, 0, 0);

        if (jummahTriggerDate > new Date()) {
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
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: jummahTriggerDate,
            },
          });
        }
      }



      // Dynamic Hadith Digest (SQLite-backed)
      const hadithEnabled = settings.hadithDigestEnabled ?? true;
      if (hadithEnabled) {
        const dailyHadith = dailyHadiths[dayOffset];
        const hadithTriggerDate = new Date(currentDate);
        hadithTriggerDate.setHours(12, 0, 0, 0);

        if (hadithTriggerDate > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: dailyHadith.title,
              body: dailyHadith.body,
              sound: 'default',
              data: {
                actionRoute: dailyHadith.route,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: hadithTriggerDate,
            },
          });
        }
      }

      // Dynamic Dua of the Day (SQLite-backed)
      const dailyDua = dailyDuas[dayOffset];
      const duaTriggerDate = new Date(currentDate);
      duaTriggerDate.setHours(14, 0, 0, 0);

      if (duaTriggerDate > new Date()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: dailyDua.title,
            body: dailyDua.body,
            sound: 'default',
            data: {
              actionRoute: dailyDua.route,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: duaTriggerDate,
          },
        });
      }

      // Tasbeeh Count Reminders
      const tasbeehReminderEnabled = settings.tasbeehReminderEnabled ?? true;
      if (tasbeehReminderEnabled) {
        const tasbeehTriggerDate = new Date(currentDate);
        tasbeehTriggerDate.setHours(20, 0, 0, 0);

        if (tasbeehTriggerDate > new Date()) {
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
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: tasbeehTriggerDate,
            },
          });
        }
      }

      // Fasting Alerts (Ramadan only)
      const fastingEnabled = settings.fastingAlertsEnabled ?? true;
      const isRamadan = usePrayerStore.getState().hijriDate?.month?.number === 9;
      if (fastingEnabled && isRamadan && dayPrayerTimes.Fajr && dayPrayerTimes.Maghrib) {
        const cleanFajr = dayPrayerTimes.Fajr.split(' ')[0];
        const [fHours, fMinutes] = cleanFajr.split(':').map(Number);
        let suhurTotal = fHours * 60 + fMinutes - 10;
        if (suhurTotal < 0) suhurTotal += 24 * 60;
        const suhurHours = Math.floor(suhurTotal / 60) % 24;
        const suhurMinutes = suhurTotal % 60;

        const suhurTriggerDate = new Date(currentDate);
        suhurTriggerDate.setHours(suhurHours, suhurMinutes, 0, 0);

        if (suhurTriggerDate > new Date()) {
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
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: suhurTriggerDate,
            },
          });
        }

        const cleanMaghrib = dayPrayerTimes.Maghrib.split(' ')[0];
        const [iftarHours, iftarMinutes] = cleanMaghrib.split(':').map(Number);

        const iftarTriggerDate = new Date(currentDate);
        iftarTriggerDate.setHours(iftarHours, iftarMinutes, 0, 0);

        if (iftarTriggerDate > new Date()) {
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
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: iftarTriggerDate,
            },
          });
        }
      }
    }

    // Save settings locally
    await AsyncStorage.setItem('noor360_notification_settings', JSON.stringify(settings));

    // 6. POST to server for tracking sync
    (async () => {
      try {
        const deviceId = (await AsyncStorage.getItem('noor360_device_id')) || 'unknown';
        await client.post('/prayer/schedule', {
          deviceId,
          prayerTimes,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
      } catch (err) {
        console.warn('Silent fallback: Background server schedule sync failed:', err);
      }
    })();
  } catch (err: any) {
    console.error('Notification scheduling error:', err);
    throw err;
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
