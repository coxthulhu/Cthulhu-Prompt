import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
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
const CENTERED_SCROLL_WORKSPACE_PATH = '/ws/centered-scroll-regression'
const CENTERED_SCROLL_FOLDER_NAME = 'Centered Scroll Regression'
const CENTERED_SCROLL_PROMPT_COUNT = 8
const CENTERED_SCROLL_LAST_PROMPT_ID = `centered-scroll-${CENTERED_SCROLL_PROMPT_COUNT}`
const CENTERED_SCROLL_LAST_PROMPT_SELECTOR = promptEditorSelector(CENTERED_SCROLL_LAST_PROMPT_ID)

type PromptTarget = {
  promptTestId: string
}

type PromptTitleTarget = PromptTarget & {
  scrollDelta: number
}

type MonacoLineMetrics = {
  centerY: number
  distanceFromHostBottom: number
  isVisibleInHost: boolean
}

const centeredScrollPromptIds = Array.from(
  { length: CENTERED_SCROLL_PROMPT_COUNT },
  (_, index) => `centered-scroll-${index + 1}`
)

const createTenLinePromptText = (promptNumber: number): string =>
  Array.from({ length: 10 }, (_, index) => `Prompt ${promptNumber} line ${index + 1}`).join('\n')

const createCenteredScrollWorkspace = (): Record<string, string | null> =>
  createWorkspaceWithFolders(CENTERED_SCROLL_WORKSPACE_PATH, [
    {
      folderName: 'CenteredScrollRegression',
      displayName: CENTERED_SCROLL_FOLDER_NAME,
      prompts: centeredScrollPromptIds.map((id, index) => ({
        id,
        title: `Centered Scroll ${index + 1}`,
        promptText: createTenLinePromptText(index + 1)
      }))
    }
  ])

async function waitForStoredPromptMaxLines(mainWindow: any, value: number): Promise<void> {
  await mainWindow.waitForFunction((expected) => {
    const ipc = window.electron?.ipcRenderer
    if (!ipc?.invoke) return false
    return ipc.invoke('load-system-settings').then((result) => {
      return result?.systemSettings?.data?.promptEditorMaxLines === expected
    })
  }, value)
}

async function setPromptEditorMaxLinesForTest(
  mainWindow: any,
  testHelpers: {
    navigateToSettingsScreen: () => Promise<void>
    navigateToHomeScreen: () => Promise<void>
  },
  value: number
): Promise<void> {
  await testHelpers.navigateToSettingsScreen()
  const input = mainWindow.locator('[data-testid="max-lines-input"]')
  await input.fill(String(value))
  await expect(input).toHaveValue(String(value))
  await testHelpers.navigateToHomeScreen()
  await waitForStoredPromptMaxLines(mainWindow, value)
}

const scrollForNextCandidate = async (page: any, testHelpers: any): Promise<boolean> => {
  const metrics = await page.evaluate((hostSelector) => {
    const host = document.querySelector<HTMLElement>(hostSelector)
    if (!host) return null
    return {
      scrollTop: host.scrollTop,
      clientHeight: host.clientHeight,
      scrollHeight: host.scrollHeight
    }
  }, HOST_SELECTOR)

  if (!metrics) return false
  const remainingScrollPx = metrics.scrollHeight - (metrics.scrollTop + metrics.clientHeight)
  if (remainingScrollPx <= 0) return false

  const scrollDelta = Math.max(1, Math.round(metrics.clientHeight * 0.75))
  await testHelpers.scrollVirtualWindowBy(HOST_SELECTOR, scrollDelta)
  return true
}

const findPromptTitleBelowViewport = async (
  page: any,
  testHelpers: any
): Promise<PromptTitleTarget | null> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const target = await page.evaluate(
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

    if (target?.promptTestId && typeof target.scrollDelta === 'number') return target
    if (!(await scrollForNextCandidate(page, testHelpers))) return null
  }

  return null
}

const findPromptEditorBelowViewport = async (
  page: any,
  testHelpers: any
): Promise<PromptTarget | null> => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const target = await page.evaluate(
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

    if (target?.promptTestId) return target
    if (!(await scrollForNextCandidate(page, testHelpers))) return null
  }

  return null
}

const getMonacoLineMetrics = async (
  page: any,
  rowSelector: string,
  lineNumber: number
): Promise<MonacoLineMetrics | null> => {
  return await page.evaluate(
    ({ hostSelector, rowSelector, lineNumber }) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      const row = document.querySelector<HTMLElement>(rowSelector)
      const line = row?.querySelectorAll<HTMLElement>('.monaco-editor .view-lines .view-line')[
        lineNumber - 1
      ]
      if (!host || !line) return null

      const hostRect = host.getBoundingClientRect()
      const lineRect = line.getBoundingClientRect()
      const centerY = lineRect.top + lineRect.height / 2

      return {
        centerY: Math.round(centerY),
        distanceFromHostBottom: Math.round(hostRect.bottom - centerY),
        isVisibleInHost: centerY >= hostRect.top && centerY <= hostRect.bottom
      }
    },
    { hostSelector: HOST_SELECTOR, rowSelector, lineNumber }
  )
}

const clickMonacoLine = async (page: any, rowSelector: string, lineNumber: number): Promise<void> => {
  const point = await page.evaluate(
    ({ hostSelector, rowSelector, lineNumber }) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      const row = document.querySelector<HTMLElement>(rowSelector)
      const line = row?.querySelectorAll<HTMLElement>('.monaco-editor .view-lines .view-line')[
        lineNumber - 1
      ]
      if (!host || !line) return null

      const hostRect = host.getBoundingClientRect()
      const lineRect = line.getBoundingClientRect()
      const x = lineRect.left + Math.min(80, Math.max(8, lineRect.width / 2))
      const y = lineRect.top + lineRect.height / 2
      const isVisibleInHost = y >= hostRect.top && y <= hostRect.bottom

      return isVisibleInHost ? { x: Math.round(x), y: Math.round(y) } : null
    },
    { hostSelector: HOST_SELECTOR, rowSelector, lineNumber }
  )

  if (!point) {
    throw new Error(`Failed to click visible Monaco line ${lineNumber} in ${rowSelector}`)
  }

  await page.mouse.click(point.x, point.y)
}

const getMonacoCursorLineNumber = async (
  page: any,
  rowSelector: string
): Promise<number | null> => {
  return await page.evaluate((rowSelector) => {
    const row = document.querySelector(rowSelector)
    const monacoNode = row?.querySelector('.monaco-editor')
    if (!row || !monacoNode) return null

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getPosition: () => { lineNumber: number } | null
          }
        }>
      }
    ).__cthulhuMonacoEditors

    const entry = registry?.find((item) => {
      if (!item?.container) return false
      return (
        item.container === monacoNode ||
        item.container.contains(monacoNode) ||
        monacoNode.contains(item.container)
      )
    })

    return entry?.editor.getPosition()?.lineNumber ?? null
  }, rowSelector)
}

const findPromptTreeTargetForPartialLastEditorVisibility = async (
  page: any,
  promptIds: string[],
  lastPromptId: string
): Promise<string> => {
  const target = await page.evaluate(
    ({ hostSelector, promptIds, lastPromptId }) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      const lastRow = document.querySelector<HTMLElement>(`[data-testid="prompt-editor-${lastPromptId}"]`)
      const firstLine = lastRow?.querySelectorAll<HTMLElement>(
        '.monaco-editor .view-lines .view-line'
      )[0]
      const lastLine = lastRow?.querySelectorAll<HTMLElement>(
        '.monaco-editor .view-lines .view-line'
      )[9]

      if (!host || !lastRow || !firstLine || !lastLine) return null

      const hostRect = host.getBoundingClientRect()
      const currentScrollTop =
        window.svelteVirtualWindowTestControls?.getScrollTop?.(host.dataset.testid ?? '') ??
        host.scrollTop
      const resolveOffset = (element: HTMLElement): number =>
        element.getBoundingClientRect().top - hostRect.top + currentScrollTop
      const firstLineCenterOffset =
        resolveOffset(firstLine) + firstLine.getBoundingClientRect().height / 2
      const lastLineCenterOffset =
        resolveOffset(lastLine) + lastLine.getBoundingClientRect().height / 2
      const candidates = promptIds.filter((promptId) => promptId !== lastPromptId).reverse()

      for (const promptId of candidates) {
        const row = document.querySelector<HTMLElement>(`[data-testid="prompt-editor-${promptId}"]`)
        if (!row) continue

        const rowRect = row.getBoundingClientRect()
        const rowOffset = rowRect.top - hostRect.top + currentScrollTop
        const centeredScrollTop = rowOffset + rowRect.height / 2 - hostRect.height / 2
        const firstLineCenterAfterTreeClick = firstLineCenterOffset - centeredScrollTop
        const lastLineCenterAfterTreeClick = lastLineCenterOffset - centeredScrollTop

        if (
          firstLineCenterAfterTreeClick >= 0 &&
          firstLineCenterAfterTreeClick <= hostRect.height &&
          lastLineCenterAfterTreeClick > hostRect.height
        ) {
          return promptId
        }
      }

      return null
    },
    { hostSelector: HOST_SELECTOR, promptIds, lastPromptId }
  )

  if (!target) {
    throw new Error('Failed to find a prompt tree target that leaves only the last editor top visible.')
  }

  return target
}

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
    const target = await findPromptTitleBelowViewport(mainWindow, testHelpers)

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

    const target = await findPromptEditorBelowViewport(mainWindow, testHelpers)

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

    await setPromptEditorMaxLinesForTest(mainWindow, testHelpers, 40)
    await testHelpers.navigateToPromptFolders(LONG_WRAPPED_FOLDER_NAME)

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_WRAPPED_PROMPT_SELECTOR, {
      state: 'attached',
      timeout: 6000
    })

    const target = await findPromptEditorBelowViewport(mainWindow, testHelpers)

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

  test('minimally reveals the previous Monaco cursor after prompt tree centered navigation', async ({
    testSetup
  }) => {
    await testSetup.setupFilesystem(createCenteredScrollWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(CENTERED_SCROLL_WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders(CENTERED_SCROLL_FOLDER_NAME)
    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })

    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, scrollHeight)
    await mainWindow.waitForSelector(CENTERED_SCROLL_LAST_PROMPT_SELECTOR, {
      state: 'attached',
      timeout: 6000
    })
    await waitForMonacoEditor(mainWindow, CENTERED_SCROLL_LAST_PROMPT_SELECTOR)

    await mainWindow.waitForFunction(
      ({ rowSelector, expectedLineCount }) => {
        const lines = document.querySelectorAll(
          `${rowSelector} .monaco-editor .view-lines .view-line`
        )
        return lines.length === expectedLineCount
      },
      { rowSelector: CENTERED_SCROLL_LAST_PROMPT_SELECTOR, expectedLineCount: 10 }
    )

    await clickMonacoLine(mainWindow, CENTERED_SCROLL_LAST_PROMPT_SELECTOR, 10)
    await expect
      .poll(() => getMonacoCursorLineNumber(mainWindow, CENTERED_SCROLL_LAST_PROMPT_SELECTOR))
      .toBe(10)

    const treeTargetPromptId = await findPromptTreeTargetForPartialLastEditorVisibility(
      mainWindow,
      centeredScrollPromptIds,
      CENTERED_SCROLL_LAST_PROMPT_ID
    )
    const treeTargetSelector = `[data-testid="prompt-tree-prompt-${treeTargetPromptId}"]`
    await expect(mainWindow.locator(treeTargetSelector)).toBeVisible()

    await mainWindow.locator(treeTargetSelector).click()

    await mainWindow.waitForFunction(
      ({ rowSelector, hostSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        const lines = row?.querySelectorAll<HTMLElement>('.monaco-editor .view-lines .view-line')
        const firstLine = lines?.[0]
        const lastLine = lines?.[9]
        if (!host || !firstLine || !lastLine) return false

        const hostRect = host.getBoundingClientRect()
        const firstLineRect = firstLine.getBoundingClientRect()
        const lastLineRect = lastLine.getBoundingClientRect()
        const firstLineCenter = firstLineRect.top + firstLineRect.height / 2
        const lastLineCenter = lastLineRect.top + lastLineRect.height / 2

        return (
          firstLineCenter >= hostRect.top &&
          firstLineCenter <= hostRect.bottom &&
          lastLineCenter > hostRect.bottom
        )
      },
      {
        rowSelector: CENTERED_SCROLL_LAST_PROMPT_SELECTOR,
        hostSelector: HOST_SELECTOR
      }
    )

    await clickMonacoLine(mainWindow, CENTERED_SCROLL_LAST_PROMPT_SELECTOR, 1)

    await mainWindow.waitForFunction(
      ({ rowSelector, hostSelector }) => {
        const host = document.querySelector<HTMLElement>(hostSelector)
        const row = document.querySelector<HTMLElement>(rowSelector)
        const lastLine = row?.querySelectorAll<HTMLElement>(
          '.monaco-editor .view-lines .view-line'
        )[9]
        if (!host || !lastLine) return false

        const hostRect = host.getBoundingClientRect()
        const lastLineRect = lastLine.getBoundingClientRect()
        const lastLineCenter = lastLineRect.top + lastLineRect.height / 2
        return lastLineCenter >= hostRect.top && lastLineCenter <= hostRect.bottom
      },
      {
        rowSelector: CENTERED_SCROLL_LAST_PROMPT_SELECTOR,
        hostSelector: HOST_SELECTOR
      }
    )

    const finalLastLineMetrics = await getMonacoLineMetrics(
      mainWindow,
      CENTERED_SCROLL_LAST_PROMPT_SELECTOR,
      10
    )

    if (!finalLastLineMetrics) {
      throw new Error('Failed to measure final last-line position.')
    }

    expect(finalLastLineMetrics.isVisibleInHost).toBe(true)
    expect(Math.abs(finalLastLineMetrics.distanceFromHostBottom - 100)).toBeLessThanOrEqual(2)
  })
})
