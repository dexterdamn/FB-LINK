import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: 'localhost',
    port: 8000,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:8001',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: 'localhost',
    port: 8000,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8001', changeOrigin: true },
      '/auth': { target: 'http://localhost:8001', changeOrigin: true }
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser'
  }
})
