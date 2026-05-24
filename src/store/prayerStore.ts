import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFullPrayerTimes, getPrayerTimesByCity } from '../api/client';

export interface Location {
  lat: number;
  lon: number;
  city: string;
  country?: string;
}

export interface HijriDate {
  date: string;
  day: string;
  month: {
    number: number;
    en: string;
    ar: string;
  };
  year: string;
}

export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface PrayerState {
  prayerTimes: PrayerTimes | null;
  nextPrayer: string | null;
  minutesUntilNext: number | null;
  location: Location;
  hijriDate: HijriDate | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPrayerTimes: (lat: number, lon: number) => Promise<void>;
  fetchByCity: (city: string, country: string) => Promise<void>;
  startCountdown: () => void;
  loadSavedLocation: () => Promise<void>;
}

let countdownInterval: any = null;

const calculateNextPrayer = (times: PrayerTimes) => {
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

  let next = list.find(p => p.time > now);
  if (!next) {
    next = { name: 'Fajr', time: parseTime(times.Fajr, 1) };
  }

  const diffMs = next.time.getTime() - now.getTime();
  const minutesUntilNext = Math.max(0, Math.ceil(diffMs / (1000 * 60)));

  return {
    nextPrayer: next.name,
    minutesUntilNext,
  };
};

export const usePrayerStore = create<PrayerState>((set, get) => ({
  prayerTimes: null,
  nextPrayer: null,
  minutesUntilNext: null,
  location: {
    lat: 21.4225,
    lon: 39.8262,
    city: 'Makkah Al-Mukarramah',
    country: 'Saudi Arabia',
  },
  hijriDate: null,
  isLoading: false,
  error: null,

  loadSavedLocation: async () => {
    try {
      const saved = await AsyncStorage.getItem('noor360_saved_location');
      if (saved) {
        set({ location: JSON.parse(saved) });
      }
    } catch (e) {
      console.warn('Failed to load saved location:', e);
    }
  },

  fetchPrayerTimes: async (lat, lon) => {
    try {
      set({ isLoading: true, error: null });
      const data = await getFullPrayerTimes(lat, lon);
      
      const hijri = data?.date?.hijri || null;
      const formattedHijri: HijriDate | null = hijri ? {
        date: hijri.date,
        day: hijri.day,
        month: {
          number: hijri.month.number,
          en: hijri.month.en,
          ar: hijri.month.ar,
        },
        year: hijri.year,
      } : null;

      set({
        prayerTimes: data.timings,
        hijriDate: formattedHijri,
      });

      // Update location coords in state
      const currentLocation = get().location;
      const updated = { ...currentLocation, lat, lon };
      set({ location: updated });
      await AsyncStorage.setItem('noor360_saved_location', JSON.stringify(updated));

      // Trigger countdown calculation
      get().startCountdown();
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch prayer times by coordinates.' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchByCity: async (city, country) => {
    try {
      set({ isLoading: true, error: null });
      const data = await getPrayerTimesByCity(city, country);

      const hijri = data?.date?.hijri || null;
      const formattedHijri: HijriDate | null = hijri ? {
        date: hijri.date,
        day: hijri.day,
        month: {
          number: hijri.month.number,
          en: hijri.month.en,
          ar: hijri.month.ar,
        },
        year: hijri.year,
      } : null;

      // Extract coordinates returned by Aladhan Meta
      const lat = parseFloat(data?.meta?.latitude || '21.4225');
      const lon = parseFloat(data?.meta?.longitude || '39.8262');

      const updated = { lat, lon, city, country };
      set({
        prayerTimes: data.timings,
        hijriDate: formattedHijri,
        location: updated,
      });

      await AsyncStorage.setItem('noor360_saved_location', JSON.stringify(updated));
      get().startCountdown();
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch prayer times for city.' });
    } finally {
      set({ isLoading: false });
    }
  },

  startCountdown: () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    const runCalculation = () => {
      const times = get().prayerTimes;
      if (!times) return;

      const { nextPrayer, minutesUntilNext } = calculateNextPrayer(times);
      set({ nextPrayer, minutesUntilNext });
    };

    runCalculation();
    countdownInterval = setInterval(runCalculation, 30000); // 30s interval
  },
}));
