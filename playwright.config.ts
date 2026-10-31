import { defineConfig } from '@playwright/test'

// Smoke tests run against the production build, at phone width, in light and dark.
export default defineConfig({
  testDir: 'docs/qa',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173/', viewport: { width: 400, height: 800 }, serviceWorkers: 'block',
    // Only for cloud sessions whose pre-installed browser differs from this Playwright version.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' } },
  ],
  webServer: [
    { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI },
    // The e2e build talks to a fake Supabase that each test mocks. See `npm run build:e2e`.
    { command: 'npx vite preview --outDir dist-e2e --port 4174 --strictPort', url: 'http://localhost:4174/', reuseExistingServer: !process.env.CI },
  ],
})
