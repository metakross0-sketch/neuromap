import { useEffect, useState, useRef, lazy, Suspense } from 'preact/compat';
import { SimpleCitySelector } from './components/SimpleCitySelector';
import { ActivationRitual } from './components/ActivationRitual';
import { useMapStore } from './store/mapStore';
import { api, updateCitiesWithoutShops } from './api/client';
import type { Shop, City } from './types';
import { showBackButton, hideBackButton, hapticFeedback } from './utils/telegram';

// Lazy load тяжёлых компонентов для быстрого первого рендера
const MapView = lazy(() => import('./components/MapView').then(m => ({ default: m.MapView })));
const ShopInfo = lazy(() => import('./components/ShopInfo').then(m => ({ default: m.ShopInfo })));

type AppScreen = 'activation' | 'city-select' | 'map';

export function App() {
  const { setCities, selectedCity, setShops } = useMapStore();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('activation');
  const mapResetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Загрузка городов И всех магазинов сразу
    Promise.all([
      api.getCities(),
      api.getAllShops()
    ]).then(([citiesData, allShops]) => {
      // Добавляем активность к магазинам
      const shopsWithActivity = allShops.map((shop: any) => ({
        ...shop,
        activity: Math.random() * 0.5 + 0.5, // 0.5-1.0
      }));
      setShops(shopsWithActivity);
      console.log(`📦 Загружено магазинов из единой таблицы: ${shopsWithActivity.length}`);
      
      // Подсчитываем количество магазинов для каждого города
      const shopsByCity = shopsWithActivity.reduce((acc: Record<string, number>, shop: Shop) => {
        const cityName = shop.city || '';
        acc[cityName] = (acc[cityName] || 0) + 1;
        return acc;
      }, {});
      
      // Обновляем города с количеством магазинов
      const citiesWithShopCounts = citiesData.map((city: City) => ({
        ...city,
        shops: shopsByCity[city.name] || 0
      }));
      
      const citiesWithShops = citiesWithShopCounts.filter((c: City) => typeof c.shops === 'number' && c.shops > 0);
      const citiesWithoutShops = citiesWithShopCounts.filter((c: City) => typeof c.shops === 'number' && c.shops === 0);
      
      // ВАЖНО: Обновляем глобальный массив CITIES_WITHOUT_SHOPS_VISUAL
      updateCitiesWithoutShops(citiesWithShopCounts);
      
      console.log(`🔍 Города БЕЗ магазинов (белые):`, citiesWithoutShops.map((c: City) => c.name));
      console.log(`🟠 Города С магазинами (оранжевые):`, citiesWithShops.map((c: City) => c.name));
      
      setCities(citiesWithShopCounts);
      console.log(`📦 App.tsx: Загружено всего магазинов: ${shopsWithActivity.length}`);
    });
    
    // Настройка кнопки "Назад" в Telegram
    const handleBack = () => {
      hapticFeedback('light');
      if (selectedShop) {
        setSelectedShop(null);
      } else if (currentScreen === 'map') {
        setCurrentScreen('city-select');
      } else if (currentScreen === 'city-select') {
        setCurrentScreen('activation');
      }
    };
    
    showBackButton(handleBack);
    
    return () => {
      hideBackButton(handleBack);
    };
  }, [currentScreen, selectedShop, selectedCity]);



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
    setCurrentScreen('map');
  };

  return (
    <div className="app">
      {currentScreen === 'activation' && <ActivationRitual onActivate={handleActivation} />}
      {currentScreen === 'city-select' && <SimpleCitySelector onCitySelected={handleCitySelected} />}
      {currentScreen === 'map' && selectedCity && (
        <Suspense fallback={<div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          background: '#000', 
          color: '#f0f8ff' 
        }}>Загрузка карты...</div>}>
          <MapView 
            onShopClick={setSelectedShop} 
            onResetMap={(fn) => { mapResetRef.current = fn; }}
          />
        </Suspense>
      )}
      {selectedShop && (
        <Suspense fallback={null}>
          <ShopInfo shop={selectedShop} onClose={() => setSelectedShop(null)} />
        </Suspense>
      )}
    </div>
  );
}
