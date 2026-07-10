import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { PROMPT_FOLDER_HOST_SELECTOR } from '../helpers/PromptFolderSelectors'
import { PROMPT_FOLDER_SECTION_GUTTER_LINE_STEP_PX } from '../../src/renderer/src/features/prompt-folders/promptFolderSectionGutterMetrics'
import {
  getMonacoEditorText,
  typeInMonacoEditor,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import { readTextFile } from '../helpers/PromptPersistenceTestHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/subfolders-ui'
const EMPTY_PLACEHOLDER_TEXT = 'No prompts found in this folder.'
const ROOT_FOLDER_EDITOR_TOP_PADDING_PX = 24

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
const folderTitleToggleSelector = '[data-testid="prompt-folder-editor-title-toggle"]'
const folderSettingsToggleSelector = '[data-testid="prompt-folder-editor-settings-toggle"]'
const folderDescriptionSectionSelector =
  '[data-testid="prompt-folder-settings-section-folderDescription"]'
const nestedDescriptionPath =
  `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/_FolderInfo/Description.md`
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
const collapsedNestedRowTestIds = [
  `prompt-folder-editor-${hierarchyFolderId}`,
  dividerTestId(hierarchyFolderId, null),
  'prompt-editor-subfolders-ui-root-before',
  dividerTestId(hierarchyFolderId, 'subfolders-ui-root-before'),
  `prompt-folder-editor-${nestedFolderId}`,
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
    await expect(
      mainWindow.locator(hierarchyFolderSelector).locator(folderTitleToggleSelector)
    ).toContainText('2 prompts')
    await expect(
      mainWindow.locator(hierarchyFolderSelector).locator(folderTitleToggleSelector)
    ).toContainText('1 completed prompt')

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await expect(
      mainWindow
        .locator(nestedFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('1 prompt')
    await expect(
      mainWindow
        .locator(nestedFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('Nested')
    await expect(
      mainWindow.locator(nestedFolderSelector).locator(folderTitleToggleSelector)
    ).toContainText('2 completed prompts')
    await revealVirtualRow(mainWindow, testHelpers, grandchildFolderSelector)
    await expect(
      mainWindow
        .locator(grandchildFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('1 prompt')
    await expect(
      mainWindow
        .locator(grandchildFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('Grandchild')
    await expect(
      mainWindow.locator(grandchildFolderSelector).locator(folderTitleToggleSelector)
    ).toContainText('0 completed prompts')
    await revealVirtualRow(mainWindow, testHelpers, emptyNestedFolderSelector)
    await expect(
      mainWindow
        .locator(emptyNestedFolderSelector)
        .locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toContainText('0 prompts')
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

  test('collapsing one subfolder hides only that folder descendants', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)

    const nestedFolderToggle = mainWindow
      .locator(nestedFolderSelector)
      .locator(folderTitleToggleSelector)
    await expect(nestedFolderToggle).toHaveAttribute('aria-expanded', 'true')
    await nestedFolderToggle.click()
    await expect(nestedFolderToggle).toHaveAttribute('aria-expanded', 'false')

    const rowOrderAfterCollapse = await collectVirtualRowTestIds(
      mainWindow,
      testHelpers,
      orderedRowTestIds.map(testIdSelector).join(', ')
    )
    expect(rowOrderAfterCollapse).toEqual(collapsedNestedRowTestIds)

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await nestedFolderToggle.click()
    await expect(nestedFolderToggle).toHaveAttribute('aria-expanded', 'true')

    const rowOrderAfterExpand = await collectVirtualRowTestIds(
      mainWindow,
      testHelpers,
      orderedRowTestIds.map(testIdSelector).join(', ')
    )
    expect(rowOrderAfterExpand).toEqual(orderedRowTestIds)
  })

  test('keeps subfolder settings expansion and edits scoped to that folder', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    const rootSettingsToggle = mainWindow
      .locator(hierarchyFolderSelector)
      .locator(folderSettingsToggleSelector)
    await expect(rootSettingsToggle).toHaveAttribute('aria-pressed', 'false')

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    const nestedFolder = mainWindow.locator(nestedFolderSelector)
    const nestedSettingsToggle = nestedFolder.locator(folderSettingsToggleSelector)
    await expect(nestedSettingsToggle).toHaveAttribute('aria-pressed', 'false')
    await nestedSettingsToggle.click()
    await expect(nestedSettingsToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(nestedFolder.locator(folderDescriptionSectionSelector)).toHaveCount(1)

    const nestedDescriptionSelector =
      `${nestedFolderSelector} ${folderDescriptionSectionSelector}`
    await waitForMonacoEditor(mainWindow, nestedDescriptionSelector)
    await expect
      .poll(async () => getMonacoEditorText(mainWindow, nestedDescriptionSelector))
      .toContain('Nested folder description.')

    await revealVirtualRow(mainWindow, testHelpers, hierarchyFolderSelector)
    await expect(rootSettingsToggle).toHaveAttribute('aria-pressed', 'false')
    await expect(
      mainWindow.locator(hierarchyFolderSelector).locator(folderDescriptionSectionSelector)
    ).toHaveCount(0)

    await revealVirtualRow(mainWindow, testHelpers, grandchildFolderSelector)
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      grandchildFolderSelector,
      80
    )
    const grandchildFolder = mainWindow.locator(grandchildFolderSelector)
    const grandchildSettingsToggle = grandchildFolder.locator(folderSettingsToggleSelector)
    await expect(grandchildSettingsToggle).toHaveAttribute('aria-pressed', 'false')
    await grandchildSettingsToggle.click()
    await expect(grandchildSettingsToggle).toHaveAttribute('aria-pressed', 'true')
    const grandchildDescriptionSelector =
      `${grandchildFolderSelector} ${folderDescriptionSectionSelector}`
    await waitForMonacoEditor(mainWindow, grandchildDescriptionSelector)
    await expect
      .poll(async () => getMonacoEditorText(mainWindow, grandchildDescriptionSelector))
      .toContain('Grandchild folder description.')

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await expect(nestedSettingsToggle).toHaveAttribute('aria-pressed', 'true')
    await waitForMonacoEditor(mainWindow, nestedDescriptionSelector)
    await expect
      .poll(async () => getMonacoEditorText(mainWindow, nestedDescriptionSelector))
      .toContain('Nested folder description.')
    const marker = '[nested-folder-settings-persisted]'
    await typeInMonacoEditor(mainWindow, nestedDescriptionSelector, marker)
    await expect
      .poll(async () => readTextFile(electronApp, nestedDescriptionPath), { timeout: 15000 })
      .toContain(marker)

    await testHelpers.navigateToHomeScreen()
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })
    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await expect(nestedSettingsToggle).toHaveAttribute('aria-pressed', 'true')
    await waitForMonacoEditor(mainWindow, nestedDescriptionSelector)
    await expect
      .poll(async () => getMonacoEditorText(mainWindow, nestedDescriptionSelector), {
        timeout: 5000
      })
      .toContain(marker)
  })

  test('keeps top padding only on the root folder editor row', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    const readEditorGeometry = async (selector: string) =>
      await mainWindow.locator(selector).evaluate((row) => {
        const rowRect = row.getBoundingClientRect()
        const cardRect = row.querySelector('.editor-card-surface')?.getBoundingClientRect()
        if (!cardRect) return null
        return {
          cardTopOffsetPx: cardRect.top - rowRect.top,
          heightDifferencePx: rowRect.height - cardRect.height
        }
      })

    const rootGeometry = await readEditorGeometry(hierarchyFolderSelector)
    if (!rootGeometry) throw new Error('Missing root folder editor geometry')

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    const nestedGeometry = await readEditorGeometry(nestedFolderSelector)
    if (!nestedGeometry) throw new Error('Missing nested folder editor geometry')

    expect(
      Math.abs(
        rootGeometry.cardTopOffsetPx - ROOT_FOLDER_EDITOR_TOP_PADDING_PX
      )
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(rootGeometry.heightDifferencePx - ROOT_FOLDER_EDITOR_TOP_PADDING_PX)
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(nestedGeometry.cardTopOffsetPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(nestedGeometry.heightDifferencePx)).toBeLessThanOrEqual(1)
  })

  test('keeps root prompt expansion behavior unchanged', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    const rootFolderToggle = mainWindow
      .locator(hierarchyFolderSelector)
      .locator(folderTitleToggleSelector)
    await expect(rootFolderToggle).toHaveAttribute('aria-expanded', 'true')
    await rootFolderToggle.click()
    await expect(rootFolderToggle).toHaveAttribute('aria-expanded', 'false')

    const rowOrderAfterCollapse = await collectVirtualRowTestIds(
      mainWindow,
      testHelpers,
      orderedRowTestIds.map(testIdSelector).join(', ')
    )
    expect(rowOrderAfterCollapse).toEqual([`prompt-folder-editor-${hierarchyFolderId}`])

    await rootFolderToggle.click()
    await expect(rootFolderToggle).toHaveAttribute('aria-expanded', 'true')
    const rowOrderAfterExpand = await collectVirtualRowTestIds(
      mainWindow,
      testHelpers,
      orderedRowTestIds.map(testIdSelector).join(', ')
    )
    expect(rowOrderAfterExpand).toEqual(orderedRowTestIds)
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
