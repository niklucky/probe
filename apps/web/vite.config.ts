import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 11020,
    proxy: {
      '/trpc': {
        target: 'http://localhost:11010',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:11010',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:11010',
        changeOrigin: true,
      },
    },
  },
})
