import { getService } from '@codingame/monaco-vscode-api'
import {
  IContextMenuService,
  IContextViewService
} from '@codingame/monaco-vscode-api/vscode/vs/platform/contextview/browser/contextView.service'

/** Connects Monaco's renderer-wide menu lifecycle to background scroll blocking once at startup. */
export const initializeMonacoContextMenuScroll = async (): Promise<void> => {
  /** Menu lifecycle and its shadow-root content share the renderer's Monaco services. */
  const [contextMenuService, contextViewService] = await Promise.all([
    getService(IContextMenuService),
    getService(IContextViewService)
  ])

  /** Intercepts background gestures before Monaco's wheel dismissal or virtual scrolling runs. */
  const preventBackgroundScroll = (event: Event): void => {
    // Composed paths include menu content even when the document sees a shadow host as the target.
    if (event.composedPath().includes(contextViewService.getContextViewElement())) return

    event.preventDefault()
    event.stopPropagation()
  }

  // These subscriptions live for the renderer lifetime, alongside Monaco's shared services.
  contextMenuService.onDidShowContextMenu(() => {
    document.addEventListener('wheel', preventBackgroundScroll, { capture: true, passive: false })
    document.addEventListener('touchmove', preventBackgroundScroll, { capture: true, passive: false })
  })
  contextMenuService.onDidHideContextMenu(() => {
    document.removeEventListener('wheel', preventBackgroundScroll, true)
    document.removeEventListener('touchmove', preventBackgroundScroll, true)
  })
}
