export interface Shop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  activity: number; // 0-1, нейронная активность
  category: string; // Категория магазина из столбца A
  photo_url?: string | null;
  spreadsheet_url?: string;
}

export interface City {
  name: string;
  apiName?: string; // оригинальное название для API запросов (например "Ishim")
  lat: number;
  lng: number;
  shops: Shop[] | number; // Массив магазинов или количество
}

export interface NeuralConnection {
  from: Shop;
  to: Shop;
  strength: number; // 0-1
  pulsePhase: number; // 0-2π для анимации
}
