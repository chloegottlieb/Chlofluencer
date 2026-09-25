import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.API_PORT ?? 4000;

export default defineConfig({
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
      '/uploads': `http://localhost:${API_PORT}`,
    },
  },
  test: {
    root: '.',
    include: ['tests/unit/**/*.test.{js,jsx}', 'tests/api/**/*.test.js', 'tests/client/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
    restoreMocks: true,
    coverage: {
      include: ['server/**/*.js', 'client/src/**/*.{js,jsx}'],
      exclude: ['server/index.js', 'server/seed-cli.js', 'client/src/main.jsx'],
    },
  },
});
