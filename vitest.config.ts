import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL('./src/extension.ts', import.meta.url)),
    },
  },
});
