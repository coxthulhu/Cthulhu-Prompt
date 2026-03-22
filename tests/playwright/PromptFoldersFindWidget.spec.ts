import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { focusMonacoEditor } from '../helpers/MonacoHelpers'
import { createWorkspaceWithFolders } from '../fixtures/WorkspaceFixtures'
import {
  VIRTUAL_FIND_FIRST_PROMPT_ID,
  VIRTUAL_FIND_LAST_PROMPT_ID,
  VIRTUAL_FIND_MARKER
} from '../helpers/VirtualFindTestConstants'

const { test, describe, expect } = createPlaywrightTestSuite()

const FIND_INPUT = '[data-testid="prompt-find-input"]'
const FIND_CLOSE = '[data-testid="prompt-find-close"]'
const FIND_MATCHES_LABEL = '[data-testid="prompt-find-widget"] .prompt-find-widget__matches'
const SETTINGS_ROW_SELECTOR =
  '[data-testid="prompt-folder-screen"] [data-virtual-window-row][data-testid^="prompt-folder-settings-"]'
const LOOP_REGRESSION_QUERY = 'cthulhu-loop-regression-marker-9x4k'
const LOOP_MATCH_PROMPT_IDS = Array.from({ length: 19 }, (_, index) => `loop-test-${2 + index * 60}`)
const RAPID_LOOP_QUERY = 'cthulhu-rapid-loop-marker-fish'
const TYPING_ANCHOR_QUERY = 'hello'

const getMonacoSelectedText = async (
  mainWindow: any,
  editorSelector: string
): Promise<string | null> => {
  return await mainWindow.evaluate(
    (selector) => {
      const monacoNode = document.querySelector(`${selector} .monaco-editor`)
      if (!monacoNode) return null

      const registry = (
        window as unknown as {
          __cthulhuMonacoEditors?: Array<{
            container: HTMLElement | null
            editor: {
              getModel: () => {
                getValueInRange: (range: any) => string
              } | null
              getSelection: () => any
            }
          }>
        }
      ).__cthulhuMonacoEditors

      if (!registry?.length) return null

      const entry = registry.find((item) => {
        if (!item?.container) return false
        return item.container === monacoNode || item.container.contains(monacoNode)
      })
      if (!entry) return null

      const model = entry.editor.getModel()
      const selection = entry.editor.getSelection()
      if (!model || !selection) return null

      return model.getValueInRange(selection)
    },
    editorSelector
  )
}

const getMonacoWordAtCursor = async (
  mainWindow: any,
  editorSelector: string
): Promise<string | null> => {
  return await mainWindow.evaluate(
    (selector) => {
      const monacoNode = document.querySelector(`${selector} .monaco-editor`)
      if (!monacoNode) return null

      const registry = (
        window as unknown as {
          __cthulhuMonacoEditors?: Array<{
            container: HTMLElement | null
            editor: {
              getConfiguredWordAtPosition: (position: any) => { word: string } | null
              getPosition: () => any
            }
          }>
        }
      ).__cthulhuMonacoEditors

      if (!registry?.length) return null

      const entry = registry.find((item) => {
        if (!item?.container) return false
        return item.container === monacoNode || item.container.contains(monacoNode)
      })
      if (!entry) return null

      const position = entry.editor.getPosition()
      if (!position) return null

      return entry.editor.getConfiguredWordAtPosition(position)?.word ?? null
    },
    editorSelector
  )
}

const getFindMatchesLabelText = async (mainWindow: any): Promise<string> => {
  return await mainWindow.evaluate((selector) => {
    return document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? ''
  }, FIND_MATCHES_LABEL)
}

const getCurrentFindMatchRowTestId = async (mainWindow: any): Promise<string | null> => {
  return await mainWindow.evaluate(() => {
    const currentFindMatch = document.querySelector('.monaco-editor .currentFindMatch')
    if (!currentFindMatch) return null
    const row = currentFindMatch.closest<HTMLElement>('[data-testid][data-virtual-window-row]')
    return row?.getAttribute('data-testid') ?? null
  })
}

const getMonacoSelectionState = async (
  mainWindow: any,
  editorSelector: string
): Promise<
  | {
      selectedText: string
      startLineNumber: number
      startColumn: number
    }
  | null
> => {
  return await mainWindow.evaluate((selector) => {
    const monacoNode = document.querySelector(`${selector} .monaco-editor`)
    if (!monacoNode) return null

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getModel: () => {
              getValueInRange: (range: any) => string
            } | null
            getSelection: () => any
          }
        }>
      }
    ).__cthulhuMonacoEditors

    if (!registry?.length) return null
    const entry = registry.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })
    if (!entry) return null

    const model = entry.editor.getModel()
    const selection = entry.editor.getSelection()
    if (!model || !selection) return null

    return {
      selectedText: model.getValueInRange(selection),
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn
    }
  }, editorSelector)
}

const buildVirtualFindLoopWorkspace = (workspacePath: string): Record<string, string | null> => {
  const promptIdsWithMatches = new Set(LOOP_MATCH_PROMPT_IDS)
  const basePromptBody = '\n'.repeat(80)
  const prompts = Array.from({ length: 1200 }, (_, index) => {
    const promptId = `loop-test-${index + 1}`
    return {
      id: promptId,
      title: `Loop Prompt ${index + 1}`,
      promptText: promptIdsWithMatches.has(promptId)
        ? `${basePromptBody}\n${LOOP_REGRESSION_QUERY}`
        : basePromptBody
    }
  })

  const filesystem = createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Long',
      displayName: 'Long',
      prompts,
      promptFolderId: 'loop-folder'
    }
  ])

  const promptFolderPath = `${workspacePath}/Prompts/Long/PromptFolder.json`
  const promptFolderRaw = filesystem[promptFolderPath]
  if (typeof promptFolderRaw !== 'string') {
    throw new Error('Missing Long/PromptFolder.json in loop fixture workspace')
  }
  const promptFolderData = JSON.parse(promptFolderRaw) as {
    folderDescription?: string
  }
  promptFolderData.folderDescription = `Find marker in folder description: ${LOOP_REGRESSION_QUERY}`
  filesystem[promptFolderPath] = JSON.stringify(promptFolderData, null, 2)

  return filesystem
}

const buildVirtualFindRapidWorkspace = (workspacePath: string): Record<string, string | null> => {
  const promptMatchCounts = new Map<string, number>([
    ['rapid-loop-2', 2],
    ['rapid-loop-300', 7],
    ['rapid-loop-700', 1],
    ['rapid-loop-1100', 1]
  ])
  const basePromptBody = '\n'.repeat(80)
  const prompts = Array.from({ length: 1200 }, (_, index) => {
    const promptId = `rapid-loop-${index + 1}`
    const matchCount = promptMatchCounts.get(promptId) ?? 0
    const matchLines =
      matchCount <= 0
        ? ''
        : `\n${Array.from({ length: matchCount }, () => RAPID_LOOP_QUERY).join('\n')}`
    return {
      id: promptId,
      title: `Rapid Loop Prompt ${index + 1}`,
      promptText: `${basePromptBody}${matchLines}`
    }
  })

  const filesystem = createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Long',
      displayName: 'Long',
      prompts,
      promptFolderId: 'rapid-loop-folder'
    }
  ])

  const promptFolderPath = `${workspacePath}/Prompts/Long/PromptFolder.json`
  const promptFolderRaw = filesystem[promptFolderPath]
  if (typeof promptFolderRaw !== 'string') {
    throw new Error('Missing Long/PromptFolder.json in rapid loop fixture workspace')
  }
  const promptFolderData = JSON.parse(promptFolderRaw) as {
    folderDescription?: string
  }
  promptFolderData.folderDescription = `Rapid loop marker in folder description: ${RAPID_LOOP_QUERY}`
  filesystem[promptFolderPath] = JSON.stringify(promptFolderData, null, 2)

  return filesystem
}

const buildTypingAnchorWorkspace = (workspacePath: string): Record<string, string | null> => {
  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Anchor',
      displayName: 'Anchor',
      promptFolderId: 'typing-anchor-folder',
      prompts: [
        {
          id: 'typing-anchor-1',
          title: 'Typing Anchor Prompt',
          promptText: `hello first marker
zzzz marker line
hello second marker
hello third marker`
        }
      ]
    }
  ])
}

const buildConfiguredWordWorkspace = (workspacePath: string): Record<string, string | null> => {
  return createWorkspaceWithFolders(workspacePath, [
    {
      folderName: 'Boundaries',
      displayName: 'Boundaries',
      promptFolderId: 'configured-word-folder',
      prompts: [
        {
          id: 'configured-word-1',
          title: 'Configured Word Prompt',
          promptText: `1.23 marker`
        }
      ]
    }
  ])
}

describe('Prompt folder find dialog', () => {
  test('opens with Ctrl+F and closes with Escape or the close button', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    // Open a prompt folder so the find dialog is available.
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findClose = mainWindow.locator(FIND_CLOSE)

    // Step 1: open find.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    // Step 2: close with Escape.
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    // Step 3: reopen, then close with the X button.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findClose.click()
    await expect(findInput).toHaveCount(0)
  })

  test('reopens with previous query and selection', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    const longQuery = 'nonmatching-0123456789-abcdefghijklmnopqrstuvwxyz-unique-query'
    const getSelectionInfo = async (page: any) => {
      return await page.locator(FIND_INPUT).evaluate((el: HTMLTextAreaElement) => {
        return {
          start: el.selectionStart,
          end: el.selectionEnd,
          value: el.value
        }
      })
    }

    // Open a prompt folder so the find dialog is available.
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findPrev = mainWindow.locator('[data-testid="prompt-find-prev"]')
    const findNext = mainWindow.locator('[data-testid="prompt-find-next"]')
    const findClose = mainWindow.locator(FIND_CLOSE)

    // Step 1-3: open find, confirm dialog and disabled buttons.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findPrev).toHaveAttribute('aria-disabled', 'true')
    await expect(findNext).toHaveAttribute('aria-disabled', 'true')

    // Step 4-5: type a long query, then close.
    await findInput.fill(longQuery)
    await findClose.click()
    await expect(findInput).toHaveCount(0)

    // Step 6: reopen, confirm focus + preserved text + full selection.
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(longQuery)
    await expect(findInput).toBeFocused()

    await expect
      .poll(async () => getSelectionInfo(mainWindow), { timeout: 2000 })
      .toEqual({ start: 0, end: longQuery.length, value: longQuery })
  })

  test('seeds find input from selected Monaco text on Ctrl+F', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.down('Shift')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.up('Shift')

    const selectedText = await getMonacoSelectedText(mainWindow, editorSelector)
    expect(selectedText && selectedText.length > 0).toBe(true)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(selectedText!)
  })

  test('starts on the currently selected Monaco match when opening find', async ({ testSetup }) => {
    const workspacePath = '/ws/find-selection-start-match'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.down('Shift')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.up('Shift')

    const selectedText = await getMonacoSelectedText(mainWindow, editorSelector)
    expect(selectedText).toBe(TYPING_ANCHOR_QUERY)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)

    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 1, startColumn: 1 })
  })

  test('starts on the selected match when reopening find with the same persisted query', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-selection-start-match-reopen'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(TYPING_ANCHOR_QUERY)
    await findInput.press('Enter')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.down('Shift')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.up('Shift')

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 1, startColumn: 1 })
  })

  test('starts on the clicked Monaco word match when opening find from a collapsed cursor', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-clicked-word-start-match'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector, {
      clickPosition: { x: 28, y: 12 }
    })

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(TYPING_ANCHOR_QUERY)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 1, startColumn: 1 })
  })

  test('seeds find input from Monaco word at cursor on Ctrl+F', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowRight')

    const cursorWord = await getMonacoWordAtCursor(mainWindow, editorSelector)
    expect(cursorWord && cursorWord.length > 0).toBe(true)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(cursorWord!)
  })

  test('seeds find input from Monaco configured word at numeric boundaries', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-configured-word-boundary'
    await testSetup.setupFilesystem(buildConfiguredWordWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Boundaries')
    const editorSelector = promptEditorSelector('configured-word-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowRight')
    await mainWindow.keyboard.press('ArrowRight')

    const cursorWord = await getMonacoWordAtCursor(mainWindow, editorSelector)
    expect(cursorWord).toBe('23')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue(cursorWord!)
  })

  test('seeds find input from selected title text on Ctrl+F', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const titleSelector = `${promptEditorSelector('dev-2')} ${PROMPT_TITLE_SELECTOR}`
    await mainWindow.waitForSelector(titleSelector, { state: 'attached' })

    const selectedText = await mainWindow.evaluate((selector) => {
      const input = document.querySelector<HTMLInputElement>(selector)
      if (!input) return null
      const start = input.value.indexOf('Analysis')
      if (start < 0) return null
      const end = start + 'Analysis'.length
      input.focus({ preventScroll: true })
      input.setSelectionRange(start, end)
      input.dispatchEvent(new Event('select', { bubbles: true }))
      return input.value.slice(start, end)
    }, titleSelector)
    expect(selectedText).toBe('Analysis')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue('Analysis')
  })

  test('jumps to the first match after the original cursor location while typing', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-typing-anchor'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowDown')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    await findInput.type('h')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: 'h', startLineNumber: 3, startColumn: 1 })

    await findInput.type('e')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: 'he', startLineNumber: 3, startColumn: 1 })

    await findInput.type('llo')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })
  })

  test('keeps the original typing anchor when the query is changed or cleared', async ({
    testSetup
  }) => {
    const workspacePath = '/ws/find-typing-anchor-reset'
    await testSetup.setupFilesystem(buildTypingAnchorWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Anchor')
    const editorSelector = promptEditorSelector('typing-anchor-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    await focusMonacoEditor(mainWindow, editorSelector)
    await mainWindow.keyboard.press('Home')
    await mainWindow.keyboard.press('ArrowDown')

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    await findInput.fill(TYPING_ANCHOR_QUERY)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })

    await findInput.press('Enter')
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 4, startColumn: 1 })

    await findInput.fill('')
    await expect.poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 }).toBe('No results')

    await findInput.fill(TYPING_ANCHOR_QUERY)
    await expect
      .poll(() => getMonacoSelectionState(mainWindow, editorSelector), { timeout: 5000 })
      .toMatchObject({ selectedText: TYPING_ANCHOR_QUERY, startLineNumber: 3, startColumn: 1 })
  })

  test('focuses the current match after closing the find widget', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(promptEditorSelector('dev-1'), { state: 'attached' })
    await mainWindow.waitForSelector(promptEditorSelector('dev-2'), { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const findClose = mainWindow.locator(FIND_CLOSE)
    const devOneSelector = promptEditorSelector('dev-1')
    const devTwoTitleSelector = `${promptEditorSelector('dev-2')} ${PROMPT_TITLE_SELECTOR}`

    const getMonacoSelectionInfo = async (editorSelector: string) => {
      return await mainWindow.evaluate((selector) => {
        const monacoNode = document.querySelector(`${selector} .monaco-editor`)
        if (!monacoNode) return null

        const active = document.activeElement
        const hasDomFocus = !!active && monacoNode.contains(active)

        const registry = (
          window as unknown as {
            __cthulhuMonacoEditors?: Array<{
              container: HTMLElement | null
              editor: {
                getSelection: () => any
                getModel: () => {
                  getValueInRange: (range: any) => string
                } | null
              }
            }>
          }
        ).__cthulhuMonacoEditors

        if (!registry?.length) return null

        const entry = registry.find((item) => {
          if (!item?.container) return false
          return item.container === monacoNode || item.container.contains(monacoNode)
        })

        if (!entry) return null
        const model = entry.editor.getModel()
        const selection = entry.editor.getSelection()
        if (!model || !selection) return null
        return {
          text: model.getValueInRange(selection),
          hasDomFocus
        }
      }, editorSelector)
    }

    const getTitleSelectionInfo = async () => {
      return await mainWindow.evaluate((selector) => {
        const input = document.querySelector<HTMLInputElement>(selector)
        if (!input) return null
        const start = input.selectionStart ?? 0
        const end = input.selectionEnd ?? 0
        return {
          selectedText: input.value.slice(start, end),
          hasFocus: document.activeElement === input
        }
      }, devTwoTitleSelector)
    }

    const openFind = async () => {
      await mainWindow.keyboard.press('Control+F')
      await expect(findInput).toBeVisible()
    }

    const selectMatch = async (query: string) => {
      await findInput.fill(query)
      await findInput.press('Enter')
    }

    const bodyQuery = 'best practices'

    await openFind()
    await selectMatch(bodyQuery)
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getMonacoSelectionInfo(devOneSelector), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: true })

    await openFind()
    await selectMatch(bodyQuery)
    await findClose.click()
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getMonacoSelectionInfo(devOneSelector), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: true })

    const titleQuery = 'Analysis'

    await openFind()
    await selectMatch(titleQuery)
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getTitleSelectionInfo(), { timeout: 2000 })
      .toEqual({ selectedText: titleQuery, hasFocus: true })

    await expect(mainWindow.locator('[data-testid="prompt-folder-prompt-dev-2"]')).toHaveAttribute(
      'data-active',
      'true'
    )
  })

  test('restores focus to the last navigated match when closing with no results', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const bodyQuery = 'best practices'

    const getMonacoSelectionInfo = async () => {
      return await mainWindow.evaluate((selector) => {
        const monacoNode = document.querySelector(`${selector} .monaco-editor`)
        if (!monacoNode) return null

        const active = document.activeElement
        const hasDomFocus = !!active && monacoNode.contains(active)

        const registry = (
          window as unknown as {
            __cthulhuMonacoEditors?: Array<{
              container: HTMLElement | null
              editor: {
                getSelection: () => any
                getModel: () => {
                  getValueInRange: (range: any) => string
                } | null
              }
            }>
          }
        ).__cthulhuMonacoEditors

        if (!registry?.length) return null

        const entry = registry.find((item) => {
          if (!item?.container) return false
          return item.container === monacoNode || item.container.contains(monacoNode)
        })
        if (!entry) return null

        const model = entry.editor.getModel()
        const selection = entry.editor.getSelection()
        if (!model || !selection) return null

        return {
          text: model.getValueInRange(selection),
          hasDomFocus
        }
      }, editorSelector)
    }

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(bodyQuery)
    await findInput.press('Enter')

    await expect
      .poll(async () => getMonacoSelectionInfo(), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: false })

    await findInput.fill('nonmatching-query-0001')
    await expect.poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 }).toBe('No results')

    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await expect
      .poll(async () => getMonacoSelectionInfo(), { timeout: 2000 })
      .toEqual({ text: bodyQuery, hasDomFocus: true })
  })

  test('scrolls to a virtualized match and highlights it immediately', async ({ testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Long')
    await mainWindow.waitForSelector(promptEditorSelector('virtualization-test-1'), {
      state: 'attached'
    })

    const targetSelector = promptEditorSelector(VIRTUAL_FIND_LAST_PROMPT_ID)
    await expect(mainWindow.locator(targetSelector)).toHaveCount(0)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()

    const uniqueQuery = VIRTUAL_FIND_MARKER
    await findInput.fill(uniqueQuery)
    await expect(mainWindow.locator('[data-testid="prompt-find-widget"]')).not.toContainText(
      'No results'
    )

    const firstSelector = promptEditorSelector(VIRTUAL_FIND_FIRST_PROMPT_ID)
    await expect
      .poll(async () => {
        return await mainWindow.evaluate(
          ({ selector, expected }) => {
            const monacoNode = document.querySelector(`${selector} .monaco-editor`)
            if (!monacoNode) return null

            const registry = (
              window as unknown as {
                __cthulhuMonacoEditors?: Array<{
                  container: HTMLElement | null
                  editor: {
                    getSelection: () => any
                    getModel: () => {
                      getValueInRange: (range: any) => string
                    } | null
                  }
                }>
              }
            ).__cthulhuMonacoEditors

            if (!registry?.length) return null

            const entry = registry.find((item) => {
              if (!item?.container) return false
              return item.container === monacoNode || item.container.contains(monacoNode)
            })

            if (!entry) return null
            const model = entry.editor.getModel()
            const selection = entry.editor.getSelection()
            if (!model || !selection) return null
            const text = model.getValueInRange(selection)
            return text === expected
          },
          { selector: firstSelector, expected: uniqueQuery }
        )
      })
      .toBe(true)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate((selector) => {
          return document.querySelector(selector) != null
        }, `${firstSelector} .monaco-editor .currentFindMatch`)
      })
      .toBe(true)

    await expect(mainWindow.locator(targetSelector)).toHaveCount(0)

    await findInput.press('Enter')
    await mainWindow.waitForSelector(targetSelector, { state: 'attached' })

    const scrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
    expect(scrollTop).toBeGreaterThan(0)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate(
          ({ selector, expected }) => {
            const monacoNode = document.querySelector(`${selector} .monaco-editor`)
            if (!monacoNode) return null

            const registry = (
              window as unknown as {
                __cthulhuMonacoEditors?: Array<{
                  container: HTMLElement | null
                  editor: {
                    getSelection: () => any
                    getModel: () => {
                      getValueInRange: (range: any) => string
                    } | null
                  }
                }>
              }
            ).__cthulhuMonacoEditors

            if (!registry?.length) return null

            const entry = registry.find((item) => {
              if (!item?.container) return false
              return item.container === monacoNode || item.container.contains(monacoNode)
            })

            if (!entry) return null
            const model = entry.editor.getModel()
            const selection = entry.editor.getSelection()
            if (!model || !selection) return null
            const text = model.getValueInRange(selection)
            return text === expected
          },
          { selector: targetSelector, expected: uniqueQuery }
        )
      })
      .toBe(true)

    await expect
      .poll(async () => {
        return await mainWindow.evaluate((selector) => {
          return document.querySelector(selector) != null
        }, `${targetSelector} .monaco-editor .currentFindMatch`)
      })
      .toBe(true)
  })

  test('cycles correctly across 20 matches including two-digit counters', async ({ testSetup }) => {
    test.setTimeout(180000)
    const workspacePath = '/ws/virtual-find-loop'
    await testSetup.setupFilesystem(buildVirtualFindLoopWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(promptEditorSelector('loop-test-1'), {
      state: 'attached'
    })
    const promptIds = LOOP_MATCH_PROMPT_IDS

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await mainWindow.waitForSelector(SETTINGS_ROW_SELECTOR, { state: 'attached' })
    const settingsRowTestId = await mainWindow.evaluate((selector) => {
      return document.querySelector<HTMLElement>(selector)?.getAttribute('data-testid') ?? null
    }, SETTINGS_ROW_SELECTOR)
    expect(settingsRowTestId).not.toBeNull()

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(LOOP_REGRESSION_QUERY)

    const expectedRowIdsByStep = [
      settingsRowTestId!,
      ...promptIds.map((promptId) => `prompt-editor-${promptId}`)
    ]
    const totalMatches = expectedRowIdsByStep.length
    expect(totalMatches).toBe(20)
    await expect
      .poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 })
      .toBe(`1 of ${totalMatches}`)
    await expect
      .poll(() => getCurrentFindMatchRowTestId(mainWindow), { timeout: 5000 })
      .toBe(expectedRowIdsByStep[0])

    const totalPresses = totalMatches * 3
    for (let step = 1; step <= totalPresses; step += 1) {
      await findInput.press('Enter')
      const expectedMatchNumber = (step % totalMatches) + 1
      const expectedLabel = `${expectedMatchNumber} of ${totalMatches}`
      const expectedRowId = expectedRowIdsByStep[expectedMatchNumber - 1]

      await expect.poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 }).toBe(
        expectedLabel
      )
      await expect.poll(() => getCurrentFindMatchRowTestId(mainWindow), { timeout: 5000 }).toBe(
        expectedRowId
      )
    }
  })

  test('keeps next progression stable during rapid enter across virtualized hydration', async ({
    testSetup
  }) => {
    test.setTimeout(180000)
    const workspacePath = '/ws/virtual-find-rapid-loop'
    await testSetup.setupFilesystem(buildVirtualFindRapidWorkspace(workspacePath))
    await testSetup.setupFileDialog([workspacePath])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(promptEditorSelector('rapid-loop-1'), {
      state: 'attached'
    })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)

    const findInput = mainWindow.locator(FIND_INPUT)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(RAPID_LOOP_QUERY)
    await expect
      .poll(() => getFindMatchesLabelText(mainWindow), { timeout: 5000 })
      .toBe('1 of 12')

    await mainWindow.evaluate((selector) => {
      const label = document.querySelector<HTMLElement>(selector)
      if (!label) return

      const captureWindow = window as unknown as {
        __promptFindLabelEvents?: Array<{ current: number; total: number }>
        __promptFindLabelObserver?: MutationObserver
      }
      const events: Array<{ current: number; total: number }> = []
      const captureLabel = () => {
        const text = label.textContent?.trim() ?? ''
        const match = text.match(/^(\d+)\s+of\s+(\d+)$/)
        if (!match) return
        events.push({
          current: Number.parseInt(match[1], 10),
          total: Number.parseInt(match[2], 10)
        })
      }

      captureWindow.__promptFindLabelObserver?.disconnect()
      captureWindow.__promptFindLabelEvents = events
      captureLabel()

      const observer = new MutationObserver(() => {
        captureLabel()
      })
      observer.observe(label, { childList: true, characterData: true, subtree: true })
      captureWindow.__promptFindLabelObserver = observer
    }, FIND_MATCHES_LABEL)

    const totalPresses = 36
    for (let step = 0; step < totalPresses; step += 1) {
      await findInput.press('Enter')
    }

    await expect
      .poll(
        async () =>
          await mainWindow.evaluate(() => {
            const events =
              (window as unknown as {
                __promptFindLabelEvents?: Array<{ current: number; total: number }>
              }).__promptFindLabelEvents ?? []
            const compressed: Array<{ current: number; total: number }> = []
            for (const event of events) {
              const previous = compressed.at(-1)
              if (
                !previous ||
                previous.current !== event.current ||
                previous.total !== event.total
              ) {
                compressed.push(event)
              }
            }
            return compressed.length
          }),
        { timeout: 5000 }
      )
      .toBe(totalPresses + 1)

    const labelEvents = await mainWindow.evaluate(() => {
      const events =
        (window as unknown as {
          __promptFindLabelEvents?: Array<{ current: number; total: number }>
        }).__promptFindLabelEvents ?? []
      const compressed: Array<{ current: number; total: number }> = []
      for (const event of events) {
        const previous = compressed.at(-1)
        if (!previous || previous.current !== event.current || previous.total !== event.total) {
          compressed.push(event)
        }
      }
      return compressed
    })
    await mainWindow.evaluate(() => {
      const captureWindow = window as unknown as { __promptFindLabelObserver?: MutationObserver }
      captureWindow.__promptFindLabelObserver?.disconnect()
    })

    expect(labelEvents[0]).toEqual({ current: 1, total: 12 })
    for (let index = 1; index < labelEvents.length; index += 1) {
      const previous = labelEvents[index - 1]
      const next = labelEvents[index]
      const expectedCurrent = previous.current >= previous.total ? 1 : previous.current + 1
      expect(next.current).toBe(expectedCurrent)
      expect(next.total).toBe(previous.total)
    }
  })

  test('does not reselect the active find match after typing at a new cursor location', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const editorSelector = promptEditorSelector('dev-1')
    await mainWindow.waitForSelector(editorSelector, { state: 'attached' })

    const findInput = mainWindow.locator(FIND_INPUT)
    const query = 'best practices'

    const getMonacoSelectionInfo = async () => {
      return await mainWindow.evaluate((selector) => {
        const monacoNode = document.querySelector(`${selector} .monaco-editor`)
        if (!monacoNode) return null

        const registry = (
          window as unknown as {
            __cthulhuMonacoEditors?: Array<{
              container: HTMLElement | null
              editor: {
                getSelection: () => any
                getModel: () => {
                  getValueInRange: (range: any) => string
                  getOffsetAt: (position: any) => number
                } | null
              }
            }>
          }
        ).__cthulhuMonacoEditors

        if (!registry?.length) return null
        const entry = registry.find((item) => {
          if (!item?.container) return false
          return item.container === monacoNode || item.container.contains(monacoNode)
        })
        if (!entry) return null

        const model = entry.editor.getModel()
        const selection = entry.editor.getSelection()
        if (!model || !selection) return null

        return {
          selectedText: model.getValueInRange(selection),
          startOffset: model.getOffsetAt(selection.getStartPosition()),
          endOffset: model.getOffsetAt(selection.getEndPosition())
        }
      }, editorSelector)
    }

    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeVisible()
    await findInput.fill(query)
    await findInput.press('Enter')

    await expect
      .poll(async () => getMonacoSelectionInfo(), { timeout: 2000 })
      .toMatchObject({
        selectedText: query
      })

    await focusMonacoEditor(mainWindow, editorSelector, {
      clickPosition: { x: 12, y: 12 }
    })
    await mainWindow.keyboard.type('z')

    await expect
      .poll(
        async () => {
          const info = await getMonacoSelectionInfo()
          if (!info) return false
          return info.selectedText === '' && info.startOffset === info.endOffset
        },
        { timeout: 2000 }
      )
      .toBe(true)
  })
})
