import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFullPrayerTimes, getPrayerTimesByCity } from '../api/client';
import * as ExpoLocation from 'expo-location';

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
      } else {
        const prefLat = await AsyncStorage.getItem('user_latitude');
        const prefLon = await AsyncStorage.getItem('user_longitude');
        if (prefLat && prefLon) {
          const lat = parseFloat(prefLat);
          const lon = parseFloat(prefLon);
          set({
            location: {
              lat,
              lon,
              city: 'Detected Location',
              country: '',
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load saved location:', e);
    }
  },

  fetchPrayerTimes: async (lat, lon) => {
    try {
      set({ isLoading: true, error: null });

      // 1. Calculate offline prayer times first (Offline-First)
      const { calculateOfflinePrayerTimes, convertGregorianToHijriOffline } = require('../services/prayerCalculations');
      const offlineTimes = calculateOfflinePrayerTimes(lat, lon);
      const offlineHijri = convertGregorianToHijriOffline(new Date());

      set({
        prayerTimes: offlineTimes,
        hijriDate: offlineHijri,
        isLoading: false,
      });
      get().startCountdown();

      // 2. Fetch from cloud API in the background to get precise calculations and sync
      getFullPrayerTimes(lat, lon).then(async (data) => {
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
          hijriDate: formattedHijri || offlineHijri,
        });
        get().startCountdown();
      }).catch(err => console.warn('Background fetch prayer times failed:', err));

      // Reverse-geocode latitude/longitude to resolve actual city and country
      let city = get().location.city || 'Makkah Al-Mukarramah';
      let country = get().location.country || 'Saudi Arabia';
      try {
        const { status } = await ExpoLocation.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const reverseGeocode = await ExpoLocation.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (reverseGeocode && reverseGeocode.length > 0) {
            const address = reverseGeocode[0];
            city = address.city || address.subregion || address.district || address.region || 'Detected Location';
            country = address.country || '';
          }
        }
      } catch (e) {
        console.warn('Silent fallback: Reverse geocoding coordinates failed.', e);
      }

      const updated = { lat, lon, city, country };
      set({ location: updated });
      await AsyncStorage.setItem('noor360_saved_location', JSON.stringify(updated));
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
      // Fallback: If offline, check if we have saved location coordinates
      const saved = await AsyncStorage.getItem('noor360_saved_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.city.toLowerCase() === city.toLowerCase() || !city) {
          const { calculateOfflinePrayerTimes, convertGregorianToHijriOffline } = require('../services/prayerCalculations');
          const offlineTimes = calculateOfflinePrayerTimes(parsed.lat, parsed.lon);
          const offlineHijri = convertGregorianToHijriOffline(new Date());

          set({
            prayerTimes: offlineTimes,
            hijriDate: offlineHijri,
            location: parsed,
            error: null,
          });
          get().startCountdown();
          return;
        }
      }
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
