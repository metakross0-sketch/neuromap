import { useRef, useEffect, useState } from 'preact/hooks';
import { useMapStore } from '../store/mapStore';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Shop } from '../types';
import { neonRoadsStyle } from '../styles/neon-roads-style';
import { requestLocation, hapticFeedback } from '../utils/telegram';
import { CITIES_WITHOUT_SHOPS_VISUAL, CITY_COORDS } from '../api/client';

interface MapViewProps {
  onShopClick?: (shop: Shop) => void;
  onResetMap?: (resetFn: () => void) => void;
  selectedCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
}

export function MapView({ onShopClick, onResetMap, selectedCategory, onCategoryChange }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const pixelOverlayRef = useRef<HTMLCanvasElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);
  const shopPulseAnimationId = useRef<number | null>(null);
  const { shops, selectedCity, cities } = useMapStore();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [clusterShops, setClusterShops] = useState<Shop[] | null>(null);
  const [showCityLabels, setShowCityLabels] = useState<boolean>(false);
  const [showCitySelector, setShowCitySelector] = useState<boolean>(false);
  const cityLabelsRef = useRef<maplibregl.Marker[]>([]);
  const whiteCityLabelsRef = useRef<maplibregl.Marker[]>([]); // Для белых городов
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [popupShop, setPopupShop] = useState<Shop | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [echoWave, setEchoWave] = useState<{ x: number; y: number; radius: number; angle: number; opacity?: number } | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(5);

  // Синхронизируем ref с state
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Передаем функцию resetRoute родительскому компоненту
  useEffect(() => {
    if (onResetMap) {
      onResetMap(resetRoute);
    }
  }, [onResetMap]);


  // Обновляем позицию popup при движении/масштабировании карты
  useEffect(() => {
    if (!map.current || !popupShop) return;

    const updatePopupPosition = () => {
      if (map.current && popupShop) {
        const point = map.current.project([popupShop.lng, popupShop.lat]);
        setPopupPosition({ x: point.x, y: point.y });
      }
    };

    map.current.on('move', updatePopupPosition);
    map.current.on('zoom', updatePopupPosition);

    return () => {
      if (map.current) {
        map.current.off('move', updatePopupPosition);
        map.current.off('zoom', updatePopupPosition);
      }
    };
  }, [popupShop]);

  // Функция построения маршрута через OSRM API
  const buildRoute = async (from: [number, number], to: [number, number]) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.routes.length > 0) {
        return data.routes[0].geometry;
      }
    } catch (error) {
      console.error('Ошибка построения маршрута:', error);
    }
    return null;
  };

  // Debounce таймер больше не нужен - дороги загружаются один раз
  const cityRoadsLoaded = useRef<{[key: string]: boolean}>({}); // Флаги для каждого города (полные дороги)
  const cityMiniaturesLoaded = useRef<{[key: string]: boolean}>({}); // Флаги для миниатюр
  const cityRoadsData = useRef<{[key: string]: any}>({}); // Данные дорог для каждого города
  const pulseIntervals = useRef<number[]>([]); // Храним ID интервалов пульсации
  const loadedCityName = useRef<string | null>(null); // Текущий загруженный город
  const skipAutoLoadRef = useRef<boolean>(false); // Флаг для пропуска автозагрузки при программном переходе
  const pendingCityLoadRef = useRef<typeof cities[0] | null>(null); // Город ожидающий загрузки после moveend
  const allCitiesMiniaturesLoaded = useRef<boolean>(false); // Флаг загрузки миниатюр всех городов
  const allMiniaturesRendered = useRef<boolean>(false); // Флаг отрисовки миниатюр
  const zoomDebounceTimer = useRef<any>(null); // Таймер debounce для zoom события
  const isLoadingMiniatures = useRef<boolean>(false); // Флаг процесса загрузки миниатюр
  const russiaCitiesLoaded = useRef<boolean>(false); // Флаг загрузки крупных городов России
  const russiaCitiesData = useRef<any[]>([]); // Данные дорог крупных городов России

  // Загрузка дорог всех крупных городов России (300к+ населения)
  const loadRussiaMajorCities = async () => {
    if (!map.current || russiaCitiesLoaded.current) {
      return;
    }
    
    console.log('🗺️ Загружаем крупные города России...');
    russiaCitiesLoaded.current = true;
    
    try {
      // Загружаем все части параллельно
      const partPromises = [1, 2, 3].map(async (partNum) => {
        try {
          const response = await fetch(`/neuromap/roads/russia-cities/part-${partNum}.geojson`);
          if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ part-${partNum}: ${data.features.length} дорог`);
            return data.features;
          } else {
            console.log(`   ⏭️ part-${partNum}: файл не найден (это норма если файлов меньше)`);
            return [];
          }
        } catch (e) {
          console.log(`   ⏭️ part-${partNum}: ошибка загрузки`);
          return [];
        }
      });
      
      const results = await Promise.all(partPromises);
      const allFeatures = results.flat();
      
      if (allFeatures.length === 0) {
        console.log('⚠️ Нет данных крупных городов России');
        return;
      }
      
      russiaCitiesData.current = allFeatures;
      console.log(`✅ Загружено дорог крупных городов России: ${allFeatures.length}`);
      
      // Отрисовываем на отдалённом зуме
      renderRussiaCities();
      
    } catch (error) {
      console.error('❌ Ошибка загрузки городов России:', error);
      russiaCitiesLoaded.current = false;
    }
  };

  // Отрисовка дорог крупных городов России (белые - без магазинов, оранжевые - с магазинами)
  const renderRussiaCities = () => {
    if (!map.current || russiaCitiesData.current.length === 0) return;
    
    const currentZoom = map.current.getZoom();
    
    // Показываем крупные города на zoom 4-11.5
    if (currentZoom >= 11.5) {
      // Скрываем все слои
      ['russia-cities-white-trunk', 'russia-cities-white-primary', 'russia-cities-white-secondary'].forEach(layerId => {
        if (map.current!.getLayer(layerId)) {
          map.current!.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });
      return;
    }
    
    // Показываем слои
    ['russia-cities-white-trunk', 'russia-cities-white-primary', 'russia-cities-white-secondary'].forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.setLayoutProperty(layerId, 'visibility', 'visible');
      }
    });
    
    // ВСЕ крупные города России отображаются БЕЛЫМ на отдалённом зуме
    // Разделение на оранжевый/белый происходит только при приближении (zoom >= 11.5)
    const allTrunk = russiaCitiesData.current.filter(f => 
      f.properties.highway === 'trunk' || f.properties.highway === 'motorway'
    );
    const allPrimary = russiaCitiesData.current.filter(f => 
      f.properties.highway === 'primary'
    );
    const allSecondary = russiaCitiesData.current.filter(f => 
      f.properties.highway === 'secondary' || f.properties.highway === 'tertiary'
    );
    
    // Обновляем source для белых trunk дорог
    const whiteTrunkSource = map.current.getSource('russia-cities-white-trunk-source');
    if (whiteTrunkSource && 'setData' in whiteTrunkSource) {
      (whiteTrunkSource as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: allTrunk
      });
    }
    
    // Обновляем source для белых primary дорог
    const whitePrimarySource = map.current.getSource('russia-cities-white-primary-source');
    if (whitePrimarySource && 'setData' in whitePrimarySource) {
      (whitePrimarySource as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: allPrimary
      });
    }
    
    // Обновляем source для белых secondary/tertiary дорог
    const whiteSecondarySource = map.current.getSource('russia-cities-white-secondary-source');
    if (whiteSecondarySource && 'setData' in whiteSecondarySource) {
      (whiteSecondarySource as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: allSecondary
      });
    }
    
    console.log(`🎨 Отрисованы города России (БЕЛЫЕ миниатюры): ${allTrunk.length} trunk, ${allPrimary.length} primary, ${allSecondary.length} secondary`);
  };

  // Загрузка миниатюр (только главные дороги) для всех городов
  const loadAllCitiesMiniatures = async () => {
    if (!map.current || allCitiesMiniaturesLoaded.current || cities.length === 0 || isLoadingMiniatures.current) {
      if (isLoadingMiniatures.current) {
        console.log('⏳ Миниатюры уже загружаются, пропускаем...');
      }
      return;
    }
    
    isLoadingMiniatures.current = true;
    console.log('🌍 Загружаем миниатюры всех городов...');
    
    const citiesWithShops = cities.filter(city => 
      typeof city.shops === 'number' && city.shops > 0
    );
    
    for (const city of citiesWithShops) {
      // Пропускаем города у которых уже загружены миниатюры
      if (cityMiniaturesLoaded.current[city.name]) {
        console.log(`⏭️ Миниатюра ${city.name} уже загружена, пропускаем`);
        continue;
      }
      
      try {
        const citySlug = cityToSlug(city.name);
        const staticUrl = `/neuromap/roads/${citySlug}.geojson`;
        
        console.log(`📁 Загружаем миниатюру: ${city.name}`);
        const response = await fetch(staticUrl);
        
        if (!response.ok) {
          console.log(`⚠️ Статический файл для ${city.name} не найден, пропускаем`);
          continue;
        }
        
        const data = await response.json();
        
        if (!data.elements || data.elements.length === 0) {
          console.warn(`⚠️ Нет данных о дорогах для ${city.name}`);
          continue;
        }
        
        // Группируем дороги - берем только главные типы для миниатюры
        const roadsByType: Record<string, any[]> = {
          motorway: [],
          trunk: [],
          primary: []
        };
        
        data.elements.forEach((element: any) => {
          if (element.type === 'way' && element.geometry) {
            const coords = element.geometry.map((node: any) => [node.lon, node.lat]);
            const highway = element.tags.highway;
            
            if (roadsByType[highway]) {
              roadsByType[highway].push({
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: coords
                },
                properties: { highway }
              });
            }
          }
        });
        
        // Сохраняем данные дорог этого города (только миниатюра!)
        if (!cityRoadsData.current[city.name]) {
          cityRoadsData.current[city.name] = {};
        }
        Object.assign(cityRoadsData.current[city.name], roadsByType);
        cityMiniaturesLoaded.current[city.name] = true;
        console.log(`✅ Миниатюра ${city.name} загружена: ${Object.values(roadsByType).flat().length} дорог`);
        
      } catch (error) {
        console.error(`❌ Ошибка загрузки миниатюры ${city.name}:`, error);
      }
    }
    
    allCitiesMiniaturesLoaded.current = true;
    isLoadingMiniatures.current = false;
    console.log('✅ Все миниатюры городов загружены');
    
    // После загрузки всех миниатюр отрисовываем их на карте
    renderAllMiniatures();
  };

  // Отрисовка всех миниатюр на карте (объединяет дороги всех городов)
  const renderAllMiniatures = () => {
    if (!map.current || allMiniaturesRendered.current) {
      if (allMiniaturesRendered.current) {
        console.log('⏭️ Миниатюры уже отрисованы, пропускаем');
      }
      return;
    }
    
    console.log('🎨 Отрисовываем миниатюры всех городов...');
    
    // Объединяем дороги всех городов по типам
    const allRoadsByType: Record<string, any[]> = {
      motorway: [],
      trunk: [],
      primary: []
    };
    
    Object.entries(cityRoadsData.current).forEach(([_, roadsByType]) => {
      Object.entries(roadsByType).forEach(([type, features]) => {
        if (allRoadsByType[type]) {
          allRoadsByType[type].push(...(features as any[]));
        }
      });
    });
    
    // Обновляем sources с объединёнными данными
    Object.entries(allRoadsByType).forEach(([type, features]) => {
      if (features.length === 0) return;
      
      const sourceId = `roads-${type}`;
      const source = map.current?.getSource(sourceId);
      
      if (source && 'setData' in source) {
        (source as any).setData({
          type: 'FeatureCollection',
          features
        });
        console.log(`✏️ Отрисовано ${features.length} дорог типа ${type}`);
      }
    });
    
    allMiniaturesRendered.current = true;
    console.log('✅ Все миниатюры отрисованы');
  };

  // Инициализация пустых sources и layers для всех типов дорог
  const initAllRoadLayers = () => {
    if (!map.current) return;
    
    const roadTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 
                       'residential', 'unclassified', 'road', 'service', 'living_street',
                       'footway', 'path', 'track', 'cycleway', 'pedestrian'];
    
    roadTypes.forEach(type => {
      const sourceId = `roads-${type}`;
      
      // Создаём пустой source
      map.current!.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      // Создаём слои в зависимости от типа дороги
      if (type === 'motorway') {
        // 4-слойная структура для главных дорог
        map.current!.addLayer({
          id: `${sourceId}-glow-outer`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#cc5500',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 3, 2, 5, 6, 10, 14, 16, 28],
            'line-blur': 15,
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 9, 0.4]
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-base`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#cc6600',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 3, 1, 5, 3, 10, 7, 16, 14],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 9, 0.6]
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-inner`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#1a1a1a',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 3, 0.8, 5, 2.5, 10, 6, 16, 12],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 9, 0.6]
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-vein`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#f0f8ff',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 3, 0.5, 5, 1, 10, 2.5, 16, 5],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 9, 0.6]
          }
        });
      } else if (type === 'trunk' || type === 'primary') {
        map.current!.addLayer({
          id: `${sourceId}-glow-outer`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#dd7722',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 2, 8, 4, 12, 11, 16, 21],
            'line-blur': 10,
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 9, 0.4]
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-base`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#dd8822',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 1, 8, 2, 12, 6, 16, 11],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 0.6]
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-inner`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#1a1a1a',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 0.8, 8, 2, 12, 5, 16, 10],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 9, 0.6]
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-vein`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#f0f8ff',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 0.4, 8, 0.8, 12, 2, 16, 4],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 0.6]
          }
        });
      } else if (type === 'secondary' || type === 'tertiary' || type === 'residential' || 
                 type === 'unclassified' || type === 'road') {
        map.current!.addLayer({
          id: `${sourceId}-glow-outer`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#aa6611',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 3, 16, 11],
            'line-blur': 5,
            'line-opacity': 0.3
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-base`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#cc7722',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 1.5, 16, 6],
            'line-opacity': 0.6
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-inner`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#1a1a1a',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 1, 16, 4],
            'line-opacity': 0.6
          }
        });
        map.current!.addLayer({
          id: `${sourceId}-vein`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#f0f8ff',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.5, 16, 2],
            'line-opacity': 0.6
          }
        });
      } else {
        // Для остальных типов (service, living_street, footway и т.д.) - простой слой
        map.current!.addLayer({
          id: `${sourceId}-base`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#aa6611',
            'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 1, 18, 3],
            'line-opacity': 0.4
          }
        });
      }
    });
    
    // Инициализация слоёв для крупных городов России (отображаются на zoom < 8)
    // БЕЛЫЕ дороги - города БЕЗ магазинов
    // Trunk/motorway (белые)
    map.current!.addSource('russia-cities-white-trunk-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    
    map.current!.addLayer({
      id: 'russia-cities-white-trunk-glow',
      type: 'line',
      source: 'russia-cities-white-trunk-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 2, 7, 4],
        'line-blur': 6,
        'line-opacity': 0.5
      },
      layout: { 'visibility': 'none' }
    });
    
    map.current!.addLayer({
      id: 'russia-cities-white-trunk',
      type: 'line',
      source: 'russia-cities-white-trunk-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 7, 2],
        'line-opacity': 0.7
      },
      layout: { 'visibility': 'none' }
    });
    
    // Primary (белые)
    map.current!.addSource('russia-cities-white-primary-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    
    map.current!.addLayer({
      id: 'russia-cities-white-primary-glow',
      type: 'line',
      source: 'russia-cities-white-primary-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 7, 3],
        'line-blur': 4,
        'line-opacity': 0.4
      },
      layout: { 'visibility': 'none' }
    });
    
    map.current!.addLayer({
      id: 'russia-cities-white-primary',
      type: 'line',
      source: 'russia-cities-white-primary-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 7, 1.5],
        'line-opacity': 0.6
      },
      layout: { 'visibility': 'none' }
    });

    // Secondary + Tertiary (белые - чуть тоньше)
    map.current!.addSource('russia-cities-white-secondary-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    
    map.current!.addLayer({
      id: 'russia-cities-white-secondary-glow',
      type: 'line',
      source: 'russia-cities-white-secondary-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 7, 2],
        'line-blur': 3,
        'line-opacity': 0.3
      },
      layout: { 'visibility': 'none' }
    });
    
    map.current!.addLayer({
      id: 'russia-cities-white-secondary',
      type: 'line',
      source: 'russia-cities-white-secondary-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 7, 1],
        'line-opacity': 0.5
      },
      layout: { 'visibility': 'none' }
    });

    // Белые неоновые дороги между городами БЕЗ магазинов (zoom 4-11.5)
    map.current!.addSource('no-shops-inter-city-roads', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    
    map.current!.addLayer({
      id: 'no-shops-inter-city-roads-glow',
      type: 'line',
      source: 'no-shops-inter-city-roads',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 10, 8, 11.5, 10],
        'line-blur': 12,
        'line-opacity': 0.4
      },
      layout: { 'visibility': 'none' }
    });
    
    map.current!.addLayer({
      id: 'no-shops-inter-city-roads',
      type: 'line',
      source: 'no-shops-inter-city-roads',
      paint: {
        'line-color': '#ffffff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 10, 4, 11.5, 5],
        'line-opacity': 0.6
      },
      layout: { 'visibility': 'none' }
    });
    
    console.log('✅ Инициализированы пустые sources и layers для всех типов дорог + крупные города России + города без магазинов');
  };

  // Создаём пульсирующие дороги между всеми городами с магазинами (по реальным дорогам через OSRM)
  const createInterCityRoads = async () => {
    if (!map.current || cities.length < 2) return;

    // Фильтруем города с магазинами
    const citiesWithShops = cities.filter(city => 
      typeof city.shops === 'number' && city.shops > 0
    );
    
    if (citiesWithShops.length < 2) return;

    // Загружаем маршруты через OSRM для всех пар городов
    const routePromises: Promise<any>[] = [];
    for (let i = 0; i < citiesWithShops.length; i++) {
      for (let j = i + 1; j < citiesWithShops.length; j++) {
        const from = [citiesWithShops[i].lng, citiesWithShops[i].lat];
        const to = [citiesWithShops[j].lng, citiesWithShops[j].lat];
        
        routePromises.push(
          fetch(`https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`)
            .then(res => res.json())
            .then(data => {
              if (data.code === 'Ok' && data.routes.length > 0) {
                return {
                  type: 'Feature',
                  geometry: data.routes[0].geometry,
                  properties: {}
                };
              }
              return null;
            })
            .catch(() => null)
        );
      }
    }
    
    const routes = (await Promise.all(routePromises)).filter(r => r !== null);
    if (routes.length === 0) return;

    // Добавляем source для межгородских дорог
    if (!map.current.getSource('inter-city-roads')) {
      map.current.addSource('inter-city-roads', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routes
        }
      });

      // Слой 1: Внешнее свечение
      map.current.addLayer({
        id: 'inter-city-roads-glow',
        type: 'line',
        source: 'inter-city-roads',
        paint: {
          'line-color': '#cc5500',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 6, 6, 12],
          'line-blur': 15,
          'line-opacity': 0.4
        },
        minzoom: 3,
        maxzoom: 8
      });

      // Слой 2: Основная пульсирующая линия
      map.current.addLayer({
        id: 'inter-city-roads-main',
        type: 'line',
        source: 'inter-city-roads',
        paint: {
          'line-color': '#cc6600',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 3, 6, 6],
          'line-opacity': 0.9
        },
        minzoom: 3,
        maxzoom: 8
      });

      // Запускаем пульсацию
      let opacity = 0.5;
      let increasing = true;
      const intervalId = window.setInterval(() => {
        if (!map.current?.getLayer('inter-city-roads-main')) {
          clearInterval(intervalId);
          return;
        }

        if (increasing) {
          opacity += 0.05;
          if (opacity >= 1) {
            opacity = 1;
            increasing = false;
          }
        } else {
          opacity -= 0.05;
          if (opacity <= 0.5) {
            opacity = 0.5;
            increasing = true;
          }
        }

        try {
          map.current?.setPaintProperty('inter-city-roads-main', 'line-opacity', opacity);
        } catch (e) {
          clearInterval(intervalId);
        }
      }, 150);

      pulseIntervals.current.push(intervalId);
    }
  };

  // Определяем ближайший город по центру карты
  const findNearestCity = (center: [number, number]) => {
    if (cities.length === 0) return null;
    
    let nearestCity = cities[0];
    let minDistance = Math.hypot(
      center[0] - nearestCity.lng,
      center[1] - nearestCity.lat
    );
    
    cities.forEach(city => {
      const distance = Math.hypot(
        center[0] - city.lng,
        center[1] - city.lat
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestCity = city;
      }
    });
    
    // Возвращаем только если расстояние < 0.5 градусов (~50км)
    return minDistance < 0.5 ? nearestCity : null;
  };

  // Загружаем дороги для всех городов БЕЗ магазинов (для миниатюр)
  const loadCitiesWithoutShopsRoads = async () => {
    if (!map.current || cities.length === 0) return;

    // Фильтруем города БЕЗ магазинов (из константы)
    const citiesWithoutShops = cities.filter(city => CITIES_WITHOUT_SHOPS_VISUAL.includes(city.name));
    
    console.log('🏙️ Загружаем дороги для городов без магазинов:', citiesWithoutShops.map(c => c.name));
    
    if (citiesWithoutShops.length === 0) return;

    // Загружаем дороги каждого города через локальные файлы
    const loadPromises = citiesWithoutShops.map(async (city) => {
      // Пропускаем если уже загружен
      if (cityRoadsData.current[city.name]) {
        console.log(`✅ ${city.name} уже загружен`);
        return;
      }

      try {
        const slug = cityToSlug(city.name);
        const response = await fetch(`/neuromap/roads/${slug}.geojson`);
        
        if (!response.ok) {
          console.log(`⚠️ Файл ${slug}.geojson не найден`);
          return;
        }
        
        const data = await response.json();
        
        // Группируем дороги по типам (только trunk и primary для миниатюр)
        const roadsByType: Record<string, any[]> = {
          trunk: [],
          primary: []
        };
        
        data.features?.forEach((feature: any) => {
          const highway = feature.properties?.highway;
          if (highway === 'trunk' || highway === 'primary') {
            roadsByType[highway].push(feature);
          }
        });
        
        // Сохраняем данные
        cityRoadsData.current[city.name] = roadsByType;
        console.log(`✅ Загружены дороги ${city.name}: trunk=${roadsByType.trunk.length}, primary=${roadsByType.primary.length}`);
        
      } catch (error) {
        console.error(`❌ Ошибка загрузки дорог ${city.name}:`, error);
      }
    });
    
    await Promise.all(loadPromises);
    console.log('✅ Все дороги городов без магазинов загружены');
  };

  // Создаём белые неоновые дороги между городами БЕЗ магазинов
  const createNoShopsInterCityRoads = async () => {
    if (!map.current) return;

    // Используем ВСЕ города из CITY_COORDS, которые БЕЗ магазинов
    const citiesWithoutShops = Object.keys(CITY_COORDS)
      .filter(cityName => CITIES_WITHOUT_SHOPS_VISUAL.includes(cityName))
      .map(cityName => ({
        name: cityName,
        lat: CITY_COORDS[cityName].lat,
        lng: CITY_COORDS[cityName].lng
      }));
    
    console.log('🔗 Создаем межгородские дороги для:', citiesWithoutShops.map(c => c.name));
    
    if (citiesWithoutShops.length < 2) {
      console.log('⚠️ Недостаточно городов без магазинов для создания дорог');
      return;
    }

    console.log(`🔗 Загружаем предварительно сгенерированные маршруты...`);

    try {
      // Загружаем статический файл с маршрутами
      const response = await fetch('/neuromap/roads/russia-cities/inter-city-roads.geojson');
      
      if (!response.ok) {
        console.warn('⚠️ Файл межгородских дорог не найден');
        return;
      }

      const geojson = await response.json();
      
      // Фильтруем только те маршруты, где ОБА города без магазинов
      const filteredFeatures = geojson.features.filter((feature: any) => {
        const from = feature.properties.from;
        const to = feature.properties.to;
        return CITIES_WITHOUT_SHOPS_VISUAL.includes(from) && 
               CITIES_WITHOUT_SHOPS_VISUAL.includes(to);
      });

      console.log(`✅ Загружено ${filteredFeatures.length} маршрутов из ${geojson.features.length}`);

      // Добавляем source для межгородских дорог
      const source = map.current.getSource('no-shops-inter-city-roads');
      if (source && 'setData' in source) {
        (source as maplibregl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: filteredFeatures
        });
      
        // Показываем слои на zoom 4-11.5
        const currentZoom = map.current.getZoom();
        if (currentZoom >= 4 && currentZoom < 11.5) {
          map.current.setLayoutProperty('no-shops-inter-city-roads-glow', 'visibility', 'visible');
          map.current.setLayoutProperty('no-shops-inter-city-roads', 'visibility', 'visible');
        }
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки межгородских дорог:', error);
    }
  };

  // Функция для преобразования названия города в slug (транслитерация)
  const cityToSlug = (cityName: string) => {
    const translit: Record<string, string> = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
      'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
      'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
      'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    
    return cityName.toLowerCase().split('').map(char => 
      translit[char] || (char === ' ' ? '_' : char)
    ).join('').replace(/[^a-z0-9_]/g, '');
  };

  // Загрузка дорог из статического GeoJSON файла (быстро!) или Flask API (fallback)
  const loadCityRoads = async (cityToLoad?: typeof cities[0]) => {
    const targetCity = cityToLoad || selectedCity;
    if (!map.current || !targetCity) return;
    
    console.log(`🔍 loadCityRoads вызван для: ${targetCity.name}, текущий загруженный: ${loadedCityName.current}`);
    
    // ВСЕГДА обновляем selectedCity в store при смене города
    if (selectedCity?.name !== targetCity.name) {
      console.log(`🏙️ Обновляем selectedCity в store: ${targetCity.name}`);
      const { selectCity } = useMapStore.getState();
      selectCity(targetCity);
      
      // Сбрасываем флаг отрисовки миниатюр при смене города
      allMiniaturesRendered.current = false;
    }
    
    // Если город уже загружен - переключаемся на него (показываем его слои)
    if (cityRoadsLoaded.current[targetCity.name]) {
      console.log(`✅ Дороги ${targetCity.name} уже загружены, переключаемся...`);
      
      // Берём сохранённые данные этого города
      const currentData = cityRoadsData.current[targetCity.name];
      if (currentData && Object.keys(currentData).length > 0) {
        console.log(`🔄 Обновляем данные на карте для ${targetCity.name}, типов дорог: ${Object.keys(currentData).length}`);
        console.log(`📊 Типы дорог в ${targetCity.name}:`, Object.keys(currentData));
        
        // НОВАЯ ЛОГИКА: Комбинируем полные дороги текущего города + миниатюры остальных
        const allTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 
                         'residential', 'unclassified', 'road', 'service', 'living_street',
                         'footway', 'path', 'track', 'cycleway', 'pedestrian'];
        
        allTypes.forEach(type => {
          const sourceId = `roads-${type}`;
          const source = map.current?.getSource(sourceId);
          
          if (!source || !('setData' in source)) {
            console.warn(`⚠️ Source ${sourceId} не найден!`);
            return;
          }
          
          // Собираем features для этого типа дорог
          let features: any[] = [];
          
          // 1. Добавляем все дороги текущего города (если есть)
          if (currentData[type]) {
            features.push(...currentData[type]);
            console.log(`  📍 ${targetCity.name}: ${currentData[type].length} дорог ${type}`);
          }
          
          // 2. Добавляем миниатюры (только motorway/trunk/primary) других городов
          if (type === 'motorway' || type === 'trunk' || type === 'primary') {
            Object.entries(cityRoadsData.current).forEach(([cityName, cityData]) => {
              // Пропускаем текущий город - его мы уже добавили
              if (cityName === targetCity.name) return;
              
              if (cityData[type]) {
                features.push(...cityData[type]);
                console.log(`  🌍 ${cityName}: ${cityData[type].length} дорог ${type} (миниатюра)`);
              }
            });
          }
          
          // Обновляем source
          (source as any).setData({
            type: 'FeatureCollection',
            features
          });
          
          console.log(`✏️ Source ${sourceId} обновлён: ${features.length} дорог`);
        });
        
        console.log(`✅ Данные карты обновлены для ${targetCity.name} + миниатюры других городов`);
      } else {
        console.warn(`⚠️ Нет сохраненных данных для города ${targetCity.name}, но отрисовываем миниатюры других городов`);
        
        // Даже если у текущего города нет данных, отрисовываем миниатюры других городов
        const allTypes = ['motorway', 'trunk', 'primary'];
        
        allTypes.forEach(type => {
          const sourceId = `roads-${type}`;
          const source = map.current?.getSource(sourceId);
          
          if (!source || !('setData' in source)) return;
          
          let features: any[] = [];
          
          // Добавляем миниатюры других городов
          Object.entries(cityRoadsData.current).forEach(([cityName, cityData]) => {
            if (cityName === targetCity.name) return; // Пропускаем текущий город
            
            if (cityData[type]) {
              features.push(...cityData[type]);
              console.log(`  🌍 ${cityName}: ${cityData[type].length} дорог ${type} (миниатюра)`);
            }
          });
          
          // Обновляем source
          (source as any).setData({
            type: 'FeatureCollection',
            features
          });
          
          console.log(`✏️ Source ${sourceId} обновлён: ${features.length} дорог (только миниатюры)`);
        });
      }
      
      loadedCityName.current = targetCity.name;
      return;
    }
    
    // Загружаем магазины этого города если ещё не загружены
    let cityShops = shops.filter(s => s.city === targetCity.name);
    if (cityShops.length === 0) {
      try {
        console.log(`📦 Загружаем магазины для ${targetCity.name}...`);
        const { api } = await import('../api/client');
        const loadedShops = await api.getShops(targetCity.name);
        const shopsWithActivity = loadedShops.map((shop: any) => ({
          ...shop,
          activity: Math.random() * 0.5 + 0.5,
          category: shop.category || 'Без категории'
        }));
        const { setShops } = useMapStore.getState();
        setShops([...shops, ...shopsWithActivity]);
        cityShops = shopsWithActivity;
        console.log(`✅ Загружено ${cityShops.length} магазинов для ${targetCity.name}`);
      } catch (error) {
        console.error(`❌ Ошибка загрузки магазинов ${targetCity.name}:`, error);
        return;
      }
    } else {
      console.log(`✅ Магазины ${targetCity.name} уже в store: ${cityShops.length} шт.`);
    }
    
    // Даже если нет магазинов, всё равно показываем карту города
    if (cityShops.length === 0) {
      console.warn(`⚠️ Нет магазинов в ${targetCity.name}, но загружаем дороги`);
      // НЕ делаем return - продолжаем загружать дороги ниже
    }
    
    try {
      // Сначала пробуем загрузить статический файл (мгновенно)
      const citySlug = cityToSlug(targetCity.name);
      const staticUrl = `/neuromap/roads/${citySlug}.geojson`;
      
      console.log(`📁 Загружаем: ${staticUrl}`);
      let response = await fetch(staticUrl);
      let data;
      
      // Если файла нет - используем Flask API как fallback
      if (!response.ok) {
        console.log(`⚠️ Статический файл не найден, используем Flask API (будет медленно)...`);
        
        // Вычисляем bbox вокруг магазинов или центра города
        let minLat: number, maxLat: number, minLng: number, maxLng: number;
        
        if (cityShops.length > 0) {
          // Есть магазины - считаем bbox по ним
          minLat = cityShops[0].lat;
          maxLat = cityShops[0].lat;
          minLng = cityShops[0].lng;
          maxLng = cityShops[0].lng;
          
          cityShops.forEach(shop => {
            minLat = Math.min(minLat, shop.lat);
            maxLat = Math.max(maxLat, shop.lat);
            minLng = Math.min(minLng, shop.lng);
            maxLng = Math.max(maxLng, shop.lng);
          });
        } else {
          // Нет магазинов - используем координаты центра города
          minLat = maxLat = targetCity.lat;
          minLng = maxLng = targetCity.lng;
        }
        
        // Добавляем буфер 30км (примерно 0.27 градуса = ~30км)
        const buffer = 0.27; // 30км буфер вокруг магазинов или центра города
        const south = minLat - buffer;
        const north = maxLat + buffer;
        const west = minLng - buffer;
        const east = maxLng + buffer;
        
        const bbox = `${south},${west},${north},${east}`;
        console.log(`📍 Область загрузки: ${(north-south)*111}км × ${(east-west)*111*Math.cos(minLat*Math.PI/180)}км`);
        
        // Запрос ВСЕХ типов дорог включая мелкие
        const query = `
          [out:json][timeout:60];
          (
            way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|road|service|living_street|footway|path|track|cycleway|pedestrian"]["highway"!~".*_link"](${bbox});
          );
          out geom;
        `;
        
        console.log('📡 Отправляем запрос к Flask API...');
        
        // Используем Flask API вместо прямого обращения к Overpass
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.error('⏱️ Timeout запроса (60 сек)');
        }, 60000); // 60 сек таймаут
        
        response = await fetch('https://chronosphere.pythonanywhere.com/api/roads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ bbox, query }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`📥 Получен ответ: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
          console.error(`❌ Flask API ошибка: ${response.status}`);
          const errorText = await response.text();
          console.error('Текст ошибки:', errorText.substring(0, 200));
          delete cityRoadsLoaded.current[targetCity.name];
          return;
        }
      }
      
      // Парсим данные (либо из статического файла, либо из Flask API)
      data = await response.json();
      
      if (!data.elements || data.elements.length === 0) {
        console.warn('⚠️ Нет данных о дорогах в ответе');
        delete cityRoadsLoaded.current[targetCity.name];
        return;
      }
      
      console.log(`✅ Загружено ${data.elements.length} дорог города ${targetCity.name}`)
      
      // Останавливаем старые быстрые интервалы пульсации
      pulseIntervals.current.forEach(id => clearInterval(id));
      pulseIntervals.current = [];
      
      // Группируем дороги по типу (включая мелкие типы)
      const roadsByType: Record<string, any[]> = {
        motorway: [],
        trunk: [],
        primary: [],
        secondary: [],
        tertiary: [],
        residential: [],
        unclassified: [],
        road: [],
        service: [],
        living_street: [],
        footway: [],
        path: [],
        track: [],
        cycleway: [],
        pedestrian: []
      };
      
      data.elements.forEach((element: any) => {
        if (element.type === 'way' && element.geometry) {
          const coords = element.geometry.map((node: any) => [node.lon, node.lat]);
          const highway = element.tags.highway;
          
          if (roadsByType[highway]) {
            roadsByType[highway].push({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: coords
              },
              properties: { highway }
            });
          }
        }
      });
      
      // Сохраняем данные дорог этого города
      cityRoadsData.current[targetCity.name] = roadsByType;
      
      // НОВАЯ ЛОГИКА: Обновляем sources комбинируя текущий город + миниатюры других
      const allTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 
                       'residential', 'unclassified', 'road', 'service', 'living_street',
                       'footway', 'path', 'track', 'cycleway', 'pedestrian'];
      
      allTypes.forEach(type => {
        const sourceId = `roads-${type}`;
        const source = map.current?.getSource(sourceId);
        
        if (!source || !('setData' in source)) return;
        
        // Собираем features для этого типа дорог
        let features: any[] = [];
        
        // 1. Добавляем все дороги текущего города (если есть)
        if (roadsByType[type]) {
          features.push(...roadsByType[type]);
          console.log(`  📍 ${targetCity.name}: ${roadsByType[type].length} дорог ${type}`);
        }
        
        // 2. Добавляем миниатюры (только motorway/trunk/primary) других городов
        if (type === 'motorway' || type === 'trunk' || type === 'primary') {
          Object.entries(cityRoadsData.current).forEach(([cityName, cityData]) => {
            // Пропускаем текущий город - его мы уже добавили
            if (cityName === targetCity.name) return;
            
            if (cityData[type]) {
              features.push(...cityData[type]);
              console.log(`  🌍 ${cityName}: ${cityData[type].length} дорог ${type} (миниатюра)`);
            }
          });
        }
        
        // Обновляем source
        (source as any).setData({
          type: 'FeatureCollection',
          features
        });
        
        console.log(`✏️ Source ${sourceId}: ${features.length} дорог`);
        
        // Запускаем МЕДЛЕННУЮ пульсацию (200ms = 2 сек цикл) для главных дорог
        if (type === 'motorway' || type === 'trunk' || type === 'primary') {
          let pulseOpacity = 0.6;
          let increasing = true;
          const intervalId = window.setInterval(() => {
            if (!map.current?.getLayer(`${sourceId}-vein`)) {
              clearInterval(intervalId);
              return;
            }
            
            if (increasing) {
              pulseOpacity += 0.04;
              if (pulseOpacity >= 1) {
                pulseOpacity = 1;
                increasing = false;
              }
            } else {
              pulseOpacity -= 0.04;
              if (pulseOpacity <= 0.6) {
                pulseOpacity = 0.6;
                increasing = true;
              }
            }
            
            try {
              map.current?.setPaintProperty(`${sourceId}-vein`, 'line-opacity', pulseOpacity);
            } catch (e) {
              clearInterval(intervalId);
            }
          }, 200);
          
          pulseIntervals.current.push(intervalId);
        }
      });
      
      console.log('Дороги загружены:', Object.values(roadsByType).flat().length);
      
      // Помечаем город как загруженный только после успешной обработки
      cityRoadsLoaded.current[targetCity.name] = true;
      loadedCityName.current = targetCity.name;
      
    } catch (error) {
      console.error('Ошибка загрузки дорог:', error);
      // Удаляем флаг если была ошибка
      delete cityRoadsLoaded.current[targetCity.name];
      delete cityRoadsData.current[targetCity.name];
    }
  };

  // Скрыть/показать слои дорог
  const toggleRoadsVisibility = (visible: boolean) => {
    if (!map.current) return;
    
    const roadLayers = [
      'roads-motorway-glow-outer',
      'roads-motorway-base',
      'roads-motorway-vein',
      'roads-major-glow',
      'roads-major-base',
      'roads-major-vein',
      'roads-minor-glow',
      'roads-minor-base',
      'roads-minor-vein'
    ];

    roadLayers.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.setLayoutProperty(
          layerId,
          'visibility',
          visible ? 'visible' : 'none'
        );
      }
    });
  };

  // Показать маршрут до магазина
  const showRouteToShop = async (shop: Shop, fromLocation?: [number, number]) => {
    const currentLocation = fromLocation || userLocation;
    if (!map.current || !currentLocation) return;

    // Закрываем popup если был открыт
    setPopupShop(null);
    setPopupPosition(null);

    // Строим маршрут
    const routeGeometry = await buildRoute(currentLocation, [shop.lng, shop.lat]);
    
    if (routeGeometry) {
      // Сохраняем координаты маршрута для анимации эхо
      const coordinates = routeGeometry.coordinates;

      // Удаляем старый маршрут если есть
      if (map.current.getSource('route')) {
        map.current.removeLayer('route-glow');
        map.current.removeLayer('route-base');
        map.current.removeLayer('route-vein');
        map.current.removeSource('route');
      }

      // Добавляем источник маршрута
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: routeGeometry
        }
      });

      // Свечение маршрута (оранжевое) - начинаем с нулевой прозрачности
      map.current.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#cc5500',
          'line-width': 20,
          'line-blur': 15,
          'line-opacity': 0
        }
      });

      // Основная линия маршрута (оранжевая) - начинаем с нулевой прозрачности
      map.current.addLayer({
        id: 'route-base',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#cc6600',
          'line-width': 10,
          'line-opacity': 0
        }
      });

      // Центральная вена маршрута (холодный белый) - начинаем невидимой
      map.current.addLayer({
        id: 'route-vein',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#f0f8ff',
          'line-width': 3,
          'line-opacity': 0
        }
      });

      // Запускаем анимацию эхолокации и рисования маршрута
      animateEchoAndRoute(coordinates, currentLocation, shop);

      // Обновляем маркер пользователя
      if (!userMarker.current) {
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.innerHTML = `
          <div style="position: relative; width: 30px; height: 30px;">
            <div style="position: absolute; width: 30px; height: 30px; background: #f0f8ff; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #f0f8ff; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #f0f8ff;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 0.3; }
              50% { transform: scale(2); opacity: 0; }
            }
          </style>
        `;
        
        userMarker.current = new maplibregl.Marker({ element: el })
          .setLngLat(currentLocation)
          .addTo(map.current);
      } else {
        // Обновляем позицию если маркер уже есть
        userMarker.current.setLngLat(currentLocation);
      }

      // Камера переместится к магазину после завершения первой фазы эхо
    }
  };

  // Анимация эхо-волны расширяющейся полукругом от местоположения до магазина
  const animateEchoAndRoute = (_coordinates: number[][], startLocation: [number, number], targetShop: Shop) => {
    if (!map.current) return;

    // Сразу начинаем перемещение камеры к магазину (2.5 секунды)
    map.current.flyTo({
      center: [targetShop.lng, targetShop.lat],
      zoom: 15,
      duration: 2500,
      essential: true
    });

    // Вычисляем угол направления от пользователя к магазину
    const calculateAngle = () => {
      const startPoint = map.current!.project(startLocation);
      const targetPoint = map.current!.project([targetShop.lng, targetShop.lat]);
      return Math.atan2(targetPoint.y - startPoint.y, targetPoint.x - startPoint.x);
    };

    // Вычисляем расстояние до магазина в пикселях
    const calculateMaxRadius = () => {
      const startPoint = map.current!.project(startLocation);
      const targetPoint = map.current!.project([targetShop.lng, targetShop.lat]);
      return Math.hypot(targetPoint.x - startPoint.x, targetPoint.y - startPoint.y);
    };

    let angle = calculateAngle();
    let maxRadius = calculateMaxRadius();

    const duration = 1250; // 1.25 секунды (ускорено на 50%)
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      if (!map.current) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Обновляем позицию и параметры при каждом кадре (на случай движения карты)
      const startPoint = map.current.project(startLocation);
      angle = calculateAngle();
      maxRadius = calculateMaxRadius();

      // Вычисляем текущий радиус волны (расширяется до магазина)
      const currentRadius = progress * maxRadius;
      
      // Обновляем позицию и размер волны с углом направления
      setEchoWave({ 
        x: startPoint.x, 
        y: startPoint.y, 
        radius: currentRadius,
        angle: angle
      });

      // Постепенно затемняем обычные дороги на 90%
      const roadLayers = [
        'roads-motorway-glow-outer',
        'roads-motorway-base',
        'roads-motorway-inner',
        'roads-motorway-vein',
        'roads-major-glow',
        'roads-major-base',
        'roads-major-inner',
        'roads-major-vein',
        'roads-minor-glow',
        'roads-minor-base',
        'roads-minor-inner',
        'roads-minor-vein'
      ];

      roadLayers.forEach(layerId => {
        if (map.current?.getLayer(layerId)) {
          // Затемняем постепенно от 60% до 6% (90% затемнение)
          map.current.setPaintProperty(
            layerId,
            'line-opacity',
            0.6 * (1 - (progress * 0.9))
          );
        }
      });

      // Затемняем все маркеры кроме выбранного
      const allMarkers = document.querySelectorAll('.map-marker');
      allMarkers.forEach((marker) => {
        const markerShopId = marker.getAttribute('data-shop-id');
        const shopIds = markerShopId?.split(',') || [];
        const containsSelectedShop = shopIds.includes(targetShop.id.toString());
        
        if (!containsSelectedShop) {
          // Затемняем невыбранные маркеры
          (marker as HTMLElement).style.opacity = (1 - (progress * 0.9)).toString();
        }
      });

      // Постепенно проявляем маршрут
      if (map.current?.getLayer('route-glow')) {
        map.current.setPaintProperty('route-glow', 'line-opacity', progress * 0.5);
      }
      if (map.current?.getLayer('route-base')) {
        map.current.setPaintProperty('route-base', 'line-opacity', progress * 0.6);
      }
      if (map.current?.getLayer('route-vein')) {
        map.current.setPaintProperty('route-vein', 'line-opacity', progress * 0.6);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // После завершения анимации оставляем маркеры затемнёнными
        const allMarkers = document.querySelectorAll('.map-marker');
        allMarkers.forEach((marker) => {
          const markerShopId = marker.getAttribute('data-shop-id');
          const shopIds = markerShopId?.split(',') || [];
          const containsSelectedShop = shopIds.includes(targetShop.id.toString());
          
          if (!containsSelectedShop) {
            (marker as HTMLElement).style.opacity = '0.1';
          }
        });
        
        // Запускаем обратный импульс от магазина
        animateShopResponse(startLocation, targetShop);
      }
    };

    requestAnimationFrame(animate);
  };

  // Анимация обратного импульса от магазина (бесконечная пульсация)
  const animateShopResponse = (_startLocation: [number, number], targetShop: Shop) => {
    if (!map.current) return;

    // Останавливаем предыдущую анимацию если есть
    if (shopPulseAnimationId.current !== null) {
      cancelAnimationFrame(shopPulseAnimationId.current);
    }

    const pulseDuration = 1500; // 1.5 секунды на один цикл расширения
    let pulseStartTime = performance.now();

    const animatePulse = (currentTime: number) => {
      if (!map.current) return;

      const elapsed = (currentTime - pulseStartTime) % pulseDuration;
      const progress = elapsed / pulseDuration;

      // Расширение от 0 до 150px без возврата
      const shopPoint = map.current.project([targetShop.lng, targetShop.lat]);
      const responseRadius = progress * 150;
      
      // Затухание волны по мере расширения (от 0.7 до 0)
      const fadeOpacity = 0.7 * (1 - progress);

      // Показываем расширяющийся импульс от магазина с затуханием
      setEchoWave({
        x: shopPoint.x,
        y: shopPoint.y,
        radius: responseRadius,
        angle: 0, // Полный круг
        opacity: fadeOpacity
      });

      // Продолжаем анимацию
      shopPulseAnimationId.current = requestAnimationFrame(animatePulse);
    };

    // Усиливаем проявление маршрута до максимума
    if (map.current?.getLayer('route-glow')) {
      map.current.setPaintProperty('route-glow', 'line-opacity', 0.8);
    }
    if (map.current?.getLayer('route-base')) {
      map.current.setPaintProperty('route-base', 'line-opacity', 1);
    }
    if (map.current?.getLayer('route-vein')) {
      map.current.setPaintProperty('route-vein', 'line-opacity', 1);
    }

    shopPulseAnimationId.current = requestAnimationFrame(animatePulse);
  };

  // Сброс (показать все дороги обратно)
  const resetRoute = () => {
    if (!map.current) return;

    // Останавливаем анимацию пульсации
    if (shopPulseAnimationId.current !== null) {
      cancelAnimationFrame(shopPulseAnimationId.current);
      shopPulseAnimationId.current = null;
    }

    // Убираем эхо
    setEchoWave(null);

    // Показываем дороги обратно
    toggleRoadsVisibility(true);

    // Восстанавливаем opacity для всех слоев дорог (возвращаем к базовой яркости 60%)
    const roadLayers = [
      'roads-motorway-glow-outer',
      'roads-motorway-base',
      'roads-motorway-inner',
      'roads-motorway-vein',
      'roads-major-glow',
      'roads-major-base',
      'roads-major-inner',
      'roads-major-vein',
      'roads-minor-glow',
      'roads-minor-base',
      'roads-minor-inner',
      'roads-minor-vein'
    ];

    roadLayers.forEach(layerId => {
      if (map.current?.getLayer(layerId)) {
        map.current.setPaintProperty(layerId, 'line-opacity', 0.6);
      }
    });

    // Восстанавливаем opacity всех маркеров
    const allMarkers = document.querySelectorAll('.map-marker');
    allMarkers.forEach((marker) => {
      (marker as HTMLElement).style.opacity = '1';
    });

    // Удаляем маршрут
    if (map.current.getSource('route')) {
      map.current.removeLayer('route-glow');
      map.current.removeLayer('route-base');
      map.current.removeLayer('route-vein');
      map.current.removeSource('route');
    }

    setSelectedShop(null);
    setPopupShop(null);
    setPopupPosition(null);
    setEchoWave(null);

    // Показываем все магазины города на карте
    if (shops.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      shops.forEach(shop => {
        bounds.extend([shop.lng, shop.lat]);
      });

      map.current.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        maxZoom: 13,
        duration: 1000,
        essential: true
      });
    }
  };

  // Переместить камеру к местоположению пользователя
  const flyToUserLocation = () => {
    if (!map.current || !userLocation) return;
    
    map.current.flyTo({
      center: userLocation,
      zoom: 15,
      duration: 1500,
      essential: true
    });
  };

  // Получение геолокации пользователя
  useEffect(() => {
    requestLocation()
      .then((location) => {
        setUserLocation([location.longitude, location.latitude]);
        hapticFeedback('success');
      })
      .catch((error) => {
        console.log('Геолокация недоступна:', error);
        hapticFeedback('error');
      });
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !selectedCity) return;
    
    // Если карта уже существует - просто перемещаем и загружаем дороги
    if (map.current) {
      console.log(`🗺️ Карта уже существует, перемещаем в ${selectedCity.name}`);
      
      // Устанавливаем флаг перед программным переходом
      skipAutoLoadRef.current = true;
      
      // Определяем zoom в зависимости от наличия магазинов
      const targetZoom = (typeof selectedCity.shops === 'number' && selectedCity.shops > 0) ? 12 : 11;
      
      // Сначала летим к городу
      map.current.flyTo({
        center: [selectedCity.lng, selectedCity.lat],
        zoom: targetZoom,
        duration: 1500
      });
      
      // Устанавливаем отложенную загрузку дорог ПОСЛЕ окончания анимации
      pendingCityLoadRef.current = selectedCity;
      console.log(`🗺️ Отложенная загрузка установлена для ${selectedCity.name}`);
      
      return;
    }

    // Скрываем карту до начала анимации
    if (mapContainer.current) {
      mapContainer.current.style.opacity = '0';
    }

    // Определяем zoom в зависимости от типа города
    const isCityWithoutShops = CITIES_WITHOUT_SHOPS_VISUAL.includes(selectedCity.name);
    const initialZoom = isCityWithoutShops ? 11 : 12;

    // Инициализация карты с неоновыми оранжевыми дорогами (только первый раз)
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: neonRoadsStyle as any,
      center: [selectedCity.lng, selectedCity.lat],
      zoom: initialZoom,
      minZoom: 4, // Минимальный zoom - нельзя отдалить дальше
      maxZoom: isCityWithoutShops ? 11.5 : 18, // Ограничение для городов без магазинов
      attributionControl: false
    });

    // Анимация появления карты из квадратиков
    map.current.on('load', () => {
      // Создаём пустые sources и layers для всех типов дорог сразу
      initAllRoadLayers();
      
      // Загружаем дороги через Overpass API и рисуем их неоном
      loadCityRoads();
      
      // Загружаем дороги для всех городов БЕЗ магазинов (для белых миниатюр)
      loadCitiesWithoutShopsRoads();
      
      // Создаём межгородские дороги (оранжевые для городов С магазинами)
      createInterCityRoads();
      
      // Создаём межгородские дороги (белые для городов БЕЗ магазинов)
      createNoShopsInterCityRoads();
      
      // Показываем карту сразу, но она будет под черными квадратиками
      if (mapContainer.current) {
        mapContainer.current.style.opacity = '1';
      }
      
      // Анимируем появление
      const canvas = pixelOverlayRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const pixelSize = 40;
      const pixels: { x: number; y: number; delay: number }[] = [];
      
      for (let y = 0; y < canvas.height; y += pixelSize) {
        for (let x = 0; x < canvas.width; x += pixelSize) {
          pixels.push({ 
            x, 
            y, 
            delay: Math.random() * 800
          });
        }
      }
      
      const startTime = Date.now();
      
      const animatePixels = () => {
        const elapsed = Date.now() - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let allComplete = true;
        
        pixels.forEach(pixel => {
          if (elapsed < pixel.delay) {
            allComplete = false;
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
          }
        });
        
        if (!allComplete) {
          requestAnimationFrame(animatePixels);
        }
      };
      
      animatePixels();
    });

    // Загружаем дороги сразу после инициализации карты (без задержки)
    map.current.once('idle', () => {
      console.log('Карта готова, начинаем загрузку дорог...');
      loadCityRoads(); // Загружаем весь город целиком один раз
    });

    // Автозагрузка дорог при приближении к другому городу
    map.current.on('moveend', () => {
      if (!map.current) return;
      
      // Проверяем есть ли отложенная загрузка города
      if (pendingCityLoadRef.current) {
        const cityToLoad = pendingCityLoadRef.current;
        pendingCityLoadRef.current = null; // Сбрасываем
        console.log(`✈️ Анимация завершена, загружаем отложенный город: ${cityToLoad.name}`);
        loadCityRoads(cityToLoad);
        return;
      }
      
      // Пропускаем автозагрузку если это программный переход без отложенного города
      if (skipAutoLoadRef.current) {
        console.log('⏭️ Пропускаем автозагрузку (программный переход)');
        skipAutoLoadRef.current = false;
        return;
      }
      
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      
      // Если приблизились достаточно (zoom > 9), проверяем ближайший город
      if (zoom > 9) {
        const nearestCity = findNearestCity([center.lng, center.lat]);
        
        if (nearestCity && nearestCity.name !== loadedCityName.current) {
          console.log(`🎯 Обнаружен новый город при перемещении карты: ${nearestCity.name}`);
          // loadCityRoads сам обновит selectedCity в store и загрузит магазины
          loadCityRoads(nearestCity);
        }
      }
    });

    // Добавление контролов
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Обработчик zoom для переключения между маркерами и city labels
    const handleZoom = () => {
      if (!map.current) return;
      const zoom = map.current.getZoom();
      
      // Обновляем state с текущим зумом
      setCurrentZoom(Math.round(zoom * 10) / 10);
      
      // Очищаем предыдущий таймер debounce
      if (zoomDebounceTimer.current) {
        clearTimeout(zoomDebounceTimer.current);
      }
      
      // При zoom < 9 показываем city labels вместо маркеров магазинов (увеличено с 7 до 9)
      if (zoom < 9) {
        setShowCityLabels(true);
        // Скрываем маркеры магазинов
        markers.current.forEach(marker => {
          const el = marker.getElement();
          el.style.display = 'none';
        });
        
        // При отдалении загружаем миниатюры всех городов с debounce
        // Это предотвращает множественные загрузки при быстром зуме
        if (!allCitiesMiniaturesLoaded.current && !isLoadingMiniatures.current) {
          zoomDebounceTimer.current = setTimeout(() => {
            loadAllCitiesMiniatures();
          }, 300); // 300мс debounce
        }
        
        // Загружаем и отрисовываем крупные города России на отдалённом зуме
        if (!russiaCitiesLoaded.current) {
          loadRussiaMajorCities();
        } else {
          renderRussiaCities();
        }
      } else {
        setShowCityLabels(false);
        // Показываем маркеры магазинов
        markers.current.forEach(marker => {
          const el = marker.getElement();
          el.style.display = 'block';
        });
        
        // Скрываем крупные города России при приближении
        renderRussiaCities();
      }
      
      // Управляем видимостью белых неоновых дорог между городами без магазинов (zoom 4-11.5)
      if (map.current.getSource('no-shops-inter-city-roads')) {
        if (zoom >= 4 && zoom < 11.5) {
          // Показываем белые неоновые дороги на zoom 4-11.5
          map.current.setLayoutProperty('no-shops-inter-city-roads-glow', 'visibility', 'visible');
          map.current.setLayoutProperty('no-shops-inter-city-roads', 'visibility', 'visible');
        } else {
          // Скрываем на других зумах
          map.current.setLayoutProperty('no-shops-inter-city-roads-glow', 'visibility', 'none');
          map.current.setLayoutProperty('no-shops-inter-city-roads', 'visibility', 'none');
        }
      }
      
      // Ограничиваем maxZoom для городов без магазинов
      if (selectedCity && CITIES_WITHOUT_SHOPS_VISUAL.includes(selectedCity.name)) {
        if (zoom > 11.5 && map.current.getMaxZoom() > 11.5) {
          map.current.setMaxZoom(11.5);
          map.current.setZoom(11.5);
        }
      } else {
        // Для городов с магазинами - полный zoom
        if (map.current.getMaxZoom() !== 18) {
          map.current.setMaxZoom(18);
        }
      }
    };

    map.current.on('zoom', handleZoom);
    handleZoom(); // Вызываем сразу для инициализации

    // Cleanup только при размонтировании компонента
    return () => {
      // Очищаем debounce таймер при cleanup
      if (zoomDebounceTimer.current) {
        clearTimeout(zoomDebounceTimer.current);
      }
      
      if (map.current) {
        markers.current.forEach(marker => marker.remove());
        markers.current = [];
        cityLabelsRef.current.forEach(label => label.remove());
        cityLabelsRef.current = [];
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Карта создаётся ТОЛЬКО ОДИН РАЗ при монтировании компонента

  // Отдельный эффект для реакции на изменение selectedCity
  useEffect(() => {
    if (!map.current || !selectedCity) return;
    
    // Если это уже загруженный город - переключаемся на него
    if (cityRoadsLoaded.current[selectedCity.name]) {
      console.log(`🗺️ Переключаемся на уже загруженный город: ${selectedCity.name}`);
      loadCityRoads(selectedCity);
      
      // Определяем zoom и maxZoom в зависимости от типа города
      const isCityWithoutShops = CITIES_WITHOUT_SHOPS_VISUAL.includes(selectedCity.name);
      const targetZoom = isCityWithoutShops ? 11 : 12;
      const newMaxZoom = isCityWithoutShops ? 11.5 : 18;
      
      // Обновляем maxZoom карты
      map.current.setMaxZoom(newMaxZoom);
      
      // Летим к городу
      map.current.flyTo({
        center: [selectedCity.lng, selectedCity.lat],
        zoom: targetZoom,
        duration: 1500
      });
    }
  }, [selectedCity]);

  // Создание city labels при zoom out
  useEffect(() => {
    if (!map.current || !showCityLabels) {
      // Удаляем labels если не нужны
      cityLabelsRef.current.forEach(label => label.remove());
      cityLabelsRef.current = [];
      return;
    }

    // Фильтруем города с магазинами
    const citiesWithShops = cities.filter(city => 
      typeof city.shops === 'number' && city.shops > 0
    );
    
    // Функция для расчета масштаба от zoom (zoom 4 = 0.5x, zoom 9 = 1x)
    const getScale = (zoom: number) => {
      const minZoom = 4;
      const maxZoom = 9;
      const minScale = 0.5;
      const maxScale = 1;
      const t = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
      return minScale + (maxScale - minScale) * t;
    };
    
    const updateScales = () => {
      if (!map.current) return;
      const zoom = map.current.getZoom();
      const scale = getScale(zoom);
      
      cityLabelsRef.current.forEach(marker => {
        const el = marker.getElement();
        const innerEl = el?.querySelector('.city-label') as HTMLElement;
        if (innerEl) {
          innerEl.style.transform = `scale(${scale})`;
        }
      });
    };
    
    citiesWithShops.forEach(city => {
      const shopCount = typeof city.shops === 'number' ? city.shops : 0;
      const el = document.createElement('div');
      el.className = 'city-label-wrapper';
      
      const initialScale = map.current ? getScale(map.current.getZoom()) : 0.5;
      
      el.innerHTML = `
        <div class="city-label" style="
          background: rgba(10, 10, 26, 0.95);
          border: 2px solid white;
          border-radius: 12px;
          padding: 12px 20px;
          cursor: pointer;
          box-shadow: 0 0 30px rgba(255, 255, 255, 0.5);
          transition: box-shadow 0.3s;
          font-weight: bold;
          text-align: center;
          pointer-events: auto;
          animation: cityLabelPulse 3s ease-in-out infinite;
          transform: scale(${initialScale});
          transform-origin: center center;
        ">
          <div class="city-label__name">${city.name}</div>
          <div class="city-label__count">${shopCount} ${shopCount === 1 ? 'магазин' : shopCount < 5 ? 'магазина' : 'магазинов'}</div>
        </div>
      `;
      
      const innerEl = el.querySelector('.city-label') as HTMLElement;
      
      // Hover эффект только для тени, без transform
      innerEl.addEventListener('mouseenter', () => {
        innerEl.style.boxShadow = '0 0 40px rgba(255, 255, 255, 0.9)';
      });
      
      innerEl.addEventListener('mouseleave', () => {
        innerEl.style.boxShadow = '0 0 30px rgba(255, 255, 255, 0.5)';
      });
      
      el.addEventListener('click', () => {
        // Переключаем на этот город и зумим к нему
        if (map.current && selectedCity?.name !== city.name) {
          console.log(`🏷️ Клик на city label: ${city.name}`);
          
          // Сбрасываем категорию при смене города
          if (onCategoryChange) {
            onCategoryChange(null);
          }
          
          // Устанавливаем флаг перед программным переходом
          skipAutoLoadRef.current = true;
          
          map.current.flyTo({
            center: [city.lng, city.lat],
            zoom: 12,
            duration: 2000
          });
          
          // Устанавливаем отложенную загрузку дорог ПОСЛЕ окончания анимации
          pendingCityLoadRef.current = city;
          console.log(`🏷️ Отложенная загрузка установлена для ${city.name}`);
        } else if (selectedCity?.name === city.name) {
          // Если уже в этом городе - просто зумим
          map.current?.flyTo({
            center: [city.lng, city.lat],
            zoom: 12,
            duration: 1500
          });
        }
      });

      const marker = new maplibregl.Marker({ 
        element: el,
        anchor: 'center'
      })
        .setLngLat([city.lng, city.lat])
        .addTo(map.current!);
      
      cityLabelsRef.current.push(marker);
    });
    
    // Устанавливаем начальный масштаб
    updateScales();
    
    // Подписываемся на изменение zoom
    map.current.on('zoom', updateScales);

    return () => {
      if (map.current) {
        map.current.off('zoom', updateScales);
      }
      cityLabelsRef.current.forEach(label => label.remove());
      cityLabelsRef.current = [];
    };
  }, [showCityLabels, cities, selectedCity]);

  // Создание белых (потухших) city labels для городов без магазинов
  useEffect(() => {
    if (!map.current || !showCityLabels) {
      // Удаляем labels если не нужны
      whiteCityLabelsRef.current.forEach(label => label.remove());
      whiteCityLabelsRef.current = [];
      return;
    }

    // Берем города из CITIES_WITHOUT_SHOPS_VISUAL
    const citiesWithoutShops = CITIES_WITHOUT_SHOPS_VISUAL
      .map(cityName => ({
        name: cityName,
        lat: CITY_COORDS[cityName]?.lat,
        lng: CITY_COORDS[cityName]?.lng
      }))
      .filter(city => city.lat && city.lng);
    
    // Функция для расчета масштаба от zoom (zoom 4 = 0.5x, zoom 9 = 1x)
    const getScale = (zoom: number) => {
      const minZoom = 4;
      const maxZoom = 9;
      const minScale = 0.5;
      const maxScale = 1;
      const t = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
      return minScale + (maxScale - minScale) * t;
    };
    
    const updateScales = () => {
      if (!map.current) return;
      const zoom = map.current.getZoom();
      const scale = getScale(zoom);
      
      whiteCityLabelsRef.current.forEach(marker => {
        const el = marker.getElement();
        const innerEl = el?.querySelector('.city-label') as HTMLElement;
        if (innerEl) {
          innerEl.style.transform = `scale(${scale})`;
        }
      });
    };
    
    citiesWithoutShops.forEach(city => {
      const el = document.createElement('div');
      el.className = 'city-label-wrapper city-label-wrapper--inactive';
      
      const initialScale = map.current ? getScale(map.current.getZoom()) : 0.5;
      
      el.innerHTML = `
        <div class="city-label city-label--inactive" style="
          background: rgba(10, 10, 26, 0.21);
          border: 2px solid rgba(255, 255, 255, 0.105);
          border-radius: 12px;
          padding: 12px 20px;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.07);
          transition: box-shadow 0.3s, border-color 0.3s, color 0.3s;
          font-weight: bold;
          text-align: center;
          pointer-events: auto;
          color: rgba(255, 255, 255, 0.175);
          opacity: 0.7;
          transform: scale(${initialScale});
          transform-origin: center center;
        ">
          <div class="city-label__name">${city.name}</div>
          <div class="city-label__count">Нет магазинов</div>
        </div>
      `;
      
      const innerEl = el.querySelector('.city-label') as HTMLElement;
      
      // Hover эффект
      innerEl.addEventListener('mouseenter', () => {
        innerEl.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.175)';
        innerEl.style.borderColor = 'rgba(255, 255, 255, 0.21)';
        innerEl.style.color = 'rgba(255, 255, 255, 0.35)';
      });
      
      innerEl.addEventListener('mouseleave', () => {
        innerEl.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.07)';
        innerEl.style.borderColor = 'rgba(255, 255, 255, 0.105)';
        innerEl.style.color = 'rgba(255, 255, 255, 0.175)';
      });
      
      el.addEventListener('click', () => {
        // Зумим к белому городу
        if (map.current) {
          console.log(`🏷️ Клик на белый city label: ${city.name}`);
          
          map.current.flyTo({
            center: [city.lng!, city.lat!],
            zoom: 11, // До maxZoom белых городов
            duration: 2000
          });
        }
      });

      const marker = new maplibregl.Marker({ 
        element: el,
        anchor: 'center'
      })
        .setLngLat([city.lng!, city.lat!])
        .addTo(map.current!);
      
      whiteCityLabelsRef.current.push(marker);
    });
    
    // Устанавливаем начальный масштаб
    updateScales();
    
    // Подписываемся на изменение zoom
    map.current.on('zoom', updateScales);

    return () => {
      if (map.current) {
        map.current.off('zoom', updateScales);
      }
      whiteCityLabelsRef.current.forEach(label => label.remove());
      whiteCityLabelsRef.current = [];
    };
  }, [showCityLabels, CITIES_WITHOUT_SHOPS_VISUAL]);

  // Отдельный эффект для обработки кликов на карту
  useEffect(() => {
    if (!map.current) return;

    const handleMapClick = (e: any) => {
      if (isSelectingLocation) {
        const { lng, lat } = e.lngLat;
        setUserLocation([lng, lat]);
        
        // Удаляем старый маркер пользователя
        if (userMarker.current) {
          userMarker.current.remove();
        }

        // Создаем новый маркер
        const el = document.createElement('div');
        el.className = 'user-marker';
        el.innerHTML = `
          <div style="position: relative; width: 30px; height: 30px;">
            <div style="position: absolute; width: 30px; height: 30px; background: #f0f8ff; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #f0f8ff; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #f0f8ff;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
          <style>
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 0.3; }
              50% { transform: scale(2); opacity: 0; }
            }
          </style>
        `;
        
        userMarker.current = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map.current!);

        setIsSelectingLocation(false);
      } else if (selectedShop || popupShop) {
        // Если есть выбранный магазин или открыт popup, сбрасываем маршрут
        resetRoute();
      }
    };

    map.current.on('click', handleMapClick);

    // Изменяем курсор при режиме выбора
    map.current.getCanvas().style.cursor = isSelectingLocation ? 'crosshair' : '';

    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [isSelectingLocation, selectedShop, popupShop]);

  // Загрузка категорий при выборе города
  useEffect(() => {
    if (!selectedCity) return;
    
    // Извлекаем уникальные категории из магазинов
    const uniqueCategories = Array.from(new Set(shops.map(shop => shop.category).filter(Boolean)));
    setCategories(uniqueCategories.sort());
  }, [shops, selectedCity]);

  // Фильтрация магазинов по городу и категории
  const cityShops = shops.filter(shop => shop.city === selectedCity?.name);
  const filteredShops = selectedCategory 
    ? cityShops.filter(shop => shop.category === selectedCategory)
    : cityShops;

  // Сбрасываем выбранный магазин если он не в текущей категории
  useEffect(() => {
    if (selectedShop && selectedCategory) {
      const shopInCategory = filteredShops.find(s => s.id === selectedShop.id);
      if (!shopInCategory) {
        setSelectedShop(null);
        resetRoute();
      }
    }
  }, [selectedCategory, filteredShops]);

  useEffect(() => {
    if (!map.current || filteredShops.length === 0) return;

    // Удаление старых маркеров
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Кластеризация магазинов по координатам
    const clusters = new Map<string, Shop[]>();
    const clusterRadius = 0.0005; // ~50 метров

    filteredShops.forEach(shop => {
      let foundCluster = false;
      
      for (const [key, cluster] of clusters.entries()) {
        const [clusterLat, clusterLng] = key.split(',').map(Number);
        const dist = Math.hypot(shop.lat - clusterLat, shop.lng - clusterLng);
        
        if (dist < clusterRadius) {
          cluster.push(shop);
          foundCluster = true;
          break;
        }
      }
      
      if (!foundCluster) {
        clusters.set(`${shop.lat},${shop.lng}`, [shop]);
      }
    });

    // Добавление маркеров для кластеров
    clusters.forEach((clusterShops, key) => {
      const [lat, lng] = key.split(',').map(Number);
      
      if (clusterShops.length === 1) {
        // Одиночный магазин
        const shop = clusterShops[0];
        
        const el = document.createElement('div');
        el.className = 'map-marker';
        el.setAttribute('data-shop-id', shop.id.toString());
        el.innerHTML = `
          <div style="
            position: absolute;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: #f0f8ff;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid white;
            white-space: nowrap;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 0 15px rgba(240, 248, 255, 0.5);
            pointer-events: none;
          ">
            ${shop.name}
          </div>
          <div class="map-marker__glow"></div>
          <div class="map-marker__dot" style="background: rgba(240, 248, 255, ${shop.activity || 0.7}); box-shadow: 0 0 15px rgba(240, 248, 255, ${shop.activity || 0.7})"></div>
          <div class="map-marker__pulse"></div>
        `;
        
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          
          // Центрируем камеру на магазине
          if (map.current) {
            map.current.flyTo({
              center: [shop.lng, shop.lat],
              zoom: 15,
              duration: 1000
            });
          }
          
          // Используем ref для получения актуального значения
          const currentLocation = userLocationRef.current;
          if (!currentLocation) {
            alert('Сначала укажите ваше местоположение на карте');
            return;
          }
          
          // Сразу прокладываем маршрут с актуальным местоположением
          setSelectedShop(shop);
          await showRouteToShop(shop, currentLocation);
          
          // Показываем popup с карточкой магазина
          const point = map.current!.project([shop.lng, shop.lat]);
          setPopupPosition({ x: point.x, y: point.y });
          setPopupShop(shop);
        });

        const marker = new maplibregl.Marker({ 
          element: el,
          anchor: 'center',
          offset: [0, 0]
        })
          .setLngLat([shop.lng, shop.lat])
          .addTo(map.current!);

        markers.current.push(marker);
      } else {
        // Кластер из нескольких магазинов
        const el = document.createElement('div');
        el.className = 'map-marker map-marker--cluster';
        // Добавляем все ID магазинов из кластера через запятую
        el.setAttribute('data-shop-id', clusterShops.map(s => s.id).join(','));
        el.innerHTML = `
          <div class="map-marker__cluster-bg"></div>
          <div class="map-marker__cluster-count">${clusterShops.length}</div>
          <div class="map-marker__pulse"></div>
        `;
        
        el.addEventListener('click', async (e) => {
          e.stopPropagation();
          
          // Центрируем камеру на кластере
          if (map.current) {
            map.current.flyTo({
              center: [lng, lat],
              zoom: 15,
              duration: 1000
            });
          }
          
          const currentLocation = userLocationRef.current;
          if (!currentLocation) {
            // Если нет местоположения - просто показываем список
            setClusterShops(clusterShops);
            return;
          }
          
          // Находим ближайший магазин из кластера
          let nearestShop = clusterShops[0];
          let minDistance = Math.hypot(
            nearestShop.lat - currentLocation[1],
            nearestShop.lng - currentLocation[0]
          );
          
          clusterShops.forEach(shop => {
            const distance = Math.hypot(
              shop.lat - currentLocation[1],
              shop.lng - currentLocation[0]
            );
            if (distance < minDistance) {
              minDistance = distance;
              nearestShop = shop;
            }
          });
          
          // Строим маршрут к ближайшему
          setSelectedShop(nearestShop);
          await showRouteToShop(nearestShop, currentLocation);
          
          // И показываем список для выбора другого
          setClusterShops(clusterShops);
        });

        const marker = new maplibregl.Marker({ 
          element: el,
          anchor: 'center',
          offset: [0, 0]
        })
          .setLngLat([lng, lat])
          .addTo(map.current!);

        markers.current.push(marker);
      }
    });

    // НЕ изменяем масштаб карты автоматически - пользователь сам управляет камерой
  }, [filteredShops, onShopClick]);

  // Отдельный useEffect для применения затемнения при выборе магазина
  useEffect(() => {
    if (!selectedShop) return;
    
    // Задержка чтобы маркеры успели пересоздаться после смены категории
    const timer = setTimeout(() => {
      console.log('Применяем затемнение в useEffect');
      // Применяем затемнение к маркерам
      const allMarkers = document.querySelectorAll('.map-marker');
      console.log('Найдено маркеров:', allMarkers.length);
      console.log('ID выбранного магазина:', selectedShop.id);
      
      allMarkers.forEach((marker) => {
        const markerShopId = marker.getAttribute('data-shop-id');
        const shopIds = markerShopId?.split(',') || [];
        const containsSelectedShop = shopIds.includes(selectedShop.id.toString());
        
        console.log(`Маркер ${markerShopId}: ${containsSelectedShop ? 'НЕ затемняем' : 'затемняем'}`);
        
        if (!containsSelectedShop) {
          (marker as HTMLElement).style.opacity = '0.1';
        } else {
          (marker as HTMLElement).style.opacity = '1';
        }
      });
    }, 150); // Увеличил задержку до 150мс
    
    return () => clearTimeout(timer);
  }, [selectedShop, filteredShops]);

  return (
    <>
      <div ref={mapContainer} className="map-view" />
      
      {/* Индикатор зума */}
      <div style={{
        position: 'absolute',
        top: '140px',
        right: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#00ff88',
        padding: '8px 12px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px',
        fontWeight: 'bold',
        border: '1px solid #00ff88',
        boxShadow: '0 0 10px rgba(0, 255, 136, 0.3)',
        zIndex: 1000,
        pointerEvents: 'none',
        userSelect: 'none'
      }}>
        Zoom: {currentZoom.toFixed(1)}
      </div>
      
      {/* Оверлей для анимации появления карты */}
      <canvas 
        ref={pixelOverlayRef} 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10000
        }}
      />
      
      {/* Фильтр категорий */}
      {categories.length > 0 && !selectedShop && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 1000
        }}>
          <select
            value={selectedCategory || ''}
            onChange={(e) => {
              const target = e.target as HTMLSelectElement;
              const value = target.value || null;
              if (onCategoryChange) {
                onCategoryChange(value);
              }
            }}
            style={{
              padding: '12px 16px',
              background: 'rgba(10, 10, 26, 0.95)',
              border: '2px solid rgba(204, 102, 0, 0.5)',
              borderRadius: '8px',
              color: '#ff8c00',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(204, 102, 0, 0.3)',
              outline: 'none',
              minWidth: '200px'
            }}
          >
            <option value="">🏷️ Все категории</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      )}
      
      {/* Кнопка выбора местоположения вручную - всегда доступна */}
      {!selectedShop && !isSelectingLocation && (
        <button 
          className="select-location-btn"
          onClick={() => setIsSelectingLocation(true)}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            padding: '12px 20px',
            background: userLocation ? 'rgba(240, 248, 255, 0.9)' : 'rgba(255, 140, 0, 0.9)',
            border: 'none',
            borderRadius: '8px',
            color: userLocation ? '#000' : '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: userLocation 
              ? '0 0 20px rgba(240, 248, 255, 0.5)' 
              : '0 0 20px rgba(255, 140, 0, 0.5)'
          }}
        >
          {userLocation ? '📍 Изменить местоположение' : '📍 Указать моё местоположение'}
        </button>
      )}

      {/* Кнопка возврата к местоположению */}
      {userLocation && !isSelectingLocation && (
        <button 
          className="fly-to-location-btn"
          onClick={flyToUserLocation}
          style={{
            position: 'absolute',
            top: '80px',
            left: '20px',
            padding: '12px 20px',
            background: 'rgba(240, 248, 255, 0.9)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(240, 248, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🎯 Моё местоположение
        </button>
      )}

      {/* Подсказка при выборе местоположения */}
      {isSelectingLocation && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            background: 'rgba(240, 248, 255, 0.95)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(240, 248, 255, 0.5)',
            textAlign: 'center'
          }}
        >
          👆 Нажмите на карту, чтобы указать ваше местоположение
          <button
            onClick={() => setIsSelectingLocation(false)}
            style={{
              marginLeft: '15px',
              padding: '4px 12px',
              background: '#000',
              color: '#f0f8ff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Отмена
          </button>
        </div>
      )}
      
      {/* Кнопка сброса маршрута */}
      {selectedShop && (
        <button 
          className="reset-route-btn"
          onClick={resetRoute}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            padding: '12px 20px',
            background: 'rgba(240, 248, 255, 0.9)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(240, 248, 255, 0.5)'
          }}
        >
          ← Показать все дороги
        </button>
      )}

      {/* Кнопка выбора города */}
      {!selectedShop && !isSelectingLocation && selectedCity && (
        <button 
          className="city-selector-btn"
          onClick={() => setShowCitySelector(true)}
          style={{
            position: 'absolute',
            top: '80px',
            right: '20px',
            padding: '12px 20px',
            background: 'rgba(240, 248, 255, 0.9)',
            border: '2px solid white',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(240, 248, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🏙️ {selectedCity.name}
        </button>
      )}
      
      {/* Эхо-волна визуализация (полукруг для прямого импульса, круг для обратного) */}
      {echoWave && (
        <div
          style={{
            position: 'absolute',
            left: `${echoWave.x}px`,
            top: `${echoWave.y}px`,
            pointerEvents: 'none',
            zIndex: 1500,
            transform: `rotate(${echoWave.angle}rad)`
          }}
        >
          {/* Основной круг/полукруг */}
          <div
            style={{
              position: 'absolute',
              width: `${echoWave.radius * 2}px`,
              height: `${echoWave.radius * 2}px`,
              marginLeft: `-${echoWave.radius}px`,
              marginTop: `-${echoWave.radius}px`,
              borderRadius: '50%',
              border: '5px solid white',
              boxShadow: '0 0 40px #f0f8ff, inset 0 0 40px rgba(240, 248, 255, 0.3)',
              opacity: echoWave.opacity ?? 0.7,
              // Если angle === 0, показываем полный круг (обратный импульс), иначе полукруг
              clipPath: echoWave.angle === 0 ? 'none' : 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%)'
            }}
          />
          {/* Второй круг/полукруг с задержкой */}
          <div
            style={{
              position: 'absolute',
              width: `${Math.max(0, echoWave.radius * 2 - 30)}px`,
              height: `${Math.max(0, echoWave.radius * 2 - 30)}px`,
              marginLeft: `-${Math.max(0, echoWave.radius - 15)}px`,
              marginTop: `-${Math.max(0, echoWave.radius - 15)}px`,
              borderRadius: '50%',
              border: '4px solid #ff8c00',
              boxShadow: '0 0 30px #ff8c00',
              opacity: (echoWave.opacity ?? 0.7) * 0.85,
              clipPath: echoWave.angle === 0 ? 'none' : 'polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%)'
            }}
          />
          {/* Лучи эхолокации (только для направленного импульса) */}
          {echoWave.angle !== 0 && (
            <>
              <div
                style={{
                  position: 'absolute',
                  width: `${echoWave.radius}px`,
                  height: '3px',
                  marginTop: '-1.5px',
                  background: 'linear-gradient(to right, #f0f8ff, transparent)',
                  boxShadow: '0 0 15px #f0f8ff',
                  opacity: 0.8
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: `${echoWave.radius}px`,
                  height: '2px',
                  marginTop: '-1px',
                  background: 'linear-gradient(to right, #f0f8ff, transparent)',
                  boxShadow: '0 0 10px #f0f8ff',
                  opacity: 0.6,
                  transform: 'rotate(30deg)',
                  transformOrigin: 'left center'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: `${echoWave.radius}px`,
                  height: '2px',
                  marginTop: '-1px',
                  background: 'linear-gradient(to right, #f0f8ff, transparent)',
                  boxShadow: '0 0 10px #f0f8ff',
                  opacity: 0.6,
                  transform: 'rotate(-30deg)',
                  transformOrigin: 'left center'
                }}
              />
            </>
          )}
          {/* Центральная точка излучения */}
          <div
            style={{
              position: 'absolute',
              width: '25px',
              height: '25px',
              marginLeft: '-12.5px',
              marginTop: '-12.5px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #f0f8ff, rgba(240, 248, 255, 0))',
              boxShadow: '0 0 40px #f0f8ff',
              animation: 'echoPulse 0.4s ease-in-out infinite'
            }}
          />
          <style>{`
            @keyframes echoPulse {
              0%, 100% {
                transform: scale(1);
                opacity: 1;
              }
              50% {
                transform: scale(1.4);
                opacity: 0.6;
              }
            }
          `}</style>
        </div>
      )}
      
      {/* Popup карточка магазина */}
      {popupShop && popupPosition && (
        <>
          {/* Убрали оверлей - теперь можно управлять камерой при открытом popup */}
          <div
            className="shop-popup"
            style={{
              position: 'absolute',
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y - 380}px`,
              transform: 'translateX(-50%)',
              background: 'rgba(30, 30, 30, 0.95)',
              border: '2px solid white',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '250px',
              zIndex: 2000,
              boxShadow: '0 0 30px rgba(240, 248, 255, 0.5)',
              backdropFilter: 'blur(10px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
          <button
            onClick={() => {
              setPopupShop(null);
              setPopupPosition(null);
              // Вызываем resetRoute для возврата к виду всех магазинов
              resetRoute();
            }}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'transparent',
              border: 'none',
              color: '#f0f8ff',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px',
              lineHeight: '24px'
            }}
          >
            ×
          </button>
          
          {popupShop.photo_url && (
            <div style={{
              width: '100%',
              height: '150px',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '12px',
              border: '2px solid white',
              boxShadow: '0 0 15px rgba(255, 255, 255, 0.3)'
            }}>
              <img 
                src={`https://raw.githubusercontent.com/metakross0-sketch/chronosphere_app/main/images/${popupShop.photo_url}`}
                alt={popupShop.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
          )}
          
          <h3 style={{ 
            color: '#f0f8ff', 
            margin: '0 0 8px 0',
            fontSize: '18px',
            paddingRight: '24px'
          }}>
            {popupShop.name}
          </h3>
          
          {popupShop.city && (
            <div style={{ 
              color: '#aaa', 
              marginBottom: '12px',
              fontSize: '14px'
            }}>
              📍 {popupShop.city}
            </div>
          )}
          
          <button
            onClick={() => {
              hapticFeedback('light');
              // Останавливаем анимацию пульсации
              if (shopPulseAnimationId.current !== null) {
                cancelAnimationFrame(shopPulseAnimationId.current);
                shopPulseAnimationId.current = null;
              }
              
              // Убираем эхо
              setEchoWave(null);
              
              // Закрываем popup
              setPopupShop(null);
              setPopupPosition(null);
              
              // Вызываем onShopClick для открытия каталога
              onShopClick?.(popupShop);
            }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #ff8c00, #cc6600)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '16px',
              boxShadow: '0 4px 15px rgba(255, 140, 0, 0.4)',
              transition: 'all 0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 140, 0, 0.6)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(255, 140, 0, 0.4)';
            }}
          >
            🚀 Открыть
          </button>
        </div>
        </>
      )}
      
      {clusterShops && (
        <div className="cluster-modal" onClick={() => setClusterShops(null)}>
          <div className="cluster-modal__content" onClick={(e) => e.stopPropagation()}>
            <div className="cluster-modal__header">
              <button className="cluster-modal__back" onClick={() => setClusterShops(null)}>←</button>
              <h3>Магазины ({clusterShops.length})</h3>
              <div style="width: 40px"></div>
            </div>
            <div className="cluster-modal__shops">
              {clusterShops.map((shop) => {
                const photoUrl = shop.photo_url 
                  ? `https://raw.githubusercontent.com/metakross0-sketch/chronosphere_app/main/images/${shop.photo_url}`
                  : null;
                
                return (
                  <div 
                    key={shop.id} 
                    className="cluster-shop-card"
                    onClick={async () => {
                      hapticFeedback('medium');
                      const currentLocation = userLocationRef.current;
                      if (!currentLocation) {
                        hapticFeedback('error');
                        alert('Сначала укажите ваше местоположение на карте');
                        return;
                      }
                      setClusterShops(null);
                      setSelectedShop(shop);
                      hapticFeedback('success');
                      await showRouteToShop(shop, currentLocation);
                    }}
                  >
                    {photoUrl && (
                      <div className="cluster-shop-card__photo">
                        <img src={photoUrl} alt={shop.name} />
                      </div>
                    )}
                    <div className="cluster-shop-card__info">
                      <h3>{shop.name}</h3>
                      {shop.city && <div className="cluster-shop-card__city">{shop.city}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Модал выбора города */}
      {showCitySelector && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowCitySelector(false)}
        >
          <div
            style={{
              background: 'rgba(10, 10, 26, 0.98)',
              border: '2px solid white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 0 40px rgba(240, 248, 255, 0.4)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ color: '#f0f8ff', margin: 0 }}>Выберите город</h2>
              <button
                onClick={() => setShowCitySelector(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f0f8ff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cities.filter(city => typeof city.shops === 'number' && city.shops > 0).map(city => {
                const shopCount = typeof city.shops === 'number' ? city.shops : 0;
                return (
                <button
                  key={city.name}
                  onClick={() => {
                    console.log(`🗺️ Выбор города через модальное окно: ${city.name}, текущий: ${selectedCity?.name}`);
                    setShowCitySelector(false);
                    
                    // Сбрасываем категорию
                    if (onCategoryChange) {
                      onCategoryChange(null);
                    }
                    
                    // Зумим к городу
                    if (map.current) {
                      // Устанавливаем флаг перед программным переходом
                      skipAutoLoadRef.current = true;
                      
                      map.current.flyTo({
                        center: [city.lng, city.lat],
                        zoom: 12,
                        duration: 2000
                      });
                      
                      // Устанавливаем отложенную загрузку ПОСЛЕ окончания анимации
                      pendingCityLoadRef.current = city;
                      console.log(`🗺️ Отложенная загрузка установлена для ${city.name} (модальное окно)`);
                    }
                  }}
                  style={{
                    background: selectedCity?.name === city.name 
                      ? 'rgba(240, 248, 255, 0.2)' 
                      : 'rgba(240, 248, 255, 0.05)',
                    border: '2px solid ' + (selectedCity?.name === city.name ? 'white' : 'rgba(255, 255, 255, 0.3)'),
                    borderRadius: '12px',
                    padding: '16px 20px',
                    color: '#f0f8ff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s',
                    fontWeight: selectedCity?.name === city.name ? 'bold' : 'normal'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(240, 248, 255, 0.15)';
                    e.currentTarget.style.transform = 'translateX(5px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = selectedCity?.name === city.name 
                      ? 'rgba(240, 248, 255, 0.2)' 
                      : 'rgba(240, 248, 255, 0.05)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{ fontSize: '18px', marginBottom: '4px' }}>
                    🏙️ {city.name}
                  </div>
                  <div style={{ fontSize: '14px', color: '#aaa' }}>
                    {shopCount} {shopCount === 1 ? 'магазин' : shopCount < 5 ? 'магазина' : 'магазинов'}
                  </div>
                </button>
              )})}
            </div>
          </div>
        </div>
      )}
    </>
  );
}