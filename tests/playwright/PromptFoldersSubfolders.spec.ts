import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { PROMPT_FOLDER_HOST_SELECTOR } from '../helpers/PromptFolderSelectors'
import { PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX } from '../../src/renderer/src/features/prompt-folders/promptFolderSectionGutterMetrics'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/subfolders-ui'
const EMPTY_PLACEHOLDER_TEXT = 'No prompts found in this folder.'

const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

const hierarchyFolderId = createDeterministicId(`${WORKSPACE_PATH}:Hierarchy`)
const nestedFolderId = createDeterministicId(`${WORKSPACE_PATH}:Hierarchy/Nested`)
const emptyNestedFolderId = createDeterministicId(
  `${WORKSPACE_PATH}:Hierarchy/EmptyNested`
)
const grandchildFolderId = createDeterministicId(
  `${WORKSPACE_PATH}:Hierarchy/Nested/Grandchild`
)

const testIdSelector = (testId: string): string => `[data-testid="${testId}"]`
const dividerTestId = (ownerFolderId: string, previousEntryId: string | null): string =>
  `prompt-folder-divider-${ownerFolderId}-${previousEntryId ?? 'initial'}`

const hierarchyFolderSelector = `[data-testid="prompt-folder-editor-${hierarchyFolderId}"]`
const nestedFolderSelector = `[data-testid="prompt-folder-editor-${nestedFolderId}"]`
const emptyNestedFolderSelector =
  `[data-testid="prompt-folder-editor-${emptyNestedFolderId}"]`
const grandchildFolderSelector =
  `[data-testid="prompt-folder-editor-${grandchildFolderId}"]`
const rootBeforeSelector = '[data-testid="prompt-editor-subfolders-ui-root-before"]'
const nestedPromptSelector = '[data-testid="prompt-editor-subfolders-ui-nested-prompt"]'
const grandchildPromptSelector =
  '[data-testid="prompt-editor-subfolders-ui-grandchild-prompt"]'
const readOnlyDividerTestIds = [
  dividerTestId(nestedFolderId, null),
  dividerTestId(nestedFolderId, 'subfolders-ui-nested-prompt'),
  dividerTestId(grandchildFolderId, null),
  dividerTestId(grandchildFolderId, 'subfolders-ui-grandchild-prompt'),
  dividerTestId(nestedFolderId, grandchildFolderId),
  dividerTestId(hierarchyFolderId, nestedFolderId),
  dividerTestId(emptyNestedFolderId, null),
  dividerTestId(hierarchyFolderId, emptyNestedFolderId)
]
const orderedRowTestIds = [
  `prompt-folder-editor-${hierarchyFolderId}`,
  dividerTestId(hierarchyFolderId, null),
  'prompt-editor-subfolders-ui-root-before',
  dividerTestId(hierarchyFolderId, 'subfolders-ui-root-before'),
  `prompt-folder-editor-${nestedFolderId}`,
  dividerTestId(nestedFolderId, null),
  'prompt-editor-subfolders-ui-nested-prompt',
  dividerTestId(nestedFolderId, 'subfolders-ui-nested-prompt'),
  `prompt-folder-editor-${grandchildFolderId}`,
  dividerTestId(grandchildFolderId, null),
  'prompt-editor-subfolders-ui-grandchild-prompt',
  dividerTestId(grandchildFolderId, 'subfolders-ui-grandchild-prompt'),
  dividerTestId(nestedFolderId, grandchildFolderId),
  dividerTestId(hierarchyFolderId, nestedFolderId),
  `prompt-folder-editor-${emptyNestedFolderId}`,
  dividerTestId(emptyNestedFolderId, null),
  dividerTestId(hierarchyFolderId, emptyNestedFolderId),
  'prompt-editor-subfolders-ui-root-after',
  dividerTestId(hierarchyFolderId, 'subfolders-ui-root-after')
]

const getVirtualScrollStops = async (testHelpers: any): Promise<number[]> => {
  const hostHeight = await testHelpers.getPromptRowHeight(PROMPT_FOLDER_HOST_SELECTOR)
  const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST_SELECTOR)
  const maxScrollTop = Math.max(0, scrollHeight - hostHeight)
  const stepPx = Math.max(1, Math.round(hostHeight * 0.7))
  const stops: number[] = []

  for (let scrollTopPx = 0; scrollTopPx < maxScrollTop; scrollTopPx += stepPx) {
    stops.push(scrollTopPx)
  }
  stops.push(maxScrollTop)
  return stops
}

const collectVirtualRowTestIds = async (
  mainWindow: any,
  testHelpers: any,
  selector: string
): Promise<string[]> => {
  const seenTestIds = new Set<string>()
  const orderedTestIds: string[] = []

  for (const scrollTopPx of await getVirtualScrollStops(testHelpers)) {
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, scrollTopPx)
    const visibleTestIds = await mainWindow
      .locator(selector)
      .evaluateAll((rows: Element[]) =>
        rows.flatMap((row) => {
          const testId = row.getAttribute('data-testid')
          return testId ? [testId] : []
        })
      )

    for (const testId of visibleTestIds) {
      if (seenTestIds.has(testId)) continue
      seenTestIds.add(testId)
      orderedTestIds.push(testId)
    }
  }

  return orderedTestIds
}

const revealVirtualRow = async (
  mainWindow: any,
  testHelpers: any,
  selector: string
): Promise<void> => {
  for (const scrollTopPx of await getVirtualScrollStops(testHelpers)) {
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, scrollTopPx)
    if ((await mainWindow.locator(selector).count()) > 0) return
  }

  throw new Error(`Missing recursive prompt-folder row: ${selector}`)
}

const hasVirtualPlaceholder = async (mainWindow: any, testHelpers: any): Promise<boolean> => {
  for (const scrollTopPx of await getVirtualScrollStops(testHelpers)) {
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, scrollTopPx)
    const placeholderCount = await mainWindow
      .locator(PROMPT_FOLDER_HOST_SELECTOR)
      .getByText(EMPTY_PLACEHOLDER_TEXT, { exact: true })
      .count()
    if (placeholderCount > 0) return true
  }

  return false
}

describe('Prompt folder subfolder rendering', () => {
  test('renders recursive mixed rows at their hierarchy indentation', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    const orderedRowSelector = orderedRowTestIds.map(testIdSelector).join(', ')
    await expect(mainWindow.locator(hierarchyFolderSelector)).toBeAttached()

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await expect(
      mainWindow
        .locator(nestedFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('Nested')
    await revealVirtualRow(mainWindow, testHelpers, grandchildFolderSelector)
    await expect(
      mainWindow
        .locator(grandchildFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('Grandchild')
    await revealVirtualRow(mainWindow, testHelpers, emptyNestedFolderSelector)
    await expect(
      mainWindow
        .locator(emptyNestedFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('Empty Nested')

    await revealVirtualRow(mainWindow, testHelpers, rootBeforeSelector)
    const hierarchyFolderBox = await mainWindow.locator(hierarchyFolderSelector).boundingBox()
    const rootBeforeBox = await mainWindow.locator(rootBeforeSelector).boundingBox()
    const nestedFolderBox = await mainWindow.locator(nestedFolderSelector).boundingBox()

    await revealVirtualRow(mainWindow, testHelpers, grandchildPromptSelector)
    const nestedPromptBox = await mainWindow.locator(nestedPromptSelector).boundingBox()
    const grandchildFolderBox = await mainWindow.locator(grandchildFolderSelector).boundingBox()
    const grandchildPromptBox = await mainWindow.locator(grandchildPromptSelector).boundingBox()

    if (
      !hierarchyFolderBox ||
      !rootBeforeBox ||
      !nestedFolderBox ||
      !nestedPromptBox ||
      !grandchildFolderBox ||
      !grandchildPromptBox
    ) {
      throw new Error('Missing prompt folder hierarchy row geometry')
    }

    expect(
      Math.abs(
        rootBeforeBox.x - hierarchyFolderBox.x - PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX
      )
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(nestedFolderBox.x - rootBeforeBox.x)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        nestedPromptBox.x - rootBeforeBox.x - PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX
      )
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(grandchildFolderBox.x - nestedPromptBox.x)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        grandchildPromptBox.x -
          rootBeforeBox.x -
          PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX * 2
      )
    ).toBeLessThanOrEqual(1)

    const rowOrder = await collectVirtualRowTestIds(
      mainWindow,
      testHelpers,
      orderedRowSelector
    )
    expect(rowOrder).toEqual(orderedRowTestIds)

    for (const readOnlyDividerTestId of readOnlyDividerTestIds) {
      const dividerSelector = testIdSelector(readOnlyDividerTestId)
      await revealVirtualRow(mainWindow, testHelpers, dividerSelector)
      await expect(
        mainWindow
          .locator(dividerSelector)
          .locator('[data-testid^="prompt-divider-add-"]')
      ).toHaveCount(0)
    }

    const rootInitialDividerSelector = testIdSelector(dividerTestId(hierarchyFolderId, null))
    await revealVirtualRow(mainWindow, testHelpers, rootInitialDividerSelector)
    await expect(
      mainWindow
        .locator(rootInitialDividerSelector)
        .locator('[data-testid="prompt-divider-add-initial"]')
    ).toHaveCount(1)
    const rootPromptDividerSelector = testIdSelector(
      dividerTestId(hierarchyFolderId, 'subfolders-ui-root-before')
    )
    await revealVirtualRow(mainWindow, testHelpers, rootPromptDividerSelector)
    await expect(
      mainWindow
        .locator(rootPromptDividerSelector)
        .locator('[data-testid="prompt-divider-add-after-subfolders-ui-root-before"]')
    ).toHaveCount(1)

    expect(await hasVirtualPlaceholder(mainWindow, testHelpers)).toBe(false)
  })

  test('shows the empty placeholder only for an empty root folder', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Empty Root')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    await expect(
      mainWindow
        .locator(PROMPT_FOLDER_HOST_SELECTOR)
        .getByText(EMPTY_PLACEHOLDER_TEXT, { exact: true })
    ).toHaveCount(1)
    await expect(mainWindow.locator(nestedFolderSelector)).toHaveCount(0)
    await expect(mainWindow.locator(emptyNestedFolderSelector)).toHaveCount(0)
  })
})
