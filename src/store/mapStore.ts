import { create } from 'zustand';
import { Shop, City } from '../types';

interface MapState {
  cities: City[];
  selectedCity: City | null;
  shops: Shop[];
  pulseOrigin: Shop | null;
  
  setCities: (cities: City[]) => void;
  selectCity: (city: City) => void;
  setShops: (shops: Shop[]) => void;
  triggerPulse: (shop: Shop) => void;
}

export const useMapStore = create<MapState>((set) => ({
  cities: [],
  selectedCity: null,
  shops: [],
  pulseOrigin: null,
  
  setCities: (cities) => set({ cities }),
  selectCity: (city) => set({ selectedCity: city, shops: [] }),
  setShops: (shops) => set({ shops }),
  triggerPulse: (shop) => {
    set({ pulseOrigin: shop });
    setTimeout(() => set({ pulseOrigin: null }), 1000);
  }
}));
