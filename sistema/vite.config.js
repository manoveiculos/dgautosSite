import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/sistema/',
  plugins: [react()],
  build: {
    outDir: '../dist/sistema',
    emptyOutDir: true,
  },
})
