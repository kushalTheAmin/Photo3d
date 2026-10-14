import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const SERVER_PORT = Number(process.env.PORT ?? 8787);

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; set VITE_BASE=/Photo3d/ for that build.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: {
    // Listen on all interfaces so phones/tablets on the same Wi-Fi can connect.
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${SERVER_PORT}`,
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,js}'],
  },
});
