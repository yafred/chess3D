import { createRequire } from 'node:module';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const chessground3DPackageRoot = dirname(dirname(require.resolve('chessground3D')));

export default defineConfig(({ command }) => ({
  // Keep assets relative so the app can be hosted from a subpath (build only).
  base: command === 'build' ? './' : '/',
  resolve: {
    alias: {
      chessground3D: resolve(chessground3DPackageRoot, 'src/chessground3D.ts'),
    },
  },
  plugins: [
    {
      name: 'copy-chessground3d-scene',
      buildStart() {
        const destination = resolve('public/assets/scene.glb');
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(resolve('node_modules/chessground3D/assets/scene.glb'), destination);
      },
    },
  ],
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
}));
