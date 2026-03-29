import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths keep the build portable for GitHub Pages project sites.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
