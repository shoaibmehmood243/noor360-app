import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getHadithBooks,
  getHadithsByBook,
  getHadithChapters,
  searchHadiths as searchHadithsApi,
  saveBookmark,
  deleteBookmark,
  getBookmarks,
} from '../api/client';

export interface HadithBookmark {
  _id?: string;
  type: 'quran' | 'hadith' | 'dua';
  refId: string; // "book:hadithNumber" e.g., "bukhari:1"
  arabicText: string;
  translation: string;
  reference: string;
}

interface HadithState {
  books: any[];
  currentBook: string;
  chapters: any[];
  currentChapter: number | null;
  activeChapter: any | null;
  hadiths: any[];
  currentPage: number;
  bookmarks: HadithBookmark[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadLocalData: () => Promise<void>;
  fetchBooks: () => Promise<void>;
  fetchChapters: (book: string) => Promise<void>;
  fetchHadiths: (book: string, page?: number, chapter?: number | null) => Promise<void>;
  setActiveChapter: (chapter: any | null) => void;
  searchHadiths: (q: string) => Promise<void>;
  addBookmark: (bookmark: Omit<HadithBookmark, '_id'>) => Promise<void>;
  removeBookmark: (refId: string) => Promise<void>;
  syncBookmarks: () => Promise<void>;
}

export const useHadithStore = create<HadithState>((set, get) => ({
  books: [],
  currentBook: 'sahih-bukhari',
  chapters: [],
  currentChapter: null,
  activeChapter: null,
  hadiths: [],
  currentPage: 1,
  bookmarks: [],
  isLoading: false,
  error: null,

  // Load cached hadith bookmarks immediately on launch
  loadLocalData: async () => {
    try {
      const cachedBookmarks = await AsyncStorage.getItem('cached_hadith_bookmarks');
      const cachedBooks = await AsyncStorage.getItem('cached_hadith_books');
      set({
        bookmarks: cachedBookmarks ? JSON.parse(cachedBookmarks) : [],
        books: cachedBooks ? JSON.parse(cachedBooks) : [],
      });
    } catch (e) {
      console.warn('Failed to load local Hadith cache:', e);
    }
  },

  // Fetch all collections metadata (with local SQLite DB cache)
  fetchBooks: async () => {
    try {
      set({ error: null });
      
      const { getLocalHadithBooks, cacheLocalHadithBooks } = require('../services/quranLocalDb');
      const localBooks = await getLocalHadithBooks();
      if (localBooks && localBooks.length > 0) {
        set({ books: localBooks, isLoading: false });
        
        // Refresh silently in background
        getHadithBooks().then(async (data) => {
          set({ books: data });
          await cacheLocalHadithBooks(data);
        }).catch(err => console.warn('Background fetch hadith books failed:', err));
        
        return;
      }

      set({ isLoading: true });
      const data = await getHadithBooks();
      set({ books: data });
      await cacheLocalHadithBooks(data);
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch hadith collections list.' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch chapters of a specific collection
  fetchChapters: async (book) => {
    try {
      set({ isLoading: true, error: null });

      const { getLocalHadithChapters, cacheLocalHadithChapters } = require('../services/quranLocalDb');
      const localChapters = await getLocalHadithChapters(book);
      if (localChapters && localChapters.length > 0) {
        set({ chapters: localChapters, isLoading: false });

        // Refresh silently in background
        getHadithChapters(book).then(async (data) => {
          if (data && data.length > 0) {
            set({ chapters: data });
            await cacheLocalHadithChapters(book, data);
          }
        }).catch(err => console.warn('Background fetch hadith chapters failed:', err));

        return;
      }

      const data = await getHadithChapters(book);
      set({ chapters: data || [] });
      if (data && data.length > 0) {
        await cacheLocalHadithChapters(book, data);
      }
    } catch (err: any) {
      console.warn('Failed to load chapters for book:', book, err.message);
      set({ chapters: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch paginated Hadiths of a specific collection (with SQLite Stale-While-Revalidate)
  fetchHadiths: async (book, page = 1, chapter = null) => {
    const limit = 20;
    try {
      set({ error: null, currentBook: book, currentChapter: chapter });

      const { getLocalHadiths, cacheLocalHadiths } = require('../services/quranLocalDb');
      const localHadiths = await getLocalHadiths(book, chapter, page, limit);

      // Stale-While-Revalidate logic for first page
      if (page === 1) {
        if (localHadiths && localHadiths.length > 0) {
          const formatted = localHadiths.map((h: any) => ({
            id: h.id,
            hadithNumber: h.hadithNumber,
            chapterNo: h.chapterNumber,
            hadithArabic: h.hadithArabic,
            hadithEnglish: h.hadithEnglish,
            englishNarrator: h.englishNarrator,
            arabicNarrator: h.arabicNarrator,
          }));

          set({ hadiths: formatted, currentPage: 1, isLoading: false });

          // Background fresh fetch
          getHadithsByBook(book, page, limit, chapter ?? undefined).then(async (response) => {
            const data = Array.isArray(response) ? response : (response?.data || []);
            if (get().currentBook === book && get().currentChapter === chapter) {
              set({ hadiths: data, currentPage: 1 });
            }
            await cacheLocalHadiths(book, data);
          }).catch(err => console.warn(`Background fetch hadiths page 1 failed for ${book}:`, err));

          return;
        }
      } else {
        if (localHadiths && localHadiths.length > 0) {
          const formatted = localHadiths.map((h: any) => ({
            id: h.id,
            hadithNumber: h.hadithNumber,
            chapterNo: h.chapterNumber,
            hadithArabic: h.hadithArabic,
            hadithEnglish: h.hadithEnglish,
            englishNarrator: h.englishNarrator,
            arabicNarrator: h.arabicNarrator,
          }));
          const currentList = get().hadiths;
          const merged = [...currentList];
          formatted.forEach((fh: any) => {
            if (!merged.some((m) => m.hadithNumber === fh.hadithNumber)) {
              merged.push(fh);
            }
          });
          set({ hadiths: merged, currentPage: page });
          return;
        }
      }

      set({ isLoading: true });
      const response = await getHadithsByBook(book, page, limit, chapter ?? undefined);
      const data = Array.isArray(response) ? response : (response?.data || []);
      const currentList = get().hadiths;
      const updatedList = page === 1 ? data : [...currentList, ...data];

      set({
        hadiths: updatedList,
        currentPage: page,
      });

      if (data && data.length > 0) {
        await cacheLocalHadiths(book, data);
      }
    } catch (err: any) {
      // Offline fallback: try to load whatever is in SQLite for this page
      try {
        const { getLocalHadiths } = require('../services/quranLocalDb');
        const fallbackHadiths = await getLocalHadiths(book, chapter, page, limit);
        if (fallbackHadiths && fallbackHadiths.length > 0) {
          const formatted = fallbackHadiths.map((h: any) => ({
            id: h.id,
            hadithNumber: h.hadithNumber,
            chapterNo: h.chapterNumber,
            hadithArabic: h.hadithArabic,
            hadithEnglish: h.hadithEnglish,
            englishNarrator: h.englishNarrator,
            arabicNarrator: h.arabicNarrator,
          }));
          const currentList = get().hadiths;
          const updatedList = page === 1 ? formatted : [...currentList, ...formatted];
          set({ hadiths: updatedList, currentPage: page, error: null });
        } else {
          set({ error: err.message || `Failed to retrieve hadith lists for ${book}.` });
        }
      } catch (e) {
        set({ error: err.message || `Failed to retrieve hadith lists for ${book}.` });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  // Set the active chapter for drilling down
  setActiveChapter: (chapter) => set({ activeChapter: chapter }),

  // Search Hadiths globally (network search with local offline index fallback)
  searchHadiths: async (q) => {
    if (!q.trim()) return;
    try {
      set({ isLoading: true, error: null });
      const results = await searchHadithsApi(q);
      set({
        hadiths: results,
        currentPage: 1,
      });
    } catch (err: any) {
      console.warn('Network search failed, trying local index...', err.message);
      try {
        const { searchLocalHadiths } = require('../services/quranLocalDb');
        const localResults = await searchLocalHadiths(q);
        if (localResults && localResults.length > 0) {
          const formatted = localResults.map((h: any) => ({
            id: h.id,
            hadithNumber: h.hadithNumber,
            chapterNo: h.chapterNumber,
            hadithArabic: h.hadithArabic,
            hadithEnglish: h.hadithEnglish,
            englishNarrator: h.englishNarrator,
            arabicNarrator: h.arabicNarrator,
          }));
          set({ hadiths: formatted, currentPage: 1 });
        } else {
          set({ error: 'Search failed. You are currently offline and no local matches were found.' });
        }
      } catch (localErr) {
        set({ error: 'Search failed.' });
      }
    } finally {
      set({ isLoading: false });
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
        console.warn('Failed to post hadith bookmark to backend. Storing locally only.', e);
      }

      const newBookmark: HadithBookmark = {
        ...bookmark,
        _id: dbId || `local_${Date.now()}`,
      };

      const updated = [...currentList, newBookmark];
      set({ bookmarks: updated });
      await AsyncStorage.setItem('cached_hadith_bookmarks', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to add hadith bookmark:', err);
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
          console.warn('Failed to delete hadith bookmark from backend:', e);
        }
      }

      const updated = currentList.filter((b) => b.refId !== refId);
      set({ bookmarks: updated });
      await AsyncStorage.setItem('cached_hadith_bookmarks', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to remove hadith bookmark:', err);
    }
  },

  // Sync bookmarks from MongoDB backend on launch
  syncBookmarks: async () => {
    try {
      const backendBookmarks = await getBookmarks();

      // Filter only Hadith type bookmarks
      const filtered = backendBookmarks.filter((b: any) => b.type === 'hadith');
      const mapped: HadithBookmark[] = filtered.map((b: any) => ({
        _id: b._id,
        type: b.type,
        refId: b.refId,
        arabicText: b.arabicText,
        translation: b.translation,
        reference: b.reference,
      }));

      set({ bookmarks: mapped });
      await AsyncStorage.setItem('cached_hadith_bookmarks', JSON.stringify(mapped));
    } catch (err) {
      console.warn('Failed to sync hadith bookmarks from cloud backend:', err);
    }
  },
}));
