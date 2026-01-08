import { useEffect, useRef } from 'preact/hooks';

export function LoadingScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Генерация пикселей для эффекта появления
    const pixelSize = 20;
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

    let startTime = Date.now();
    let lastFrame = 0;
    const fps = 60;
    const frameInterval = 1000 / fps;
    let animationId: number;

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastFrame;
      if (elapsed < frameInterval) {
        animationId = requestAnimationFrame(animate);
        return;
      }
      lastFrame = timestamp;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const elapsedTime = Date.now() - startTime;

      // Анимация исчезновения пикселей
      let visibleCount = 0;
      for (let i = 0; i < pixels.length; i++) {
        const pixel = pixels[i];
        if (elapsedTime < pixel.delay) {
          ctx.fillStyle = '#0a0a1a';
          ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
          visibleCount++;
        }
      }

      // Останавливаем когда все пиксели исчезли
      if (visibleCount === 0 && elapsedTime > 800) {
        return;
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    let resizeTimeout: number;
    const handleResize = () => {
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
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#0a0a1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      {/* Логотип с анимированными квадратиками */}
      <div style={{
        position: 'relative',
        zIndex: 101,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Анимированные квадратики вокруг логотипа */}
        <div style={{
          position: 'absolute',
          width: '280px',
          height: '280px',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: 'repeat(12, 1fr)',
          gap: '8px'
        }}>
          {Array.from({ length: 44 }, (_, i) => {
            // Только периметр: верхний ряд, нижний ряд, левый столбец, правый столбец
            const isTop = i < 12;
            const isBottom = i >= 32 && i < 44;
            const isLeft = i >= 12 && i < 32 && i % 2 === 0;
            const isRight = i >= 12 && i < 32 && i % 2 === 1;
            
            if (!isTop && !isBottom && !isLeft && !isRight) return null;
            
            const row = isTop ? 0 : isBottom ? 11 : Math.floor((i - 12) / 2) + 1;
            const col = isTop ? i : isBottom ? (i - 32) : isLeft ? 0 : 11;
            
            return (
              <div
                key={i}
                style={{
                  gridRow: row + 1,
                  gridColumn: col + 1,
                  width: '12px',
                  height: '12px',
                  backgroundColor: '#ffffff',
                  opacity: 0,
                  borderRadius: '2px',
                  animation: `loadSquare 2s infinite`,
                  animationDelay: `${i * 0.05}s`
                }}
              />
            );
          })}
        </div>
        
        {/* Логотип */}
        <img 
          src="/neuromap/logo.png" 
          alt="NeuroMap"
          style={{
            width: '200px',
            height: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 30px rgba(240, 248, 255, 0.5))',
            animation: 'pulse 2s infinite',
            position: 'relative',
            zIndex: 1
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Canvas для эффекта пикселей */}
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
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          
          @keyframes loadSquare {
            0%, 100% { opacity: 0; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
}
