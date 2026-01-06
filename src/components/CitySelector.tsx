import { useState, useEffect, useRef } from 'preact/hooks';
import { useMapStore } from '../store/mapStore';
import * as THREE from 'three';

export function CitySelector() {
  const { cities, selectCity } = useMapStore();
  const [showCities, setShowCities] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hasMoved, setHasMoved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<any>(null);
  const mouseRef = useRef({ x: 0, y: 0, prevX: 0, prevY: 0 });
  const rotationRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ 
      canvas: canvasRef.current, 
      antialias: true,
      alpha: true 
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    camera.position.z = 2.5;

    // Создаем планету с темной поверхностью
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    
    // Темный материал планеты
    const planetMaterial = new THREE.MeshPhongMaterial({
      color: 0x0a0a1a,
      emissive: 0x050510,
      shininess: 10,
      specular: 0x1a1a2a
    });
    
    const planet = new THREE.Mesh(geometry, planetMaterial);
    scene.add(planet);

    // Создаем четкие контуры континентов
    const createContinentOutline = (points: number[][][], color: number) => {
      const lines: THREE.Line[] = [];
      
      points.forEach(continentPoints => {
        const vertices: THREE.Vector3[] = [];
        
        continentPoints.forEach((p: number[]) => {
          const lat = p[0] * Math.PI / 180;
          const lon = p[1] * Math.PI / 180;
          const radius = 1.01;
          vertices.push(new THREE.Vector3(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.sin(lat),
            radius * Math.cos(lat) * Math.sin(lon)
          ));
        });
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: color,
          linewidth: 2,
          transparent: true,
          opacity: 0.85
        });
        
        const line = new THREE.Line(lineGeometry, lineMaterial);
        planet.add(line);
        lines.push(line);
      });
      
      return lines;
    };

    // Очень детальные и точные контуры континентов
    const continents = [
      // Африка
      [[37, 10], [36, 12], [34, 14], [32, 17], [30, 20], [28, 23], [25, 26], [22, 29], [20, 31], [17, 33], [14, 35], [11, 36], [8, 37], [5, 38], [2, 39], [0, 40], [-3, 40], [-6, 39], [-9, 38], [-12, 36], [-15, 34], [-17, 32], [-19, 29], [-20, 26], [-21, 23], [-21, 20], [-20, 17], [-19, 14], [-17, 11], [-15, 8], [-12, 5], [-9, 3], [-6, 1], [-3, 0], [0, -1], [3, -2], [6, -2], [9, -2], [12, -1], [15, 0], [18, 2], [21, 4], [24, 6], [27, 7], [30, 8], [33, 9], [36, 10]],
      
      // Европа
      [[71, -10], [70, -5], [69, 0], [68, 5], [66, 9], [64, 13], [62, 16], [60, 19], [58, 22], [56, 25], [54, 27], [52, 29], [50, 30], [48, 30], [46, 29], [45, 27], [44, 25], [43, 22], [43, 19], [43, 16], [44, 13], [45, 10], [47, 7], [49, 5], [51, 3], [54, 1], [57, 0], [60, -2], [63, -5], [66, -7], [69, -9], [71, -10]],
      
      // Азия
      [[70, 35], [68, 42], [66, 48], [64, 54], [62, 60], [60, 66], [58, 72], [56, 78], [54, 84], [52, 90], [50, 96], [48, 101], [46, 106], [44, 110], [42, 114], [40, 117], [37, 120], [34, 122], [31, 123], [28, 123], [25, 122], [22, 120], [20, 117], [18, 114], [17, 110], [16, 106], [16, 102], [17, 98], [18, 94], [20, 90], [22, 86], [25, 82], [28, 78], [32, 74], [36, 70], [40, 66], [44, 62], [48, 58], [52, 54], [56, 50], [60, 46], [64, 42], [67, 38], [70, 35]],
      
      // Северная Америка  
      [[71, -168], [69, -165], [67, -162], [64, -159], [61, -156], [58, -153], [55, -150], [52, -147], [49, -144], [46, -141], [43, -138], [40, -135], [37, -132], [35, -129], [33, -126], [31, -123], [29, -120], [28, -117], [27, -114], [26, -111], [26, -108], [26, -105], [27, -102], [28, -99], [29, -96], [30, -93], [31, -90], [32, -87], [33, -84], [35, -81], [37, -78], [40, -76], [43, -75], [47, -75], [51, -76], [55, -78], [59, -81], [63, -85], [66, -90], [69, -96], [71, -103], [72, -111], [72, -120], [71, -130], [70, -140], [69, -150], [68, -160], [70, -168]],
      
      // Южная Америка
      [[12, -81], [10, -79], [8, -77], [6, -75], [4, -73], [2, -71], [0, -70], [-2, -68], [-5, -67], [-8, -66], [-11, -65], [-14, -64], [-17, -63], [-20, -62], [-23, -61], [-26, -60], [-29, -59], [-32, -58], [-35, -57], [-38, -57], [-41, -58], [-43, -60], [-45, -62], [-46, -65], [-47, -68], [-47, -71], [-46, -74], [-44, -76], [-41, -77], [-38, -78], [-35, -78], [-32, -78], [-29, -77], [-26, -76], [-23, -75], [-20, -74], [-17, -74], [-14, -74], [-11, -75], [-8, -76], [-5, -77], [-2, -78], [1, -79], [4, -80], [7, -81], [10, -81], [12, -81]],
      
      // Австралия
      [[-10, 113], [-12, 115], [-14, 117], [-17, 120], [-20, 123], [-23, 127], [-26, 131], [-29, 136], [-31, 141], [-33, 146], [-35, 150], [-36, 153], [-37, 151], [-36, 148], [-34, 145], [-32, 142], [-29, 139], [-26, 136], [-23, 132], [-20, 128], [-17, 124], [-15, 120], [-13, 116], [-11, 113], [-10, 113]]
    ];

    const continentLines = createContinentOutline(continents, 0xff6600);

    // Добавляем четкие маркеры городов с магазинами
    const highlightedCountries: THREE.Mesh[] = [];
    cities.forEach(city => {
      const cityLat = city.lat * Math.PI / 180;
      const cityLon = city.lng * Math.PI / 180;
      const radius = 1.02;
      
      // Яркая точка города
      const dotGeometry = new THREE.SphereGeometry(0.015, 16, 16);
      const dotMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8c00,
        transparent: true,
        opacity: 0.9
      });
      
      const cityDot = new THREE.Mesh(dotGeometry, dotMaterial);
      cityDot.position.set(
        radius * Math.cos(cityLat) * Math.cos(cityLon),
        radius * Math.sin(cityLat),
        radius * Math.cos(cityLat) * Math.sin(cityLon)
      );
      
      planet.add(cityDot);
      highlightedCountries.push(cityDot);
    });

    // Добавляем светящиеся точки городов
    const citiesGeometry = new THREE.BufferGeometry();
    const cityPositions = [];
    const cityColors = [];
    
    for (let i = 0; i < 50; i++) {
      const lat = (Math.random() - 0.5) * Math.PI;
      const lon = Math.random() * Math.PI * 2;
      const radius = 1.02;
      
      cityPositions.push(
        radius * Math.cos(lat) * Math.cos(lon),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lon)
      );
      
      // Оранжевый цвет для городов
      cityColors.push(0.8, 0.4, 0);
    }
    
    citiesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(cityPositions, 3));
    citiesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(cityColors, 3));
    
    const citiesMaterial = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    
    const cities3d = new THREE.Points(citiesGeometry, citiesMaterial);
    planet.add(cities3d);

    // Атмосфера (свечение)
    const atmosphereGeometry = new THREE.SphereGeometry(1.15, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // Пульсирующее кольцо-подсказка вокруг планеты
    const ringGeometry = new THREE.RingGeometry(1.4, 1.45, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    // Второе кольцо для эффекта
    const ring2Geometry = new THREE.RingGeometry(1.5, 1.52, 64);
    const ring2Material = new THREE.MeshBasicMaterial({
      color: 0xff8c00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4
    });
    const ring2 = new THREE.Mesh(ring2Geometry, ring2Material);
    ring2.rotation.x = Math.PI / 2;
    scene.add(ring2);

    // Освещение - солнце
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x333333, 0.8);
    scene.add(ambientLight);

    // Звезды
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.7,
      transparent: true
    });

    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = (Math.random() - 0.5) * 2000;
      const y = (Math.random() - 0.5) * 2000;
      const z = (Math.random() - 0.5) * 2000;
      starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    sceneRef.current = { scene, camera, renderer, planet, atmosphere, stars, ring, ring2, continentLines, cities3d, highlightedCountries };

    // Animation
    let rotationSpeed = 0.0005;
    let pulseTime = 0;
    const animate = () => {
      requestAnimationFrame(animate);

      if (isZooming) {
        rotationSpeed = Math.min(rotationSpeed * 1.05, 0.02);
        camera.position.z = Math.max(camera.position.z - 0.03, 0.1);
        camera.fov = Math.min(camera.fov + 0.8, 110);
        camera.updateProjectionMatrix();
        
        // Скрываем кольца при зуме
        ring.material.opacity = Math.max(ring.material.opacity - 0.02, 0);
        ring2.material.opacity = Math.max(ring2.material.opacity - 0.02, 0);
      } else {
        // Пульсация колец
        pulseTime += 0.02;
        const pulse = Math.sin(pulseTime) * 0.3 + 0.6;
        ring.material.opacity = pulse * 0.6;
        ring2.material.opacity = pulse * 0.4;
        ring.rotation.z += 0.005;
        ring2.rotation.z -= 0.003;
        
        // Пульсация контуров континентов
        continentLines.forEach((line, i) => {
          const offset = i * 0.5;
          if (line.material && !Array.isArray(line.material)) {
            (line.material as THREE.LineBasicMaterial).opacity = 0.7 + Math.sin(pulseTime + offset) * 0.2;
          }
        });
        
        // Пульсация городов
        cities3d.material.opacity = 0.7 + Math.sin(pulseTime * 2) * 0.2;
        
        // Пульсация выделенных городов
        highlightedCountries.forEach((ring, i) => {
          const offset = i * 0.3;
          if (ring.material && !Array.isArray(ring.material)) {
            (ring.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(pulseTime * 1.5 + offset) * 0.3;
          }
        });
      }

      // Эффект hover
      if (isHovering && !isZooming) {
        planet.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.1);
        atmosphere.scale.lerp(new THREE.Vector3(1.05, 1.05, 1.05), 0.1);
      } else if (!isZooming) {
        planet.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        atmosphere.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }

      // Автоматическое или ручное вращение
      if (autoRotate && !isDragging) {
        planet.rotation.y += rotationSpeed;
      } else if (isDragging) {
        planet.rotation.y = rotationRef.current.y;
        planet.rotation.x = rotationRef.current.x;
      }
      
      stars.rotation.y += 0.00005;

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      planetMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      starsGeometry.dispose();
      starsMaterial.dispose();
    };
  }, [isZooming, isHovering, isDragging, autoRotate]);

  const handlePlanetClick = () => {
    if (!isDragging && !hasMoved) {
      setShowCities(true);
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (showCities) return;
    setIsDragging(true);
    setHasMoved(false);
    setAutoRotate(false);
    mouseRef.current.prevX = e.clientX;
    mouseRef.current.prevY = e.clientY;
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !sceneRef.current) return;
    
    const deltaX = e.clientX - mouseRef.current.prevX;
    const deltaY = e.clientY - mouseRef.current.prevY;
    
    // Если мышь сдвинулась больше чем на 5 пикселей, считаем это драгом
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }
    
    rotationRef.current.y += deltaX * 0.005;
    rotationRef.current.x += deltaY * 0.005;
    
    // Ограничиваем вращение по X (чтобы не переворачивать планету вверх ногами)
    rotationRef.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationRef.current.x));
    
    mouseRef.current.prevX = e.clientX;
    mouseRef.current.prevY = e.clientY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setTimeout(() => setAutoRotate(true), 2000); // Возобновляем автовращение через 2 сек
  };

  const handleWheel = (e: WheelEvent) => {
    if (!sceneRef.current || showCities) return;
    e.preventDefault();
    
    const camera = sceneRef.current.camera;
    const delta = e.deltaY * 0.001;
    camera.position.z = Math.max(1.5, Math.min(4, camera.position.z + delta));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown as any);
    canvas.addEventListener('mousemove', handleMouseMove as any);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel as any, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown as any);
      canvas.removeEventListener('mousemove', handleMouseMove as any);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel as any);
    };
  }, [isDragging, showCities]);

  const handleCitySelect = (city: any) => {
    setIsZooming(true);
    setTimeout(() => {
      selectCity(city);
    }, 2500);
  };

  return (
    <div className="city-selector">
      <canvas 
        ref={canvasRef} 
        className="planet-canvas"
        onClick={handlePlanetClick}
        onMouseEnter={() => !showCities && setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        style={{ 
          cursor: isDragging ? 'grabbing' : (!showCities ? 'grab' : 'default')
        }}
      />
      
      {/* Список городов */}
      {showCities && !isZooming && (
        <div className="city-list-overlay">
          <div className="city-selector__content">
            <h1 className="city-selector__title">Выберите город</h1>
            <div className="city-selector__list">
              {cities.map(city => (
                <button
                  key={city.name}
                  className="city-button"
                  onClick={() => handleCitySelect(city)}
                >
                  <span className="city-button__name">{city.name}</span>
                  <span className="city-button__arrow">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .city-selector {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .planet-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          transition: filter 0.3s ease;
        }

        .planet-canvas:hover {
          filter: brightness(1.2);
        }

        .city-list-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(15px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .city-selector__content {
          background: rgba(20, 20, 30, 0.95);
          border: 2px solid #00ffff;
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 90%;
          box-shadow: 
            0 0 40px rgba(0, 255, 255, 0.5),
            inset 0 0 20px rgba(0, 255, 255, 0.1);
        }

        .city-selector__title {
          color: #00ffff;
          text-align: center;
          font-size: 32px;
          margin-bottom: 30px;
          text-shadow: 
            0 0 10px rgba(0, 255, 255, 1),
            0 0 20px rgba(0, 255, 255, 0.8);
        }

        .city-selector__list {
          display: flex;
          flex-direction: column;
          gap: 15px;
          max-height: 60vh;
          overflow-y: auto;
        }

        .city-button {
          background: linear-gradient(135deg, 
            rgba(0, 200, 255, 0.15) 0%, 
            rgba(0, 100, 150, 0.15) 100%);
          border: 2px solid rgba(0, 255, 255, 0.5);
          border-radius: 12px;
          padding: 20px 30px;
          color: #00ffff;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .city-button:hover {
          background: linear-gradient(135deg, 
            rgba(0, 200, 255, 0.35) 0%, 
            rgba(0, 100, 150, 0.35) 100%);
          border-color: #00ffff;
          box-shadow: 0 0 30px rgba(0, 255, 255, 0.6);
          transform: translateX(10px);
        }

        .city-button__name {
          font-weight: bold;
        }

        .city-button__arrow {
          font-size: 24px;
          transition: transform 0.3s ease;
        }

        .city-button:hover .city-button__arrow {
          transform: translateX(10px);
        }
      `}</style>
    </div>
  );
}
