import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Build an unconfigured production artifact without loading developer .env files.
export default defineConfig({
  plugins: [react()],
  envDir: './.production-test-env',
  build: { outDir: './dist-production-test' },
});
