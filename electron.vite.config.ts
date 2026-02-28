import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// Allow silencing build logs during Playwright runs.
// Reads `VITE_LOG_LEVEL` env var and applies to all bundles.
// Default is 'info'; use 'error' or 'silent' to reduce output.
const logLevel = (process.env.VITE_LOG_LEVEL as 'info' | 'warn' | 'error' | 'silent') || 'info'

export default defineConfig({
  main: {
    // Reduce noisy build logs when desired (e.g., in CI/E2E runs).
    // Purpose: make Playwright output concise and avoid tool truncation.
    logLevel,
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    // Purpose: keep preload build logs consistent with chosen log level.
    logLevel,
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    // Purpose: renderer build is the noisiest; suppress when needed.
    logLevel,
    optimizeDeps: {
      // Keep monaco-vscode packages unoptimized so extension resource URLs resolve in dev.
      exclude: [
        '@codingame/monaco-vscode-api',
        '@codingame/monaco-vscode-languages-service-override',
        '@codingame/monaco-vscode-markdown-basics-default-extension',
        '@codingame/monaco-vscode-textmate-service-override',
        '@codingame/monaco-vscode-theme-defaults-default-extension',
        '@codingame/monaco-vscode-theme-service-override'
      ]
    },
    // Monaco VSCode TextMate worker uses code-splitting; Vite worker output must be ES modules.
    worker: {
      format: 'es'
    },
    server: {
      host: '127.0.0.1',
      port: 12000,
      strictPort: true
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      tailwindcss(),
      svelte({
        // Disable Svelte HMR so Vite triggers a full window reload on file changes.
        compilerOptions: { hmr: false }
      })
    ]
  }
})
