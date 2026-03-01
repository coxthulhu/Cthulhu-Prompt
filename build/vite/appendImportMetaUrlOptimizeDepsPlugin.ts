import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin'
import type { Plugin } from 'vite'

export const appendImportMetaUrlOptimizeDepsPlugin: Plugin = {
  name: 'cthulhu:append-import-meta-url-optimize-deps',
  apply: 'serve',
  configResolved(config) {
    const optimizeDeps = config.optimizeDeps
    if (!optimizeDeps) return

    const esbuildOptions = optimizeDeps.esbuildOptions ?? (optimizeDeps.esbuildOptions = {})
    const plugins = esbuildOptions.plugins ?? (esbuildOptions.plugins = [])
    if (!plugins.some((plugin) => plugin?.name === importMetaUrlPlugin.name)) {
      plugins.push(importMetaUrlPlugin)
    }
  }
}
