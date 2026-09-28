import { fileURLToPath } from 'node:url';

// Vite serves the playground pages only; the library is compiled by tsc.
export default {
  base: './',
  build: {
    outDir: 'demo-dist',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        gallery: fileURLToPath(new URL('./gallery.html', import.meta.url)),
      },
    },
  },
};
