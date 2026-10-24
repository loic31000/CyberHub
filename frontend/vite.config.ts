import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'

function landingStaticMarkup() {
  return {
    name: 'cyberhub-landing-static-markup',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === '/welcome' || request.url?.startsWith('/welcome?')) {
          request.url = `/welcome/${request.url.slice('/welcome'.length)}`
        }
        next()
      })
    },
    transformIndexHtml(html: string) {
      const marker = '<!-- LANDING_STATIC_MARKUP -->'
      if (!html.includes(marker)) return html
      const markup = readFileSync(
        path.resolve(__dirname, './src/landing/terminal-story-markup.html'),
        'utf8',
      )
      return html.replace(marker, markup)
    },
  }
}

export default defineConfig({
  plugins: [react(), landingStaticMarkup()],
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
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'index.html'),
        welcome: path.resolve(__dirname, 'welcome/index.html'),
      },
    },
  },
})
