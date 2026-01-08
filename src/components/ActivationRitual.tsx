import { useEffect, useState, useRef } from 'preact/hooks';

interface ActivationRitualProps {
  onActivate: () => void;
}

export function ActivationRitual({ onActivate }: ActivationRitualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const onActivateRef = useRef(onActivate);
  
  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Оптимизация: отключаем альфа-канал
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Генерация квадратиков-пикселей для эффекта "пазла" (КЭШИРУЕМ результат)
    const pixelSize = 20;
    const pixels: { x: number; y: number; delay: number }[] = [];
    
    for (let y = 0; y < canvas.height; y += pixelSize) {
      for (let x = 0; x < canvas.width; x += pixelSize) {
        pixels.push({
          x,
          y,
          delay: Math.random() * 800 // Случайная задержка от 0 до 800мс
        });
      }
    }

    let startTime = Date.now();
    let lastFrame = 0;
    const fps = 60;
    const frameInterval = 1000 / fps;
    let animationId: number;

    const animate = (timestamp: number) => {
      // Ограничение FPS для экономии ресурсов
      const elapsed = timestamp - lastFrame;
      if (elapsed < frameInterval) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastFrame = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const elapsedTime = Date.now() - startTime;

      if (!isActivating) {
        // Анимация появления - квадратики исчезают, открывая контент
        let visibleCount = 0;
        for (let i = 0; i < pixels.length; i++) {
          const pixel = pixels[i];
          if (elapsedTime < pixel.delay) {
            // Квадратик еще не исчез - рисуем его
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
            visibleCount++;
          }
        }

        // Останавливаем анимацию когда все пиксели исчезли
        if (visibleCount === 0 && elapsedTime > 800) {
          if (!showPrompt) setShowPrompt(true);
          return; // Прекращаем анимацию
        }

        if (elapsedTime > 1000 && !showPrompt) {
          setShowPrompt(true);
        }
      } else {
        // Анимация закрытия - квадратики появляются, закрывая контент
        for (let i = 0; i < pixels.length; i++) {
          const pixel = pixels[i];
          if (elapsedTime > pixel.delay) {
            // Квадратик уже появился - рисуем его
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
          }
        }

        if (elapsedTime > 400) {
          onActivateRef.current();
          return;
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    let resizeTimeout: number;
    const handleResize = () => {
      // Debounce resize для производительности
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }, 150);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      clearTimeout(resizeTimeout);
    };
  }, [isActivating]);

  const handleClick = () => {
    if (!isActivating) {
      setIsActivating(true);
      setShowPrompt(false);
    }
  };

  return (
    <div 
      onClick={handleClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        cursor: showPrompt && !isActivating ? 'pointer' : 'default',
        background: '#0a0a1a'
      }}
    >
      {/* Отпечаток пальца - обычный SVG */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '200px',
        height: '300px',
        zIndex: 101
      }}>
        <svg viewBox="0 0 200 300" style={{ width: '100%', height: '100%' }}>
          {/* Упрощенный паттерн отпечатка пальца */}
          <ellipse cx="100" cy="150" rx="80" ry="120" fill="none" stroke="#ff8c00" strokeWidth="3" opacity="0.8" />
          <ellipse cx="100" cy="150" rx="65" ry="100" fill="none" stroke="#ff8c00" strokeWidth="3" opacity="0.7" />
          <ellipse cx="100" cy="150" rx="50" ry="80" fill="none" stroke="#ff8c00" strokeWidth="3" opacity="0.6" />
          <ellipse cx="100" cy="150" rx="35" ry="60" fill="none" stroke="#ff8c00" strokeWidth="3" opacity="0.5" />
          <ellipse cx="100" cy="150" rx="20" ry="40" fill="none" stroke="#ff8c00" strokeWidth="3" opacity="0.4" />
          
          {/* Пульсация */}
          <ellipse cx="100" cy="150" rx="80" ry="120" fill="none" stroke="#ff8c00" strokeWidth="2" opacity="0.5">
            <animate attributeName="rx" values="80;90;80" dur="2s" repeatCount="indefinite" />
            <animate attributeName="ry" values="120;135;120" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.8;0.5" dur="2s" repeatCount="indefinite" />
          </ellipse>
        </svg>
      </div>
      
      {showPrompt && !isActivating && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#ff8c00',
          fontSize: '18px',
          fontWeight: 'bold',
          textAlign: 'center',
          animation: 'pulse 2s infinite',
          textShadow: '0 0 20px rgba(255, 140, 0, 0.5)',
          zIndex: 101
        }}>
          Нажмите для активации
        </div>
      )}
      
      {/* Canvas-маска для эффекта появления */}
      <canvas 
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 100
        }}
      />

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
