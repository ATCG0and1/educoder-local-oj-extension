import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup/vscode.setup.ts'],
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
