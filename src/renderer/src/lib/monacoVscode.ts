import { whenReady as whenThemeDefaultsReady } from '@codingame/monaco-vscode-theme-defaults-default-extension'
import '@codingame/monaco-vscode-markdown-basics-default-extension'
import '@codingame/monaco-vscode-markdown-language-features-default-extension'

import * as monaco from 'monaco-editor'
import { initialize } from '@codingame/monaco-vscode-api'
import getBaseServiceOverride from '@codingame/monaco-vscode-base-service-override'
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override'
import getTextMateServiceOverride from '@codingame/monaco-vscode-textmate-service-override'
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override'
import getConfigurationServiceOverride from '@codingame/monaco-vscode-configuration-service-override'
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

export const PROMPT_EDITOR_THEME = 'Default Dark Modern'

let initializationPromise: Promise<void> | null = null

const configureWorkers = (): void => {
  self.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === 'TextMateWorker') {
        return new Worker(
          new URL('@codingame/monaco-vscode-textmate-service-override/worker', import.meta.url),
          { type: 'module' }
        )
      }

      return new EditorWorker()
    }
  } as monaco.Environment
}

export const initMonacoVscode = async (): Promise<void> => {
  if (initializationPromise) {
    await initializationPromise
    return
  }

  initializationPromise = (async () => {
    configureWorkers()
    await initialize({
      ...getBaseServiceOverride(),
      ...getConfigurationServiceOverride(),
      ...getLanguagesServiceOverride(),
      ...getThemeServiceOverride(),
      ...getTextMateServiceOverride(),
      ...getModelServiceOverride()
    })
    await import('vscode/localExtensionHost')
    await whenThemeDefaultsReady()
    monaco.editor.setTheme(PROMPT_EDITOR_THEME)
  })()

  await initializationPromise
}
