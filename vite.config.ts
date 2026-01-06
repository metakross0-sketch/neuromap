import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: '/neuromap/',
  plugins: [preact()],
  build: {
    target: 'es2015',
    minify: 'esbuild'
  }
})
