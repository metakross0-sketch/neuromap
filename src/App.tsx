import { useEffect, useState, useRef } from 'preact/hooks';
import { MapView } from './components/MapView';
import { SimpleCitySelector } from './components/SimpleCitySelector';
import { CategorySelector } from './components/CategorySelector';
import { ActivationRitual } from './components/ActivationRitual';
import { ShopInfo } from './components/ShopInfo';
import { useMapStore } from './store/mapStore';
import { api } from './api/client';
import type { Shop } from './types';
import { showBackButton, hideBackButton, hapticFeedback } from './utils/telegram';

type AppScreen = 'activation' | 'city-select' | 'category-select' | 'map';

export function App() {
  const { setCities, selectedCity, setShops, shops } = useMapStore();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('activation');
  const [categories, setCategories] = useState<string[]>([]);
  const mapResetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Загрузка городов
    api.getCities().then(setCities);
    
    // Настройка кнопки "Назад" в Telegram
    const handleBack = () => {
      hapticFeedback('light');
      if (selectedShop) {
        setSelectedShop(null);
      } else if (currentScreen === 'map') {
        setCurrentScreen('category-select');
      } else if (currentScreen === 'category-select') {
        setCurrentScreen('city-select');
      } else if (currentScreen === 'city-select') {
        setCurrentScreen('activation');
      }
    };
    
    showBackButton(handleBack);
    
    return () => {
      hideBackButton(handleBack);
    };
  }, [currentScreen, selectedShop]);

  useEffect(() => {
    // Загрузка магазинов при выборе города (только если их ещё нет в store)
    if (selectedCity) {
      const cityShops = shops.filter(s => s.city === selectedCity.name);
      
      // Загружаем только если магазинов этого города ещё нет
      if (cityShops.length === 0) {
        console.log(`📦 App.tsx: Загружаем магазины для ${selectedCity.name}`);
        // Используем apiName если есть, иначе name
        const cityNameForApi = selectedCity.apiName || selectedCity.name;
        api.getShops(cityNameForApi).then(loadedShops => {
          const shopsWithActivity = loadedShops.map((shop: any) => ({
            ...shop,
            city: selectedCity.name, // используем отображаемое русское название
            activity: Math.random() * 0.5 + 0.5, // 0.5-1.0
            category: shop.category || 'Без категории' // Устанавливаем категорию по умолчанию
          }));
          
          // Добавляем к существующим магазинам вместо замены
          setShops([...shops, ...shopsWithActivity]);
          
          // Извлекаем уникальные категории из новых магазинов
          const uniqueCategories = Array.from(new Set(shopsWithActivity.map((shop: Shop) => shop.category).filter(Boolean))) as string[];
          setCategories(uniqueCategories.sort());
        });
      } else {
        console.log(`✅ App.tsx: Магазины ${selectedCity.name} уже загружены: ${cityShops.length} шт.`);
        
        // Обновляем категории из уже загруженных магазинов
        const uniqueCategories = Array.from(new Set(cityShops.map((shop: Shop) => shop.category).filter(Boolean))) as string[];
        setCategories(uniqueCategories.sort());
      }
    }
  }, [selectedCity, shops, setShops]);

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
