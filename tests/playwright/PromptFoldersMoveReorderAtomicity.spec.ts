import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { readPromptFolderEntryIds, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  promptEditorSelector
} from '../helpers/PromptFolderSelectors'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { heightTestPrompts } from '../fixtures/TestData'
import type { Page } from '@playwright/test'

/** Waits for visible editors to hydrate and row geometry to stop changing before recording. */
const waitForMeasuredRows = async (page: Page): Promise<void> => {
  /** Previous measured layout, compared with the next observed layout rather than a timer. */
  let previousLayout = ''
  await expect.poll(async () => {
    /** Visible hydration and geometry snapshot from the virtual viewport. */
    const layout = await page.locator(PROMPT_FOLDER_HOST_SELECTOR).evaluate((host) => {
      /** Viewport bounds distinguish queued visible hydration from offscreen placeholders. */
      const bounds = host.getBoundingClientRect()
      /** Rows whose geometry can affect the moved prompt's placement. */
      const rows = Array.from(host.querySelectorAll<HTMLElement>('[data-testid^="prompt-editor-"]'))
      if (rows.some((row) => {
        /** Row position determines whether its placeholder still needs hydration. */
        const rect = row.getBoundingClientRect()
        return rect.bottom > bounds.top && rect.top < bounds.bottom &&
          row.querySelector('[data-testid="monaco-placeholder"]') !== null
      })) return null
      return JSON.stringify(rows.map((row) => {
        /** Measured bounds include height changes produced by Monaco hydration. */
        const rect = row.getBoundingClientRect()
        return [row.dataset.testid, rect.top, rect.height]
      }))
    })
    /** Equal observations establish the baseline only after visible hydration finishes. */
    const unchanged = layout !== null && layout === previousLayout
    previousLayout = layout ?? ''
    return unchanged
  }).toBe(true)
}

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/move-reorder-atomicity'
const FOLDER_NAME = 'Move Reorder Atomicity'
const ROOT_ORDER_PATH =
  `${WORKSPACE_PATH}/Prompts/${FOLDER_NAME}/Active/_FolderInfo/FolderOrder.json`
const CATEGORY_WORKSPACE_PATH = '/ws/categories-controls'
const CATEGORY_ROOT_ORDER_PATH =
  `${CATEGORY_WORKSPACE_PATH}/Prompts/Controls/Active/_FolderInfo/FolderOrder.json`
const MOVED_ROW_POSITION_TOLERANCE_PX = 1

const moveUpSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-move-up"]`
const moveDownSelector = (promptId: string) =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-move-down"]`

type FrameSnapshot = {
  movedRowTop: number | null
  editorIdsByTop: string[]
}

const buildWorkspace = () => {
  return createWorkspaceWithFolders(WORKSPACE_PATH, [
    {
      folderName: FOLDER_NAME,
      displayName: FOLDER_NAME,
      prompts: [
        { ...heightTestPrompts.tenLine, id: 'atomic-1', title: 'Atomic Prompt 1' },
        { ...heightTestPrompts.threeLine, id: 'atomic-2', title: 'Atomic Prompt 2' },
        { ...heightTestPrompts.twentyFiveLine, id: 'atomic-3', title: 'Atomic Prompt 3' },
        { ...heightTestPrompts.fortyLine, id: 'atomic-4', title: 'Atomic Prompt 4' },
        { ...heightTestPrompts.tenLine, id: 'atomic-5', title: 'Atomic Prompt 5' },
        { ...heightTestPrompts.twentyLine, id: 'atomic-6', title: 'Atomic Prompt 6' }
      ]
    }
  ])
}

// Capture one snapshot per animation frame so an intermediate mis-ordered
// paint (e.g. an optimistic reorder later corrected by the IPC response)
// shows up as a frame where the moved row is missing or displaced.
const startFrameRecorder = async (page: any, movedPromptId: string) => {
  await page.evaluate((promptId: string) => {
    const win = window as any
    win.__moveFrames = []
    win.__moveFramesStop = false
    win.__moveFramesToken = (win.__moveFramesToken ?? 0) + 1
    const token = win.__moveFramesToken
    const record = () => {
      if (win.__moveFramesToken !== token || win.__moveFramesStop) return
      const editors = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="prompt-editor-"]')
      )
        .map((element) => ({
          id: (element.getAttribute('data-testid') ?? '').replace('prompt-editor-', ''),
          top: element.getBoundingClientRect().top
        }))
        .sort((a, b) => a.top - b.top)
      const movedRow = editors.find((editor) => editor.id === promptId)
      win.__moveFrames.push({
        movedRowTop: movedRow ? movedRow.top : null,
        editorIdsByTop: editors.map((editor) => editor.id)
      })
      requestAnimationFrame(record)
    }
    requestAnimationFrame(record)
  }, movedPromptId)
}

/** Includes the reconciled layout's next frame, then stops this recorder before returning. */
const stopFrameRecorder = async (page: Page): Promise<FrameSnapshot[]> => {
  return page.evaluate(() => new Promise<FrameSnapshot[]>((resolve) => {
    requestAnimationFrame(() => {
      /** The recorder's earlier frame callback has now captured the final layout. */
      const win = window as any
      win.__moveFramesStop = true
      resolve(win.__moveFrames as FrameSnapshot[])
    })
  }))
}

const runMove = async (
  page: any,
  testHelpers: any,
  label: string,
  targetId: string,
  direction: 'up' | 'down',
  waitForMove: () => Promise<void>
) => {
  const buttonSelector =
    direction === 'down' ? moveDownSelector(targetId) : moveUpSelector(targetId)
  await testHelpers.scrollVirtualElementIntoView(
    PROMPT_FOLDER_HOST_SELECTOR,
    promptEditorSelector(targetId),
    120
  )
  await testHelpers.scrollVirtualElementIntoView(
    PROMPT_FOLDER_HOST_SELECTOR,
    buttonSelector,
    120
  )
  await waitForMeasuredRows(page)

  await expect(page.locator(buttonSelector)).toBeEnabled()
  const initialTop = await page.locator(promptEditorSelector(targetId)).evaluate(
    (element: HTMLElement) => element.getBoundingClientRect().top
  )
  await startFrameRecorder(page, targetId)
  await page.locator(buttonSelector).click()
  await waitForMove()
  // Persisted order is visible before the renderer finishes authoritative reconciliation.
  await page.evaluate(() => window.playwrightTestControls!.waitForMutations())
  await waitForMeasuredRows(page)
  const frames = await stopFrameRecorder(page)

  expect(frames.length, `${label}: recorder captured no frames`).toBeGreaterThan(0)

  for (const [frameIndex, frame] of frames.entries()) {
    const describeFrame = `${label}: frame ${frameIndex} [${frame.editorIdsByTop.join(', ')}]`
    expect(frame.movedRowTop, `${describeFrame} unmounted the moved row`).not.toBeNull()
    expect(
      Math.abs(frame.movedRowTop! - initialTop),
      `${describeFrame} shifted the moved row from ${initialTop} to ${frame.movedRowTop}`
    ).toBeLessThanOrEqual(MOVED_ROW_POSITION_TOLERANCE_PX)
  }
}

const expectFolderOrder = async (
  electronApp: any,
  orderPath: string,
  expectedOrder: string[]
): Promise<void> => {
  await expect
    .poll(async () => await readPromptFolderEntryIds(electronApp, orderPath))
    .toEqual(expectedOrder)
}

const expectCategoryOrders = async (
  electronApp: any,
  expectedOrders: string[][]
): Promise<void> => {
  await expect
    .poll(async () => {
      /** Current folder-order category groups flattened to prompt IDs per owner. */
      const categoryOrder = JSON.parse(
        await readTextFile(electronApp, CATEGORY_ROOT_ORDER_PATH)
      ) as { categories: Array<{ entries: Array<{ id: string }> }> }
      return categoryOrder.categories.map((category) =>
        category.entries.map((entry) => entry.id)
      )
    })
    .toEqual(expectedOrders)
}

describe('Prompt move reorder atomicity', () => {
  test('keeps the moved prompt mounted and stationary on every frame of a move', async ({
    testSetup,
    electronApp
  }) => {
    await testSetup.setupFilesystem(buildWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders(FOLDER_NAME)

    // Downward moves exercised the optimistic-order bug; upward moves are the control.
    await runMove(
      mainWindow,
      testHelpers,
      'move atomic-2 down past a 25-line prompt',
      'atomic-2',
      'down',
      () => expectFolderOrder(electronApp, ROOT_ORDER_PATH, [
        'atomic-1',
        'atomic-3',
        'atomic-2',
        'atomic-4',
        'atomic-5',
        'atomic-6'
      ])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move atomic-2 up past a 25-line prompt',
      'atomic-2',
      'up',
      () => expectFolderOrder(electronApp, ROOT_ORDER_PATH, [
        'atomic-1',
        'atomic-2',
        'atomic-3',
        'atomic-4',
        'atomic-5',
        'atomic-6'
      ])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move atomic-3 down past a 40-line prompt',
      'atomic-3',
      'down',
      () => expectFolderOrder(electronApp, ROOT_ORDER_PATH, [
        'atomic-1',
        'atomic-2',
        'atomic-4',
        'atomic-3',
        'atomic-5',
        'atomic-6'
      ])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move atomic-3 up past a 40-line prompt',
      'atomic-3',
      'up',
      () => expectFolderOrder(electronApp, ROOT_ORDER_PATH, [
        'atomic-1',
        'atomic-2',
        'atomic-3',
        'atomic-4',
        'atomic-5',
        'atomic-6'
      ])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move atomic-4 down past a 10-line prompt',
      'atomic-4',
      'down',
      () => expectFolderOrder(electronApp, ROOT_ORDER_PATH, [
        'atomic-1',
        'atomic-2',
        'atomic-3',
        'atomic-5',
        'atomic-4',
        'atomic-6'
      ])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move atomic-4 up past a 10-line prompt',
      'atomic-4',
      'up',
      () => expectFolderOrder(electronApp, ROOT_ORDER_PATH, [
        'atomic-1',
        'atomic-2',
        'atomic-3',
        'atomic-4',
        'atomic-5',
        'atomic-6'
      ])
    )
  })

  test('keeps prompts stationary within and across category boundaries', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories-controls' }
    })

    await testHelpers.navigateToPromptFolders('Controls')
    await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST_SELECTOR, 160)

    const promptId = 'categories-controls-first'
    const secondPromptId = 'categories-controls-second'
    await runMove(
      mainWindow,
      testHelpers,
      'move category prompt up to Uncategorized',
      promptId,
      'up',
      () =>
        expectCategoryOrders(electronApp, [[promptId], [secondPromptId], []])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move Uncategorized prompt down into category',
      promptId,
      'down',
      () =>
        expectCategoryOrders(electronApp, [[], [promptId, secondPromptId], []])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move prompt down within category',
      promptId,
      'down',
      () =>
        expectCategoryOrders(electronApp, [[], [secondPromptId, promptId], []])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move prompt down into next category',
      promptId,
      'down',
      () =>
        expectCategoryOrders(electronApp, [[], [secondPromptId], [promptId]])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move prompt up into previous category',
      promptId,
      'up',
      () =>
        expectCategoryOrders(electronApp, [[], [secondPromptId, promptId], []])
    )
    await runMove(
      mainWindow,
      testHelpers,
      'move prompt up within category',
      promptId,
      'up',
      () =>
        expectCategoryOrders(electronApp, [[], [promptId, secondPromptId], []])
    )
  })
})
