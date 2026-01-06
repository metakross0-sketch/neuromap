const API_BASE = 'https://chronosphere.pythonanywhere.com';

// Координаты городов (справочник)
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Тюмень': { lat: 57.1522, lng: 65.5272 },
  'Москва': { lat: 55.7558, lng: 37.6173 },
  'Санкт-Петербург': { lat: 59.9343, lng: 30.3351 },
  'Новосибирск': { lat: 55.0084, lng: 82.9357 },
  'Екатеринбург': { lat: 56.8389, lng: 60.6057 },
  'Казань': { lat: 55.8304, lng: 49.0661 },
  'Нижний Новгород': { lat: 56.2965, lng: 43.9361 },
  'Челябинск': { lat: 55.1644, lng: 61.4368 },
  'Самара': { lat: 53.1959, lng: 50.1002 },
  'Омск': { lat: 54.9885, lng: 73.3242 }
};

export const api = {
  getCities: async () => {
    const response = await fetch(`${API_BASE}/api/cities`);
    const data = await response.json();
    
    // Преобразуем массив строк в объекты с координатами
    return data.cities.map((cityName: string) => ({
      name: cityName,
      lat: CITY_COORDS[cityName]?.lat || 55.7558,
      lng: CITY_COORDS[cityName]?.lng || 37.6173,
      shops: []
    }));
  },
  
  getShops: async (city: string) => {
    const response = await fetch(`${API_BASE}/api/shops/${city}`);
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
