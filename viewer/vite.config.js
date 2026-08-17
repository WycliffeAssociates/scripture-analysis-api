import { defineConfig } from 'vite'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "/scripture-analysis-api/",
  server: {
    port: 3006,
  },
  resolve: {
    alias: {
      // Point to source so Tailwind v4 auto-scanning picks up AnalysisBar classes
      '@scripture-analysis/components': resolve(__dirname, '../components/src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    tailwindcss(),
    react(),
  ],
})
