import { useEffect } from 'react';
import { usePrayerStore } from '../store/prayerStore';

export const usePrayer = () => {
  const store = usePrayerStore();

  useEffect(() => {
    if (!store.prayerTimes) {
      store.loadSavedLocation().then(() => {
        const loc = usePrayerStore.getState().location;
        store.fetchPrayerTimes(loc.lat, loc.lon);
      });
    }
  }, []);

  return store;
};

export default usePrayer;
