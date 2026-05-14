import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // In development, read env vars from server/.env (local only)
  // On Render, env vars are set per-service in the dashboard
  envDir: mode === 'development' ? '../server' : '.',
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
}));