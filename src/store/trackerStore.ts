import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveUserPreferences } from '../api/client';

export type PrayerStatus = 'prayed' | 'missed' | 'qadha' | 'pending';

export interface DayRecord {
  fajr: PrayerStatus;
  dhuhr: PrayerStatus;
  asr: PrayerStatus;
  maghrib: PrayerStatus;
  isha: PrayerStatus;
}

interface TrackerState {
  records: Record<string, DayRecord>;
  streak: number;
  longestStreak: number;
  
  // Actions
  markPrayer: (date: string, prayer: keyof DayRecord, status: PrayerStatus) => Promise<void>;
  calculateStreak: () => void;
  initializeToday: (date: string) => void;
}

const defaultDayRecord: DayRecord = {
  fajr: 'pending',
  dhuhr: 'pending',
  asr: 'pending',
  maghrib: 'pending',
  isha: 'pending',
};

export const useTrackerStore = create<TrackerState>()(
  persist(
    (set, get) => ({
      records: {},
      streak: 0,
      longestStreak: 0,

      initializeToday: (date: string) => {
        const { records } = get();
        if (!records[date]) {
          set({
            records: {
              ...records,
              [date]: { ...defaultDayRecord },
            },
          });
        }
      },

      markPrayer: async (date: string, prayer: keyof DayRecord, status: PrayerStatus) => {
        const { records } = get();
        const currentDay = records[date] || { ...defaultDayRecord };
        
        const updatedDay = {
          ...currentDay,
          [prayer]: status,
        };

        const updatedRecords = {
          ...records,
          [date]: updatedDay,
        };

        set({ records: updatedRecords });
        
        // Recalculate streak
        get().calculateStreak();

        // Sync summary statistics with server preferences
        try {
          const totalDays = Object.keys(updatedRecords).length;
          let totalPrayersLogged = 0;
          let totalPrayersCompleted = 0;

          Object.values(updatedRecords).forEach((day) => {
            Object.values(day).forEach((p) => {
              if (p !== 'pending') totalPrayersLogged++;
              if (p === 'prayed' || p === 'qadha') totalPrayersCompleted++;
            });
          });

          await saveUserPreferences({
            language: 'en',
            selectedTranslation: 'en.sahih',
            selectedReciter: 'ar.alafasy',
            notificationsEnabled: true,
            // Custom stats summary field to sync with MongoDB
            metadata: {
              streak: get().streak,
              longestStreak: get().longestStreak,
              completionRate: totalPrayersLogged > 0 ? Math.round((totalPrayersCompleted / totalPrayersLogged) * 100) : 0,
              totalDaysTracked: totalDays
            }
          });
        } catch (err) {
          console.warn('Syncing tracker summary to server failed:', err);
        }
      },

      calculateStreak: () => {
        const { records, longestStreak } = get();
        const todayStr = new Date().toISOString().split('T')[0];
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Ensure both records exist
        const hasToday = records[todayStr] && Object.values(records[todayStr]).some((v) => v === 'prayed' || v === 'qadha');
        const hasYesterday = records[yesterdayStr] && Object.values(records[yesterdayStr]).some((v) => v === 'prayed' || v === 'qadha');

        if (!hasToday && !hasYesterday) {
          set({ streak: 0 });
          return;
        }

        let currentStreak = 0;
        const datePtr = hasToday ? new Date() : yesterday;

        while (true) {
          const dateStr = datePtr.toISOString().split('T')[0];
          const dayRecord = records[dateStr];

          // A day qualifies if the user prayed at least one prayer (active logging day)
          if (dayRecord && Object.values(dayRecord).some((v) => v === 'prayed' || v === 'qadha')) {
            currentStreak++;
            datePtr.setDate(datePtr.getDate() - 1);
          } else {
            break;
          }
        }

        const maxStreak = Math.max(currentStreak, longestStreak);
        set({ streak: currentStreak, longestStreak: maxStreak });
      },
    }),
    {
      name: 'noor360_salah_tracker',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
