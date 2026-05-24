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
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            set({ duas: JSON.parse(cached), isLoading: false });
            
            // Background refresh
            getDuasByCategory(category).then(async (duas) => {
              set({ duas });
              await AsyncStorage.setItem(cacheKey, JSON.stringify(duas));
            }).catch(err => console.warn(`Background fetch duas for cat ${category} failed:`, err));

            return;
          }

          set({ isLoading: true });
          const duas = await getDuasByCategory(category);
          set({ duas, isLoading: false });
          await AsyncStorage.setItem(cacheKey, JSON.stringify(duas));
        } catch (err: any) {
          set({ error: err.message || 'Failed to fetch supplications', isLoading: false });
        }
      },

      fetchDuaOfDay: async () => {
        try {
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

          const duaOfDay = await getDuaOfDay();
          set({ duaOfDay });
          await AsyncStorage.setItem('cached_dua_of_day', JSON.stringify(duaOfDay));
        } catch (err) {
          console.warn('Failed to fetch Dua of the Day:', err);
        }
      },

      fetchAllDuas: async () => {
        try {
          const { categories } = get();
          let cats = categories;
          if (cats.length === 0) {
            cats = await getDuaCategories();
            set({ categories: cats });
          }

          const allDuasMap: Record<number, Dua> = {};
          await Promise.all(
            cats.map(async (cat) => {
              try {
                const duasList = await getDuasByCategory(cat.id);
                duasList.forEach((d) => {
                  allDuasMap[d.id] = d;
                });
              } catch (e) {
                console.warn(`Failed to prefetch duas for category ${cat.id}:`, e);
              }
            })
          );

          set({ allDuas: allDuasMap });
        } catch (err) {
          console.warn('Failed to fetch all duas details:', err);
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
