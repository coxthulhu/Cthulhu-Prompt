import { expect, type Page } from '@playwright/test'
import type { ElectronApplication, Locator } from 'playwright'
import { createTestRequestId } from './PlaywrightTestFramework'
import { PROMPT_FOLDER_HOST_SELECTOR, promptEditorSelector } from './PromptFolderSelectors'

type ElementBox = {
  x: number
  y: number
  width: number
  height: number
}

type PromptFolderScrollHelpers = {
  getElementScrollTop: (selector: string) => Promise<number>
  scrollVirtualWindowBy: (selector: string, deltaPx: number) => Promise<void>
  scrollVirtualWindowTo: (selector: string, topPx: number) => Promise<void>
}

export type TargetVerticalAlign = 'top' | 'center' | 'bottom'

export const promptHandleSelector = (promptId: string): string =>
  `${promptEditorSelector(promptId)} [data-testid="prompt-drag-handle"]`

/** Selects a prompt row in one explicit workflow or template tree. */
export const promptTreePromptSelector = (promptId: string, group: 'active' | 'completed' | 'archived' | 'template' = 'active'): string =>
  `[data-testid="prompt-tree-${group}-prompt-${promptId}"]`

/** Returns the sidebar toggle selector for one category name. */
export const promptTreeCategorySelector = (categoryName: string, group: 'active' | 'template' = 'active'): string =>
  `[data-testid="prompt-tree-${group}-category-toggle-button-${categoryName.replace(/\s+/g, '')}"]`

export const promptFolderSelectorTriggerSelector =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'

export const promptFolderSelectorMenuSelector =
  '[data-testid="sidebar-prompt-folder-selector-menu"]'

export const promptFolderSelectorDropdownItemSelector = (folderId: string): string =>
  `[data-testid="sidebar-prompt-folder-dropdown-item-${folderId}"]`

/** Selects a prompt boundary within one exact workflow tree. */
export const promptTreePromptDropIndicatorSelector = (promptId: string, group: 'active' | 'completed' | 'archived' | 'template' = 'active'): string =>
  `[data-testid="prompt-tree-${group}-drop-indicator-prompt-${promptId}"]`

export const dragGhostSelector = '[data-testid="drag-ghost"]'

const getRequiredBox = async (locator: Locator, errorMessage: string): Promise<ElementBox> => {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(errorMessage)
  }

  return box
}

/** Verifies that the drag ghost keeps its leading icon to the left of its label. */
export const expectDragGhostIconBeforeLabel = async (dragGhost: Locator): Promise<void> => {
  // These boxes compare the rendered icon and label edges with the standard 2px tolerance.
  const iconBox = await getRequiredBox(
    dragGhost.locator('[data-testid="drag-ghost-icon"]'),
    'Missing drag ghost icon geometry'
  )
  const labelBox = await getRequiredBox(
    dragGhost.locator('.sidebarPromptTreeSettingsLabel'),
    'Missing drag ghost label geometry'
  )

  expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(labelBox.x + 2)
}

const getTargetPoint = (
  targetBox: ElementBox,
  verticalAlign: TargetVerticalAlign
): { x: number; y: number } => {
  const x = targetBox.x + targetBox.width / 2
  const y =
    verticalAlign === 'top'
      ? targetBox.y + targetBox.height * 0.25
      : verticalAlign === 'bottom'
        ? targetBox.y + targetBox.height * 0.75
        : targetBox.y + targetBox.height / 2

  return { x, y }
}

const moveMouseToBoxCenter = async (page: Page, box: ElementBox): Promise<void> => {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}

const beginDragFromLocator = async (
  page: Page,
  locator: Locator,
  errorMessage: string
): Promise<void> => {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator).toBeVisible()

  const box = await getRequiredBox(locator, errorMessage)
  await moveMouseToBoxCenter(page, box)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8, { steps: 4 })
  await expect(page.locator('body')).toHaveCSS('cursor', 'grabbing')
}

export const moveActiveDragToTarget = async (
  page: Page,
  targetSelector: string,
  verticalAlign: TargetVerticalAlign = 'center'
): Promise<void> => {
  const target = page.locator(targetSelector)
  await target.scrollIntoViewIfNeeded()
  await expect(target).toBeVisible()

  const targetBox = await getRequiredBox(target, `Missing drag geometry for ${targetSelector}`)
  const targetPoint = getTargetPoint(targetBox, verticalAlign)
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 12 })
}

export const finishActiveDrag = async (page: Page): Promise<void> => {
  await page.mouse.up()
}

export const dragPromptHandleToTarget = async (
  page: Page,
  promptId: string,
  targetSelector: string,
  verticalAlign: TargetVerticalAlign = 'center'
): Promise<void> => {
  await beginPromptHandleDrag(page, promptId)
  await moveActiveDragToTarget(page, targetSelector, verticalAlign)
  await finishActiveDrag(page)
}

export const dragPromptTreeRowToTarget = async (
  page: Page,
  promptId: string,
  targetSelector: string,
  verticalAlign: TargetVerticalAlign = 'center'
): Promise<void> => {
  await beginPromptTreeRowDrag(page, promptId)
  await moveActiveDragToTarget(page, targetSelector, verticalAlign)
  await finishActiveDrag(page)
}

export const beginPromptHandleDrag = async (page: Page, promptId: string): Promise<void> => {
  await beginDragFromLocator(
    page,
    page.locator(promptHandleSelector(promptId)),
    `Missing drag geometry for ${promptId}`
  )
}

/** Starts a drag from the prompt's current group-specific row. */
export const beginPromptTreeRowDrag = async (page: Page, promptId: string, group: 'active' | 'completed' | 'archived' | 'template' = 'active'): Promise<void> => {
  await beginDragFromLocator(
    page,
    page.locator(promptTreePromptSelector(promptId, group)),
    `Missing prompt tree drag geometry for ${promptId}`
  )
}

/** Starts a category-card drag from its dedicated handle. */
export const beginCategoryHandleDrag = async (
  page: Page,
  categoryId: string
): Promise<void> => {
  await beginDragFromLocator(
    page,
    page.locator(
      `[data-testid="category-editor-${categoryId}"] [data-testid="category-drag-handle"]`
    ),
    `Missing category drag geometry for ${categoryId}`
  )
}

/** Starts a category drag from its sidebar row. */
export const beginPromptTreeCategoryRowDrag = async (
  page: Page,
  categoryName: string
): Promise<void> => {
  await beginDragFromLocator(
    page,
    page.locator(promptTreeCategorySelector(categoryName)),
    `Missing prompt tree category drag geometry for ${categoryName}`
  )
}

export const beginPromptTreeRowGutterDrag = async (page: Page, promptId: string): Promise<void> => {
  const row = page.locator(promptTreePromptSelector(promptId))
  await row.scrollIntoViewIfNeeded()
  await expect(row).toBeVisible()

  const box = await getRequiredBox(row, `Missing prompt tree gutter drag geometry for ${promptId}`)
  const startX = box.x + 8
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 8, startY + 8, { steps: 4 })
  await expect(page.locator('body')).toHaveCSS('cursor', 'grabbing')
}

export const expectPromptTreeRowActiveState = async (
  page: Page,
  promptId: string,
  isActive: boolean
): Promise<void> => {
  const row = page.locator(promptTreePromptSelector(promptId))

  if (isActive) {
    await expect(row).toHaveAttribute('data-row-state', /^(active|drag-active)$/)
    return
  }

  await expect(row).not.toHaveAttribute('data-row-state', /^(active|drag-active)$/)
}

export const expectPromptTreeRowDraggingState = async (
  page: Page,
  promptId: string,
  isDragging: boolean
): Promise<void> => {
  const row = page.locator(promptTreePromptSelector(promptId))

  if (isDragging) {
    await expect(row).toHaveAttribute('data-row-state', 'dragging')
    return
  }

  await expect(row).not.toHaveAttribute('data-row-state', 'dragging')
}

export const getPromptEditorIds = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="prompt-editor-"]'))
      .map((element) => element.getAttribute('data-testid') ?? '')
      .map((testId) => testId.replace('prompt-editor-', ''))
  })
}

const readTextFile = async (
  electronApp: ElectronApplication,
  filePath: string
): Promise<string> => {
  const requestId = createTestRequestId('read')

  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { targetPath, requestId } = payload
      return await new Promise<string>((resolve) => {
        app.once(`test-read-file-ready:${requestId}`, (result: { content: string }) => {
          resolve(result.content)
        })
        app.emit('test-read-file', { filePath: targetPath, requestId })
      })
    },
    { targetPath: filePath, requestId }
  )
}

export const readPromptFolderEntries = async (
  electronApp: ElectronApplication,
  folderOrderPath: string
): Promise<Array<{ kind: 'prompt' | 'folder'; id: string }>> => {
  const fileContents = await readTextFile(electronApp, folderOrderPath)
  /** Current root ordering groups active content beneath category ownership. */
  const order = JSON.parse(fileContents) as {
    categories: Array<{
      entries: Array<{ kind: 'prompt' | 'folder'; id: string }>
    }>
  }
  return order.categories.flatMap((category) => category.entries)
}

export const readPromptFolderEntryIds = async (
  electronApp: ElectronApplication,
  folderOrderPath: string
): Promise<string[]> =>
  (await readPromptFolderEntries(electronApp, folderOrderPath)).map((entry) => entry.id)

export const expectCurrentFolderPromptEditors = async (
  page: Page,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect.poll(async () => await getPromptEditorIds(page)).toEqual(expectedPromptIds)
}

export const expectPersistedFolderPromptIds = async (
  electronApp: ElectronApplication,
  folderOrderPath: string,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect
    .poll(async () => await readPromptFolderEntryIds(electronApp, folderOrderPath))
    .toEqual(expectedPromptIds)
}

export const getRowViewportOffsets = async (
  page: Page,
  selector: string
): Promise<{ top: number; bottom: number } | null> => {
  return await page.evaluate(
    ({ hostSelector, rowSelector }) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      const row = document.querySelector<HTMLElement>(rowSelector)
      if (!host || !row) {
        return null
      }

      const hostRect = host.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()

      return {
        top: Math.round(rowRect.top - hostRect.top),
        bottom: Math.round(rowRect.bottom - hostRect.top)
      }
    },
    {
      hostSelector: PROMPT_FOLDER_HOST_SELECTOR,
      rowSelector: selector
    }
  )
}

export const scrollUntilPromptEditorVisible = async (
  page: Page,
  testHelpers: PromptFolderScrollHelpers,
  promptId: string
): Promise<void> => {
  const selector = promptEditorSelector(promptId)

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await page.locator(selector).count()) > 0) {
      return
    }

    await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST_SELECTOR, 600)
  }

  throw new Error(`Prompt editor did not become visible: ${promptId}`)
}

export const scrollPromptEditorAcrossViewportTop = async (
  page: Page,
  testHelpers: PromptFolderScrollHelpers,
  promptId: string,
  overlapPx = 24
): Promise<void> => {
  const selector = promptEditorSelector(promptId)
  await scrollUntilPromptEditorVisible(page, testHelpers, promptId)

  const offsets = await getRowViewportOffsets(page, selector)
  if (!offsets) {
    throw new Error(`Missing viewport offsets for ${promptId}`)
  }

  const currentScrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR)
  await testHelpers.scrollVirtualWindowTo(
    PROMPT_FOLDER_HOST_SELECTOR,
    currentScrollTop + offsets.top + overlapPx
  )

  await expect
    .poll(async () => {
      const nextOffsets = await getRowViewportOffsets(page, selector)
      return nextOffsets ? nextOffsets.top <= 0 && nextOffsets.bottom > 0 : false
    })
    .toBe(true)
}
