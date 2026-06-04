import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

class AdhanPlayerService {
  private activePlayer: any = null;

  async playAdhan(soundType: string) {
    this.stopAdhan();

    let soundUrl = '';
    if (soundType === 'Makkah' || soundType === 'Complete_Makkah') {
      soundUrl = 'https://github.com/AalianKhan/adhans/blob/master/adhan.mp3?raw=true';
    } else if (soundType === 'Madinah' || soundType === 'Complete_Madinah') {
      soundUrl = 'https://github.com/AalianKhan/adhans/blob/master/adhan_fajr.mp3?raw=true';
    } else if (soundType === 'Simple') {
      soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav';
    }

    if (!soundUrl) return;

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      this.activePlayer = createAudioPlayer(soundUrl);
      this.activePlayer.play();
    } catch (err) {
      console.warn('Adhan playback failed:', err);
    }
  }

  stopAdhan() {
    if (this.activePlayer) {
      try {
        this.activePlayer.pause();
        this.activePlayer.release();
      } catch (e) {
        console.warn('Failed to release adhan player:', e);
      }
      this.activePlayer = null;
    }
  }

  isPlaying() {
    return this.activePlayer !== null;
  }
}

export const AdhanPlayer = new AdhanPlayerService();
