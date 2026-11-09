import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  // SPENDMATE_API lets a second copy point at a different API (e.g. an in-memory test server).
  // ws: true lets the live-update connection (/api/realtime) pass through the dev proxy too.
  server: { proxy: { '/api': { target: process.env.SPENDMATE_API ?? 'http://localhost:4000', ws: true } } },
});
