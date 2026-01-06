export const neonRoadsStyle = {
  version: 8,
  name: 'Neon Roads',
  sources: {
    'protomaps': {
      type: 'vector',
      tiles: ['https://api.protomaps.com/tiles/v3/{z}/{x}/{y}.mvt?key=41392fb7515533a5'],
      minzoom: 0,
      maxzoom: 14,
      attribution: '© <a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>'
    }
  },
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  layers: [
    // Фон
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#1e1e1e'
      }
    },
    // Вода
    {
      id: 'water',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'water',
      paint: {
        'fill-color': '#252530',
        'fill-opacity': 0.9
      }
    },
    // Парки
    {
      id: 'landuse-park',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'landuse',
      filter: ['==', 'pmap:kind', 'park'],
      paint: {
        'fill-color': '#252825',
        'fill-opacity': 0.7
      }
    },
    // Здания
    {
      id: 'buildings',
      type: 'fill',
      source: 'protomaps',
      'source-layer': 'buildings',
      paint: {
        'fill-color': '#2a2a2a',
        'fill-opacity': 0.8
      }
    },
    // МАГИСТРАЛИ - внешнее свечение (оранжевое)
    {
      id: 'roads-motorway-glow-outer',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['==', 'pmap:kind', 'highway'],
      paint: {
        'line-color': '#cc5500',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          5, 8,
          10, 20,
          16, 40
        ],
        'line-blur': 15,
        'line-opacity': 0.4
      }
    },
    // МАГИСТРАЛИ - основная дорога (оранжевая)
    {
      id: 'roads-motorway-base',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['==', 'pmap:kind', 'highway'],
      paint: {
        'line-color': '#cc6600',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          5, 4,
          10, 10,
          16, 20
        ],
        'line-opacity': 0.6
      }
    },
    // МАГИСТРАЛИ - внутренний темный слой (разделитель)
    {
      id: 'roads-motorway-inner',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['==', 'pmap:kind', 'highway'],
      paint: {
        'line-color': '#1a1a1a',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          5, 2.5,
          10, 6,
          16, 12
        ],
        'line-opacity': 0.6
      }
    },
    // МАГИСТРАЛИ - центральная вена (циан как маркер)
    {
      id: 'roads-motorway-vein',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['==', 'pmap:kind', 'highway'],
      paint: {
        'line-color': '#00ffff',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          5, 1,
          10, 2.5,
          16, 5
        ],
        'line-opacity': 0.6
      }
    },
    // КРУПНЫЕ ДОРОГИ - свечение (оранжевое)
    {
      id: 'roads-major-glow',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'major_road', 'medium_road'],
      paint: {
        'line-color': '#dd7722',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          8, 6,
          12, 15,
          16, 30
        ],
        'line-blur': 10,
        'line-opacity': 0.4
      }
    },
    // КРУПНЫЕ ДОРОГИ - основная дорога (оранжевая)
    {
      id: 'roads-major-base',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'major_road', 'medium_road'],
      paint: {
        'line-color': '#dd8822',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          8, 3,
          12, 8,
          16, 16
        ],
        'line-opacity': 0.6
      }
    },
    // КРУПНЫЕ ДОРОГИ - внутренний темный слой (разделитель)
    {
      id: 'roads-major-inner',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'major_road', 'medium_road'],
      paint: {
        'line-color': '#1a1a1a',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          8, 2,
          12, 5,
          16, 10
        ],
        'line-opacity': 0.6
      }
    },
    // КРУПНЫЕ ДОРОГИ - центральная вена (циан)
    {
      id: 'roads-major-vein',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'major_road', 'medium_road'],
      paint: {
        'line-color': '#00ffff',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          8, 0.8,
          12, 2,
          16, 4
        ],
        'line-opacity': 0.6
      }
    },
    // МЕЛКИЕ ДОРОГИ - свечение (оранжевое)
    {
      id: 'roads-minor-glow',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'minor_road', 'other'],
      minzoom: 12,
      paint: {
        'line-color': '#aa6611',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          12, 4,
          16, 16
        ],
        'line-blur': 5,
        'line-opacity': 0.3
      }
    },
    // МЕЛКИЕ ДОРОГИ - основная дорога (оранжевая)
    {
      id: 'roads-minor-base',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'minor_road', 'other'],
      minzoom: 12,
      paint: {
        'line-color': '#cc7722',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          12, 2,
          16, 8
        ],
        'line-opacity': 0.6
      }
    },
    // МЕЛКИЕ ДОРОГИ - внутренний темный слой (разделитель)
    {
      id: 'roads-minor-inner',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'minor_road', 'other'],
      minzoom: 12,
      paint: {
        'line-color': '#1a1a1a',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          12, 1.2,
          16, 5
        ],
        'line-opacity': 0.6
      }
    },
    // МЕЛКИЕ ДОРОГИ - центральная вена (циан, тусклее)
    {
      id: 'roads-minor-vein',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['in', 'pmap:kind', 'minor_road', 'other'],
      minzoom: 12,
      paint: {
        'line-color': '#00cccc',
        'line-width': [
          'interpolate',
          ['exponential', 1.6],
          ['zoom'],
          12, 0.5,
          16, 2
        ],
        'line-opacity': 0.6
      }
    }
  ]
};

// Альтернативный стиль с векторными тайлами OpenMapTiles
export const neonRoadsStyleVector = {
  version: 8,
  name: 'Neon Roads Vector',
  sources: {
    'openmaptiles': {
      type: 'vector',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], // Замените на ваш тайл-сервер
      tileSize: 512
    }
  },
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0a0a0f'
      }
    },
    // Парки и зеленые зоны
    {
      id: 'park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'park'],
      paint: {
        'fill-color': '#0d1a0d',
        'fill-opacity': 0.6
      }
    },
    // Вода
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: {
        'fill-color': '#0a1428'
      }
    },
    // Здания
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      paint: {
        'fill-color': '#1a1a2e',
        'fill-opacity': 0.7
      }
    },
    // ДОРОГИ - Магистрали (толстые, яркий оранжевый неон)
    {
      id: 'road-motorway-neon-glow',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', 'class', 'motorway'],
      paint: {
        'line-color': '#ff8c00',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5, 3,
          12, 12,
          16, 24
        ],
        'line-blur': 8,
        'line-opacity': 0.6
      }
    },
    {
      id: 'road-motorway-core',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', 'class', 'motorway'],
      paint: {
        'line-color': '#ffaa33',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5, 1,
          12, 4,
          16, 8
        ]
      }
    },
    // Основные дороги (оранжевый неон средней яркости)
    {
      id: 'road-primary-neon-glow',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'primary', 'trunk'],
      paint: {
        'line-color': '#ff9933',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 2,
          12, 8,
          16, 18
        ],
        'line-blur': 6,
        'line-opacity': 0.5
      }
    },
    {
      id: 'road-primary-core',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'primary', 'trunk'],
      paint: {
        'line-color': '#ffbb55',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 0.5,
          12, 3,
          16, 6
        ]
      }
    },
    // Второстепенные дороги (тусклый оранжевый)
    {
      id: 'road-secondary-neon-glow',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'secondary', 'tertiary'],
      paint: {
        'line-color': '#ff9933',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 1,
          14, 6,
          16, 14
        ],
        'line-blur': 4,
        'line-opacity': 0.4
      }
    },
    {
      id: 'road-secondary-core',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'secondary', 'tertiary'],
      paint: {
        'line-color': '#cc8844',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          10, 0.3,
          14, 2,
          16, 4
        ]
      }
    },
    // Мелкие улицы (совсем тусклый оранжевый)
    {
      id: 'road-minor-neon',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'minor', 'service'],
      minzoom: 12,
      paint: {
        'line-color': '#996633',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12, 0.5,
          16, 3
        ],
        'line-blur': 2,
        'line-opacity': 0.3
      }
    },
    // Названия мест
    {
      id: 'place-labels',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      layout: {
        'text-field': '{name}',
        'text-font': ['Open Sans Regular'],
        'text-size': 12
      },
      paint: {
        'text-color': '#ff9933',
        'text-halo-color': '#0a0a0f',
        'text-halo-width': 2
      }
    }
  ]
};
