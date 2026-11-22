// Builds the gym app into dist/gym, next to TRCK, so one GitHub Pages deploy serves both.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(new URL('./version.json', import.meta.url), 'utf8')) as { version: string }
const root = fileURLToPath(new URL('.', import.meta.url))

// `--mode e2e` points the app at a fake Supabase that the Playwright tests mock.
const e2eEnv = {
  'import.meta.env.VITE_GYM_SUPABASE_URL': JSON.stringify('http://127.0.0.1:54321'),
  'import.meta.env.VITE_GYM_SUPABASE_ANON_KEY': JSON.stringify('e2e-anon-key'),
}

export default defineConfig(({ mode }) => ({
  root,
  base: './',
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  server: { port: 5174 },
  define: { __GYM_VERSION__: JSON.stringify(version), ...(mode === 'e2e' ? e2eEnv : {}) },
  build: { outDir: fileURLToPath(new URL(mode === 'e2e' ? '../dist-e2e/gym' : '../dist/gym', import.meta.url)), emptyOutDir: true },
}))
