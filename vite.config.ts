/// <reference types="vitest" />
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const version = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version
// Every build gets its own id, so the service worker file always changes and phones notice the update.
const build = `${version}-${process.env.GITHUB_SHA?.slice(0, 7) ?? Date.now().toString(36)}`

const stampServiceWorker = (): Plugin => {
  let outDir = 'dist'
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      writeFileSync(file, readFileSync(file, 'utf8').replace('__BUILD__', build))
    },
  }
}

// `npm run build:e2e` makes a copy that believes Supabase is set up at a fake local address, so Playwright can mock it.
const e2eEnv = {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
  'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('e2e-anon-key'),
}

// base './' keeps the build working on GitHub Pages, Cloudflare Pages and Vercel.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), stampServiceWorker()],
  define: { __APP_VERSION__: JSON.stringify(version), ...(mode === 'e2e' ? e2eEnv : {}) },
  build: mode === 'e2e' ? { outDir: 'dist-e2e' } : undefined,
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}))
