/// <reference types="vitest" />
import { readFileSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version
// Every build gets its own id, so the service worker file always changes and phones notice the update.
const build = `${version}-${process.env.GITHUB_SHA?.slice(0, 7) ?? Date.now().toString(36)}`

const stampServiceWorker = (): Plugin => ({
  name: 'stamp-service-worker',
  apply: 'build',
  closeBundle() {
    const file = new URL('./dist/sw.js', import.meta.url)
    writeFileSync(file, readFileSync(file, 'utf8').replace('__BUILD__', build))
  },
})

// base './' keeps the build working on GitHub Pages, Cloudflare Pages and Vercel.
export default defineConfig({
  base: './',
  plugins: [react(), stampServiceWorker()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
