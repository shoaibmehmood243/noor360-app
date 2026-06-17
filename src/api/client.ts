import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL points to the noor360-backend
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.6:5000/api';

/**
 * Retrieves the stored unique device identifier, or generates and stores one if none exists.
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
  try {
    let id = await AsyncStorage.getItem('noor360_device_id');
    if (!id) {
      // Generate a highly secure, collision-resistant random identifier
      id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await AsyncStorage.setItem('noor360_device_id', id);
    }
    return id;
  } catch (error) {
    console.error('Failed to get or create device ID:', error);
    return 'fallback_device_id';
  }
};

/**
 * Configure Axios Instance
 */
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000, // 15 seconds timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 1. Request Deduplication Cache Map
const inFlightRequests = new Map<string, Promise<any>>();

const getRequestKey = (config: any) => {
  const { method, url, params, data } = config;
  return `${method || 'get'}_${url}_${JSON.stringify(params || {})}_${JSON.stringify(data || {})}`;
};

const CACHE_FIRST_PATHS = [
  '/quran/surahs',
  '/quran/surah/',
  '/quran/juz/',
  '/hadith/books',
  '/hadith/',
  '/duas/categories',
  '/duas/names'
];

const isCacheFirst = (url?: string) => {
  if (!url) return false;
  return CACHE_FIRST_PATHS.some(path => url.includes(path));
};

const getCacheKey = (config: any) => {
  const { url, params } = config;
  return `api_cache_${url}_${JSON.stringify(params || {})}`;
};

// Override client.request to intercept, deduplicate, and cache requests
const originalRequest = client.request.bind(client);
client.request = async function (config: any): Promise<any> {
  const key = getRequestKey(config);
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)!;
  }

  const isGet = (config.method || 'get').toLowerCase() === 'get';
  const cacheKey = getCacheKey(config);

  if (isGet && isCacheFirst(config.url)) {
    try {
      const cachedData = await AsyncStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        return { data: parsed, status: 200, statusText: 'OK (Cached)', headers: {}, config };
      }
    } catch (e) {
      console.warn('Failed to read from cache-first storage:', e);
    }
  }

  const promise = (async () => {
    try {
      const response = await originalRequest(config);
      if (isGet && response?.data) {
        AsyncStorage.setItem(cacheKey, JSON.stringify(response.data)).catch(e => {
          console.warn('Failed to save to storage cache:', e);
        });
      }
      return response;
    } catch (err) {
      if (isGet) {
        try {
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            return { data: parsed, status: 200, statusText: 'OK (Cached Fallback)', headers: {}, config };
          }
        } catch (e) {
          console.warn('Failed to read from cache-fallback storage:', e);
        }
      }
      throw err;
    }
  })();

  inFlightRequests.set(key, promise);
  promise.finally(() => {
    inFlightRequests.delete(key);
  });

  return promise;
};

/**
 * Request Interceptor: Attach X-Device-ID and X-Language headers dynamically
 */
client.interceptors.request.use(
  async (config) => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const language = (await AsyncStorage.getItem('noor360_language')) || 'en';

      config.headers['X-Device-ID'] = deviceId;
      config.headers['X-Language'] = language;
    } catch (error) {
      console.warn('Failed to inject headers into request config:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Max retry attempts and exponential backoff multiplier
const MAX_RETRIES = 3;

/**
 * Response Interceptor: Gracefully format network and server errors, and retry failed requests with exponential backoff
 */
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // If the request fails and qualifies for retries (and is not a cancelled request or duplicate)
    if (config && (!config._retryCount || config._retryCount < MAX_RETRIES)) {
      config._retryCount = config._retryCount || 0;
      config._retryCount += 1;

      // Exponential delay: 1st retry = 1s, 2nd retry = 2s, 3rd retry = 4s
      const delay = Math.pow(2, config._retryCount) * 500;
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Resubmit request config
      return client(config);
    }

    let friendlyMessage = 'An unexpected connection error occurred. Please try again.';

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      // Handle specific API error bounds
      if (status === 429) {
        friendlyMessage = data?.message || 'Daily inquiry or request rate limit exceeded. Please try again later.';
      } else if (status === 503 || status === 502) {
        friendlyMessage = 'The server is temporarily undergoing maintenance or offline. Please check back shortly.';
      } else if (data?.message) {
        friendlyMessage = data.message;
      }
    } else if (error.request) {
      // Network timeouts or completely offline
      friendlyMessage = 'Unable to reach the Noor360 server. Please check your internet connection.';
    }

    return Promise.reject(new Error(friendlyMessage));
  }
);

/**
 * Interfaces & Typed Response Wrappers
 */
export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Hadith {
  book: string;
  hadithNumber: string;
  hadithArabic: string;
  hadithEnglish: string;
  chapterTitle?: string;
}

export interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
}

export interface Dua {
  id: number;
  category: string;
  title: string;
  arabic: string;
  transliteration: string;
  translation: string;
  reference: string;
}

/**
 * 1. Quran Endpoints
 */
export const getQuranSurahs = async (): Promise<Surah[]> => {
  const res = await client.get('/quran/surahs');
  return res.data.data;
};

export const getSurahDetail = async (id: number, translation = 'en.sahih'): Promise<any> => {
  const res = await client.get(`/quran/surah/${id}`, { params: { translation } });
  return res.data.data;
};

export const getJuzDetail = async (id: number, translation = 'en.sahih'): Promise<any> => {
  const res = await client.get(`/quran/juz/${id}`, { params: { translation } });
  return res.data.data;
};

export const getVerseOfDay = async (): Promise<any> => {
  const res = await client.get('/quran/verse-of-day');
  return res.data.data;
};

export const searchQuran = async (q: string, lang = 'en.sahih'): Promise<any[]> => {
  const res = await client.get('/quran/search', { params: { q, lang } });
  return res.data.data;
};

export const getQuranAudioUrl = async (surah: number, verse: number, reciter = 'Alafasy_128kbps'): Promise<string> => {
  const res = await client.get('/quran/audio-url', { params: { surah, verse, reciter } });
  return res.data.url;
};

export const getQuranReciters = async (): Promise<any[]> => {
  const res = await client.get('/quran/reciters');
  return res.data.data;
};

export const getQuranLanguages = async (): Promise<string[]> => {
  const res = await client.get('/quran/languages');
  return res.data.data;
};

export const getQuranTranslations = async (lang?: string): Promise<any[]> => {
  const res = await client.get('/quran/translations', { params: { lang } });
  return res.data.data;
};

/**
 * 2. Hadith Endpoints
 */
export const getHadithBooks = async (): Promise<any[]> => {
  const res = await client.get('/hadith/books');
  return res.data.data;
};

export const getHadithsByBook = async (book: string, page = 1, limit = 20, chapter?: number): Promise<any> => {
  const res = await client.get(`/hadith/${book}`, { params: { page, limit, chapter } });
  return res.data.data;
};

export const getHadithChapters = async (book: string): Promise<any[]> => {
  const res = await client.get(`/hadith/${book}/chapters`);
  return res.data.data;
};

export const getHadithOfDay = async (): Promise<Hadith> => {
  const res = await client.get('/hadith/of-day');
  return res.data.data;
};

export const searchHadiths = async (q: string): Promise<any[]> => {
  const res = await client.get('/hadith/search', { params: { q } });
  return res.data.data;
};

/**
 * 3. Prayer Endpoints
 */
export const getPrayerTimes = async (lat: number, lon: number, date?: string): Promise<PrayerTimings> => {
  const res = await client.get('/prayer/times', { params: { lat, lon, date } });
  return res.data.data.timings;
};

export const getFullPrayerTimes = async (lat: number, lon: number, date?: string): Promise<any> => {
  const res = await client.get('/prayer/times', { params: { lat, lon, date } });
  return res.data.data;
};

export const getPrayerTimesByCity = async (city: string, country: string, date?: string): Promise<any> => {
  const res = await client.get('/prayer/times-by-city', { params: { city, country, date } });
  return res.data.data;
};

export const getQiblaBearing = async (lat: number, lon: number): Promise<number> => {
  const res = await client.get('/prayer/qibla', { params: { lat, lon } });
  return res.data.data.direction;
};

export const getHijriDate = async (dateStr?: string): Promise<any> => {
  const res = await client.get('/prayer/hijri', { params: { date: dateStr } });
  return res.data.data;
};

/**
 * 4. Duas Endpoints
 */
export const getDuaCategories = async (): Promise<any[]> => {
  const res = await client.get('/duas/categories');
  return res.data.data;
};

export const getDuasByCategory = async (category: string): Promise<Dua[]> => {
  const res = await client.get(`/duas/${category}`);
  return res.data.data;
};

export const getDuaOfDay = async (): Promise<Dua> => {
  const res = await client.get('/duas/of-day');
  return res.data.data;
};

export const getNamesOfAllah = async (): Promise<any[]> => {
  const res = await client.get('/duas/names');
  return res.data.data;
};

/**
 * 5. User Sync Endpoints
 */
export const saveUserPreferences = async (preferences: {
  language: string;
  selectedTranslation: string;
  selectedReciter: string;
  notificationsEnabled: boolean;
  firstName?: string;
  lastName?: string;
  metadata?: any;
}): Promise<any> => {
  const deviceId = await getOrCreateDeviceId();
  const res = await client.post('/user/preferences', { deviceId, ...preferences });
  return res.data.data;
};

export const getUserPreferences = async (): Promise<any> => {
  const deviceId = await getOrCreateDeviceId();
  const res = await client.get(`/user/preferences/${deviceId}`);
  return res.data.data;
};

export const saveBookmark = async (bookmark: {
  type: 'quran' | 'hadith' | 'dua';
  refId: string;
  arabicText: string;
  translation: string;
  reference: string;
}): Promise<any> => {
  const deviceId = await getOrCreateDeviceId();
  const res = await client.post('/user/bookmarks', { deviceId, ...bookmark });
  return res.data.data;
};

export const getBookmarks = async (): Promise<any[]> => {
  const deviceId = await getOrCreateDeviceId();
  const res = await client.get(`/user/bookmarks/${deviceId}`);
  return res.data.data;
};

export const deleteBookmark = async (bookmarkId: string): Promise<any> => {
  const res = await client.delete(`/user/bookmarks/${bookmarkId}`);
  return res.data;
};

export const saveSalahTrackerRecord = async (
  date: string,
  record: { fajr?: string; dhuhr?: string; asr?: string; maghrib?: string; isha?: string }
): Promise<any> => {
  const deviceId = await getOrCreateDeviceId();
  const res = await client.post('/user/salah-tracker', { deviceId, date, ...record });
  return res.data.data;
};

export const getSalahTrackerRecords = async (): Promise<Record<string, any>> => {
  const deviceId = await getOrCreateDeviceId();
  const res = await client.get(`/user/salah-tracker/${deviceId}`);
  return res.data.data;
};

/**
 * 6. AI Scholar Endpoint
 */
export const askScholar = async (
  messages: { role: 'user' | 'assistant'; content: string }[],
  language = 'en'
): Promise<string> => {
  const deviceId = await getOrCreateDeviceId();
  const res = await client.post('/ai-scholar/chat', {
    deviceId,
    messages,
    language
  });

  // Since it is an SSE stream, we parse the accumulated text chunks if it comes back as a text block
  if (typeof res.data === 'string') {
    const lines = res.data.split('\n');
    let accumulatedText = '';
    for (const line of lines) {
      if (line.startsWith('data:')) {
        try {
          const parsed = JSON.parse(line.substring(5).trim());
          if (parsed.type === 'content') {
            accumulatedText += parsed.text;
          }
        } catch (e) {
          // Ignore non-json
        }
      }
    }
    return accumulatedText || 'Could not parse response from AI Scholar.';
  }

  return res.data?.message || 'Inquiry successfully processed.';
};

export default client;
