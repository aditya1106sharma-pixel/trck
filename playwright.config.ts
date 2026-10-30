import { defineConfig } from '@playwright/test'

// Smoke tests run against the production build, at phone width, in light and dark.
export default defineConfig({
  testDir: 'docs/qa',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173/', viewport: { width: 400, height: 800 }, serviceWorkers: 'block' },
  projects: [
    { name: 'light', use: { colorScheme: 'light' } },
    { name: 'dark', use: { colorScheme: 'dark' } },
  ],
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/', reuseExistingServer: !process.env.CI },
})
