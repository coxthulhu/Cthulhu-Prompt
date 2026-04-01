import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { heightTestPrompts } from '../fixtures/TestData'

const { test, describe, expect } = createPlaywrightTestSuite()

async function waitForStoredPromptFontSize(mainWindow: any, value: number): Promise<void> {
  await mainWindow.waitForFunction((expected) => {
    const ipc = window.electron?.ipcRenderer
    if (!ipc?.invoke) return false
    return ipc.invoke('load-system-settings').then((result) => {
      return result?.systemSettings?.data?.promptFontSize === expected
    })
  }, value)
}

async function waitForStoredShowLineNumbers(mainWindow: any, value: boolean): Promise<void> {
  await mainWindow.waitForFunction((expected) => {
    const ipc = window.electron?.ipcRenderer
    if (!ipc?.invoke) return false
    return ipc.invoke('load-system-settings').then((result) => {
      return result?.systemSettings?.data?.showLineNumbers === expected
    })
  }, value)
}

async function setPromptFontSize(
  mainWindow: any,
  testHelpers: {
    navigateToSettingsScreen: () => Promise<void>
    navigateToHomeScreen: () => Promise<void>
  },
  value: number
): Promise<void> {
  await testHelpers.navigateToSettingsScreen()
  const input = mainWindow.locator('[data-testid="font-size-input"]')
  await input.fill(String(value))
  await expect(input).toHaveValue(String(value))
  await testHelpers.navigateToHomeScreen()
  await waitForStoredPromptFontSize(mainWindow, value)
}

async function getMonacoLineHeight(mainWindow: any, editorSelector: string): Promise<number> {
  const monacoSelector = `${editorSelector} .monaco-editor`
  await mainWindow.waitForSelector(monacoSelector, { state: 'visible' })
  await mainWindow.waitForSelector(`${monacoSelector} .view-line`, { state: 'attached' })

  const lineHeight = await mainWindow.evaluate(
    ({ selector }) => {
      const editor = document.querySelector(selector)
      const line = editor?.querySelector<HTMLElement>('.view-lines .view-line')
      if (!line) return null
      return Math.round(line.getBoundingClientRect().height)
    },
    { selector: monacoSelector }
  )

  if (lineHeight == null) {
    throw new Error('Failed to measure Monaco line height.')
  }

  return lineHeight
}

async function getMonacoLineNumbersSetting(
  mainWindow: any,
  editorSelector: string
): Promise<string | null> {
  return await mainWindow.evaluate((selector) => {
    const row = document.querySelector(selector)
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
            getRawOptions: () => { lineNumbers?: string }
          }
        }>
      }
    ).__cthulhuMonacoEditors

    const entry = registry?.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })

    return entry?.editor.getRawOptions().lineNumbers ?? null
  }, editorSelector)
}

describe('Prompt editor settings', () => {
  test('applies updated font size to Monaco editors', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'height' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    const prompt = heightTestPrompts.singleLine
    const rowSelector = promptEditorSelector(prompt.id)
    const placeholderSelector = `${rowSelector} ${MONACO_PLACEHOLDER_SELECTOR}`

    await setPromptFontSize(mainWindow, testHelpers, 12)
    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: prompt.title,
      hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
      promptSelector: rowSelector,
      placeholderSelector
    })

    const smallLineHeight = await getMonacoLineHeight(mainWindow, rowSelector)

    await setPromptFontSize(mainWindow, testHelpers, 32)
    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: prompt.title,
      hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
      promptSelector: rowSelector,
      placeholderSelector
    })

    await mainWindow.waitForFunction(
      ({ selector, minHeight }) => {
        const editor = document.querySelector(selector)
        const line = editor?.querySelector<HTMLElement>('.view-lines .view-line')
        if (!line) return false
        return line.getBoundingClientRect().height > minHeight
      },
      {
        selector: `${rowSelector} .monaco-editor`,
        minHeight: Math.ceil(smallLineHeight * 1.5)
      }
    )

    const largeLineHeight = await getMonacoLineHeight(mainWindow, rowSelector)

    expect(largeLineHeight).toBeGreaterThan(smallLineHeight * 2)
  })

  test('keeps updated font size after blur', async ({ testSetup }) => {
    const updatedFontSize = 27
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToSettingsScreen()
    const input = mainWindow.locator('[data-testid="font-size-input"]')
    const minLinesInput = mainWindow.locator('[data-testid="min-lines-input"]')
    await input.fill(String(updatedFontSize))
    await expect(input).toHaveValue(String(updatedFontSize))

    await minLinesInput.click()
    await expect(input).toHaveValue(String(updatedFontSize))
    await waitForStoredPromptFontSize(mainWindow, updatedFontSize)
  })

  test('applies the line number setting to Monaco editors', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'height' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    const prompt = heightTestPrompts.singleLine
    const rowSelector = promptEditorSelector(prompt.id)
    const placeholderSelector = `${rowSelector} ${MONACO_PLACEHOLDER_SELECTOR}`

    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: prompt.title,
      hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
      promptSelector: rowSelector,
      placeholderSelector
    })

    await expect.poll(async () => getMonacoLineNumbersSetting(mainWindow, rowSelector)).toBe('on')

    await testHelpers.navigateToSettingsScreen()
    const toggle = mainWindow.locator('[data-testid="show-line-numbers-toggle"]')
    await toggle.click()
    await expect(toggle).toContainText('Disabled')
    await waitForStoredShowLineNumbers(mainWindow, false)

    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: prompt.title,
      hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
      promptSelector: rowSelector,
      placeholderSelector
    })

    await expect.poll(async () => getMonacoLineNumbersSetting(mainWindow, rowSelector)).toBe('off')
  })
})
