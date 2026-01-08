import { useRef, useEffect, useState } from 'preact/hooks';
import { useMapStore } from '../store/mapStore';
import type { Shop } from '../types';

interface NeuralMapProps {
  onShopClick?: (shop: Shop) => void;
  activationWave?: boolean;
}

export function NeuralMap({ onShopClick, activationWave = false }: NeuralMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { shops, pulseOrigin, selectedCity, triggerPulse } = useMapStore();
  const [scale, setScale] = useState(3000);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [waveProgress, setWaveProgress] = useState(0);

  useEffect(() => {
    if (activationWave && waveProgress < 100) {
      const timer = setTimeout(() => {
        setWaveProgress(prev => Math.min(prev + 1.5, 100));
      }, 20);
      return () => clearTimeout(timer);
    }
  }, [activationWave, waveProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedCity) return;

    const ctx = canvas.getContext('2d', { alpha: false })!; // Отключаем альфа-канал для производительности
    const dpr = window.devicePixelRatio || 1;
    
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    
    resize();
    
    let resizeTimeout: number;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(resize, 150);
    };
    
    window.addEventListener('resize', debouncedResize);

    let animationId: number;
    let time = 0;
    let lastFrame = 0;
    const fps = 30; // Ограничиваем FPS для экономии ресурсов
    const frameInterval = 1000 / fps;

    // Преобразование координат
    const latLngToScreen = (lat: number, lng: number) => {
      const centerLat = selectedCity.lat;
      const centerLng = selectedCity.lng;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      
      const x = w / 2 + (lng - centerLng) * scale + offsetX;
      const y = h / 2 - (lat - centerLat) * scale + offsetY;
      
      return { x, y };
    };

    // Zoom (колесико мыши)
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.max(500, Math.min(10000, s * delta)));
    };

    // Pan (перетаскивание)
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      setOffsetX(ox => ox + dx);
      setOffsetY(oy => oy + dy);
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    // Обработка кликов на магазины
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (isDragging) return; // Не кликать при перетаскивании
      
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      for (const shop of shops) {
        const { x, y } = latLngToScreen(shop.lat, shop.lng);
        const dist = Math.hypot(clickX - x, clickY - y);
        if (dist < 30) { // Увеличенный радиус
          triggerPulse(shop);
          onShopClick?.(shop); // Вызываем callback
          break;
        }
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('click', handleClick);

    const render = (timestamp: number = 0) => {
      // Ограничение FPS
      const elapsed = timestamp - lastFrame;
      if (elapsed < frameInterval) {
        animationId = requestAnimationFrame(render);
        return;
      }
      lastFrame = timestamp;

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Очистка
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // Фоновая сетка (оптимизирована - рисуем одним строком)
      ctx.strokeStyle = 'rgba(240, 248, 255, 0.03)';
      ctx.lineWidth = 0.5;
      const gridSize = 50;
      ctx.beginPath();
      for (let x = 0; x < w; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      if (shops.length === 0) {
        ctx.fillStyle = '#0ff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Загрузка магазинов...', w / 2, h / 2);
        animationId = requestAnimationFrame(render);
        return;
      }

      // Отрисовка связей (нейронная сеть)
      ctx.strokeStyle = 'rgba(240, 248, 255, 0.2)';
      ctx.lineWidth = 1.5;
      
      shops.forEach((shop, i) => {
        const pos1 = latLngToScreen(shop.lat, shop.lng);
        
        shops.slice(i + 1).forEach(other => {
          const dist = Math.hypot(shop.lat - other.lat, shop.lng - other.lng);
          if (dist < 0.05) { // Связи до 5км
            const pos2 = latLngToScreen(other.lat, other.lng);
            
            // Градиент для связи
            const gradient = ctx.createLinearGradient(pos1.x, pos1.y, pos2.x, pos2.y);
            gradient.addColorStop(0, `rgba(240, 248, 255, ${0.3 * (shop.activity || 0.5)})`);
            gradient.addColorStop(1, `rgba(240, 248, 255, ${0.3 * (other.activity || 0.5)})`);
            
            ctx.strokeStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.stroke();
          }
        });
      });
      
      // Дополнительные слабые связи между всеми магазинами
      if (shops.length > 1) {
        ctx.strokeStyle = 'rgba(240, 248, 255, 0.05)';
        ctx.lineWidth = 0.5;
        shops.forEach((shop, i) => {
          const pos1 = latLngToScreen(shop.lat, shop.lng);
          if (i < shops.length - 1) {
            const next = shops[i + 1];
            const pos2 = latLngToScreen(next.lat, next.lng);
            ctx.beginPath();
            ctx.moveTo(pos1.x, pos1.y);
            ctx.lineTo(pos2.x, pos2.y);
            ctx.stroke();
          }
        });
      }

      // Отрисовка нейронов
      shops.forEach(shop => {
        const { x, y } = latLngToScreen(shop.lat, shop.lng);
        const activity = shop.activity || 0.5;
        
        // Ядро
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 248, 255, ${activity})`;
        ctx.fill();
        
        // Обводка
        ctx.strokeStyle = `rgba(240, 248, 255, 0.8)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Название при приближении
        if (scale > 5000) {
          ctx.fillStyle = 'rgba(240, 248, 255, 0.7)';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(shop.name, x, y - 12);
        }
        
        // Пульсация при клике
        if (pulseOrigin?.id === shop.id) {
          const pulse = (Math.sin(time * 5) + 1) / 2;
          ctx.beginPath();
          ctx.arc(x, y, 8 + pulse * 25, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(240, 248, 255, ${(1 - pulse) * 0.8})`;
          ctx.lineWidth = 3;
          ctx.stroke();
          
          // Название магазина при клике
          ctx.fillStyle = '#0ff';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(shop.name, x, y + 35);
        }
      });

      // UI
      ctx.fillStyle = '#0ff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(selectedCity.name, 20, 40);
      
      ctx.font = '14px sans-serif';
      ctx.fillStyle = 'rgba(240, 248, 255, 0.7)';
      ctx.fillText(`Нейронов: ${shops.length}`, 20, 65);
      ctx.fillText(`Zoom: ${Math.round(scale)}`, 20, 85);

      time += 0.016;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResize);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('click', handleClick);
    };
  }, [shops, pulseOrigin, selectedCity, scale, offsetX, offsetY]);

  return <canvas ref={canvasRef} />;
}
