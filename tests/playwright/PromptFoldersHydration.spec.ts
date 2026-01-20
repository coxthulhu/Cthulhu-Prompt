import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  MONACO_PLACEHOLDER_SELECTOR,
  PROMPT_EDITOR_PREFIX_SELECTOR,
  PROMPT_FOLDER_HOST_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const HOST_SELECTOR = PROMPT_FOLDER_HOST_SELECTOR
const FIRST_PROMPT_SELECTOR = promptEditorSelector('virtualization-test-1')
const PLACEHOLDER_PROMPT_ID = 'placeholder-1'
const PLACEHOLDER_FOLDER_NAME = 'Placeholder Height'
const PLACEHOLDER_PROMPT_SELECTOR = promptEditorSelector(PLACEHOLDER_PROMPT_ID)
const PLACEHOLDER_SELECTOR = `${PLACEHOLDER_PROMPT_SELECTOR} ${MONACO_PLACEHOLDER_SELECTOR}`
const LONG_SINGLE_LINE_FOLDER_NAME = 'Long Wrapped Singles'
const MEASUREMENT_PROMPT_ID = 'measurement-1'
const MEASUREMENT_PROMPT_SELECTOR = promptEditorSelector(MEASUREMENT_PROMPT_ID)
const MEASUREMENT_PLACEHOLDER_SELECTOR = `${MEASUREMENT_PROMPT_SELECTOR} ${MONACO_PLACEHOLDER_SELECTOR}`
const PROMPT_ROW_SELECTOR = PROMPT_EDITOR_PREFIX_SELECTOR

describe('Prompt Folder Hydration', () => {
  test('keeps scroll position at the top when loading tall prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Long')

    await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
    await mainWindow.waitForSelector(FIRST_PROMPT_SELECTOR, { state: 'attached', timeout: 6000 })

    const scrollTop = await testHelpers.getElementScrollTop(HOST_SELECTOR)
    expect(scrollTop).toBe(0)
  })

  test('placeholder preserves hydrated height after dehydration and rehydration', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual-placeholder' }
    })

    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: PLACEHOLDER_FOLDER_NAME,
      hostSelector: HOST_SELECTOR,
      promptSelector: PLACEHOLDER_PROMPT_SELECTOR,
      placeholderSelector: PLACEHOLDER_SELECTOR
    })

    const hydratedHeight = await testHelpers.getPromptRowHeight(PLACEHOLDER_PROMPT_SELECTOR)

    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(HOST_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, scrollHeight)

    await mainWindow.waitForSelector(PLACEHOLDER_PROMPT_SELECTOR, { state: 'detached' })

    await mainWindow.evaluate(() => {
      window.svelteVirtualWindowTestControls?.pauseMonacoHydration()
    })

    try {
      await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, 0)

      await mainWindow.waitForSelector(PLACEHOLDER_PROMPT_SELECTOR, { state: 'attached' })
      await mainWindow.waitForSelector(PLACEHOLDER_SELECTOR, { state: 'attached' })

      const placeholderHeight = await testHelpers.getPromptRowHeight(PLACEHOLDER_PROMPT_SELECTOR)
      expect(placeholderHeight).toBe(hydratedHeight)

      await mainWindow.evaluate(() => {
        window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
      })

      await mainWindow.waitForSelector(PLACEHOLDER_SELECTOR, { state: 'detached' })

      const rehydratedHeight = await testHelpers.getPromptRowHeight(PLACEHOLDER_PROMPT_SELECTOR)
      expect(rehydratedHeight).toBe(hydratedHeight)
    } finally {
      if (!mainWindow.isClosed()) {
        await mainWindow.evaluate(() => {
          window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
        })
      }
    }
  })

  test('keeps first prompt hydrated while sidebar width shrinks content area', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual-placeholder' }
    })

    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: PLACEHOLDER_FOLDER_NAME,
      hostSelector: HOST_SELECTOR,
      promptSelector: PLACEHOLDER_PROMPT_SELECTOR,
      placeholderSelector: PLACEHOLDER_SELECTOR
    })

    const initialWidth = await testHelpers.getPromptRowWidth(PLACEHOLDER_PROMPT_SELECTOR)

    await mainWindow.evaluate(() => {
      window.svelteVirtualWindowTestControls?.pauseMonacoHydration()
    })

    const dragDistance = 280

    try {
      await testHelpers.dragSidebarHandleBy(dragDistance)

      await mainWindow.waitForTimeout(300)

      const resizedWidth = await testHelpers.getPromptRowWidth(PLACEHOLDER_PROMPT_SELECTOR)
      expect(resizedWidth).toBeLessThan(initialWidth)
      expect(initialWidth - resizedWidth).toBeGreaterThan(20)

      await expect(mainWindow.locator(PLACEHOLDER_SELECTOR)).toHaveCount(0)

      await expect(mainWindow.locator(PLACEHOLDER_PROMPT_SELECTOR)).toBeVisible()
    } finally {
      if (!mainWindow.isClosed()) {
        await mainWindow.evaluate(() => {
          window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
        })
      }
    }
  })

  test('shrinks hydrated prompt rows after expanding and shrinking the virtual window', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'long-wrapped-lines' }
    })

    await testHelpers.openPromptFolderAndWaitForHydrationReady({
      folderName: LONG_SINGLE_LINE_FOLDER_NAME,
      hostSelector: HOST_SELECTOR,
      promptSelector: MEASUREMENT_PROMPT_SELECTOR,
      placeholderSelector: MEASUREMENT_PLACEHOLDER_SELECTOR
    })

    const getEditorContentWidth = async (): Promise<number> => {
      const width = await mainWindow.evaluate((selector) => {
        const row = document.querySelector<HTMLElement>(selector)
        if (!row) return null
        const editor = row.children.item(1) as HTMLElement | null
        if (!editor) return null
        return Math.round(editor.getBoundingClientRect().width)
      }, MEASUREMENT_PROMPT_SELECTOR)

      if (width == null) {
        throw new Error('Failed to read prompt editor content width')
      }

      return width
    }

    const initialWidth = await getEditorContentWidth()

    const dragDistance = 180
    await testHelpers.dragSidebarHandleBy(dragDistance)
    await mainWindow.waitForTimeout(300)

    const narrowedWidth = await getEditorContentWidth()
    expect(narrowedWidth).toBeLessThan(initialWidth)
    expect(initialWidth - narrowedWidth).toBeGreaterThan(20)

    await testHelpers.dragSidebarHandleBy(-dragDistance)
    await mainWindow.waitForTimeout(300)

    const expandedWidth = await getEditorContentWidth()
    expect(expandedWidth).toBeGreaterThan(narrowedWidth)
    expect(expandedWidth - narrowedWidth).toBeGreaterThan(20)

    await testHelpers.dragSidebarHandleBy(dragDistance)
    await mainWindow.waitForTimeout(300)

    const resizedWidth = await getEditorContentWidth()
    expect(resizedWidth).toBeLessThan(expandedWidth)
    expect(expandedWidth - resizedWidth).toBeGreaterThan(20)
  })

  test('retains scroll anchor offset after hydration in long wrapped singles', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'long-wrapped-lines' }
    })

    expect(workspaceSetupResult?.workspaceReady).toBe(true)

    await mainWindow.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
    await mainWindow.evaluate(() => {
      window.svelteVirtualWindowTestControls?.pauseMonacoHydration()
    })

    try {
      await testHelpers.navigateToPromptFolders(LONG_SINGLE_LINE_FOLDER_NAME)

      await mainWindow.waitForSelector(HOST_SELECTOR, { state: 'attached' })
      await mainWindow.waitForSelector(`${HOST_SELECTOR} ${MONACO_PLACEHOLDER_SELECTOR}`, {
        state: 'attached'
      })

      const viewportHeight = await mainWindow.evaluate(
        (selector: string) => document.querySelector<HTMLElement>(selector)?.clientHeight ?? 0,
        HOST_SELECTOR
      )

      if (!viewportHeight) {
        throw new Error('Failed to measure virtual window viewport height')
      }

      await testHelpers.scrollVirtualWindowBy(HOST_SELECTOR, viewportHeight * 3)

      await mainWindow.waitForTimeout(500)

      const anchorHandle = await mainWindow.waitForFunction(
        ({ hostSelector, rowSelector, placeholderSelector }) => {
          const host = document.querySelector<HTMLElement>(hostSelector)
          if (!host) return false
          const hostTop = Math.round(host.getBoundingClientRect().top)
          const rows = Array.from(host.querySelectorAll<HTMLElement>(rowSelector))
          for (const row of rows) {
            if (!row.querySelector(placeholderSelector)) continue
            const rect = row.getBoundingClientRect()
            if (rect.top <= hostTop && rect.bottom >= hostTop) {
              const testId = host.getAttribute('data-testid')
              const scrollTop =
                testId && window.svelteVirtualWindowTestControls?.getScrollTop
                  ? window.svelteVirtualWindowTestControls.getScrollTop(testId)
                  : host.scrollTop
              return {
                rowId: row.getAttribute('data-testid'),
                offset: Math.round(hostTop - rect.top),
                scrollTop: Math.round(scrollTop ?? 0)
              }
            }
          }
          return false
        },
        {
          hostSelector: HOST_SELECTOR,
          rowSelector: PROMPT_ROW_SELECTOR,
          placeholderSelector: MONACO_PLACEHOLDER_SELECTOR
        }
      )

      const anchorData = await anchorHandle.jsonValue()
      await anchorHandle.dispose()

      if (!anchorData?.rowId || typeof anchorData.offset !== 'number') {
        throw new Error('Failed to capture placeholder anchor offset')
      }

      const rowsAboveViewportHandle = await mainWindow.evaluateHandle(
        ({ hostSelector, rowSelector, placeholderSelector }) => {
          const host = document.querySelector<HTMLElement>(hostSelector)
          if (!host) return null
          const hostTop = Math.round(host.getBoundingClientRect().top)
          const rows = Array.from(host.querySelectorAll<HTMLElement>(rowSelector))

          const rowsAboveViewport = rows
            .filter((row) => {
              if (!row.querySelector(placeholderSelector)) return false
              const rect = row.getBoundingClientRect()
              return rect.bottom <= hostTop
            })
            .map((row) => ({
              rowId: row.getAttribute('data-testid') ?? '',
              placeholderHeight: Math.round(row.getBoundingClientRect().height)
            }))
            .filter((row) => Boolean(row.rowId))

          const testId = host.getAttribute('data-testid')
          const scrollTop =
            testId && window.svelteVirtualWindowTestControls?.getScrollTop
              ? window.svelteVirtualWindowTestControls.getScrollTop(testId)
              : host.scrollTop
          return {
            scrollTopBefore: Math.round(scrollTop ?? 0),
            rows: rowsAboveViewport
          }
        },
        {
          hostSelector: HOST_SELECTOR,
          rowSelector: PROMPT_ROW_SELECTOR,
          placeholderSelector: MONACO_PLACEHOLDER_SELECTOR
        }
      )

      const rowsAboveViewportData = await rowsAboveViewportHandle.jsonValue()
      await rowsAboveViewportHandle.dispose()

      if (
        !rowsAboveViewportData ||
        typeof rowsAboveViewportData.scrollTopBefore !== 'number' ||
        !Array.isArray(rowsAboveViewportData.rows)
      ) {
        throw new Error('Failed to capture placeholder measurements above viewport')
      }

      expect(rowsAboveViewportData.rows.length).toBeGreaterThan(0)

      await mainWindow.evaluate(() => {
        window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
      })

      await mainWindow.waitForTimeout(3000)

      const anchoringVerificationHandle = await mainWindow.evaluateHandle(
        ({ hostSelector, rows, placeholderSelector }) => {
          const host = document.querySelector<HTMLElement>(hostSelector)
          if (!host) return null

          const verifiedRows = rows.map((row: { rowId: string; placeholderHeight: number }) => {
            const selector = `[data-testid="${row.rowId}"]`
            const element = host.querySelector<HTMLElement>(selector)
            if (!element) {
              return { ...row, hydratedHeight: null, isPlaceholder: false }
            }
            const hydratedHeight = Math.round(element.getBoundingClientRect().height)
            const isPlaceholder = Boolean(element.querySelector(placeholderSelector))
            return { ...row, hydratedHeight, isPlaceholder }
          })

          const testId = host.getAttribute('data-testid')
          const scrollTop =
            testId && window.svelteVirtualWindowTestControls?.getScrollTop
              ? window.svelteVirtualWindowTestControls.getScrollTop(testId)
              : host.scrollTop
          return {
            scrollTopAfter: Math.round(scrollTop ?? 0),
            rows: verifiedRows
          }
        },
        {
          hostSelector: HOST_SELECTOR,
          rows: rowsAboveViewportData.rows,
          placeholderSelector: MONACO_PLACEHOLDER_SELECTOR
        }
      )

      const anchoringVerification = await anchoringVerificationHandle.jsonValue()
      await anchoringVerificationHandle.dispose()

      if (
        !anchoringVerification ||
        typeof anchoringVerification.scrollTopAfter !== 'number' ||
        !Array.isArray(anchoringVerification.rows)
      ) {
        throw new Error('Failed to capture anchoring verification data')
      }

      const hydratedRows = anchoringVerification.rows.filter(
        (row: { hydratedHeight: number | null; isPlaceholder: boolean }) =>
          typeof row.hydratedHeight === 'number' && row.isPlaceholder === false
      )

      expect(hydratedRows.length).toBeGreaterThan(0)

      const scrollShift =
        anchoringVerification.scrollTopAfter - rowsAboveViewportData.scrollTopBefore
      const totalMeasuredDelta = hydratedRows.reduce(
        (sum: number, row: { hydratedHeight: number; placeholderHeight: number }) => {
          return sum + (row.hydratedHeight - row.placeholderHeight)
        },
        0
      )

      expect(Math.abs(scrollShift - totalMeasuredDelta)).toBeLessThanOrEqual(2)

      await testHelpers.scrollVirtualWindowTo(HOST_SELECTOR, anchoringVerification.scrollTopAfter)

      await mainWindow.waitForTimeout(200)

      const hydratedAnchorHandle = await mainWindow.waitForFunction(
        ({ hostSelector, rowSelector, placeholderSelector }) => {
          const host = document.querySelector<HTMLElement>(hostSelector)
          if (!host) return false
          const hostTop = Math.round(host.getBoundingClientRect().top)
          const rows = Array.from(host.querySelectorAll<HTMLElement>(rowSelector))
          for (const row of rows) {
            if (row.querySelector(placeholderSelector)) {
              continue
            }
            const rect = row.getBoundingClientRect()
            if (rect.top <= hostTop && rect.bottom >= hostTop) {
              return {
                rowId: row.getAttribute('data-testid'),
                offset: Math.round(hostTop - rect.top)
              }
            }
          }
          return false
        },
        {
          hostSelector: HOST_SELECTOR,
          rowSelector: PROMPT_ROW_SELECTOR,
          placeholderSelector: MONACO_PLACEHOLDER_SELECTOR
        }
      )

      const hydratedAnchor = await hydratedAnchorHandle.jsonValue()
      await hydratedAnchorHandle.dispose()

      if (!hydratedAnchor?.rowId || typeof hydratedAnchor.offset !== 'number') {
        throw new Error('Failed to capture hydrated row anchor')
      }

      expect(hydratedAnchor.rowId).toBe(anchorData.rowId)
      expect(hydratedAnchor.offset).toBe(anchorData.offset)
    } finally {
      if (!mainWindow.isClosed()) {
        await mainWindow.evaluate(() => {
          window.svelteVirtualWindowTestControls?.resumeMonacoHydration()
        })
      }
    }
  })
})
