import { useRef, useEffect, useState } from 'preact/hooks';
import { useMapStore } from '../store/mapStore';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Shop } from '../types';
import { neonRoadsStyle } from '../styles/neon-roads-style';

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
  const routeSource = useRef<string | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);
  const shopPulseAnimationId = useRef<number | null>(null);
  const { shops, selectedCity } = useMapStore();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [clusterShops, setClusterShops] = useState<Shop[] | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [popupShop, setPopupShop] = useState<Shop | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [echoWave, setEchoWave] = useState<{ x: number; y: number; radius: number; angle: number; opacity?: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<number[][] | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(true);

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
      setRouteCoordinates(coordinates);

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

      // Центральная вена маршрута (циан) - начинаем невидимой
      map.current.addLayer({
        id: 'route-vein',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#00ffff',
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
            <div style="position: absolute; width: 30px; height: 30px; background: #00ffff; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #00ffff; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #00ffff;"></div>
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
  const animateEchoAndRoute = (coordinates: number[][], startLocation: [number, number], targetShop: Shop) => {
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
  const animateShopResponse = (startLocation: [number, number], targetShop: Shop) => {
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
    setRouteCoordinates(null);

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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.longitude, position.coords.latitude]);
        },
        (error) => {
          console.log('Геолокация недоступна:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !selectedCity) return;

    // Скрываем карту до начала анимации
    if (mapContainer.current) {
      mapContainer.current.style.opacity = '0';
    }

    // Инициализация карты с неоновыми оранжевыми дорогами
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: neonRoadsStyle as any,
      center: [selectedCity.lng, selectedCity.lat],
      zoom: 12,
      attributionControl: false
    });

    // Анимация появления карты из квадратиков
    map.current.on('load', () => {
      setIsMapLoading(false);
      
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

    // Добавление контролов
    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, [selectedCity]);

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
            <div style="position: absolute; width: 30px; height: 30px; background: #00ffff; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #00ffff; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #00ffff;"></div>
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

  // Фильтрация магазинов по категории
  const filteredShops = selectedCategory 
    ? shops.filter(shop => shop.category === selectedCategory)
    : shops;

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
            color: #00ffff;
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid #00ffff;
            white-space: nowrap;
            font-size: 12px;
            font-weight: bold;
            box-shadow: 0 0 15px rgba(0, 255, 255, 0.5);
            pointer-events: none;
          ">
            ${shop.name}
          </div>
          <div class="map-marker__glow"></div>
          <div class="map-marker__dot" style="background: rgba(0, 255, 255, ${shop.activity || 0.7}); box-shadow: 0 0 15px rgba(0, 255, 255, ${shop.activity || 0.7})"></div>
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
          const rect = mapContainer.current!.getBoundingClientRect();
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
            background: userLocation ? 'rgba(0, 255, 255, 0.9)' : 'rgba(255, 140, 0, 0.9)',
            border: 'none',
            borderRadius: '8px',
            color: userLocation ? '#000' : '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: userLocation 
              ? '0 0 20px rgba(0, 255, 255, 0.5)' 
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
            background: 'rgba(0, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)',
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
            background: 'rgba(0, 255, 255, 0.95)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)',
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
              color: '#00ffff',
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
            background: 'rgba(0, 255, 255, 0.9)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 1000,
            boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)'
          }}
        >
          ← Показать все дороги
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
              border: '5px solid #00ffff',
              boxShadow: '0 0 40px #00ffff, inset 0 0 40px rgba(0, 255, 255, 0.3)',
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
                  background: 'linear-gradient(to right, #00ffff, transparent)',
                  boxShadow: '0 0 15px #00ffff',
                  opacity: 0.8
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: `${echoWave.radius}px`,
                  height: '2px',
                  marginTop: '-1px',
                  background: 'linear-gradient(to right, #00ffff, transparent)',
                  boxShadow: '0 0 10px #00ffff',
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
                  background: 'linear-gradient(to right, #00ffff, transparent)',
                  boxShadow: '0 0 10px #00ffff',
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
              background: 'radial-gradient(circle, #00ffff, rgba(0, 255, 255, 0))',
              boxShadow: '0 0 40px #00ffff',
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
              border: '2px solid #00ffff',
              borderRadius: '12px',
              padding: '16px',
              minWidth: '250px',
              zIndex: 2000,
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.5)',
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
              color: '#00ffff',
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
              border: '2px solid #00ffff',
              boxShadow: '0 0 15px rgba(0, 255, 255, 0.3)'
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
            color: '#00ffff', 
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
                      const currentLocation = userLocationRef.current;
                      if (!currentLocation) {
                        alert('Сначала укажите ваше местоположение на карте');
                        return;
                      }
                      setClusterShops(null);
                      setSelectedShop(shop);
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
    </>
  );
}