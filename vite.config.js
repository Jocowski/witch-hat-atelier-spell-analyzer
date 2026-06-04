import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// data/ fica na raiz do projeto (fora de src/) — liberar acesso do dev server.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..', '.'] } },
  build: {
    rollupOptions: {
      output: {
        // Split the big third-party libs into their own cacheable chunks so the main bundle
        // stays lean and the 500kB warning goes away.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          markdown: ['react-markdown'],
          konva: ['konva', 'react-konva'],
        },
      },
    },
  },
})
