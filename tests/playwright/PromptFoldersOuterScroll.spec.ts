import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const MAIN_SCREEN_SURFACE_SELECTOR = '.mainScreenSurface'
const PROMPT_FOLDER_SCREEN_SELECTOR = '[data-testid="prompt-folder-screen"]'
const INITIAL_PROMPT_SELECTOR = promptEditorSelector('short-1')
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-active-virtual-window"]'
const VIRTUAL_SCROLL_TOP_PX = 320

describe('Prompt folder outer scroll containment', () => {
  test('does not move the app shell when a lower prompt-tree overscan row receives focus', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_TREE_HOST_SELECTOR, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, VIRTUAL_SCROLL_TOP_PX)

    let overscannedPromptTreeButtonTestId: string | null = null
    await expect
      .poll(async () => {
        overscannedPromptTreeButtonTestId = await mainWindow.evaluate((hostSelector) => {
          const host = document.querySelector<HTMLElement>(hostSelector)
          if (!host) return null
          const hostBottom = host.getBoundingClientRect().bottom
          const overscannedButton = Array.from(
            host.querySelectorAll<HTMLButtonElement>('[data-testid^="prompt-tree-active-prompt-"]')
          ).find((button) => button.getBoundingClientRect().top > hostBottom)
          return overscannedButton?.dataset.testid ?? null
        }, PROMPT_TREE_HOST_SELECTOR)
        return overscannedPromptTreeButtonTestId
      })
      .not.toBeNull()

    if (typeof overscannedPromptTreeButtonTestId !== 'string') {
      throw new Error('Failed to resolve the lower prompt-tree overscan row')
    }

    const beforeFocus = await mainWindow.evaluate(
      ({ buttonTestId, mainSurfaceSelector }) => {
        const mainSurface = document.querySelector<HTMLElement>(mainSurfaceSelector)!
        const contentPane = mainSurface.parentElement!
        const resizableShell = contentPane.parentElement!
        const appSidebar = document.querySelector<HTMLElement>('[data-testid="app-sidebar"]')!
        const button = document.querySelector<HTMLButtonElement>(
          `[data-testid="${buttonTestId}"]`
        )!
        return {
          mainSurfaceTop: mainSurface.getBoundingClientRect().top,
          appSidebarTop: appSidebar.getBoundingClientRect().top,
          resizableShellTop: resizableShell.getBoundingClientRect().top,
          mainSurfaceScrollTop: mainSurface.scrollTop,
          resizableShellScrollTop: resizableShell.scrollTop,
          buttonTop: button.getBoundingClientRect().top
        }
      },
      {
        buttonTestId: overscannedPromptTreeButtonTestId,
        mainSurfaceSelector: MAIN_SCREEN_SURFACE_SELECTOR
      }
    )

    await mainWindow
      .locator(`[data-testid="${overscannedPromptTreeButtonTestId}"]`)
      .focus()

    await expect
      .poll(async () => {
        return await mainWindow.evaluate(
          ({ mainSurfaceSelector }) => {
            const mainSurface = document.querySelector<HTMLElement>(mainSurfaceSelector)!
            const contentPane = mainSurface.parentElement!
            const resizableShell = contentPane.parentElement!
            const appSidebar = document.querySelector<HTMLElement>('[data-testid="app-sidebar"]')!
            return {
              mainSurfaceTop: mainSurface.getBoundingClientRect().top,
              appSidebarTop: appSidebar.getBoundingClientRect().top,
              resizableShellTop: resizableShell.getBoundingClientRect().top,
              mainSurfaceScrollTop: mainSurface.scrollTop,
              resizableShellScrollTop: resizableShell.scrollTop
            }
          },
          { mainSurfaceSelector: MAIN_SCREEN_SURFACE_SELECTOR }
        )
      })
      .toEqual({
        mainSurfaceTop: beforeFocus.mainSurfaceTop,
        appSidebarTop: beforeFocus.appSidebarTop,
        resizableShellTop: beforeFocus.resizableShellTop,
        mainSurfaceScrollTop: 0,
        resizableShellScrollTop: 0
      })
  })

  test('does not native-scroll the main screen when a focused Monaco row moves into overscan', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, INITIAL_PROMPT_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 800)

    let focusedEditorTestId: string | null = null
    await expect
      .poll(async () => {
        focusedEditorTestId = await mainWindow.evaluate(
          ({ hostSelector, mainSurfaceSelector }) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            const mainSurface = document.querySelector<HTMLElement>(mainSurfaceSelector)
            if (!host || !mainSurface) return null

            const surfaceRect = mainSurface.getBoundingClientRect()
            const candidates = Array.from(
              host.querySelectorAll<HTMLElement>(
                '[data-testid^="prompt-editor-"][data-virtual-window-row]'
              )
            ).filter((row) => {
              const rowRect = row.getBoundingClientRect()
              return (
                rowRect.top >= surfaceRect.top &&
                rowRect.bottom <= surfaceRect.bottom &&
                Boolean(row.querySelector('.monaco-editor .view-lines'))
              )
            })
            return candidates.at(-1)?.dataset.testid ?? null
          },
          {
            hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
            mainSurfaceSelector: MAIN_SCREEN_SURFACE_SELECTOR
          }
        )
        return focusedEditorTestId
      })
      .not.toBeNull()

    if (typeof focusedEditorTestId !== 'string') {
      throw new Error('Failed to resolve the visible Monaco row')
    }

    await mainWindow.evaluate((editorTestId) => {
      const row = document.querySelector<HTMLElement>(`[data-testid="${editorTestId}"]`)
      const monacoRoot = row?.querySelector<HTMLElement>('.monaco-editor')
      const registry = (
        window as unknown as {
          __cthulhuMonacoEditors?: Array<{
            container: HTMLElement | null
            editor: { focus: () => void; hasTextFocus: () => boolean }
          }>
        }
      ).__cthulhuMonacoEditors
      const entry = registry?.find((candidate) => {
        if (!candidate.container || !monacoRoot) return false
        return (
          candidate.container === monacoRoot ||
          candidate.container.contains(monacoRoot) ||
          monacoRoot.contains(candidate.container)
        )
      })
      if (!entry) throw new Error('Missing registered Monaco editor for visible row')
      entry.editor.focus()
      if (!entry.editor.hasTextFocus()) throw new Error('Failed to focus visible Monaco editor')
    }, focusedEditorTestId)

    expect(
      await mainWindow.locator(MAIN_SCREEN_SURFACE_SELECTOR).evaluate((surface) => surface.scrollTop)
    ).toBe(0)

    await testHelpers.scrollVirtualWindowTo(
      PROMPT_FOLDER_HOST_SELECTOR,
      VIRTUAL_SCROLL_TOP_PX
    )

    await mainWindow.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
    )

    const afterScroll = await mainWindow.evaluate(
      ({ editorTestId, mainSurfaceSelector }) => {
        const mainSurface = document.querySelector<HTMLElement>(mainSurfaceSelector)!
        const editorRow = document.querySelector<HTMLElement>(
          `[data-testid="${editorTestId}"]`
        )
        return {
          mainSurfaceScrollTop: mainSurface.scrollTop,
          editorTop: editorRow?.getBoundingClientRect().top ?? null,
          mainSurfaceBottom: mainSurface.getBoundingClientRect().bottom
        }
      },
      {
        editorTestId: focusedEditorTestId,
        mainSurfaceSelector: MAIN_SCREEN_SURFACE_SELECTOR
      }
    )

    expect(afterScroll.editorTop).not.toBeNull()
    expect(afterScroll.editorTop!).toBeGreaterThan(afterScroll.mainSurfaceBottom)
    expect(afterScroll.mainSurfaceScrollTop).toBe(0)
  })

  test('does not native-scroll the main screen when Monaco focuses an overscanned row', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Short')
    await waitForMonacoEditor(mainWindow, INITIAL_PROMPT_SELECTOR)
    await testHelpers.scrollVirtualWindowTo(
      PROMPT_FOLDER_HOST_SELECTOR,
      VIRTUAL_SCROLL_TOP_PX
    )

    let overscannedEditorTestId: string | null = null
    await expect
      .poll(async () => {
        overscannedEditorTestId = await mainWindow.evaluate(
          ({ hostSelector, mainSurfaceSelector }) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            const mainSurface = document.querySelector<HTMLElement>(mainSurfaceSelector)
            if (!host || !mainSurface) return null

            const surfaceBottom = mainSurface.getBoundingClientRect().bottom
            const editorRows = Array.from(
              host.querySelectorAll<HTMLElement>(
                '[data-testid^="prompt-editor-"][data-virtual-window-row]'
              )
            )
            const overscannedRow = editorRows.find((row) => {
              if (row.getBoundingClientRect().top <= surfaceBottom) return false
              return Boolean(row.querySelector('.monaco-editor .view-lines'))
            })
            return overscannedRow?.dataset.testid ?? null
          },
          {
            hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
            mainSurfaceSelector: MAIN_SCREEN_SURFACE_SELECTOR
          }
        )
        return overscannedEditorTestId
      })
      .not.toBeNull()

    if (typeof overscannedEditorTestId !== 'string') {
      throw new Error('Failed to resolve the hydrated overscanned Monaco row')
    }

    const beforeFocus = await mainWindow.evaluate(
      ({ editorTestId, mainSurfaceSelector, screenSelector }) => {
        const mainSurface = document.querySelector<HTMLElement>(mainSurfaceSelector)!
        const screen = document.querySelector<HTMLElement>(screenSelector)!
        const editorRow = document.querySelector<HTMLElement>(
          `[data-testid="${editorTestId}"]`
        )!
        return {
          mainSurfaceScrollTop: mainSurface.scrollTop,
          mainSurfaceTop: mainSurface.getBoundingClientRect().top,
          screenTop: screen.getBoundingClientRect().top,
          editorTop: editorRow.getBoundingClientRect().top,
          mainSurfaceBottom: mainSurface.getBoundingClientRect().bottom
        }
      },
      {
        editorTestId: overscannedEditorTestId,
        mainSurfaceSelector: MAIN_SCREEN_SURFACE_SELECTOR,
        screenSelector: PROMPT_FOLDER_SCREEN_SELECTOR
      }
    )

    expect(beforeFocus.mainSurfaceScrollTop).toBe(0)
    expect(beforeFocus.screenTop).toBeGreaterThanOrEqual(beforeFocus.mainSurfaceTop - 1)
    expect(beforeFocus.editorTop).toBeGreaterThan(beforeFocus.mainSurfaceBottom)

    await mainWindow.evaluate((editorTestId) => {
      const row = document.querySelector<HTMLElement>(`[data-testid="${editorTestId}"]`)
      const monacoRoot = row?.querySelector<HTMLElement>('.monaco-editor')
      if (!monacoRoot) throw new Error('Missing Monaco editor in overscanned row')

      const registry = (
        window as unknown as {
          __cthulhuMonacoEditors?: Array<{
            container: HTMLElement | null
            editor: { focus: () => void }
          }>
        }
      ).__cthulhuMonacoEditors
      const entry = registry?.find((candidate) => {
        if (!candidate.container) return false
        return (
          candidate.container === monacoRoot ||
          candidate.container.contains(monacoRoot) ||
          monacoRoot.contains(candidate.container)
        )
      })
      if (!entry) throw new Error('Missing registered Monaco editor for overscanned row')
      entry.editor.focus()
    }, overscannedEditorTestId)

    await expect
      .poll(async () => {
        return await mainWindow.locator(MAIN_SCREEN_SURFACE_SELECTOR).evaluate((surface) => ({
          scrollTop: surface.scrollTop,
          screenTop:
            document
              .querySelector('[data-testid="prompt-folder-screen"]')
              ?.getBoundingClientRect().top ?? null,
          surfaceTop: surface.getBoundingClientRect().top
        }))
      })
      .toEqual({
        scrollTop: 0,
        screenTop: beforeFocus.screenTop,
        surfaceTop: beforeFocus.mainSurfaceTop
      })
  })
})
