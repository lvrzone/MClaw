import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

function isMainProcessExternal(id: string): boolean {
  if (!id || id.startsWith('\0')) return false;
  if (id.startsWith('.') || id.startsWith('/') || /^[A-Za-z]:[\\/]/.test(id)) return false;
  if (id.startsWith('@/') || id.startsWith('@electron/')) return false;
  // Bundle all dependencies into the main process to avoid runtime ESM/CJS issues
  // and missing node_modules in the packaged app. Only exclude built-in Node/Electron modules.
  // Note: 'ws' must be external because it contains native binary dependencies (bufferutil, utf-8-validate)
  // that cannot be bundled correctly by rollup.
  const builtInModules = [
    'electron',
    'node:',
    'child_process',
    'crypto',
    'events',
    'fs',
    'fs/promises',
    'http',
    'https',
    'net',
    'os',
    'path',
    'stream',
    'url',
    'util',
    'zlib',
    'async_hooks',
    'node:module',
    'node:path',
    'node:fs',
    'node:fs/promises',
    'node:os',
    'node:crypto',
    'node:child_process',
    'node:http',
    'node:zlib',
    'ws',
  ];
  if (builtInModules.some(m => id === m || id.startsWith(m))) return true;
  return false;
}

// https://vitejs.dev/config/
export default defineConfig({
  // Required for Electron: all asset URLs must be relative because the renderer
  // loads via file:// in production. vite-plugin-electron-renderer sets this
  // automatically, but we declare it explicitly so the intent is clear and the
  // build remains correct even if plugin order ever changes.
  base: './',
  plugins: [
    react(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: isMainProcessExternal,
            },
          },
        },
      },
      {
        // Preload scripts entry file
        entry: 'electron/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
