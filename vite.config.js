import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const API_PORT = process.env.API_PORT ?? 4000;

export default defineConfig(({ mode }) => {
  // `npm run dev:phone` serves over HTTPS on your network, because browsers
  // only allow camera access on https:// or localhost.
  const phone = mode === 'phone';
  return {
    root: 'client',
    plugins: [react(), ...(phone ? [basicSsl()] : [])],
    build: {
      outDir: '../dist',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      host: phone ? true : undefined,
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
  };
});
