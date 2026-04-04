import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    // Keep globals: false (Vitest default). `tsconfig.app.json` includes `src/test/**/*.tsx` in `tsc -b`;
    // `vi` / `expect` / `test` are not typed globals — import them from `vitest` in each test file (Docker-safe).
  },
})

