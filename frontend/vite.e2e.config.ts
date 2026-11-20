import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Isolate browser E2E from any developer .env.local Firebase client configuration.
export default defineConfig({
  plugins: [react()],
  envDir: './.e2e-env',
});
