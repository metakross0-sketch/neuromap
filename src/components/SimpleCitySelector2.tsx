import { useEffect, useState, useRef } from 'preact/hooks';
import { useMapStore } from '../store/mapStore';

interface Pixel {
  x: number;
  y: number;
  delay: number;
}

interface SimpleCitySelectorProps {
  onCitySelected: () => void;
}

export function SimpleCitySelector({ onCitySelected }: SimpleCitySelectorProps) {
  const { cities, selectCity } = useMapStore();
  const [selectedCityName, setSelectedCityName] = useState<string | null>(null);
  const [isDisassembling, setIsDisassembling] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const hasTransitioned = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Генерация квадратиков-пикселей для эффекта "пазла"
    const pixelSize = 20;
    const pixels: Pixel[] = [];
    
    for (let y = 0; y < canvas.height; y += pixelSize) {
      for (let x = 0; x < canvas.width; x += pixelSize) {
        const distFromCenter = Math.sqrt(
          Math.pow(x - canvas.width / 2, 2) + 
          Math.pow(y - canvas.height / 2, 2)
        );
        pixels.push({
          x,
          y,
          delay: distFromCenter / 3
        });
      }
    }

    pixelsRef.current = pixels;

    let startTime = Date.now();
    let animationId: number;

    const animate = () => {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const elapsed = Date.now() - startTime;

      if (!isDisassembling) {
        // Анимация появления - квадратики исчезают, открывая контент
        pixels.forEach(pixel => {
          if (elapsed > pixel.delay) {
            const progress = Math.min(1, (elapsed - pixel.delay) / 300);
            const alpha = 1 - progress;
            
            if (alpha > 0) {
              ctx.fillStyle = `rgba(10, 10, 26, ${alpha})`;
              ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
            }
          } else {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
          }
        });
      } else {
        // Анимация закрытия - квадратики появляются, закрывая контент
        pixels.forEach(pixel => {
          const progress = Math.min(1, elapsed / 400);
          const alpha = progress;
          
          ctx.fillStyle = `rgba(10, 10, 26, ${alpha})`;
          ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
        });

        if (elapsed > 400) {
          // Анимация завершена, переходим к следующему экрану
          if (selectedCityName && !hasTransitioned.current) {
            hasTransitioned.current = true;
            const city = cities.find(c => c.name === selectedCityName);
            if (city) {
              selectCity(city);
              onCitySelected();
            }
          }
          return;
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [cities, selectCity, selectedCityName, isDisassembling, onCitySelected]);

  const handleCityClick = (cityName: string) => {
    setSelectedCityName(cityName);
    setIsDisassembling(true);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: '#0a0a1a'
    }}>
      {/* Canvas-маска для эффекта появления */}
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0,
          pointerEvents: 'none',
          zIndex: 1000
        }} 
      />
      
      {/* Контент - всегда видим, маска его открывает/закрывает */}
      {!isDisassembling && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          maxHeight: '500px',
          overflowY: 'auto',
          padding: '20px'
        }}>
          <h2 style={{
            color: '#ff8c00',
            textAlign: 'center',
            marginBottom: '30px',
            fontSize: '24px',
            fontWeight: 'bold',
            textShadow: '0 0 20px rgba(255, 140, 0, 0.5)'
          }}>
            Выберите город
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {cities.map(city => (
              <button
                key={city.name}
                onClick={() => handleCityClick(city.name)}
                style={{
                  padding: '16px 24px',
                  background: 'rgba(255, 140, 0, 0.1)',
                  border: '2px solid rgba(255, 140, 0, 0.5)',
                  borderRadius: '8px',
                  color: '#ff8c00',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textShadow: '0 0 10px rgba(255, 140, 0, 0.3)',
                  boxShadow: '0 0 20px rgba(255, 140, 0, 0.2)'
                }}
                onMouseEnter={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.background = 'rgba(255, 140, 0, 0.2)';
                  target.style.borderColor = 'rgba(255, 140, 0, 0.8)';
                  target.style.boxShadow = '0 0 30px rgba(255, 140, 0, 0.4)';
                }}
                onMouseLeave={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.background = 'rgba(255, 140, 0, 0.1)';
                  target.style.borderColor = 'rgba(255, 140, 0, 0.5)';
                  target.style.boxShadow = '0 0 20px rgba(255, 140, 0, 0.2)';
                }}
              >
                {city.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
