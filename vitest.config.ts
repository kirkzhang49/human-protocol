import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the tsconfig.app.json path mapping so tests import the workspace
      // package the same way the app does.
      '@age/render-webgpu': fileURLToPath(new URL('./packages/age-render-webgpu/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
});
