import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(), // Add React plugin for JSX/TSX support
    tailwindcss(), // Keep Tailwind CSS plugin
  ],
  base: './', // Ensure assets load correctly in Electron
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Simplify imports (e.g., import Comp from '@/Comp')
    },
  },
});