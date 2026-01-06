import { useEffect, useState, useRef } from 'preact/hooks';
import { MapView } from './components/MapView';
import { SimpleCitySelector } from './components/SimpleCitySelector';
import { CategorySelector } from './components/CategorySelector';
import { ActivationRitual } from './components/ActivationRitual';
import { ShopInfo } from './components/ShopInfo';
import { useMapStore } from './store/mapStore';
import { api } from './api/client';
import type { Shop } from './types';

type AppScreen = 'activation' | 'city-select' | 'category-select' | 'map';

export function App() {
  const { setCities, selectedCity, setShops, selectCity, shops } = useMapStore();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('activation');
  const [categories, setCategories] = useState<string[]>([]);
  const mapResetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Инициализация Telegram Web App
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Кнопка "Назад" в Telegram
      window.Telegram.WebApp.BackButton.onClick(() => {
        if (selectedShop) {
          setSelectedShop(null);
        } else if (currentScreen === 'map') {
          setCurrentScreen('category-select');
        } else if (currentScreen === 'category-select') {
          setCurrentScreen('city-select');
        } else if (currentScreen === 'city-select') {
          setCurrentScreen('activation');
        }
      });
    }

    // Загрузка городов
    api.getCities().then(setCities);
  }, []);

  useEffect(() => {
    // Показать/скрыть кнопку "Назад"
    if (window.Telegram?.WebApp) {
      if (currentScreen !== 'activation' || selectedShop) {
        window.Telegram.WebApp.BackButton.show();
      } else {
        window.Telegram.WebApp.BackButton.hide();
      }
    }
  }, [currentScreen, selectedShop]);

  useEffect(() => {
    // Загрузка магазинов при выборе города
    if (selectedCity) {
      api.getShops(selectedCity.name).then(shops => {
        const shopsWithActivity = shops.map((shop: any) => ({
          ...shop,
          activity: Math.random() * 0.5 + 0.5, // 0.5-1.0
          category: shop.category || 'Без категории' // Устанавливаем категорию по умолчанию
        }));
        setShops(shopsWithActivity);
        
        // Извлекаем уникальные категории
        const uniqueCategories = Array.from(new Set(shopsWithActivity.map((shop: Shop) => shop.category).filter(Boolean)));
        setCategories(uniqueCategories.sort());
      });
    }
  }, [selectedCity]);

  // Сброс карты при закрытии каталога
  useEffect(() => {
    if (!selectedShop && mapResetRef.current && currentScreen === 'map') {
      mapResetRef.current();
    }
  }, [selectedShop, currentScreen]);

  const handleActivation = () => {
    setCurrentScreen('city-select');
  };

  const handleCitySelected = () => {
    setCurrentScreen('category-select');
  };

  const handleCategorySelected = (category: string | null) => {
    setSelectedCategory(category);
  };

  const handleOpenMap = () => {
    setCurrentScreen('map');
  };

  return (
    <div className="app">
      {currentScreen === 'activation' && <ActivationRitual onActivate={handleActivation} />}
      {currentScreen === 'city-select' && <SimpleCitySelector onCitySelected={handleCitySelected} />}
      {currentScreen === 'category-select' && selectedCity && (
        <CategorySelector 
          categories={categories}
          onSelectCategory={handleCategorySelected}
          onOpenMap={handleOpenMap}
        />
      )}
      {currentScreen === 'map' && selectedCity && (
        <MapView 
          onShopClick={setSelectedShop} 
          onResetMap={(fn) => { mapResetRef.current = fn; }}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      )}
      {selectedShop && <ShopInfo shop={selectedShop} onClose={() => setSelectedShop(null)} />}
    </div>
  );
}

declare global {
  interface Window {
    Telegram?: any;
  }
}
