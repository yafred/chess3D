import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Keep assets relative so the app can be hosted from a subpath (build only).
  base: command === 'build' ? './' : '/',
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
}));
