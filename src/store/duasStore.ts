import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDuaCategories,
  getDuasByCategory,
  getDuaOfDay,
  saveBookmark,
  getBookmarks,
  deleteBookmark,
  Dua,
} from '../api/client';

interface DuasState {
  categories: any[];
  duas: Dua[];
  duaOfDay: Dua | null;
  bookmarkedDuaIds: number[];
  bookmarkedDuas: any[]; // Full bookmark items containing MongoDB _id and savedAt
  allDuas: Record<number, Dua>; // Fast lookup table id -> Dua
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchCategories: () => Promise<void>;
  fetchDuas: (category: string) => Promise<void>;
  fetchDuaOfDay: () => Promise<void>;
  fetchAllDuas: () => Promise<void>;
  toggleBookmark: (dua: Dua) => Promise<void>;
  removeBookmark: (bookmarkId: string, refId: number) => Promise<void>;
  syncBookmarks: () => Promise<void>;
}

export const useDuasStore = create<DuasState>()(
  persist(
    (set, get) => ({
      categories: [],
      duas: [],
      duaOfDay: null,
      bookmarkedDuaIds: [],
      bookmarkedDuas: [],
      allDuas: {},
      isLoading: false,
      error: null,

      fetchCategories: async () => {
        try {
          set({ error: null });

          // 1. Try displaying local SQLite categories list (Offline-First)
          const { getLocalDuaCategories } = require('../services/quranLocalDb');
          const localCats = await getLocalDuaCategories();
          
          const formatCategoryName = (slug: string): string => {
            return slug
              .split('-')
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };

          if (localCats && localCats.length > 0) {
            const formatted = localCats.map((c: any) => ({
              id: c.category,
              name: formatCategoryName(c.category),
              count: c.count,
            }));
            set({ categories: formatted, isLoading: false });

            // Refresh from backend silently in the background
            getDuaCategories().then(async (categories) => {
              set({ categories });
              await AsyncStorage.setItem('cached_dua_categories', JSON.stringify(categories));
            }).catch(err => console.warn('Background fetch dua categories failed:', err));

            return;
          }

          // 2. Fallback to AsyncStorage cache
          const cached = await AsyncStorage.getItem('cached_dua_categories');
          if (cached) {
            set({ categories: JSON.parse(cached), isLoading: false });
            
            // Background update
            getDuaCategories().then(async (categories) => {
              set({ categories });
              await AsyncStorage.setItem('cached_dua_categories', JSON.stringify(categories));
            }).catch(err => console.warn('Background fetch dua categories failed:', err));
            
            return;
          }

          // 3. Fallback to remote API call
          set({ isLoading: true });
          const categories = await getDuaCategories();
          set({ categories, isLoading: false });
          await AsyncStorage.setItem('cached_dua_categories', JSON.stringify(categories));
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch categories', isLoading: false });
        }
      },

      fetchDuas: async (category: string) => {
        const cacheKey = `cached_duas_cat_${category}`;
        try {
          set({ error: null });

          // 1. Try displaying local SQLite duas first (Offline-First)
          const { getLocalDuasByCategory } = require('../services/quranLocalDb');
          const localDuas = await getLocalDuasByCategory(category);
          if (localDuas && localDuas.length > 0) {
            set({ duas: localDuas, isLoading: false });

            // Background refresh from cloud API
            getDuasByCategory(category).then(async (duas) => {
              if (Array.isArray(duas)) {
                set({ duas });
                await AsyncStorage.setItem(cacheKey, JSON.stringify(duas));
              }
            }).catch(err => console.warn(`Background fetch duas for cat ${category} failed:`, err));

            return;
          }

          // 2. Fallback to AsyncStorage cache
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached && cached !== 'undefined') {
            const parsed = JSON.parse(cached);
            set({ duas: Array.isArray(parsed) ? parsed : [], isLoading: false });
            
            // Background refresh
            getDuasByCategory(category).then(async (duas) => {
              if (Array.isArray(duas)) {
                set({ duas });
                await AsyncStorage.setItem(cacheKey, JSON.stringify(duas));
              }
            }).catch(err => console.warn(`Background fetch duas for cat ${category} failed:`, err));

            return;
          }

          // 3. Fallback to remote API
          set({ isLoading: true });
          const duas = await getDuasByCategory(category);
          if (Array.isArray(duas)) {
            set({ duas, isLoading: false });
            await AsyncStorage.setItem(cacheKey, JSON.stringify(duas));
          } else {
            set({ duas: [], isLoading: false });
          }
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch supplications', isLoading: false });
        }
      },

      fetchDuaOfDay: async () => {
        try {
          // 1. Calculate deterministic index and fetch from SQLite first (Offline-First)
          const today = new Date();
          const start = new Date(today.getFullYear(), 0, 0);
          const diff = today.getTime() - start.getTime();
          const oneDay = 1000 * 60 * 60 * 24;
          const dayOfYear = Math.floor(diff / oneDay);

          const { getDbConnection } = require('../services/quranLocalDb');
          const db = await getDbConnection();
          const totalRes = (await db.getFirstAsync('SELECT COUNT(*) as count FROM duas')) as { count: number } | null;
          const totalCount = totalRes?.count ?? 60;
          
          const index = ((dayOfYear + today.getFullYear()) % totalCount) + 1;
          const localDuaOfDay = (await db.getFirstAsync('SELECT * FROM duas WHERE id = ?', [index])) as Dua | null;
          
          if (localDuaOfDay) {
            set({ duaOfDay: localDuaOfDay });
            
            // Background refresh
            getDuaOfDay().then(async (duaOfDay) => {
              set({ duaOfDay });
              await AsyncStorage.setItem('cached_dua_of_day', JSON.stringify(duaOfDay));
            }).catch(err => console.warn('Background fetch dua of day failed:', err));

            return;
          }

          // 2. Fallback to AsyncStorage cache
          const cached = await AsyncStorage.getItem('cached_dua_of_day');
          if (cached) {
            set({ duaOfDay: JSON.parse(cached) });
            
            // Background fresh
            getDuaOfDay().then(async (duaOfDay) => {
              set({ duaOfDay });
              await AsyncStorage.setItem('cached_dua_of_day', JSON.stringify(duaOfDay));
            }).catch(err => console.warn('Background fetch dua of day failed:', err));

            return;
          }

          // 3. Fallback to API
          const duaOfDay = await getDuaOfDay();
          set({ duaOfDay });
          await AsyncStorage.setItem('cached_dua_of_day', JSON.stringify(duaOfDay));
        } catch (err) {
          console.warn('Failed to fetch Dua of the Day:', err);
        }
      },

      fetchAllDuas: async () => {
        try {
          // Query all Duas instantly from local SQLite DB
          const { getDbConnection } = require('../services/quranLocalDb');
          const db = await getDbConnection();
          const allLocalDuas = (await db.getAllAsync('SELECT * FROM duas')) as Dua[];
          
          const allDuasMap: Record<number, Dua> = {};
          allLocalDuas.forEach((d: Dua) => {
            allDuasMap[d.id] = d;
          });

          set({ allDuas: allDuasMap });
        } catch (err) {
          console.warn('Failed to fetch all duas details from SQLite:', err);
        }
      },

      toggleBookmark: async (dua: Dua) => {
        const { bookmarkedDuaIds, bookmarkedDuas } = get();
        const isBookmarked = bookmarkedDuaIds.includes(dua.id);

        try {
          if (isBookmarked) {
            // Delete from local state first for immediate UI feedback
            set({
              bookmarkedDuaIds: bookmarkedDuaIds.filter((id) => id !== dua.id),
              bookmarkedDuas: bookmarkedDuas.filter((b) => parseInt(b.refId) !== dua.id),
            });

            // Find matching bookmark on backend and delete
            const remoteBookmarks = await getBookmarks();
            const matching = remoteBookmarks.find(
              (b: any) => b.type === 'dua' && parseInt(b.refId) === dua.id
            );
            if (matching) {
              await deleteBookmark(matching._id);
            }
          } else {
            // Save on server first to get the generated MongoDB ID
            const saved = await saveBookmark({
              type: 'dua',
              refId: dua.id.toString(),
              arabicText: dua.arabic,
              translation: dua.translation,
              reference: dua.reference,
            });

            // Add to local state
            set({
              bookmarkedDuaIds: [...bookmarkedDuaIds, dua.id],
              bookmarkedDuas: [saved, ...bookmarkedDuas],
            });
          }
        } catch (err) {
          console.warn('Failed to toggle bookmark on server:', err);
          // Re-sync to ensure local state matches server in case of failure
          get().syncBookmarks();
        }
      },

      removeBookmark: async (bookmarkId: string, refId: number) => {
        const { bookmarkedDuaIds, bookmarkedDuas } = get();
        try {
          // Optimistically update local state
          set({
            bookmarkedDuaIds: bookmarkedDuaIds.filter((id) => id !== refId),
            bookmarkedDuas: bookmarkedDuas.filter((b) => b._id !== bookmarkId),
          });

          await deleteBookmark(bookmarkId);
        } catch (err) {
          console.warn('Failed to remove bookmark on server:', err);
          get().syncBookmarks();
        }
      },

      syncBookmarks: async () => {
        try {
          const remoteBookmarks = await getBookmarks();
          const duaBookmarks = remoteBookmarks.filter((b: any) => b.type === 'dua');
          
          set({ 
            bookmarkedDuas: duaBookmarks,
            bookmarkedDuaIds: duaBookmarks.map((b: any) => parseInt(b.refId)) 
          });
        } catch (err) {
          console.warn('Failed to sync bookmarks with server:', err);
        }
      },
    }),
    {
      name: 'noor360_duas_store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        bookmarkedDuaIds: state.bookmarkedDuaIds,
        bookmarkedDuas: state.bookmarkedDuas,
      }),
    }
  )
);
