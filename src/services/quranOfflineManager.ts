import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQuranAudioUrl } from '../api/client';

const AUDIO_DIR = `${FileSystem.documentDirectory}quran_audio/`;

const ensureDirectoryExists = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('Failed to create quran audio directory:', e);
  }
};

export const getVerseFilename = (surah: number, verse: number, reciter: string) => {
  // Clean reciter ID to make safe filename
  const safeReciter = reciter.replace(/[^a-zA-Z0-9]/g, '_');
  return `${safeReciter}_s${surah}v${verse}.mp3`;
};

export const getLocalVersePath = (surah: number, verse: number, reciter: string) => {
  return `${AUDIO_DIR}${getVerseFilename(surah, verse, reciter)}`;
};

/**
 * Checks if a specific verse audio is downloaded offline.
 */
export const isVerseDownloaded = async (surah: number, verse: number, reciter: string): Promise<boolean> => {
  try {
    const path = getLocalVersePath(surah, verse, reciter);
    const fileInfo = await FileSystem.getInfoAsync(path);
    return fileInfo.exists;
  } catch (e) {
    return false;
  }
};

/**
 * Returns local URI for a verse if it exists offline, otherwise null.
 */
export const getOfflineVerseUri = async (surah: number, verse: number, reciter: string): Promise<string | null> => {
  const path = getLocalVersePath(surah, verse, reciter);
  try {
    const fileInfo = await FileSystem.getInfoAsync(path);
    if (fileInfo.exists) {
      return fileInfo.uri;
    }
  } catch (e) {
    // Fallback to null
  }
  return null;
};

/**
 * Downloads a single verse audio file.
 */
export const downloadVerse = async (surah: number, verse: number, reciter: string): Promise<string> => {
  await ensureDirectoryExists();
  const path = getLocalVersePath(surah, verse, reciter);

  // If already downloaded, return it immediately
  const fileInfo = await FileSystem.getInfoAsync(path);
  if (fileInfo.exists) {
    return fileInfo.uri;
  }

  // Get source URL
  const remoteUrl = await getQuranAudioUrl(surah, verse, reciter);
  if (!remoteUrl) {
    throw new Error(`Failed to get audio URL for Surah ${surah} Ayah ${verse}`);
  }

  // Download
  const downloadResult = await FileSystem.downloadAsync(remoteUrl, path);
  if (downloadResult.status !== 200) {
    // Clean up partial file on failure
    try { await FileSystem.deleteAsync(path, { idempotent: true }); } catch (e) {}
    throw new Error(`Download failed with status code ${downloadResult.status}`);
  }

  return downloadResult.uri;
};

// Active download tasks registry to allow cancellation or duplicate prevention
const activeSurahDownloads = new Map<string, { cancel: () => void }>();

/**
 * Downloads an entire Surah sequentially or in batches, reporting progress.
 */
export const downloadFullSurah = async (
  surah: number,
  totalVerses: number,
  reciter: string,
  onProgress?: (progress: number, downloadedCount: number) => void
): Promise<void> => {
  await ensureDirectoryExists();
  const downloadKey = `${reciter}_${surah}`;

  if (activeSurahDownloads.has(downloadKey)) {
    throw new Error('Download is already in progress for this Surah.');
  }

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  activeSurahDownloads.set(downloadKey, { cancel });

  try {
    let downloadedCount = 0;
    
    // Check which verses are already downloaded first to save time and bandwidth
    const pendingVerses: number[] = [];
    for (let verse = 1; verse <= totalVerses; verse++) {
      if (cancelled) break;
      const isDownloaded = await isVerseDownloaded(surah, verse, reciter);
      if (isDownloaded) {
        downloadedCount++;
      } else {
        pendingVerses.push(verse);
      }
    }

    if (onProgress) {
      onProgress(totalVerses > 0 ? downloadedCount / totalVerses : 0, downloadedCount);
    }

    // Process pending downloads in parallel batches of 3 to speed up without overloading
    const batchSize = 3;
    for (let i = 0; i < pendingVerses.length; i += batchSize) {
      if (cancelled) break;
      const batch = pendingVerses.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (verse) => {
          try {
            await downloadVerse(surah, verse, reciter);
            downloadedCount++;
            if (onProgress && !cancelled) {
              onProgress(downloadedCount / totalVerses, downloadedCount);
            }
          } catch (e) {
            console.warn(`Failed to download surah ${surah} verse ${verse}:`, e);
          }
        })
      );
    }

    if (cancelled) {
      throw new Error('Download cancelled by user.');
    }

    // Mark as downloaded
    if (downloadedCount >= totalVerses) {
      await markSurahOfflineStatus(surah, reciter, true);
    } else {
      throw new Error(`Only downloaded ${downloadedCount}/${totalVerses} verses. Please try again.`);
    }

  } finally {
    activeSurahDownloads.delete(downloadKey);
  }
};

/**
 * Cancels a running Surah download.
 */
export const cancelSurahDownload = (surah: number, reciter: string) => {
  const downloadKey = `${reciter}_${surah}`;
  const task = activeSurahDownloads.get(downloadKey);
  if (task) {
    task.cancel();
  }
};

/**
 * Checks if a Surah is marked as fully downloaded.
 */
export const isSurahDownloaded = async (surah: number, reciter: string): Promise<boolean> => {
  try {
    const list = await getDownloadedSurahsList(reciter);
    return list.includes(surah);
  } catch (e) {
    return false;
  }
};

/**
 * Returns the list of fully downloaded Surah IDs.
 */
export const getDownloadedSurahsList = async (reciter: string): Promise<number[]> => {
  try {
    const key = `offline_surahs_${reciter.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Saves the offline status of a Surah.
 */
const markSurahOfflineStatus = async (surah: number, reciter: string, status: boolean) => {
  try {
    const key = `offline_surahs_${reciter.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const list = await getDownloadedSurahsList(reciter);
    let updated: number[];
    if (status) {
      if (!list.includes(surah)) {
        updated = [...list, surah].sort((a, b) => a - b);
      } else {
        updated = list;
      }
    } else {
      updated = list.filter((id) => id !== surah);
    }
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to mark surah offline status:', e);
  }
};

/**
 * Deletes downloaded audio files for a Surah.
 */
export const deleteDownloadedSurah = async (surah: number, totalVerses: number, reciter: string): Promise<void> => {
  for (let verse = 1; verse <= totalVerses; verse++) {
    const path = getLocalVersePath(surah, verse, reciter);
    try {
      const fileInfo = await FileSystem.getInfoAsync(path);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(path, { idempotent: true });
      }
    } catch (e) {
      console.warn(`Failed to delete surah ${surah} verse ${verse} audio file:`, e);
    }
  }
  await markSurahOfflineStatus(surah, reciter, false);
};

/**
 * Clears all downloaded Quran audio files.
 */
export const clearAllOfflineAudio = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(AUDIO_DIR, { idempotent: true });
    }
    // Delete all offline metadata keys in AsyncStorage
    const allKeys = await AsyncStorage.getAllKeys();
    const offlineKeys = allKeys.filter((key) => key.startsWith('offline_surahs_'));
    if (offlineKeys.length > 0) {
      await AsyncStorage.multiRemove(offlineKeys);
    }
  } catch (e) {
    console.warn('Failed to clear all offline audio:', e);
  }
};

/**
 * Gets total storage size of downloaded audio.
 */
export const getOfflineStorageSize = async (): Promise<number> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIO_DIR);
    if (!dirInfo.exists) {
      return 0;
    }
    
    // Sum children sizes
    let totalBytes = 0;
    const files = await FileSystem.readDirectoryAsync(AUDIO_DIR);
    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${AUDIO_DIR}${file}`);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        totalBytes += fileInfo.size || 0;
      }
    }
    return totalBytes;
  } catch (e) {
    return 0;
  }
};
