/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const THEME_COLOR = '#a78bfa';
const BACKGROUND_COLOR = '#0e0e12';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' (not 'autoUpdate'): vite-plugin-pwa's own client-side
      // registerSW() bundles an unconditional `window.location.reload()` on
      // SW activation whenever registerType is 'autoUpdate' — regardless of
      // what options are passed to registerSW() in src/main.tsx. The user
      // has explicitly declined both auto-reload and an update-available
      // prompt. 'prompt' disables that built-in reload wiring; since
      // onNeedRefresh is never passed from src/main.tsx, no prompt is shown
      // either. Detection (main.tsx's registerSW()/registration.update())
      // and background activation (src/sw.ts's skipWaiting()/clients.claim())
      // are untouched by this setting — see comments there.
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['icon.svg', 'icon-192x192.png', 'icon-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Daily Rituals',
        short_name: 'Rituals',
        description: 'Daily habit tracking application',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.{ts,tsx}',
      'api/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/hooks/use*.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/components/**',
        'src/ui/**',
        'src/lib/utils.ts',
        'src/vite-env.d.ts',
        'src/data/repositories/completionRepository.ts',
        'src/data/repositories/index.ts',
        'src/hooks/index.ts',
        'src/lib/database.types.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
