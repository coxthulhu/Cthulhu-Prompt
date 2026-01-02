import { monaco } from '@renderer/common/Monaco'

// NOTE: This registry is only for Playwright helpers. Application logic should never depend on it.

export type MonacoEditorRegistryEntry = {
  container: HTMLElement
  editor: monaco.editor.IStandaloneCodeEditor
}

declare global {
  interface Window {
    __cthulhuMonacoEditors?: MonacoEditorRegistryEntry[]
  }
}

export function registerMonacoEditor(entry: MonacoEditorRegistryEntry): void {
  if (typeof window === 'undefined') return
  const registry = window.__cthulhuMonacoEditors ?? []
  const existingIndex = registry.findIndex((item) => item.editor === entry.editor)
  if (existingIndex === -1) {
    registry.push(entry)
  } else {
    registry[existingIndex] = entry
  }
  window.__cthulhuMonacoEditors = registry
}

export function unregisterMonacoEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
  if (typeof window === 'undefined') return
  const registry = window.__cthulhuMonacoEditors
  if (!registry) return
  window.__cthulhuMonacoEditors = registry.filter((item) => item.editor !== editor)
}
