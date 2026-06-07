import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// data/ fica na raiz do projeto (fora de src/) — liberar acesso do dev server.
export default defineConfig({
  base: '/witch-hat-atelier-spell-analyzer/',
  plugins: [react()],
  server: { fs: { allow: ['..', '.'] } },
  // Layer aliases (refactor-plan-spec §3.2). Mirror of package.json "imports" so the same
  // import specifiers resolve under both Vite and `node --test` (Node resolves "imports" natively;
  // Vite needs this explicit map). Intra-layer imports stay relative; cross-layer use these.
  resolve: {
    alias: {
      '#domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
      '#services': fileURLToPath(new URL('./src/services', import.meta.url)),
      '#shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '#features': fileURLToPath(new URL('./src/features', import.meta.url)),
    },
  },
  // Treat .onnx files as static assets so `import '…/model.onnx?url'` returns
  // the hashed public URL (base-path-safe for GitHub Pages).
  assetsInclude: ['**/*.onnx'],
  optimizeDeps: {
    // Do NOT pre-bundle onnxruntime-web into the dev/build entry chunk.
    // It must stay in a lazy dynamic-import chunk so engine:"p" users never load it.
    exclude: ['onnxruntime-web'],
  },
  build: {
    rollupOptions: {
      output: {
        // Split the big third-party libs into their own cacheable chunks so the main bundle
        // stays lean and the 500kB warning goes away.
        manualChunks: {
          react:    ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          markdown: ['react-markdown'],
          konva:    ['konva', 'react-konva'],
          // onnxruntime-web is intentionally NOT listed here: it lands in its own
          // auto-split lazy chunk because mlRecognizer.js is only ever dynamic-imported.
          // Listing it in manualChunks would risk pulling it into the entry path.
        },
      },
    },
  },
})
