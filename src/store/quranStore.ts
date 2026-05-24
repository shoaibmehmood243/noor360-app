import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getQuranSurahs,
  getSurahDetail,
  saveUserPreferences,
  saveBookmark,
  deleteBookmark,
  getBookmarks,
  Surah,
} from '../api/client';

interface Bookmark {
  _id?: string; // Backend MongoDB ID
  id?: string;  // Local reference
  type: 'quran' | 'hadith' | 'dua';
  refId: string; // "surah:verse" e.g., "1:1"
  arabicText: string;
  translation: string;
  reference: string;
}

interface LastRead {
  surahId: number;
  verseNumber: number;
  timestamp: number;
}

interface QuranState {
  surahs: Surah[];
  currentSurah: any | null;
  currentVerse: any | null;
  bookmarks: Bookmark[];
  recentlyRead: LastRead[];
  selectedTranslation: string;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadLocalData: () => Promise<void>;
  fetchSurahs: () => Promise<void>;
  fetchSurah: (id: number) => Promise<any>;
  setTranslation: (translation: string) => Promise<void>;
  addBookmark: (bookmark: Omit<Bookmark, '_id'>) => Promise<void>;
  removeBookmark: (refId: string) => Promise<void>;
  syncBookmarks: () => Promise<void>;
  setLastRead: (surahId: number, verseNumber: number) => Promise<void>;
}

export const useQuranStore = create<QuranState>((set, get) => ({
  surahs: [],
  currentSurah: null,
  currentVerse: null,
  bookmarks: [],
  recentlyRead: [],
  selectedTranslation: 'en.sahih',
  isLoading: false,
  error: null,

  // Load cached surahs and bookmarks immediately on startup
  loadLocalData: async () => {
    try {
      const cachedSurahs = await AsyncStorage.getItem('cached_surahs');
      const cachedBookmarks = await AsyncStorage.getItem('cached_bookmarks');
      const cachedLastRead = await AsyncStorage.getItem('recently_read');
      const cachedTranslation = await AsyncStorage.getItem('selected_translation');

      set({
        surahs: cachedSurahs ? JSON.parse(cachedSurahs) : [],
        bookmarks: cachedBookmarks ? JSON.parse(cachedBookmarks) : [],
        recentlyRead: cachedLastRead ? JSON.parse(cachedLastRead) : [],
        selectedTranslation: cachedTranslation || 'en.sahih',
      });
    } catch (e) {
      console.warn('Failed to load local Quran cache:', e);
    }
  },

  // Fetch Surah list from API, caching immediately on success (with Stale-While-Revalidate)
  fetchSurahs: async () => {
    try {
      set({ error: null });

      // 1. Try displaying cached data instantly (Stale-While-Revalidate)
      const cached = await AsyncStorage.getItem('cached_surahs');
      if (cached) {
        set({ surahs: JSON.parse(cached), isLoading: false });
        
        // Refresh silently in the background
        getQuranSurahs().then(async (data) => {
          set({ surahs: data });
          await AsyncStorage.setItem('cached_surahs', JSON.stringify(data));
        }).catch((err) => console.warn('Background fetch surahs failed:', err));
        
        return;
      }

      set({ isLoading: true });
      const data = await getQuranSurahs();
      set({ surahs: data });
      await AsyncStorage.setItem('cached_surahs', JSON.stringify(data));
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch surahs list.' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch Surah detail including translation verses (with Stale-While-Revalidate)
  fetchSurah: async (id) => {
    const translation = get().selectedTranslation;
    const cacheKey = `cached_surah_${id}_${translation}`;
    try {
      set({ error: null });

      // 1. Return cached copy instantly if it exists
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({ currentSurah: parsed, isLoading: false });
        
        // Refresh in the background silently
        getSurahDetail(id, translation).then(async (data) => {
          // Check to ensure we only update if user hasn't switched away
          if (get().selectedTranslation === translation) {
            set({ currentSurah: data });
          }
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        }).catch((err) => console.warn(`Background fetch surah ${id} failed:`, err));

        return parsed;
      }

      set({ isLoading: true });
      const data = await getSurahDetail(id, translation);
      set({ currentSurah: data });
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    } catch (err: any) {
      set({ error: err.message || `Failed to fetch Surah ${id}.` });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  setTranslation: async (translation) => {
    try {
      set({ selectedTranslation: translation });
      await AsyncStorage.setItem('selected_translation', translation);
      await AsyncStorage.setItem('user_selected_translation', translation);
      try {
        const { usePreferencesStore } = require('./usePreferencesStore');
        usePreferencesStore.setState({ selectedTranslation: translation });
      } catch (err) {
        console.warn('Failed to dynamically sync translation to usePreferencesStore:', err);
      }
      
      // Sync preference to Mongo backend
      await saveUserPreferences({
        language: 'en',
        selectedTranslation: translation,
        selectedReciter: 'ar.alafasy',
        notificationsEnabled: true,
      });
    } catch (err) {
      console.warn('Failed to sync translation preferences to server:', err);
    }
  },

  // Add a bookmark locally and post to Mongo DB
  addBookmark: async (bookmark) => {
    try {
      const currentList = get().bookmarks;
      
      // Save to Mongo backend first to get the database _id
      let dbId = '';
      try {
        const saved = await saveBookmark({
          type: bookmark.type,
          refId: bookmark.refId,
          arabicText: bookmark.arabicText,
          translation: bookmark.translation,
          reference: bookmark.reference,
        });
        dbId = saved._id || '';
      } catch (e) {
        console.warn('Failed to post bookmark to backend. Storing locally only.', e);
      }

      const newBookmark: Bookmark = {
        ...bookmark,
        _id: dbId || `local_${Date.now()}`,
      };

      const updated = [...currentList, newBookmark];
      set({ bookmarks: updated });
      await AsyncStorage.setItem('cached_bookmarks', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to add bookmark:', err);
    }
  },

  // Remove a bookmark locally and call DELETE endpoint on backend
  removeBookmark: async (refId) => {
    try {
      const currentList = get().bookmarks;
      const target = currentList.find((b) => b.refId === refId);
      
      if (!target) return;

      // Delete from backend if _id exists and is not local
      if (target._id && !target._id.startsWith('local_')) {
        try {
          await deleteBookmark(target._id);
        } catch (e) {
          console.warn('Failed to delete bookmark from backend:', e);
        }
      }

      const updated = currentList.filter((b) => b.refId !== refId);
      set({ bookmarks: updated });
      await AsyncStorage.setItem('cached_bookmarks', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
    }
  },

  // Sync bookmarks from MongoDB backend on launch
  syncBookmarks: async () => {
    try {
      set({ isLoading: true });
      const backendBookmarks = await getBookmarks();
      
      const mapped: Bookmark[] = backendBookmarks.map((b: any) => ({
        _id: b._id,
        type: b.type,
        refId: b.refId,
        arabicText: b.arabicText,
        translation: b.translation,
        reference: b.reference,
      }));

      set({ bookmarks: mapped });
      await AsyncStorage.setItem('cached_bookmarks', JSON.stringify(mapped));
    } catch (err) {
      console.warn('Failed to sync bookmarks from cloud backend:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  // Persist Last Read tracking
  setLastRead: async (surahId, verseNumber) => {
    try {
      const newRead: LastRead = {
        surahId,
        verseNumber,
        timestamp: Date.now(),
      };

      // Limit list to last 5 recently read entries
      const currentList = get().recentlyRead;
      const filtered = currentList.filter((r) => r.surahId !== surahId);
      const updated = [newRead, ...filtered].slice(0, 5);

      set({ recentlyRead: updated });
      await AsyncStorage.setItem('recently_read', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to write last read preferences:', err);
    }
  },
}));
