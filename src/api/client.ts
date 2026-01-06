const API_BASE = 'https://chronosphere.pythonanywhere.com';

// Координаты городов (справочник) - все крупные города России 300к+
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Города с магазинами (уже есть)
  'Тюмень': { lat: 57.1522, lng: 65.5272 },
  'Ишим': { lat: 56.1129, lng: 69.4886 },
  'Заводоуковск': { lat: 56.5042, lng: 66.5509 },
  'Североуральск': { lat: 60.1574, lng: 59.9521 },
  'Ивдель': { lat: 60.6931, lng: 60.4284 },
  
  // Миллионники (15)
  'Москва': { lat: 55.7558, lng: 37.6173 },
  'Санкт-Петербург': { lat: 59.9343, lng: 30.3351 },
  'Новосибирск': { lat: 55.0084, lng: 82.9357 },
  'Екатеринбург': { lat: 56.8389, lng: 60.6057 },
  'Казань': { lat: 55.8304, lng: 49.0661 },
  'Нижний Новгород': { lat: 56.2965, lng: 43.9361 },
  'Челябинск': { lat: 55.1644, lng: 61.4368 },
  'Самара': { lat: 53.1959, lng: 50.1002 },
  'Омск': { lat: 54.9885, lng: 73.3242 },
  'Ростов-на-Дону': { lat: 47.2357, lng: 39.7015 },
  'Уфа': { lat: 54.7388, lng: 55.9721 },
  'Красноярск': { lat: 56.0153, lng: 92.8932 },
  'Воронеж': { lat: 51.6605, lng: 39.2006 },
  'Пермь': { lat: 58.0105, lng: 56.2502 },
  'Волгоград': { lat: 48.7080, lng: 44.5133 },
  
  // 500к-1млн (21)
  'Краснодар': { lat: 45.0355, lng: 38.9753 },
  'Саратов': { lat: 51.5924, lng: 46.0348 },
  'Тольятти': { lat: 53.5303, lng: 49.3461 },
  'Ижевск': { lat: 56.8519, lng: 53.2048 },
  'Барнаул': { lat: 53.3547, lng: 83.7697 },
  'Ульяновск': { lat: 54.3142, lng: 48.4031 },
  'Иркутск': { lat: 52.2869, lng: 104.2811 },
  'Хабаровск': { lat: 48.4827, lng: 135.0838 },
  'Ярославль': { lat: 57.6261, lng: 39.8845 },
  'Владивосток': { lat: 43.1155, lng: 131.8855 },
  'Махачкала': { lat: 42.9849, lng: 47.5047 },
  'Томск': { lat: 56.4977, lng: 84.9744 },
  'Оренбург': { lat: 51.7727, lng: 55.0988 },
  'Кемерово': { lat: 55.3547, lng: 86.0861 },
  'Новокузнецк': { lat: 53.7577, lng: 87.1099 },
  'Рязань': { lat: 54.6269, lng: 39.6916 },
  'Астрахань': { lat: 46.3497, lng: 48.0408 },
  'Набережные Челны': { lat: 55.7430, lng: 52.4078 },
  'Пенза': { lat: 53.2001, lng: 45.0047 },
  'Киров': { lat: 58.6035, lng: 49.6680 },
  
  // 300к-500к (24)
  'Липецк': { lat: 52.6108, lng: 39.5928 },
  'Чебоксары': { lat: 56.1439, lng: 47.2489 },
  'Калининград': { lat: 54.7104, lng: 20.4522 },
  'Тула': { lat: 54.1961, lng: 37.6182 },
  'Курск': { lat: 51.7373, lng: 36.1873 },
  'Ставрополь': { lat: 45.0428, lng: 41.9734 },
  'Сочи': { lat: 43.5855, lng: 39.7231 },
  'Улан-Удэ': { lat: 51.8272, lng: 107.6063 },
  'Тверь': { lat: 56.8587, lng: 35.9176 },
  'Магнитогорск': { lat: 53.4181, lng: 58.9797 },
  'Иваново': { lat: 57.0000, lng: 40.9737 },
  'Брянск': { lat: 53.2521, lng: 34.3717 },
  'Белгород': { lat: 50.5997, lng: 36.5988 },
  'Нижний Тагил': { lat: 57.9191, lng: 59.9650 },
  'Архангельск': { lat: 64.5401, lng: 40.5433 },
  'Владимир': { lat: 56.1366, lng: 40.3966 },
  'Калуга': { lat: 54.5293, lng: 36.2754 },
  'Чита': { lat: 52.0339, lng: 113.5004 },
  'Смоленск': { lat: 54.7818, lng: 32.0401 },
  'Волжский': { lat: 48.7854, lng: 44.7788 },
  'Курган': { lat: 55.4500, lng: 65.3333 },
  'Череповец': { lat: 59.1333, lng: 37.9000 },
  'Орёл': { lat: 52.9651, lng: 36.0785 },
  'Вологда': { lat: 59.2239, lng: 39.8843 },
  
  // Север и Северо-Запад (10)
  'Мурманск': { lat: 68.9585, lng: 33.0827 },
  'Петрозаводск': { lat: 61.7849, lng: 34.3469 },
  'Сыктывкар': { lat: 61.6681, lng: 50.8372 },
  'Северодвинск': { lat: 64.5635, lng: 39.8302 },
  'Великий Новгород': { lat: 58.5218, lng: 31.2755 },
  'Псков': { lat: 57.8136, lng: 28.3496 },
  'Петропавловск-Камчатский': { lat: 53.0245, lng: 158.6433 },
  'Норильск': { lat: 69.3558, lng: 88.1893 },
  'Нарьян-Мар': { lat: 67.6380, lng: 53.0069 },
  'Салехард': { lat: 66.5297, lng: 66.6139 },
  
  // Дальний Восток и Сибирь (12)
  'Якутск': { lat: 62.0355, lng: 129.6755 },
  'Благовещенск': { lat: 50.2903, lng: 127.5270 },
  'Южно-Сахалинск': { lat: 46.9590, lng: 142.7386 },
  'Магадан': { lat: 59.5606, lng: 150.8102 },
  'Комсомольск-на-Амуре': { lat: 50.5497, lng: 137.0108 },
  'Находка': { lat: 42.8167, lng: 132.8736 },
  'Абакан': { lat: 53.7215, lng: 91.4425 },
  'Братск': { lat: 56.1515, lng: 101.6340 },
  'Ангарск': { lat: 52.5379, lng: 103.8886 },
  'Усть-Илимск': { lat: 58.0006, lng: 102.6619 },
  'Анадырь': { lat: 64.7340, lng: 177.4970 },
  'Южно-Курильск': { lat: 44.0311, lng: 145.8636 }
};

// Маппинг английских названий на русские (для обратной совместимости с API)
const CITY_NAME_MAP: Record<string, string> = {
  'Ishim': 'Ишим',
  'Zavodoukovsk': 'Заводоуковск',
  'Severouralsk': 'Североуральск',
  'Ivdel': 'Ивдель'
};

// Города БЕЗ магазинов (белые миниатюры) - определяются автоматически
// Город белый если: shops === 0 (нет магазинов в таблице Google) или города нет в API
// Город оранжевый если: shops > 0 (есть магазины с координатами из 2ГИС)
export const CITIES_WITHOUT_SHOPS_VISUAL: string[] = [];

// Функция для обновления списка городов без магазинов (вызывается после загрузки данных из API)
export function updateCitiesWithoutShops(cities: Array<{ name: string; shops: number }>) {
  CITIES_WITHOUT_SHOPS_VISUAL.length = 0;
  
  // Добавляем все города из CITY_COORDS, которых нет в API или у которых shops === 0
  Object.keys(CITY_COORDS).forEach(cityName => {
    const cityInApi = cities.find(c => c.name === cityName);
    if (!cityInApi || cityInApi.shops === 0) {
      CITIES_WITHOUT_SHOPS_VISUAL.push(cityName);
    }
  });
  
  console.log('🔍 Города БЕЗ магазинов (белые):', CITIES_WITHOUT_SHOPS_VISUAL);
  console.log('🟠 Города С магазинами (оранжевые):', cities.filter(c => c.shops > 0).map(c => `${c.name} (${c.shops})`));
}

export const api = {
  getCities: async () => {
    try {
      const response = await fetch(`${API_BASE}/api/cities`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      
      // Загружаем количество магазинов для каждого города
      const citiesWithCounts = await Promise.all(
        data.cities.map(async (cityName: string) => {
          try {
            const shopsResponse = await fetch(`${API_BASE}/api/shops/${cityName}`);
            const shopsData = await shopsResponse.json();
            
            // Преобразуем английское название в русское
            const displayName = CITY_NAME_MAP[cityName] || cityName;
            
            return {
              name: displayName,
              apiName: cityName, // сохраняем оригинальное название для API запросов
              lat: CITY_COORDS[displayName]?.lat || 55.7558,
              lng: CITY_COORDS[displayName]?.lng || 37.6173,
              shops: shopsData.shops ? shopsData.shops.length : 0
            };
          } catch (error) {
            const displayName = CITY_NAME_MAP[cityName] || cityName;
            return {
              name: displayName,
              apiName: cityName,
              lat: CITY_COORDS[displayName]?.lat || 55.7558,
              lng: CITY_COORDS[displayName]?.lng || 37.6173,
              shops: 0
            };
          }
        })
      );
      
      // Обновляем список городов без магазинов на основе данных из API
      updateCitiesWithoutShops(citiesWithCounts);
      
      return citiesWithCounts;
    } catch (error) {
      console.error('❌ API недоступен, используем статические города:', error);
      // Fallback: возвращаем список городов из CITY_COORDS
      const fallbackCities = Object.keys(CITY_COORDS).map(cityName => ({
        name: cityName,
        lat: CITY_COORDS[cityName].lat,
        lng: CITY_COORDS[cityName].lng,
        shops: 0
      }));
      
      // Обновляем список городов без магазинов
      updateCitiesWithoutShops(fallbackCities);
      
      return fallbackCities;
    }
  },
  
  getShops: async (city: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/shops/${city}`);
      if (!response.ok) throw new Error('API unavailable');
      const data = await response.json();
      
      // Преобразуем latitude/longitude в lat/lng
      return data.shops.map((shop: any) => ({
        id: shop.shop_id,
        name: shop.name,
        lat: shop.latitude,
        lng: shop.longitude,
        city: city,
        category: shop.category,
        photo_url: shop.photo_url,
        spreadsheet_url: shop.spreadsheet_url
      }));
    } catch (error) {
      console.error(`❌ Не удалось загрузить магазины для ${city}:`, error);
      return [];
    }
  },
  
  getShopCatalog: async (shopId: string) => {
    const response = await fetch(`${API_BASE}/api/shop/${shopId}/catalog`);
    return response.json();
  },
  
  getCategories: async (city: string) => {
    const response = await fetch(`${API_BASE}/api/categories/${city}`);
    return response.json();
  }
};
