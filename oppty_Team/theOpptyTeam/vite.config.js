// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
  },
  server: {
    port: 5173,
    host: 'localhost',
    proxy: {
      // ── Your local Django backend ──────────────────────
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },

      // ── WebSocket ──────────────────────────────────────
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },

      // ── Media files ────────────────────────────────────
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },

      // ── External Oppty API (forgot password) ───────────
      '/oppty-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/oppty-api/, ''),
      },
    },
  },
})