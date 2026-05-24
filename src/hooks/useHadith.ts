import { useEffect } from 'react';
import { useHadithStore } from '../store/hadithStore';

export const useHadith = () => {
  const store = useHadithStore();

  useEffect(() => {
    // Proactively load offline datasets immediately on hook attachment
    if (store.books.length === 0) {
      store.loadLocalData().then(() => {
        store.fetchBooks();
        store.syncBookmarks();
      });
    }
  }, []);

  return {
    books: store.books,
    currentBook: store.currentBook,
    chapters: store.chapters,
    currentChapter: store.currentChapter,
    activeChapter: store.activeChapter,
    hadiths: store.hadiths,
    currentPage: store.currentPage,
    bookmarks: store.bookmarks,
    isLoading: store.isLoading,
    error: store.error,

    // Operations
    fetchBooks: store.fetchBooks,
    fetchChapters: store.fetchChapters,
    fetchHadiths: store.fetchHadiths,
    setActiveChapter: store.setActiveChapter,
    searchHadiths: store.searchHadiths,
    addBookmark: store.addBookmark,
    removeBookmark: store.removeBookmark,
    syncBookmarks: store.syncBookmarks,
    isBookmarked: (refId: string) => store.bookmarks.some((b) => b.refId === refId),
  };
};

export default useHadith;
