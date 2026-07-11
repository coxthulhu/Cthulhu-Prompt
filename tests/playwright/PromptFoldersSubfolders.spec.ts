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
const ROOT_FOLDER_EDITOR_TOP_PADDING_PX = 12

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
const rootFolderOrderPath =
  `${WORKSPACE_PATH}/Prompts/Hierarchy/_FolderInfo/FolderOrder.json`
const nestedFolderOrderPath =
  `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/_FolderInfo/FolderOrder.json`
const emptyNestedFolderOrderPath =
  `${WORKSPACE_PATH}/Prompts/Hierarchy/EmptyNested/_FolderInfo/FolderOrder.json`
const activeDividerTestIds = [
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

const scrollDividerIntoView = async (
  mainWindow: any,
  testHelpers: any,
  ownerFolderId: string,
  previousEntryId: string | null
): Promise<string> => {
  const selector = testIdSelector(dividerTestId(ownerFolderId, previousEntryId))
  await revealVirtualRow(mainWindow, testHelpers, selector)
  await testHelpers.scrollVirtualElementIntoView(
    PROMPT_FOLDER_HOST_SELECTOR,
    selector,
    12
  )
  return selector
}

const addSubfolderTestId = (previousEntryId: string | null): string =>
  previousEntryId
    ? `prompt-divider-add-subfolder-after-${previousEntryId}`
    : 'prompt-divider-add-subfolder-initial'

const createSubfolderAtDivider = async (
  mainWindow: any,
  testHelpers: any,
  ownerFolderId: string,
  previousEntryId: string | null,
  displayName: string
): Promise<void> => {
  const dividerSelector = await scrollDividerIntoView(
    mainWindow,
    testHelpers,
    ownerFolderId,
    previousEntryId
  )
  await mainWindow
    .locator(dividerSelector)
    .locator(testIdSelector(addSubfolderTestId(previousEntryId)))
    .click()
  await mainWindow
    .locator('[data-testid="create-prompt-subfolder-name-input"]')
    .fill(displayName)
  await mainWindow.locator('[data-testid="create-prompt-subfolder-button"]').click()
  await expect(
    mainWindow.locator('[data-testid="create-prompt-subfolder-name-input"]')
  ).toHaveCount(0)
}

const readFolderEntryIds = async (electronApp: any, orderPath: string): Promise<string[]> => {
  const orderFile = JSON.parse(await readTextFile(electronApp, orderPath)) as {
    entryIds: string[]
  }
  return orderFile.entryIds
}

const expectCreatedFolderVisible = async (
  mainWindow: any,
  promptFolderId: string,
  displayName: string
): Promise<void> => {
  const editor = mainWindow.locator(
    `[data-testid="prompt-folder-editor-${promptFolderId}"]`
  )
  await expect(editor).toBeVisible()
  await expect(editor.getByText(displayName, { exact: true })).toBeVisible()
  await expect(editor.locator(folderSettingsToggleSelector)).toHaveAttribute(
    'aria-pressed',
    'false'
  )
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
    ).toContainText('3 completed prompts')

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

    for (const activeDividerTestId of activeDividerTestIds) {
      const dividerSelector = testIdSelector(activeDividerTestId)
      await revealVirtualRow(mainWindow, testHelpers, dividerSelector)
      await expect(
        mainWindow.locator(dividerSelector).getByRole('button', { name: 'Add Prompt' })
      ).toHaveCount(1)
      await expect(
        mainWindow.locator(dividerSelector).getByRole('button', { name: 'Add Subfolder' })
      ).toHaveCount(1)
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

  test('creates normalized subfolders at mixed entry divider positions', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    await createSubfolderAtDivider(
      mainWindow,
      testHelpers,
      hierarchyFolderId,
      null,
      '  Initial Child  '
    )
    await expect
      .poll(async () => (await readFolderEntryIds(electronApp, rootFolderOrderPath)).length)
      .toBe(5)
    const initialOrder = await readFolderEntryIds(electronApp, rootFolderOrderPath)
    const initialChildId = initialOrder[0]
    expect(initialOrder.slice(1)).toEqual([
      'subfolders-ui-root-before',
      nestedFolderId,
      emptyNestedFolderId,
      'subfolders-ui-root-after'
    ])
    await expectCreatedFolderVisible(mainWindow, initialChildId, 'Initial Child')
    const persistedInitialFolderInfo = JSON.parse(
      await readTextFile(
        electronApp,
        `${WORKSPACE_PATH}/Prompts/Hierarchy/InitialChild/_FolderInfo/FolderInfo.json`
      )
    ) as { displayName: string; promptFolderId: string }
    expect(persistedInitialFolderInfo).toEqual({
      displayName: 'Initial Child',
      promptFolderId: initialChildId
    })

    await createSubfolderAtDivider(
      mainWindow,
      testHelpers,
      nestedFolderId,
      'subfolders-ui-nested-prompt',
      'After Prompt'
    )
    await expect
      .poll(async () => (await readFolderEntryIds(electronApp, nestedFolderOrderPath)).length)
      .toBe(3)
    const nestedOrder = await readFolderEntryIds(electronApp, nestedFolderOrderPath)
    expect(nestedOrder[0]).toBe('subfolders-ui-nested-prompt')
    expect(nestedOrder[2]).toBe(grandchildFolderId)
    await expectCreatedFolderVisible(mainWindow, nestedOrder[1], 'After Prompt')

    await createSubfolderAtDivider(
      mainWindow,
      testHelpers,
      hierarchyFolderId,
      nestedFolderId,
      'After Nested'
    )
    await expect
      .poll(async () => (await readFolderEntryIds(electronApp, rootFolderOrderPath)).length)
      .toBe(6)
    const finalRootOrder = await readFolderEntryIds(electronApp, rootFolderOrderPath)
    const afterNestedFolderId = finalRootOrder[3]
    expect(finalRootOrder).toEqual([
      initialChildId,
      'subfolders-ui-root-before',
      nestedFolderId,
      afterNestedFolderId,
      emptyNestedFolderId,
      'subfolders-ui-root-after'
    ])
    expect(afterNestedFolderId).not.toBe(initialChildId)
    await expectCreatedFolderVisible(mainWindow, afterNestedFolderId, 'After Nested')
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')
  })

  test('rejects duplicate siblings while allowing the same name under another parent', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    await createSubfolderAtDivider(
      mainWindow,
      testHelpers,
      nestedFolderId,
      'subfolders-ui-nested-prompt',
      'Shared Child'
    )
    await expect
      .poll(async () => (await readFolderEntryIds(electronApp, nestedFolderOrderPath)).length)
      .toBe(3)
    const nestedSharedChildId = (
      await readFolderEntryIds(electronApp, nestedFolderOrderPath)
    )[1]
    await expectCreatedFolderVisible(mainWindow, nestedSharedChildId, 'Shared Child')

    const nestedInitialDivider = await scrollDividerIntoView(
      mainWindow,
      testHelpers,
      nestedFolderId,
      null
    )
    await mainWindow
      .locator(nestedInitialDivider)
      .locator('[data-testid="prompt-divider-add-subfolder-initial"]')
      .click()
    await mainWindow
      .locator('[data-testid="create-prompt-subfolder-name-input"]')
      .fill('  Shared Child  ')
    await expect(
      mainWindow.locator('[data-testid="create-prompt-subfolder-name-error"]')
    ).toContainText('A folder with this name already exists')
    await expect(
      mainWindow.locator('[data-testid="create-prompt-subfolder-button"]')
    ).toBeDisabled()
    await mainWindow.keyboard.press('Escape')

    await createSubfolderAtDivider(
      mainWindow,
      testHelpers,
      emptyNestedFolderId,
      null,
      'Shared Child'
    )
    await expect
      .poll(async () => (await readFolderEntryIds(electronApp, emptyNestedFolderOrderPath)).length)
      .toBe(1)
    const emptyNestedSharedChildId = (
      await readFolderEntryIds(electronApp, emptyNestedFolderOrderPath)
    )[0]
    expect(emptyNestedSharedChildId).not.toBe(nestedSharedChildId)
    await expectCreatedFolderVisible(
      mainWindow,
      emptyNestedSharedChildId,
      'Shared Child'
    )
    await expect
      .poll(async () => (await readFolderEntryIds(electronApp, nestedFolderOrderPath)).length)
      .toBe(3)
  })

  test('adds a prompt to the divider owning subfolder without changing the screen root', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    const nestedChildFolderDivider = await scrollDividerIntoView(
      mainWindow,
      testHelpers,
      nestedFolderId,
      grandchildFolderId
    )
    await mainWindow
      .locator(nestedChildFolderDivider)
      .locator(`[data-testid="prompt-divider-add-after-${grandchildFolderId}"]`)
      .click()

    await expect
      .poll(async () => (await readFolderEntryIds(electronApp, nestedFolderOrderPath)).length)
      .toBe(3)
    const nestedOrder = await readFolderEntryIds(electronApp, nestedFolderOrderPath)
    const createdPromptId = nestedOrder[2]
    expect(nestedOrder.slice(0, 2)).toEqual([
      'subfolders-ui-nested-prompt',
      grandchildFolderId
    ])
    expect(await readFolderEntryIds(electronApp, rootFolderOrderPath)).toEqual([
      'subfolders-ui-root-before',
      nestedFolderId,
      emptyNestedFolderId,
      'subfolders-ui-root-after'
    ])
    await expect(
      mainWindow.locator(`[data-testid="prompt-editor-${createdPromptId}"]`)
    ).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')
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

  test('shows disabled subfolder controls and keeps nested prompt movement inactive', async ({
    testSetup,
    electronApp
  }) => {
    const workspacePath = '/ws/subfolders-controls'
    const rootFolderId = createDeterministicId(`${workspacePath}:Controls`)
    const controlledNestedFolderId = createDeterministicId(
      `${workspacePath}:Controls/Nested`
    )
    const controlledRootSelector =
      `[data-testid="prompt-folder-editor-${rootFolderId}"]`
    const controlledNestedSelector =
      `[data-testid="prompt-folder-editor-${controlledNestedFolderId}"]`
    const controlledPromptSelector =
      '[data-testid="prompt-editor-subfolders-controls-first"]'
    const controlledRootOrderPath =
      `${workspacePath}/Prompts/Controls/_FolderInfo/FolderOrder.json`
    const controlledNestedOrderPath =
      `${workspacePath}/Prompts/Controls/Nested/_FolderInfo/FolderOrder.json`
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-controls' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Controls')

    await expect(
      mainWindow.locator(`${controlledRootSelector} [data-testid="prompt-folder-editor-sidebar"]`)
    ).toHaveCount(0)
    await revealVirtualRow(mainWindow, testHelpers, controlledNestedSelector)
    await expect(
      mainWindow.locator(`${controlledNestedSelector} [data-testid="prompt-folder-editor-sidebar"]`)
    ).toBeVisible()
    await expect(
      mainWindow.locator(`${controlledNestedSelector} [data-testid="prompt-folder-drag-handle"]`)
    ).toBeDisabled()
    await expect(
      mainWindow.locator(`${controlledNestedSelector} [data-testid="prompt-folder-editor-title-edit"]`)
    ).toHaveCount(0)

    const folderOrderBeforeMove = await readFolderEntryIds(
      electronApp,
      controlledRootOrderPath
    )
    const folderMoveDownButton = mainWindow.locator(
      `${controlledNestedSelector} [data-testid="prompt-folder-move-down"]`
    )
    await expect(folderMoveDownButton).toBeEnabled()
    await folderMoveDownButton.click()
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, controlledRootOrderPath))
      .toEqual(folderOrderBeforeMove)

    await revealVirtualRow(mainWindow, testHelpers, controlledPromptSelector)
    await expect(
      mainWindow.locator(`${controlledPromptSelector} [data-testid="prompt-drag-handle"]`)
    ).toBeDisabled()

    const promptOrderBeforeMove = await readFolderEntryIds(
      electronApp,
      controlledNestedOrderPath
    )
    const moveDownButton = mainWindow.locator(
      `${controlledPromptSelector} [data-testid="prompt-move-down"]`
    )
    await expect(moveDownButton).toBeEnabled()
    await moveDownButton.click()
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, controlledNestedOrderPath))
      .toEqual(promptOrderBeforeMove)
  })

  test('hides Add Subfolder at depth eight', async ({ testSetup }) => {
    const workspacePath = '/ws/subfolders-depth-limit'
    const levelEightName = `DepthRoot/${Array.from(
      { length: 8 },
      (_, index) => `Level${index + 1}`
    ).join('/')}`
    const levelEightId = createDeterministicId(`${workspacePath}:${levelEightName}`)
    const levelSevenName = `DepthRoot/${Array.from(
      { length: 7 },
      (_, index) => `Level${index + 1}`
    ).join('/')}`
    const levelSevenId = createDeterministicId(`${workspacePath}:${levelSevenName}`)
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-depth-limit' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Depth Root')
    await scrollDividerIntoView(mainWindow, testHelpers, levelSevenId, null)
    await expect(
      mainWindow
        .locator(testIdSelector(dividerTestId(levelSevenId, null)))
        .locator('[data-testid="prompt-divider-add-subfolder-initial"]')
    ).toBeVisible()
    await scrollDividerIntoView(mainWindow, testHelpers, levelEightId, null)

    const deepestDivider = mainWindow.locator(
      testIdSelector(dividerTestId(levelEightId, null))
    )
    await expect(deepestDivider.locator('[data-testid="prompt-divider-add-initial"]')).toBeVisible()
    await expect(
      deepestDivider.locator('[data-testid="prompt-divider-add-subfolder-initial"]')
    ).toHaveCount(0)
  })

  test('aggregates completed prompts across descendants and restores to the direct owner', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()

    const completedPromptIds = [
      'subfolders-ui-nested-completed-2',
      'subfolders-ui-nested-completed-1',
      'subfolders-ui-root-completed'
    ]
    await expect
      .poll(async () =>
        await mainWindow.locator('[data-testid^="prompt-editor-"]').evaluateAll((rows) =>
          rows.map((row) => row.getAttribute('data-testid')?.replace('prompt-editor-', ''))
        )
      )
      .toEqual(completedPromptIds)

    await expect(mainWindow.locator(hierarchyFolderSelector)).toContainText(
      '3 completed prompts'
    )
    await expect(mainWindow.locator(nestedFolderSelector)).toHaveCount(0)
    await expect(mainWindow.locator(grandchildFolderSelector)).toHaveCount(0)
    await expect(mainWindow.locator(emptyNestedFolderSelector)).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid^="prompt-divider-add-subfolder"]')
    ).toHaveCount(0)

    const completedPromptXs = await Promise.all(
      completedPromptIds.map(async (promptId) =>
        (await mainWindow.locator(`[data-testid="prompt-editor-${promptId}"]`).boundingBox())?.x
      )
    )
    completedPromptXs.forEach((x) => expect(typeof x).toBe('number'))
    const firstCompletedPromptX = completedPromptXs[0]!
    completedPromptXs.slice(1).forEach((x) => {
      expect(Math.abs(x! - firstCompletedPromptX)).toBeLessThanOrEqual(1)
    })

    await mainWindow
      .locator(
        '[data-testid="prompt-editor-subfolders-ui-nested-completed-2"] [data-testid="prompt-uncomplete-button"]'
      )
      .click()
    await expect(
      mainWindow.locator('[data-testid="prompt-editor-subfolders-ui-nested-completed-2"]')
    ).toHaveCount(0)

    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await expect(
      mainWindow.locator('[data-testid="prompt-editor-subfolders-ui-nested-completed-2"]')
    ).toBeAttached()
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, nestedFolderOrderPath))
      .toEqual([
        'subfolders-ui-nested-completed-2',
        'subfolders-ui-nested-prompt',
        grandchildFolderId
      ])
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')
  })
})
