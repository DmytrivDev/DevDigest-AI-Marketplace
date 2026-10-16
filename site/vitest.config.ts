import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __DD_DEMO__: 'false' },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
