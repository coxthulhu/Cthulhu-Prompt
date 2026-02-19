import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  waitForMonacoEditor,
  focusMonacoEditor,
  getMonacoEditorText,
  getMonacoCursorPosition,
  isMonacoEditorFocused
} from '../helpers/MonacoHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const DEVELOPMENT_EDITOR = '[data-testid="prompt-editor-dev-1"]'

describe('Prompt Folders Autosave (Svelte)', () => {
  test('keeps the Monaco editor focused after autosave completes', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)

    const marker = '[autosave-focus-check]'

    await focusMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)
    await mainWindow.keyboard.type(marker, { delay: 50 })

    const contentAfterTyping = await getMonacoEditorText(mainWindow, DEVELOPMENT_EDITOR)
    expect(contentAfterTyping).toContain(marker)

    const cursorBeforeAutosave = await getMonacoCursorPosition(mainWindow, DEVELOPMENT_EDITOR)
    expect(cursorBeforeAutosave).not.toBeNull()
    expect(cursorBeforeAutosave?.column ?? 0).toBeGreaterThan(1)

    await mainWindow.waitForTimeout(3000)

    const cursorAfterAutosave = await getMonacoCursorPosition(mainWindow, DEVELOPMENT_EDITOR)
    expect(cursorAfterAutosave).toEqual(cursorBeforeAutosave)

    const stillFocused = await isMonacoEditorFocused(mainWindow, DEVELOPMENT_EDITOR)
    expect(stillFocused).toBe(true)

    await mainWindow.keyboard.type('!', { delay: 50 })

    const cursorAfterSecondType = await getMonacoCursorPosition(mainWindow, DEVELOPMENT_EDITOR)
    expect(cursorAfterSecondType?.lineNumber).toBe(cursorBeforeAutosave?.lineNumber)
    expect(cursorAfterSecondType?.column ?? 0).toBe((cursorBeforeAutosave?.column ?? 0) + 1)
  })

  test('retains typed content when switching folders immediately after typing', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)

    const marker = '[autosave-switch-immediate]'
    await focusMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)
    await mainWindow.keyboard.type(marker, { delay: 50 })

    const contentAfterTyping = await getMonacoEditorText(mainWindow, DEVELOPMENT_EDITOR)
    expect(contentAfterTyping).toContain(marker)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForTimeout(2000)

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)

    const persistedContent = await electronApp.evaluate(async ({ app }, filePath) => {
      return await new Promise<string>((resolve) => {
        const requestId = `read-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
        app.once(`test-read-file-ready:${requestId}`, (payload: { content: string }) => {
          resolve(payload.content)
        })
        app.emit('test-read-file', { filePath, requestId })
      })
    }, '/ws/sample/Prompts/Development/Prompts.json')
    const persisted = JSON.parse(persistedContent)
      .prompts.map((prompt: { promptText: string }) => prompt.promptText)
      .join('\n')
    expect(persisted).toContain(marker)

    await expect
      .poll(async () => getMonacoEditorText(mainWindow, DEVELOPMENT_EDITOR), {
        timeout: 5000
      })
      .toContain(marker)
  })

  test('retains typed content when switching folders after autosave delay', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)

    const marker = '[autosave-switch-after-delay]'
    await focusMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)
    await mainWindow.keyboard.type(marker, { delay: 50 })

    await mainWindow.waitForTimeout(3000)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForTimeout(2000)

    await testHelpers.navigateToPromptFolders('Development')
    await waitForMonacoEditor(mainWindow, DEVELOPMENT_EDITOR)

    await expect
      .poll(async () => getMonacoEditorText(mainWindow, DEVELOPMENT_EDITOR), {
        timeout: 5000
      })
      .toContain(marker)
  })
})
