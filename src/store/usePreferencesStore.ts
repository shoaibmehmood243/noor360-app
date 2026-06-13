import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { saveUserPreferences, getUserPreferences, getOrCreateDeviceId } from '../api/client';

export type TextSize = 'Small' | 'Medium' | 'Large';
export type PrayerMethod = 'MWL' | 'ISNA' | 'Egypt' | 'Makkah' | 'Karachi' | 'Tehran' | 'Shia';
export type AsrMethod = 'Standard' | 'Hanafi';
export type AIResponseLang = 'Auto-detect' | 'Always English' | 'Always Arabic';

interface PreferencesState {
  language: string;
  latitude: number | null;
  longitude: number | null;
  notificationsEnabled: boolean;
  quranLevel: 'Beginner' | 'Learning' | 'Fluent';
  selectedReciter: string;
  selectedTranslation: string;
  textSize: TextSize;
  theme: 'dark' | 'light';
  autoplayAudio: boolean;
  wordByWord: boolean;
  calculationMethod: PrayerMethod;
  asrMethod: AsrMethod;
  responseLanguage: AIResponseLang;
  dailyQuestionsUsed: number;
  dailyQuestionsMax: number;

  setLanguage: (lang: string) => Promise<void>;
  setLocation: (lat: number, lon: number) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setQuranLevel: (level: 'Beginner' | 'Learning' | 'Fluent') => Promise<void>;
  setSelectedReciter: (reciter: string) => Promise<void>;
  setSelectedTranslation: (translation: string) => Promise<void>;
  setTextSize: (size: TextSize) => Promise<void>;
  setAutoplayAudio: (enabled: boolean) => Promise<void>;
  setWordByWord: (enabled: boolean) => Promise<void>;
  setCalculationMethod: (method: PrayerMethod) => Promise<void>;
  setAsrMethod: (method: AsrMethod) => Promise<void>;
  setResponseLanguage: (lang: AIResponseLang) => Promise<void>;
  incrementQuestionsUsed: () => Promise<void>;
  resetQuestionsUsed: () => Promise<void>;
  
  loadAllPreferences: () => Promise<void>;
  syncWithBackend: () => Promise<void>;
  saveAllPreferences: () => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  language: 'en',
  latitude: null,
  longitude: null,
  notificationsEnabled: false,
  quranLevel: 'Beginner',
  selectedReciter: 'ar.alafasy',
  selectedTranslation: 'en.sahih',
  textSize: 'Medium',
  theme: 'dark',
  autoplayAudio: true,
  wordByWord: false,
  calculationMethod: 'MWL',
  asrMethod: 'Standard',
  responseLanguage: 'Auto-detect',
  dailyQuestionsUsed: 18, // Default initial mock visual representation
  dailyQuestionsMax: 20,

  saveAllPreferences: async () => {
    // Write a unified sync flag to disk
    await AsyncStorage.setItem('onboarding_complete', 'true');
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    await AsyncStorage.setItem('user_language', lang);
    await get().syncWithBackend();
  },

  setLocation: async (lat, lon) => {
    set({ latitude: lat, longitude: lon });
    await AsyncStorage.setItem('user_latitude', lat.toString());
    await AsyncStorage.setItem('user_longitude', lon.toString());
  },

  setNotificationsEnabled: async (enabled) => {
    set({ notificationsEnabled: enabled });
    await AsyncStorage.setItem('user_notifications_enabled', enabled ? 'true' : 'false');
    await get().syncWithBackend();
  },

  setQuranLevel: async (level) => {
    set({ quranLevel: level });
    await AsyncStorage.setItem('user_quran_level', level);
  },

  setSelectedReciter: async (reciter) => {
    set({ selectedReciter: reciter });
    await AsyncStorage.setItem('user_selected_reciter', reciter);
    try {
      const { AudioPlayer } = require('../services/audioPlayer');
      AudioPlayer.setReciter(reciter);
    } catch (e) {
      console.warn('Failed to dynamically sync reciter to AudioPlayer service:', e);
    }
    await get().syncWithBackend();
  },

  setSelectedTranslation: async (translation) => {
    set({ selectedTranslation: translation });
    await AsyncStorage.setItem('user_selected_translation', translation);
    await AsyncStorage.setItem('selected_translation', translation);
    try {
      const { useQuranStore } = require('./quranStore');
      useQuranStore.setState({ selectedTranslation: translation });
    } catch (err) {
      console.warn('Failed to dynamically sync translation to useQuranStore:', err);
    }
    await get().syncWithBackend();
  },

  setTextSize: async (size) => {
    set({ textSize: size });
    await AsyncStorage.setItem('user_text_size', size);
    await get().syncWithBackend();
  },

  setAutoplayAudio: async (enabled) => {
    set({ autoplayAudio: enabled });
    await AsyncStorage.setItem('user_autoplay_audio', enabled ? 'true' : 'false');
    await get().syncWithBackend();
  },

  setWordByWord: async (enabled) => {
    set({ wordByWord: enabled });
    await AsyncStorage.setItem('user_word_by_word', enabled ? 'true' : 'false');
    await get().syncWithBackend();
  },

  setCalculationMethod: async (method) => {
    set({ calculationMethod: method });
    await AsyncStorage.setItem('user_calculation_method', method);
    await get().syncWithBackend();
  },

  setAsrMethod: async (method) => {
    set({ asrMethod: method });
    await AsyncStorage.setItem('user_asr_method', method);
    await get().syncWithBackend();
  },

  setResponseLanguage: async (lang) => {
    set({ responseLanguage: lang });
    await AsyncStorage.setItem('user_response_language', lang);
    await get().syncWithBackend();
  },

  incrementQuestionsUsed: async () => {
    const nextVal = Math.min(get().dailyQuestionsUsed + 1, get().dailyQuestionsMax);
    set({ dailyQuestionsUsed: nextVal });
    await AsyncStorage.setItem('user_ai_questions_used', nextVal.toString());
  },

  resetQuestionsUsed: async () => {
    set({ dailyQuestionsUsed: 0 });
    await AsyncStorage.setItem('user_ai_questions_used', '0');
  },

  syncWithBackend: async () => {
    try {
      const state = get();
      const firstName = (await AsyncStorage.getItem('user_first_name')) || '';
      const lastName = (await AsyncStorage.getItem('user_last_name')) || '';
      await saveUserPreferences({
        language: state.language,
        selectedTranslation: state.selectedTranslation,
        selectedReciter: state.selectedReciter,
        notificationsEnabled: state.notificationsEnabled,
        firstName,
        lastName,
        metadata: {
          textSize: state.textSize,
          autoplayAudio: state.autoplayAudio,
          wordByWord: state.wordByWord,
          calculationMethod: state.calculationMethod,
          asrMethod: state.asrMethod,
          responseLanguage: state.responseLanguage,
        }
      });
    } catch (e) {
      console.warn('Preferences backend sync failed (offline-first):', e);
    }
  },

  loadAllPreferences: async () => {
    try {
      // 1. Pull from AsyncStorage first for ultra-fast startup
      const cachedLang = await AsyncStorage.getItem('user_language');
      const cachedLat = await AsyncStorage.getItem('user_latitude');
      const cachedLon = await AsyncStorage.getItem('user_longitude');
      const cachedNotif = await AsyncStorage.getItem('user_notifications_enabled');
      const cachedLvl = await AsyncStorage.getItem('user_quran_level');
      const cachedReciter = await AsyncStorage.getItem('user_selected_reciter');
      const cachedTrans = await AsyncStorage.getItem('user_selected_translation');
      const cachedSize = await AsyncStorage.getItem('user_text_size');
      const cachedAutoplay = await AsyncStorage.getItem('user_autoplay_audio');
      const cachedWbW = await AsyncStorage.getItem('user_word_by_word');
      const cachedCalc = await AsyncStorage.getItem('user_calculation_method');
      const cachedAsr = await AsyncStorage.getItem('user_asr_method');
      const cachedAIRes = await AsyncStorage.getItem('user_response_language');
      const cachedAIUsed = await AsyncStorage.getItem('user_ai_questions_used');

      set({
        language: cachedLang || 'en',
        latitude: cachedLat ? parseFloat(cachedLat) : null,
        longitude: cachedLon ? parseFloat(cachedLon) : null,
        notificationsEnabled: cachedNotif === 'true',
        quranLevel: (cachedLvl as any) || 'Beginner',
        selectedReciter: cachedReciter || 'ar.alafasy',
        selectedTranslation: cachedTrans || 'en.sahih',
        textSize: (cachedSize as any) || 'Medium',
        autoplayAudio: cachedAutoplay !== 'false',
        wordByWord: cachedWbW === 'true',
        calculationMethod: (cachedCalc as any) || 'MWL',
        asrMethod: (cachedAsr as any) || 'Standard',
        responseLanguage: (cachedAIRes as any) || 'Auto-detect',
        dailyQuestionsUsed: cachedAIUsed ? parseInt(cachedAIUsed, 10) : 18,
      });

      // 2. Fetch from backend inside background SWR layer
      try {
        const backendPrefs = await getUserPreferences();
        if (backendPrefs) {
          set({
            language: backendPrefs.language || get().language,
            selectedTranslation: backendPrefs.selectedTranslation || get().selectedTranslation,
            selectedReciter: backendPrefs.selectedReciter || get().selectedReciter,
            notificationsEnabled: backendPrefs.notificationsEnabled ?? get().notificationsEnabled,
            // Merge metadata if present
            ...(backendPrefs.metadata || {}),
          });

          if (backendPrefs.firstName) {
            await AsyncStorage.setItem('user_first_name', backendPrefs.firstName);
          }
          if (backendPrefs.lastName) {
            await AsyncStorage.setItem('user_last_name', backendPrefs.lastName);
          }
        }
      } catch (err) {
        console.warn('Failed to load settings from server background SWR (relying on cache):', err);
      }
    } catch (e) {
      console.warn('Failed to read settings from AsyncStorage:', e);
    }
  },
}));
