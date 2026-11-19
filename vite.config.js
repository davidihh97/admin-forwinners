import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // En desarrollo, la API la atiende `npm run dev:api` (wrangler) en el puerto 8788.
  server: { proxy: { '/api': 'http://localhost:8788' } },
  build: { outDir: 'dist', emptyOutDir: true },
});
