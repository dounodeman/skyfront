import { defineConfig } from 'vite';

// Relative base so the built game can be hosted from any sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: true },
  server: { host: '0.0.0.0', port: 5173 },
});
