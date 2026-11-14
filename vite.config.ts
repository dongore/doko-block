/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

const THEME = '#0e5a40';

export default defineConfig(({ mode }) => {
  // `--mode single` builds one self-contained HTML file (no service worker),
  // handy for sharing a preview or opening the app from disk.
  const single = mode === 'single';
  return {
    base: './',
    define: {
      __SINGLE__: JSON.stringify(single),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: single ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000 } : { outDir: 'dist' },
    plugins: [
      react(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            injectRegister: null,
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
              name: 'Doko-Block – Doppelkopf-Spielblock',
              short_name: 'Doko-Block',
              description: 'Der digitale Spielblock für Doppelkopf: Punkte, Bockrunden, Pflichtsoli, Statistik und Abrechnung.',
              lang: 'de',
              start_url: './',
              scope: './',
              display: 'standalone',
              orientation: 'any',
              theme_color: THEME,
              background_color: '#0b1310',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
              navigateFallback: 'index.html',
            },
          }),
    ],
    test: {
      include: ['src/**/*.test.ts'],
    },
  };
});
