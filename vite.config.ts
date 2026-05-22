import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
      '/up': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
