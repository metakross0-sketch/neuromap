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
      {/* Логотип */}
      <div style={{
        position: 'relative',
        zIndex: 101,
        marginBottom: '40px'
      }}>
        <img 
          src="/neuromap/logo.png" 
          alt="NeuroMap"
          style={{
            width: '200px',
            height: 'auto',
            objectFit: 'contain',
            filter: 'drop-shadow(0 0 30px rgba(240, 248, 255, 0.5))',
            animation: 'pulse 2s infinite'
          }}
          onError={(e) => {
            // Fallback если нет логотипа - показываем текст
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      {/* Текст "Загрузка" */}
      <div style={{
        position: 'relative',
        zIndex: 101,
        color: '#f0f8ff',
        fontSize: '24px',
        fontWeight: 'bold',
        textAlign: 'center',
        animation: 'pulse 2s infinite',
        textShadow: '0 0 20px rgba(240, 248, 255, 0.5)'
      }}>
        Загрузка...
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
        `}
      </style>
    </div>
  );
}
