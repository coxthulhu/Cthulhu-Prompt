import { whenReady as whenThemeDefaultsReady } from '@codingame/monaco-vscode-theme-defaults-default-extension'
import '@codingame/monaco-vscode-all-language-default-extensions'
import '@codingame/monaco-vscode-css-language-features-default-extension'
import '@codingame/monaco-vscode-html-language-features-default-extension'
import '@codingame/monaco-vscode-json-language-features-default-extension'
import '@codingame/monaco-vscode-markdown-language-features-default-extension'
import '@codingame/monaco-vscode-typescript-language-features-default-extension'

import * as monaco from 'monaco-editor'
import {
  ConfigurationTarget,
  getService,
  IExtensionService,
  initialize,
  IWorkbenchThemeService
} from '@codingame/monaco-vscode-api'
import getBaseServiceOverride from '@codingame/monaco-vscode-base-service-override'
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override'
import getTextMateServiceOverride from '@codingame/monaco-vscode-textmate-service-override'
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override'
import getConfigurationServiceOverride from '@codingame/monaco-vscode-configuration-service-override'
import getExtensionsServiceOverride from '@codingame/monaco-vscode-extensions-service-override'
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override'
import ExtensionHostWorkerUrl from '@codingame/monaco-vscode-api/workers/extensionHost.worker?worker&url'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

const PROMPT_EDITOR_THEME = 'Dark 2026'

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
    },
    getWorkerUrl(_moduleId: string, label: string) {
      if (label === 'extensionHostWorkerMain') {
        return ExtensionHostWorkerUrl
      }

      return undefined
    },
    getWorkerOptions(_moduleId: string, label: string) {
      if (label === 'extensionHostWorkerMain') {
        return { type: 'module' }
      }

      return undefined
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
      ...getModelServiceOverride(),
      ...getExtensionsServiceOverride({ enableWorkerExtensionHost: true })
    })
    await whenThemeDefaultsReady()

    const extensionService = await getService(IExtensionService)
    await extensionService.whenInstalledExtensionsRegistered()

    const themeService = await getService(IWorkbenchThemeService)
    const themes = await themeService.getColorThemes()
    const promptEditorTheme = themes.find((theme) => theme.settingsId === PROMPT_EDITOR_THEME)
    if (!promptEditorTheme) {
      throw new Error(`Monaco theme "${PROMPT_EDITOR_THEME}" was not registered.`)
    }

    // Side effect: finish applying Monaco's dark theme before warmup or visible editors are created.
    await themeService.setColorTheme(promptEditorTheme, ConfigurationTarget.MEMORY)
  })()

  await initializationPromise
}
