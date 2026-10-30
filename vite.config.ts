/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps the build working on GitHub Pages, Cloudflare Pages and Vercel.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
