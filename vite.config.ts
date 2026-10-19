import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Use tldts' official compact browser ESM bundle for MSW's cookie support.
      // This preserves its complete public suffix data and API, without duplicating
      // the generated trie across source modules during bundling.
      tldts: fileURLToPath(new URL('./node_modules/tldts/dist/index.esm.min.js', import.meta.url)),
    },
  },
  build: { target: 'es2022' },
})
