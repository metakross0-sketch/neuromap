import { useEffect, useState, useRef } from 'preact/hooks';

interface Pixel {
  x: number;
  y: number;
  delay: number;
}

interface CategorySelectorProps {
  categories: string[];
  onSelectCategory: (category: string | null) => void;
  onOpenMap: () => void;
}

export function CategorySelector({ categories, onSelectCategory, onOpenMap }: CategorySelectorProps) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isDisassembling, setIsDisassembling] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const onSelectCategoryRef = useRef(onSelectCategory);
  const onOpenMapRef = useRef(onOpenMap);
  
  useEffect(() => {
    onSelectCategoryRef.current = onSelectCategory;
    onOpenMapRef.current = onOpenMap;
  }, [onSelectCategory, onOpenMap]);

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
        pixels.push({
          x,
          y,
          delay: Math.random() * 800
        });
      }
    }

    pixelsRef.current = pixels;

    let startTime = Date.now();
    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const elapsed = Date.now() - startTime;

      if (!isDisassembling) {
        // Анимация появления - квадратики исчезают, открывая контент
        pixels.forEach(pixel => {
          if (elapsed < pixel.delay) {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
          }
        });

        if (elapsed > 800) {
          setIsAnimating(false);
        }
      } else {
        // Анимация закрытия - квадратики появляются, закрывая контент
        pixels.forEach(pixel => {
          if (elapsed > pixel.delay) {
            ctx.fillStyle = '#0a0a1a';
            ctx.fillRect(pixel.x, pixel.y, pixelSize, pixelSize);
          }
        });

        if (elapsed > 400) {
          // Анимация завершена
          if (selectedOption === 'map') {
            onOpenMapRef.current();
          } else if (selectedOption) {
            onSelectCategoryRef.current(selectedOption);
            onOpenMapRef.current();
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
  }, [isDisassembling]);

  const handleOptionClick = (option: string) => {
    setSelectedOption(option);
    setIsDisassembling(true);
    setIsAnimating(true);
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
      {!isDisassembling && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '400px',
          maxHeight: '500px',
          overflowY: 'auto',
          padding: '20px',
          zIndex: 1
        }}>
          <h2 style={{
            color: '#ff8c00',
            textAlign: 'center',
            marginBottom: '30px',
            fontSize: '24px',
            fontWeight: 'bold',
            textShadow: '0 0 20px rgba(255, 140, 0, 0.5)'
          }}>
            Выберите категорию
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Кнопка "Показать все магазины" */}
            <button
              onClick={() => handleOptionClick('map')}
              style={{
                padding: '20px 24px',
                background: 'rgba(0, 255, 255, 0.1)',
                border: '2px solid rgba(0, 255, 255, 0.5)',
                borderRadius: '8px',
                color: '#00ffff',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s',
                textShadow: '0 0 10px rgba(0, 255, 255, 0.3)',
                boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)'
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLElement;
                target.style.background = 'rgba(0, 255, 255, 0.2)';
                target.style.borderColor = 'rgba(0, 255, 255, 0.8)';
                target.style.boxShadow = '0 0 30px rgba(0, 255, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLElement;
                target.style.background = 'rgba(0, 255, 255, 0.1)';
                target.style.borderColor = 'rgba(0, 255, 255, 0.5)';
                target.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.2)';
              }}
            >
              🗺️ Показать все магазины
            </button>

            {/* Категории */}
            {categories.map(category => (
              <button
                key={category}
                onClick={() => handleOptionClick(category)}
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
                🏷️ {category}
              </button>
            ))}
          </div>
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
    </div>
  );
}
