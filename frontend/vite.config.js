import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // En dev, l'API tourne à part (npm run dev dans backend/)
    proxy: { '/api': process.env.VITE_API_PROXY ?? 'http://localhost:3000' },
  },
});
