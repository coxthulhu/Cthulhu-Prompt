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

export const promptTreePromptSelector = (promptId: string): string =>
  `[data-testid="prompt-folder-prompt-${promptId}"]`

export const promptTreeFolderSelector = (folderName: string): string =>
  `[data-testid="regular-prompt-folder-${folderName}"]`

export const promptTreeFolderSettingsSelector = (folderName: string): string =>
  `[data-testid="prompt-folder-settings-${folderName}"]`

export const promptTreePromptDropIndicatorSelector = (promptId: string): string =>
  `[data-testid="prompt-tree-drop-indicator-prompt-${promptId}"]`

export const promptTreeFolderSettingsDropIndicatorSelector = (folderName: string): string =>
  `[data-testid="prompt-tree-drop-indicator-settings-${folderName}"]`

const getRequiredBox = async (locator: Locator, errorMessage: string): Promise<ElementBox> => {
  const box = await locator.boundingBox()
  if (!box) {
    throw new Error(errorMessage)
  }

  return box
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
  await expect(page.locator('[data-testid="drag-drop-overlay"]')).toBeVisible()
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

export const beginPromptTreeRowDrag = async (page: Page, promptId: string): Promise<void> => {
  await beginDragFromLocator(
    page,
    page.locator(promptTreePromptSelector(promptId)),
    `Missing prompt tree drag geometry for ${promptId}`
  )
}

export const expectPromptTreeRowActiveState = async (
  page: Page,
  promptId: string,
  isActive: boolean
): Promise<void> => {
  await expect(page.locator(promptTreePromptSelector(promptId))).toHaveAttribute(
    'data-active',
    isActive ? 'true' : 'false'
  )
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

export const readPromptFolderPromptIds = async (
  electronApp: ElectronApplication,
  folderDataPath: string
): Promise<string[]> => {
  const fileContents = await readTextFile(electronApp, folderDataPath)
  return (JSON.parse(fileContents) as { promptIds: string[] }).promptIds
}

export const expectCurrentFolderPromptEditors = async (
  page: Page,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect.poll(async () => await getPromptEditorIds(page)).toEqual(expectedPromptIds)
}

export const expectPersistedFolderPromptIds = async (
  electronApp: ElectronApplication,
  folderDataPath: string,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect
    .poll(async () => await readPromptFolderPromptIds(electronApp, folderDataPath))
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
