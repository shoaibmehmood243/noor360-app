import { createAudioPlayer, AudioPlayer as ExpoPlayer } from 'expo-audio';
import { getQuranAudioUrl } from '../api/client';

export interface PlaybackState {
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  didJustFinish: boolean;
  currentVerse: number | null;
  currentSurah: number | null;
  reciter: string;
  isLooping: boolean;
  isAutoAdvance: boolean;
  isLoading: boolean;
}

type PlaybackListener = (state: PlaybackState) => void;

class AudioPlayerService {
  private player: any = null;
  private listeners: Set<PlaybackListener> = new Set();
  private statusSubscription: any = null;

  // Internal states
  private currentSurah: number | null = null;
  private currentVerse: number | null = null;
  private currentReciter = 'ar.alafasy';
  private isPlayingState = false;
  private isLoopingState = false;
  private isAutoAdvanceState = true;
  private isLoadingState = false;

  private positionMillis = 0;
  private durationMillis = 0;

  // Full Surah queuing
  private isPlaylistActive = false;
  private totalVersesInSurah = 0;

  // Polling interval for currentTime updates during playback
  private progressInterval: any = null;

  // Subscribe to playback updates
  subscribe(listener: PlaybackListener) {
    this.listeners.add(listener);
    this.emitState();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitState() {
    const state: PlaybackState = {
      isPlaying: this.isPlayingState,
      positionMillis: this.positionMillis,
      durationMillis: this.durationMillis,
      didJustFinish: false,
      currentVerse: this.currentVerse,
      currentSurah: this.currentSurah,
      reciter: this.currentReciter,
      isLooping: this.isLoopingState,
      isAutoAdvance: this.isAutoAdvanceState,
      isLoading: this.isLoadingState,
    };
    this.listeners.forEach((listener) => listener(state));
  }

  getState(): PlaybackState {
    return {
      isPlaying: this.isPlayingState,
      positionMillis: this.positionMillis,
      durationMillis: this.durationMillis,
      didJustFinish: false,
      currentVerse: this.currentVerse,
      currentSurah: this.currentSurah,
      reciter: this.currentReciter,
      isLooping: this.isLoopingState,
      isAutoAdvance: this.isAutoAdvanceState,
      isLoading: this.isLoadingState,
    };
  }

  setReciter(reciter: string) {
    this.currentReciter = reciter;
    this.emitState();
    if (this.currentSurah && this.currentVerse && this.player) {
      this.loadVerse(this.currentSurah, this.currentVerse, reciter);
    }
  }

  setLooping(loop: boolean) {
    this.isLoopingState = loop;
    if (this.player) {
      this.player.loop = loop;
    }
    this.emitState();
  }

  setAutoAdvance(advance: boolean) {
    this.isAutoAdvanceState = advance;
    this.emitState();
  }

  // Load a single verse audio
  async loadVerse(surah: number, verse: number, reciter?: string) {
    try {
      this.isLoadingState = true;
      this.emitState();

      // Retrieve preferred reciter from preferences store if not supplied
      let activeReciter: string = reciter || '';
      if (!activeReciter) {
        try {
          const { usePreferencesStore } = require('../store/usePreferencesStore');
          activeReciter = usePreferencesStore.getState().selectedReciter || 'ar.alafasy';
        } catch (e) {
          activeReciter = this.currentReciter || 'ar.alafasy';
        }
      }

      // Clean up active player and subscriptions first
      this.clearProgressInterval();
      if (this.statusSubscription) {
        this.statusSubscription.remove();
        this.statusSubscription = null;
      }
      if (this.player) {
        this.player.pause();
        this.player.release();
        this.player = null;
      }

      this.currentSurah = surah;
      this.currentVerse = verse;
      this.currentReciter = activeReciter;

      // Fetch dynamic URL from the backend
      const audioUrl = await getQuranAudioUrl(surah, verse, activeReciter);

      // Create new Expo Audio Player
      const playerInstance = createAudioPlayer(audioUrl);
      playerInstance.loop = this.isLoopingState;

      this.player = playerInstance;

      // Subscribe to playback status updates
      this.statusSubscription = playerInstance.addListener('playbackStatusUpdate', (status: any) => {
        this.positionMillis = (status.currentTime || 0) * 1000;
        this.durationMillis = (status.duration || 0) * 1000;
        this.isPlayingState = status.playing;

        if (status.didJustFinish) {
          this.isPlayingState = false;
          this.clearProgressInterval();

          // Let listeners know it just completed
          this.listeners.forEach((listener) =>
            listener({
              isPlaying: false,
              positionMillis: this.positionMillis,
              durationMillis: this.durationMillis,
              didJustFinish: true,
              currentVerse: this.currentVerse,
              currentSurah: this.currentSurah,
              reciter: this.currentReciter,
              isLooping: this.isLoopingState,
              isAutoAdvance: this.isAutoAdvanceState,
              isLoading: false,
            })
          );

          if (this.isAutoAdvanceState && !this.isLoopingState) {
            this.playNext();
          } else if (this.isLoopingState) {
            this.player?.seekTo(0);
            this.player?.play();
          } else {
            this.emitState();
          }
        } else {
          this.emitState();
        }
      });

      // Start playing
      playerInstance.play();
      this.isPlayingState = true;
      this.isLoadingState = false;
      this.startProgressInterval();
      this.emitState();
    } catch (e) {
      this.isLoadingState = false;
      this.isPlayingState = false;
      console.warn('Failed to load verse audio:', e);
      this.emitState();
    }
  }

  // Play controls
  play() {
    if (this.player) {
      this.player.play();
      this.isPlayingState = true;
      this.startProgressInterval();
      this.emitState();
    } else if (this.currentSurah && this.currentVerse) {
      this.loadVerse(this.currentSurah, this.currentVerse);
    }
  }

  pause() {
    if (this.player) {
      this.player.pause();
      this.isPlayingState = false;
      this.clearProgressInterval();
      this.emitState();
    }
  }

  resume() {
    this.play();
  }

  stop() {
    this.clearProgressInterval();
    if (this.statusSubscription) {
      this.statusSubscription.remove();
      this.statusSubscription = null;
    }
    if (this.player) {
      try {
        this.player.pause();
        this.player.release();
      } catch (err) {
        console.warn('Error releasing player on stop:', err);
      }
      this.player = null;
    }
    this.currentSurah = null;
    this.currentVerse = null;
    this.isPlayingState = false;
    this.positionMillis = 0;
    this.durationMillis = 0;
    this.emitState();
  }

  seek(millis: number) {
    if (this.player) {
      this.player.seekTo(millis / 1000);
      this.positionMillis = millis;
      this.emitState();
    }
  }

  // Queue and play a whole Surah sequentially
  async playFullSurah(surahId: number, totalVerses: number) {
    this.isPlaylistActive = true;
    this.totalVersesInSurah = totalVerses;
    await this.loadVerse(surahId, 1);
  }

  // Skip forwards/backwards
  async playNext() {
    if (!this.currentSurah || !this.currentVerse) return;

    let nextVerse = this.currentVerse + 1;
    if (this.isPlaylistActive && nextVerse > this.totalVersesInSurah) {
      nextVerse = 1;
    }
    await this.loadVerse(this.currentSurah, nextVerse);
  }

  async playPrevious() {
    if (!this.currentSurah || !this.currentVerse) return;

    const prevVerse = Math.max(1, this.currentVerse - 1);
    await this.loadVerse(this.currentSurah, prevVerse);
  }

  // Progress polling updates to keep UI extremely responsive
  private startProgressInterval() {
    this.clearProgressInterval();
    this.progressInterval = setInterval(() => {
      if (this.player) {
        const curTime = this.player.currentTime || 0;
        const dur = this.player.duration || 0;
        this.positionMillis = curTime * 1000;
        this.durationMillis = dur * 1000;
        this.emitState();
      }
    }, 250);
  }

  private clearProgressInterval() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}

export const AudioPlayer = new AudioPlayerService();
