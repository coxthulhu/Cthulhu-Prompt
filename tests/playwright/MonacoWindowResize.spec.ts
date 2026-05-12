import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const FOLDER_NAME = 'Wrapped Single Line Prompt'
const PROMPT_SELECTOR = promptEditorSelector('height-test-11')
const PLACEHOLDER_SELECTOR = `${PROMPT_SELECTOR} ${MONACO_PLACEHOLDER_SELECTOR}`

type MonacoResizeSnapshot = {
  domWidth: number
  rowHeight: number
  editorWidth: number
  editorHeight: number
  contentHeight: number
}

const readMonacoResizeSnapshot = async (
  mainWindow: any,
  editorSelector: string
): Promise<MonacoResizeSnapshot | null> => {
  return await mainWindow.evaluate((selector) => {
    const row = document.querySelector<HTMLElement>(selector)
    if (!row) return null
    const monacoNode = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
      (candidate) => candidate.querySelector('.view-lines')
    )
    if (!monacoNode) return null
    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getContentHeight: () => number
            getLayoutInfo: () => { width: number; height: number }
          }
        }>
      }
    ).__cthulhuMonacoEditors
    const entry = registry?.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })
    if (!entry) return null
    const layoutInfo = entry.editor.getLayoutInfo()
    return {
      domWidth: Math.round(entry.container?.getBoundingClientRect().width ?? 0),
      rowHeight: Math.round(row.getBoundingClientRect().height),
      editorWidth: Math.round(layoutInfo.width),
      editorHeight: Math.round(layoutInfo.height),
      contentHeight: Math.round(entry.editor.getContentHeight())
    }
  }, editorSelector)
}

describe('Monaco window resize', () => {
  test('relayouts hydrated wrapped editors when the BrowserWindow width changes', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'height' }
    })

    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: FOLDER_NAME,
      hostSelector: HOST_SELECTOR,
      promptSelector: PROMPT_SELECTOR,
      placeholderSelector: PLACEHOLDER_SELECTOR
    })
    await waitForMonacoEditor(mainWindow, PROMPT_SELECTOR)

    const initialSnapshot = await readMonacoResizeSnapshot(mainWindow, PROMPT_SELECTOR)
    if (!initialSnapshot) {
      throw new Error('Failed to read initial Monaco resize snapshot')
    }

    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (!mainWindow) throw new Error('Missing main window')
      const bounds = mainWindow.getBounds()
      mainWindow.setSize(Math.max(900, bounds.width - 320), bounds.height)
    })

    await expect
      .poll(async () => {
        const snapshot = await readMonacoResizeSnapshot(mainWindow, PROMPT_SELECTOR)
        return snapshot?.domWidth ?? initialSnapshot.domWidth
      })
      .toBeLessThan(initialSnapshot.domWidth)

    await expect
      .poll(async () => {
        const snapshot = await readMonacoResizeSnapshot(mainWindow, PROMPT_SELECTOR)
        return (
          !!snapshot &&
          snapshot.editorWidth === snapshot.domWidth &&
          snapshot.contentHeight > initialSnapshot.contentHeight &&
          snapshot.editorHeight === snapshot.contentHeight &&
          snapshot.rowHeight > initialSnapshot.rowHeight
        )
      })
      .toBe(true)

    const resizedSnapshot = await readMonacoResizeSnapshot(mainWindow, PROMPT_SELECTOR)
    if (!resizedSnapshot) {
      throw new Error('Failed to read resized Monaco resize snapshot')
    }
    expect(resizedSnapshot.editorWidth).toBe(resizedSnapshot.domWidth)
    expect(resizedSnapshot.contentHeight).toBeGreaterThan(initialSnapshot.contentHeight)
    expect(resizedSnapshot.editorHeight).toBe(resizedSnapshot.contentHeight)
    expect(resizedSnapshot.rowHeight).toBeGreaterThan(initialSnapshot.rowHeight)
  })
})
