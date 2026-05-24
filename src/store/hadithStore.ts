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

  // Fetch all collections metadata (with Stale-While-Revalidate)
  fetchBooks: async () => {
    try {
      set({ error: null });
      const cached = await AsyncStorage.getItem('cached_hadith_books');
      if (cached) {
        set({ books: JSON.parse(cached), isLoading: false });
        
        // Refresh silently in background
        getHadithBooks().then(async (data) => {
          set({ books: data });
          await AsyncStorage.setItem('cached_hadith_books', JSON.stringify(data));
        }).catch(err => console.warn('Background fetch hadith books failed:', err));
        
        return;
      }

      set({ isLoading: true });
      const data = await getHadithBooks();
      set({ books: data });
      await AsyncStorage.setItem('cached_hadith_books', JSON.stringify(data));
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
      const data = await getHadithChapters(book);
      set({ chapters: data || [] });
    } catch (err: any) {
      console.warn('Failed to load chapters for book:', book, err.message);
      set({ chapters: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch paginated Hadiths of a specific collection (with Stale-While-Revalidate for page 1)
  fetchHadiths: async (book, page = 1, chapter = null) => {
    const cacheKey = `cached_hadiths_${book}_ch${chapter ?? 'all'}_p${page}`;
    try {
      set({ error: null, currentBook: book, currentChapter: chapter });

      // Stale-While-Revalidate logic for first page
      if (page === 1) {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          set({ hadiths: parsed, currentPage: 1, isLoading: false });

          // Background fresh fetch
          const limit = 20;
          getHadithsByBook(book, page, limit, chapter ?? undefined).then(async (response) => {
            const data = Array.isArray(response) ? response : (response?.data || []);
            // Check if user is still on same book/chapter
            if (get().currentBook === book && get().currentChapter === chapter) {
              set({ hadiths: data, currentPage: 1 });
            }
            await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
          }).catch(err => console.warn(`Background fetch hadiths page 1 failed for ${book}:`, err));

          return;
        }
      }

      set({ isLoading: true });
      const limit = 20;
      const response = await getHadithsByBook(book, page, limit, chapter ?? undefined);
      const data = Array.isArray(response) ? response : (response?.data || []);
      const currentList = get().hadiths;
      const updatedList = page === 1 ? data : [...currentList, ...data];

      set({
        hadiths: updatedList,
        currentPage: page,
      });

      if (page === 1) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (err: any) {
      set({ error: err.message || `Failed to retrieve hadith lists for ${book}.` });
    } finally {
      set({ isLoading: false });
    }
  },

  // Set the active chapter for drilling down
  setActiveChapter: (chapter) => set({ activeChapter: chapter }),

  // Search Hadiths globally
  searchHadiths: async (q) => {
    if (!q.trim()) return;
    try {
      set({ isLoading: true, error: null });
      const results = await searchHadithsApi(q);
      set({
        hadiths: results,
        currentPage: 1, // Reset pagination to page 1 on search
      });
    } catch (err: any) {
      set({ error: err.message || 'Search failed.' });
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
