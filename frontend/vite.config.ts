import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'zustand',
      'clsx',
    ],
  },
  // En dev : proxy les appels API et WebSocket vers le backend Go (port 7743)
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:7743',
        changeOrigin: true,
        ws: true, // Proxy WebSocket pour le Docker Runner (et futurs flux IA/OSINT)
      },
    },
  },
  // Build : output vers backend/web (pour que Go l'embarque)
  build: {
    outDir: '../backend/web',
    emptyOutDir: true,
  },
})
