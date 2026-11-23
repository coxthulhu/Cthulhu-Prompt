import path from 'node:path'
import { defineConfig } from '@playwright/test'

/** Runs the rendering performance scenarios one Electron launch at a time on the real display. */
export default defineConfig({
  testDir: '.',
  testMatch: 'PromptCollectionPerformance.spec.ts',
  outputDir: path.join(process.env.PERF_OUTPUT_DIR!, 'test-results'),
  workers: 1,
  retries: 0,
  timeout: 5 * 60 * 1000,
  reporter: [['dot'], ['../helpers/RendererErrorReporter.ts']]
})
