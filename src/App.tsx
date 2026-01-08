import { useEffect, useState, useRef } from 'preact/hooks';
import { MapView } from './components/MapView';
import { LoadingScreen } from './components/LoadingScreen';
import { ShopInfo } from './components/ShopInfo';
import { useMapStore } from './store/mapStore';
import { api, updateCitiesWithoutShops } from './api/client';
import type { Shop, City } from './types';
import { showBackButton, hideBackButton, hapticFeedback } from './utils/telegram';

export function App() {
  const { setCities, setShops } = useMapStore();
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mapResetRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log('🔵 App: Начало загрузки данных');
    // Загрузка данных параллельно с показом экрана загрузки (3 сек)
    Promise.all([
      api.getCities(),
      api.getAllShops(),
      new Promise(resolve => setTimeout(resolve, 3000)) // Минимум 3 секунды загрузки
    ]).then(([citiesData, allShops]) => {
      console.log('🟢 App: Данные загружены', { cities: citiesData.length, shops: allShops.length });
      // Добавляем активность к магазинам
      const shopsWithActivity = allShops.map((shop: any) => ({
        ...shop,
        activity: Math.random() * 0.5 + 0.5,
      }));
      setShops(shopsWithActivity);
      
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
      
      updateCitiesWithoutShops(citiesWithShopCounts);
      setCities(citiesWithShopCounts);
      
      // Скрываем загрузку
      console.log('✅ App: Скрываем загрузку, показываем MapView');
      setIsLoading(false);
      console.log(`📦 Загружено: ${shopsWithActivity.length} магазинов`);
    }).catch(error => {
      console.error('❌ App: Ошибка загрузки данных:', error);
      setIsLoading(false);
    });
    
    // Настройка кнопки "Назад" в Telegram
    const handleBack = () => {
      hapticFeedback('light');
      if (selectedShop) {
        setSelectedShop(null);
      }
    };
    
    showBackButton(handleBack);
    
    return () => {
      hideBackButton(handleBack);
    };
  }, [selectedShop]);



  // Сброс карты при закрытии каталога
  useEffect(() => {
    if (!selectedShop && mapResetRef.current && !isLoading) {
      mapResetRef.current();
    }
  }, [selectedShop, isLoading]);

  return (
    <div className="app">
      {isLoading ? (
        <LoadingScreen />
      ) : (
        <>
          <MapView 
            onShopClick={setSelectedShop} 
            onResetMap={(fn) => { mapResetRef.current = fn; }}
          />
          {selectedShop && <ShopInfo shop={selectedShop} onClose={() => setSelectedShop(null)} />}
        </>
      )}
    </div>
  );
}
