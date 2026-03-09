import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const appVersion = process.env.npm_package_version || '0.0.0';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return;
            const normalized = id.replace(/\\/g, '/');

            if (normalized.includes('/three/')) return 'vendor-three';
            if (normalized.includes('/remotion/') || normalized.includes('/@remotion/')) return 'vendor-remotion';
            if (
              normalized.includes('/jspdf/') ||
              normalized.includes('/html2canvas/') ||
              normalized.includes('/html-to-image/') ||
              normalized.includes('/@capacitor/filesystem/') ||
              normalized.includes('/@capacitor/share/')
            ) {
              return 'vendor-export';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify this; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
