import { useEffect } from 'react';
import { useQuranStore } from '../store/quranStore';

export const useQuran = () => {
  const store = useQuranStore();

  useEffect(() => {
    // Proactively load offline datasets immediately on hook attachment
    if (store.surahs.length === 0) {
      store.loadLocalData().then(() => {
        // Run background fetch to refresh the cached indexes seamlessly
        store.fetchSurahs();
        store.syncBookmarks();
      });
    }
  }, []);

  return {
    surahs: store.surahs,
    currentSurah: store.currentSurah,
    currentVerse: store.currentVerse,
    bookmarks: store.bookmarks,
    recentlyRead: store.recentlyRead,
    selectedTranslation: store.selectedTranslation,
    isLoading: store.isLoading,
    error: store.error,

    // Operations
    fetchSurahs: store.fetchSurahs,
    fetchSurah: store.fetchSurah,
    setTranslation: store.setTranslation,
    addBookmark: store.addBookmark,
    removeBookmark: store.removeBookmark,
    syncBookmarks: store.syncBookmarks,
    setLastRead: store.setLastRead,
    isBookmarked: (refId: string) => store.bookmarks.some((b) => b.refId === refId),
  };
};

export default useQuran;
