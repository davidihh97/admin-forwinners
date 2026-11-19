// Construye dist/fw-content.js: el script que la página principal (forwinnersec.com)
// carga para mostrar el contenido publicado desde el panel.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/embed/fw-content.js',
      name: 'ForWinnersContent',
      formats: ['iife'],
      fileName: () => 'fw-content.js',
    },
  },
});
