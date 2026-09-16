import { createRequire } from 'node:module';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const chessground3DPackageRoot = dirname(dirname(require.resolve('chessground3D')));
const chessground3DDistRoot = resolve(chessground3DPackageRoot, 'dist');
const chessground3DSrcRoot = resolve(chessground3DPackageRoot, 'src');

function isWithinDirectory(filePath: string, directoryPath: string): boolean {
  const relativePath = relative(directoryPath, filePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

export default defineConfig(({ command }) => ({
  // Keep assets relative so the app can be hosted from a subpath (build only).
  base: command === 'build' ? './' : '/',
  plugins: [
    {
      name: 'resolve-chessground3d-missing-dist-modules',
      enforce: 'pre',
      resolveId(source, importer) {
        if (!importer || !isWithinDirectory(importer, chessground3DDistRoot) || !source.startsWith('.')) {
          return null;
        }

        const compiledModule = resolve(dirname(importer), source);
        if (existsSync(compiledModule) || existsSync(`${compiledModule}.js`)) {
          return null;
        }

        const sourceRelativePath = relative(chessground3DDistRoot, compiledModule);
        const sourceModule = resolve(
          chessground3DSrcRoot,
          source.endsWith('.js') ? sourceRelativePath.replace(/\.js$/, '.ts') : `${sourceRelativePath}.ts`,
        );

        return isWithinDirectory(sourceModule, chessground3DSrcRoot) && existsSync(sourceModule) ? sourceModule : null;
      },
    },
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
