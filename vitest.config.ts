import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    // Page-level suites here mount whole screens (the config editor renders
    // ~60 controls) and this repository is verified on a slow arm64 host
    // where parallel workers contend for 2 cores — the default 5s per test
    // flakes under that load while passing in isolation.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
