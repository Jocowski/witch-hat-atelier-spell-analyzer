import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// data/ fica na raiz do projeto (fora de src/) — liberar acesso do dev server.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['..', '.'] } },
})
