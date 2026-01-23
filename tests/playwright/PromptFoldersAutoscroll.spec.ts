import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const TITLE_SELECTOR = PROMPT_TITLE_SELECTOR
const FIRST_PROMPT_SELECTOR = promptEditorSelector('virtualization-test-1')
const FIRST_EMPTY_PROMPT_SELECTOR = promptEditorSelector('empty-1')
const FIRST_WRAPPED_PROMPT_SELECTOR = promptEditorSelector('measurement-1')
const EMPTY_FOLDER_NAME = 'Empty'
const MONACO_CURSOR_LINE_SELECTOR = '.monaco-editor .view-overlays .current-line'
const MONACO_CURSOR_SELECTOR = '.monaco-editor .cursor'
const LONG_WRAPPED_FOLDER_NAME = 'Long Wrapped Singles'

describe('Prompt Folders Autoscroll', () => {
  test('scrolls title input to 100px from bottom when typing', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    // Align the first offscreen title input to the bottom of the viewport.
    const target = await mainWindow.evaluate(
      ({ hostSelector, titleSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return null
        const hostRect = host.getBoundingClientRect()
        const inputs = Array.from(host.querySelectorAll<HTMLInputElement>(titleSelector))
        const candidate = inputs
          .map((input) => ({ input, rect: input.getBoundingClientRect() }))
          .filter(({ rect }) => rect.top >= hostRect.bottom)
          .sort((a, b) => a.rect.top - b.rect.top)[0]
        if (!candidate) return null

        const row = candidate.input.closest('[data-virtual-window-row]') as HTMLElement | null
        const promptTestId = row?.getAttribute('data-testid')
        if (!promptTestId) return null

        const scrollDelta = Math.round(candidate.rect.bottom - hostRect.bottom)

        return { promptTestId, scrollDelta }
      },
      { hostSelector: HOST_SELECTOR, titleSelector: TITLE_SELECTOR }
    )

    if (!target?.promptTestId || typeof target.scrollDelta !== 'number') {
      throw new Error('Failed to find a prompt title below the viewport.')
    }

    await testHelpers.scrollVirtualWindowBy(HOST_SELECTOR, target.scrollDelta)

    const targetSelector = `[data-testid="${target.promptTestId}"] ${TITLE_SELECTOR}`

    await mainWindow.waitForFunction(
      ({ hostSelector, targetSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const input = document.querySelector<HTMLInputElement>(targetSelector)
        if (!host || !input) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const inputBottom = input.getBoundingClientRect().bottom
        return Math.abs(Math.round(hostBottom - inputBottom)) <= 2
      },
      { hostSelector: HOST_SELECTOR, targetSelector }
    )

    const input = mainWindow.locator(targetSelector)
    await input.click()
    await input.type('Autoscroll check')

    await mainWindow.waitForFunction(
      ({ hostSelector, targetSelector, targetDistance, tolerance }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const input = document.querySelector<HTMLInputElement>(targetSelector)
        if (!host || !input) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = input.getBoundingClientRect()
        const inputCenter = rect.top + rect.height / 2
        const distance = Math.round(hostBottom - inputCenter)
        return Math.abs(distance - targetDistance) <= tolerance
      },
      { hostSelector: HOST_SELECTOR, targetSelector, targetDistance: 100, tolerance: 2 }
    )

    const finalDistance = await mainWindow.evaluate(
      ({ hostSelector, targetSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const input = document.querySelector<HTMLInputElement>(targetSelector)
        if (!host || !input) return null
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = input.getBoundingClientRect()
        const inputCenter = rect.top + rect.height / 2
        return Math.round(hostBottom - inputCenter)
      },
      { hostSelector: HOST_SELECTOR, targetSelector }
    )

    if (finalDistance == null) {
      throw new Error('Failed to measure the final input position.')
    }

    expect(Math.abs(finalDistance - 100)).toBeLessThanOrEqual(2)
  })

  test('scrolls Monaco cursor to 100px from bottom when typing', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(EMPTY_FOLDER_NAME)

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_EMPTY_PROMPT_SELECTOR, {
      state: 'attached',
      timeout: 6000
    })

    const target = await mainWindow.evaluate(
      ({ hostSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return null
        const hostRect = host.getBoundingClientRect()
        const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-virtual-window-row]'))
        const candidate = rows
          .map((row) => ({ row, rect: row.getBoundingClientRect() }))
          .filter(({ rect }) => rect.top >= hostRect.bottom)
          .sort((a, b) => a.rect.top - b.rect.top)[0]
        if (!candidate) return null

        const promptTestId = candidate.row.getAttribute('data-testid')
        if (!promptTestId) return null

        return { promptTestId }
      },
      { hostSelector: HOST_SELECTOR }
    )

    if (!target?.promptTestId) {
      throw new Error('Failed to find a prompt editor below the viewport.')
    }

    const rowSelector = `[data-testid="${target.promptTestId}"]`

    const rowScrollDelta = await mainWindow.evaluate(
      ({ hostSelector, rowSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        if (!host || !row) return null
        const hostRect = host.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        if (rowRect.bottom > hostRect.bottom) {
          return Math.round(rowRect.bottom - hostRect.bottom)
        }
        if (rowRect.top < hostRect.top) {
          return Math.round(rowRect.top - hostRect.top)
        }
        return 0
      },
      { hostSelector: HOST_SELECTOR, rowSelector }
    )

    if (typeof rowScrollDelta === 'number' && rowScrollDelta !== 0) {
      await testHelpers.scrollVirtualWindowBy(HOST_SELECTOR, rowScrollDelta)
    }
    await waitForMonacoEditor(mainWindow, rowSelector)

    await focusMonacoEditor(mainWindow, rowSelector)

    await mainWindow.waitForFunction(
      ({ rowSelector, lineSelector }) => {
        return !!document.querySelector(`${rowSelector} ${lineSelector}`)
      },
      { rowSelector, lineSelector: MONACO_CURSOR_LINE_SELECTOR }
    )

    // Align the first Monaco line to the bottom of the viewport.
    const lineScrollDelta = await mainWindow.evaluate(
      ({ hostSelector, rowSelector, lineSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const line = document.querySelector<HTMLElement>(`${rowSelector} ${lineSelector}`)
        if (!host || !line) return null

        const hostRect = host.getBoundingClientRect()
        const lineRect = line.getBoundingClientRect()
        const lineCenter = lineRect.top + lineRect.height / 2
        return Math.round(lineCenter - hostRect.bottom)
      },
      { hostSelector: HOST_SELECTOR, rowSelector, lineSelector: MONACO_CURSOR_LINE_SELECTOR }
    )

    if (typeof lineScrollDelta === 'number') {
      await testHelpers.scrollVirtualWindowBy(HOST_SELECTOR, lineScrollDelta)
    }

    await mainWindow.waitForFunction(
      ({ hostSelector, rowSelector, lineSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const line = document.querySelector<HTMLElement>(`${rowSelector} ${lineSelector}`)
        if (!host || !line) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const lineRect = line.getBoundingClientRect()
        const lineCenter = lineRect.top + lineRect.height / 2
        return Math.abs(Math.round(hostBottom - lineCenter)) <= 2
      },
      { hostSelector: HOST_SELECTOR, rowSelector, lineSelector: MONACO_CURSOR_LINE_SELECTOR }
    )
    await mainWindow.keyboard.type('Autoscroll check')

    await mainWindow.waitForFunction(
      ({ hostSelector, rowSelector, lineSelector, targetDistance, tolerance }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        if (!host || !row) return false
        const line = row.querySelector<HTMLElement>(lineSelector)
        if (!line) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = line.getBoundingClientRect()
        const lineCenter = rect.top + rect.height / 2
        const distance = Math.round(hostBottom - lineCenter)
        return Math.abs(distance - targetDistance) <= tolerance
      },
      {
        hostSelector: HOST_SELECTOR,
        rowSelector,
        lineSelector: MONACO_CURSOR_LINE_SELECTOR,
        targetDistance: 100,
        tolerance: 2
      }
    )

    await mainWindow.keyboard.press('Enter')
    await mainWindow.keyboard.press('Enter')
    await mainWindow.keyboard.press('Enter')
    await mainWindow.keyboard.press('Enter')

    await mainWindow.waitForFunction(
      ({ hostSelector, rowSelector, lineSelector, targetDistance, tolerance }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        if (!host || !row) return false
        const line = row.querySelector<HTMLElement>(lineSelector)
        if (!line) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = line.getBoundingClientRect()
        const lineCenter = rect.top + rect.height / 2
        const distance = Math.round(hostBottom - lineCenter)
        return Math.abs(distance - targetDistance) <= tolerance
      },
      {
        hostSelector: HOST_SELECTOR,
        rowSelector,
        lineSelector: MONACO_CURSOR_LINE_SELECTOR,
        targetDistance: 100,
        tolerance: 2
      },
      { timeout: 2000 }
    )
  })

  test('scrolls Monaco cursor within wrapped lines to 100px from bottom when navigating', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'long-wrapped-lines' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(LONG_WRAPPED_FOLDER_NAME)

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_WRAPPED_PROMPT_SELECTOR, {
      state: 'attached',
      timeout: 6000
    })

    const target = await mainWindow.evaluate(
      ({ hostSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        if (!host) return null
        const hostRect = host.getBoundingClientRect()
        const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-virtual-window-row]'))
        const candidate = rows
          .map((row) => ({ row, rect: row.getBoundingClientRect() }))
          .filter(({ rect }) => rect.top >= hostRect.bottom)
          .sort((a, b) => a.rect.top - b.rect.top)[0]
        if (!candidate) return null

        const promptTestId = candidate.row.getAttribute('data-testid')
        if (!promptTestId) return null

        return { promptTestId }
      },
      { hostSelector: HOST_SELECTOR }
    )

    if (!target?.promptTestId) {
      throw new Error('Failed to find a prompt editor below the viewport.')
    }

    const rowSelector = `[data-testid="${target.promptTestId}"]`

    const rowScrollDelta = await mainWindow.evaluate(
      ({ hostSelector, rowSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        if (!host || !row) return null
        const hostRect = host.getBoundingClientRect()
        const rowRect = row.getBoundingClientRect()
        if (rowRect.bottom > hostRect.bottom) {
          return Math.round(rowRect.bottom - hostRect.bottom)
        }
        if (rowRect.top < hostRect.top) {
          return Math.round(rowRect.top - hostRect.top)
        }
        return 0
      },
      { hostSelector: HOST_SELECTOR, rowSelector }
    )

    if (typeof rowScrollDelta === 'number' && rowScrollDelta !== 0) {
      await testHelpers.scrollVirtualWindowBy(HOST_SELECTOR, rowScrollDelta)
    }

    await waitForMonacoEditor(mainWindow, rowSelector)

    const didFocus = await mainWindow.evaluate(
      ({ rowSelector }) => {
        const monacoNode = document.querySelector(`${rowSelector} .monaco-editor`)
        if (!monacoNode) return false
        const registry = (
          window as unknown as {
            __cthulhuMonacoEditors?: Array<{
              container: HTMLElement | null
              editor: {
                focus: () => void
                setPosition: (pos: { lineNumber: number; column: number }) => void
              }
            }>
          }
        ).__cthulhuMonacoEditors

        if (!registry?.length) return false
        const entry = registry.find((item) => {
          if (!item?.container) return false
          return item.container === monacoNode || item.container.contains(monacoNode)
        })
        if (!entry) return false
        entry.editor.focus()
        entry.editor.setPosition({ lineNumber: 1, column: 1 })
        return true
      },
      { rowSelector }
    )

    if (!didFocus) {
      throw new Error('Failed to focus Monaco editor.')
    }

    await mainWindow.waitForFunction(
      ({ rowSelector, cursorSelector }) => {
        return !!document.querySelector(`${rowSelector} ${cursorSelector}`)
      },
      { rowSelector, cursorSelector: MONACO_CURSOR_SELECTOR }
    )

    const cursorScrollDelta = await mainWindow.evaluate(
      ({ hostSelector, rowSelector, cursorSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const cursor = document.querySelector<HTMLElement>(`${rowSelector} ${cursorSelector}`)
        if (!host || !cursor) return null

        const hostRect = host.getBoundingClientRect()
        const cursorRect = cursor.getBoundingClientRect()
        const cursorCenter = cursorRect.top + cursorRect.height / 2
        return Math.round(cursorCenter - hostRect.bottom)
      },
      { hostSelector: HOST_SELECTOR, rowSelector, cursorSelector: MONACO_CURSOR_SELECTOR }
    )

    if (typeof cursorScrollDelta === 'number') {
      await testHelpers.scrollVirtualWindowBy(HOST_SELECTOR, cursorScrollDelta)
    }

    await mainWindow.waitForFunction(
      ({ hostSelector, rowSelector, cursorSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const cursor = document.querySelector<HTMLElement>(`${rowSelector} ${cursorSelector}`)
        if (!host || !cursor) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const cursorRect = cursor.getBoundingClientRect()
        const cursorCenter = cursorRect.top + cursorRect.height / 2
        return Math.abs(Math.round(hostBottom - cursorCenter)) <= 2
      },
      { hostSelector: HOST_SELECTOR, rowSelector, cursorSelector: MONACO_CURSOR_SELECTOR }
    )

    for (let i = 0; i < 20; i += 1) {
      await mainWindow.keyboard.press('ArrowDown')
    }

    await mainWindow.waitForFunction(
      ({ hostSelector, rowSelector, cursorSelector, targetDistance, tolerance }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        if (!host || !row) return false
        const cursor = row.querySelector<HTMLElement>(cursorSelector)
        if (!cursor) return false
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = cursor.getBoundingClientRect()
        const cursorCenter = rect.top + rect.height / 2
        const distance = Math.round(hostBottom - cursorCenter)
        return Math.abs(distance - targetDistance) <= tolerance
      },
      {
        hostSelector: HOST_SELECTOR,
        rowSelector,
        cursorSelector: MONACO_CURSOR_SELECTOR,
        targetDistance: 100,
        tolerance: 2
      }
    )

    const finalDistance = await mainWindow.evaluate(
      ({ hostSelector, rowSelector, cursorSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const cursor = document.querySelector<HTMLElement>(`${rowSelector} ${cursorSelector}`)
        if (!host || !cursor) return null
        const hostBottom = host.getBoundingClientRect().bottom
        const rect = cursor.getBoundingClientRect()
        const cursorCenter = rect.top + rect.height / 2
        return Math.round(hostBottom - cursorCenter)
      },
      { hostSelector: HOST_SELECTOR, rowSelector, cursorSelector: MONACO_CURSOR_SELECTOR }
    )

    if (finalDistance == null) {
      throw new Error('Failed to measure the final cursor position.')
    }

    expect(Math.abs(finalDistance - 100)).toBeLessThanOrEqual(2)
  })
})
