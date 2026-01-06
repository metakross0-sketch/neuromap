export const neonRoadsStyle = {
  version: 8,
  name: 'Neon Roads Dark',
  sources: {
    'carto-base': {
      type: 'raster',
      tiles: ['https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'],
      tileSize: 256
    }
  },
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {'background-color': '#0a0a0f'}
    },
    {
      id: 'base-map',
      type: 'raster',
      source: 'carto-base',
      paint: {'raster-opacity': 1.0}
    }
  ]
};
