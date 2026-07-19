import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  PROMPT_TITLE_SELECTOR
} from '../helpers/PromptFolderSelectors'
import { PROMPT_FOLDER_SECTION_INSET_PX } from '../../src/renderer/src/features/prompt-folders/promptFolderSectionGutterMetrics'
import {
  focusMonacoEditor,
  getMonacoCursorPosition,
  getMonacoEditorText,
  isMonacoEditorFocused,
  typeInMonacoEditor,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import {
  checkPersistedPromptFilesExistByTitle,
  checkFileExists,
  readPersistedPromptTextById,
  readTextFile
} from '../helpers/PromptPersistenceTestHelpers'
import { runSqlQuery, toSqlText } from '../helpers/UserPersistenceHelpers'
import {
  beginPromptFolderHandleDrag,
  beginPromptTreeFolderRowDrag,
  finishActiveDrag,
  moveActiveDragToTarget,
  promptFolderSelectorDropdownItemSelector,
  promptFolderSelectorMenuSelector,
  promptFolderSelectorTriggerSelector,
  promptTreeFolderSelector
} from '../helpers/PromptDragDropHelpers'
import {
  createWorkspaceWithFolders,
  getWorkspaceInfoPath,
  setupWorkspaceScenario
} from '../fixtures/WorkspaceFixtures'

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
const emptyRootFolderId = createDeterministicId(`${WORKSPACE_PATH}:EmptyRoot`)
const nestedFolderId = createDeterministicId(`${WORKSPACE_PATH}:Hierarchy/Nested`)
const emptyNestedFolderId = createDeterministicId(`${WORKSPACE_PATH}:Hierarchy/EmptyNested`)
const grandchildFolderId = createDeterministicId(`${WORKSPACE_PATH}:Hierarchy/Nested/Grandchild`)

const testIdSelector = (testId: string): string => `[data-testid="${testId}"]`
const dividerTestId = (ownerFolderId: string, previousEntryId: string | null): string =>
  `prompt-folder-divider-${ownerFolderId}-${previousEntryId ?? 'initial'}`

const hierarchyFolderSelector = `[data-testid="prompt-folder-editor-${hierarchyFolderId}"]`
const nestedFolderSelector = `[data-testid="prompt-folder-editor-${nestedFolderId}"]`
const emptyNestedFolderSelector = `[data-testid="prompt-folder-editor-${emptyNestedFolderId}"]`
const grandchildFolderSelector = `[data-testid="prompt-folder-editor-${grandchildFolderId}"]`
const nestedBottomCapSelector = `[data-testid="prompt-folder-bottom-cap-${nestedFolderId}"]`
const rootBeforeSelector = '[data-testid="prompt-editor-subfolders-ui-root-before"]'
const nestedPromptSelector = '[data-testid="prompt-editor-subfolders-ui-nested-prompt"]'
const grandchildPromptSelector = '[data-testid="prompt-editor-subfolders-ui-grandchild-prompt"]'
const folderTitleToggleSelector = '[data-testid="prompt-folder-editor-title-toggle"]'
const folderTitleBarSelector = '[data-testid="prompt-folder-editor-title-bar"]'
const folderTitleEditSelector = '[data-testid="prompt-folder-editor-title-edit"]'
const folderSettingsToggleSelector = '[data-testid="prompt-folder-editor-settings-toggle"]'
const folderSettingsSeparatorSelector =
  '[data-testid="prompt-folder-editor-settings-separator"]'
const folderDescriptionSectionSelector =
  '[data-testid="prompt-folder-settings-section-folderDescription"]'
const nestedDescriptionPath = `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/_FolderInfo/Description.md`
const emptyNestedSettingsInfoPath =
  `${WORKSPACE_PATH}/Prompts/Hierarchy/EmptyNested/_FolderInfo`
const rootFolderOrderPath = `${WORKSPACE_PATH}/Prompts/Hierarchy/_FolderInfo/FolderOrder.json`
const nestedFolderOrderPath = `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/_FolderInfo/FolderOrder.json`
const grandchildFolderOrderPath = `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/Grandchild/_FolderInfo/FolderOrder.json`
const emptyNestedFolderOrderPath = `${WORKSPACE_PATH}/Prompts/Hierarchy/EmptyNested/_FolderInfo/FolderOrder.json`
const workspaceFolderOrderPath = `${WORKSPACE_PATH}/Prompts/FolderOrder.json`
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

const promptTitleSelector = (promptId: string): string =>
  `[data-testid="prompt-editor-${promptId}"] ${PROMPT_TITLE_SELECTOR}`
const statusPillSelector = (promptId: string): string =>
  `[data-testid="prompt-editor-${promptId}"] [data-testid="prompt-status-pill"]`
const statusIndicatorSelector = (promptId: string): string =>
  `[data-testid="prompt-editor-${promptId}"] [data-testid="prompt-title-status-indicator"]`
const statusMoreOptionsSelector = (promptId: string): string =>
  `[data-testid="prompt-editor-${promptId}"] [data-testid="prompt-status-more-options-button"]`
type PromptIndicatorColorToken =
  | '--ui-info-strong-border'
  | '--ui-warning-icon-glyph'
  | '--ui-success-normal-text'

const expectStatusIndicator = async (
  page: any,
  promptId: string,
  status: 'Todo' | 'InProgress' | 'Completed',
  isEdited: boolean,
  colorToken: PromptIndicatorColorToken | null
) => {
  const indicator = page.locator(statusIndicatorSelector(promptId))
  await expect(indicator).toHaveAttribute('data-status', status)
  await expect(indicator).toHaveAttribute('data-edited', isEdited ? 'true' : 'false')
  await expect(indicator).toHaveCSS('visibility', colorToken ? 'visible' : 'hidden')

  const geometry = await indicator.evaluate((element) => {
    const indicatorRect = element.getBoundingClientRect()
    const titleRowRect = element.parentElement!.getBoundingClientRect()
    const titleAreaRect = element.parentElement!.parentElement!.getBoundingClientRect()
    const sidebar = element.closest('[data-testid^="prompt-editor-"]')?.querySelector(
      '.prompt-editor-sidebar'
    )
    const sidebarRect = sidebar?.getBoundingClientRect() ?? null
    return {
      height: indicatorRect.height,
      width: indicatorRect.width,
      x: indicatorRect.x,
      titleAreaHeight: titleAreaRect.height,
      titleRowX: titleRowRect.x,
      sidebarRight: sidebarRect ? sidebarRect.right : null
    }
  })
  expect(geometry.width).toBe(2)
  expect(Math.abs(geometry.height - geometry.titleAreaHeight)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.x - geometry.titleRowX)).toBeLessThanOrEqual(1)
  if (geometry.sidebarRight !== null) {
    expect(Math.abs(geometry.x - geometry.sidebarRight)).toBeLessThanOrEqual(1)
  }

  if (!colorToken) return
  const colors = await indicator.evaluate((element, token) => {
    const reference = document.createElement('span')
    reference.style.backgroundColor = `var(${token})`
    document.body.append(reference)
    const expected = getComputedStyle(reference).backgroundColor
    reference.remove()
    return { actual: getComputedStyle(element).backgroundColor, expected }
  }, colorToken)
  expect(colors.actual).toBe(colors.expected)
}
const orderedRowTestIds = [
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
    const visibleTestIds = await mainWindow.locator(selector).evaluateAll((rows: Element[]) =>
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
  await testHelpers.scrollVirtualElementIntoView(PROMPT_FOLDER_HOST_SELECTOR, selector, 12)
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
  await mainWindow.locator('[data-testid="create-prompt-subfolder-name-input"]').fill(displayName)
  await mainWindow.locator('[data-testid="create-prompt-subfolder-button"]').click()
  await expect(
    mainWindow.locator('[data-testid="create-prompt-subfolder-name-input"]')
  ).toHaveCount(0)
}

const readFolderEntryIds = async (electronApp: any, orderPath: string): Promise<string[]> => {
  const orderFile = JSON.parse(await readTextFile(electronApp, orderPath)) as {
    entries: Array<{ id: string }>
  }
  return orderFile.entries.map((entry) => entry.id)
}

const expectNoPromptFolderSettingsFiles = async (
  electronApp: any,
  promptFolderPath: string
): Promise<void> => {
  await expect
    .poll(async () =>
      await Promise.all(
        ['Description.md', 'PromptPrefix.md', 'PromptSuffix.md'].map((filename) =>
          checkFileExists(electronApp, `${promptFolderPath}/_FolderInfo/${filename}`)
        )
      )
    )
    .toEqual([false, false, false])
}

const readSettingsEditorViewStateCount = async (
  electronApp: any,
  promptFolderId: string
): Promise<number> => {
  const result = await runSqlQuery(
    electronApp,
    `
    SELECT COUNT(*) AS count
    FROM prompt_folder_settings_editor_view_state
    WHERE workspace_id = ${toSqlText(createDeterministicId(WORKSPACE_PATH))}
      AND prompt_folder_id = ${toSqlText(promptFolderId)}
      AND settings_field = 'folderDescription'
    `
  )
  if (!result.success) throw new Error(result.error ?? 'Failed to read settings editor view state')
  return Number(result.rows?.[0]?.count ?? 0)
}

const expectCreatedFolderVisible = async (
  mainWindow: any,
  promptFolderId: string,
  displayName: string
): Promise<void> => {
  const editor = mainWindow.locator(`[data-testid="prompt-folder-editor-${promptFolderId}"]`)
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
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toContainText(
      'Hierarchy'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"] span')).toHaveText(
      '4'
    )
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"] span')
    ).toHaveText('3')

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await expect(
      mainWindow.locator(nestedFolderSelector).locator('.cthulhuUiIconButtonBar')
    ).toHaveCSS('gap', '8px')
    await expect(
      mainWindow.locator(nestedFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('1 prompt')
    await expect(
      mainWindow.locator(nestedFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('Nested')
    await expect(
      mainWindow.locator(nestedFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('2 completed prompts')
    await expect(
      mainWindow.locator(nestedFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('1 subfolder')
    await expect(
      mainWindow.locator(nestedFolderSelector).locator(folderTitleEditSelector)
    ).toHaveAttribute('aria-label', 'Rename prompt folder')
    await expect(
      mainWindow.locator(nestedFolderSelector).locator('.prompt-folder-editor-title-line')
    ).toHaveCSS('align-items', 'baseline')
    await revealVirtualRow(mainWindow, testHelpers, grandchildFolderSelector)
    await expect(
      mainWindow.locator(grandchildFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('1 prompt')
    await expect(
      mainWindow.locator(grandchildFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('Grandchild')
    await expect(
      mainWindow.locator(grandchildFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('0 completed prompts')
    await expect(
      mainWindow.locator(grandchildFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('0 subfolders')
    await expect(
      mainWindow.locator(grandchildFolderSelector).locator(folderTitleEditSelector)
    ).toHaveAttribute('aria-label', 'Rename prompt folder')
    await revealVirtualRow(mainWindow, testHelpers, emptyNestedFolderSelector)
    await expect(
      mainWindow.locator(emptyNestedFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('0 prompts')
    await expect(
      mainWindow.locator(emptyNestedFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('Empty Nested')
    await expect(
      mainWindow.locator(emptyNestedFolderSelector).locator(folderTitleBarSelector)
    ).toContainText('0 subfolders')
    await expect(
      mainWindow.locator(emptyNestedFolderSelector).locator(folderTitleEditSelector)
    ).toHaveAttribute('aria-label', 'Rename prompt folder')

    await revealVirtualRow(mainWindow, testHelpers, rootBeforeSelector)
    await expect(
      mainWindow.locator(rootBeforeSelector).locator('.cthulhuUiIconButtonBar')
    ).toHaveCSS('gap', '8px')
    const rootBeforeBox = await mainWindow.locator(rootBeforeSelector).boundingBox()
    const nestedFolderBox = await mainWindow.locator(nestedFolderSelector).boundingBox()

    await revealVirtualRow(mainWindow, testHelpers, grandchildPromptSelector)
    const nestedPromptBox = await mainWindow.locator(nestedPromptSelector).boundingBox()
    const grandchildFolderBox = await mainWindow.locator(grandchildFolderSelector).boundingBox()
    const grandchildPromptBox = await mainWindow.locator(grandchildPromptSelector).boundingBox()
    const nestedPromptSection = mainWindow.locator(
      `.prompt-folder-section-row:has(${nestedPromptSelector})`
    )
    const grandchildPromptSection = mainWindow.locator(
      `.prompt-folder-section-row:has(${grandchildPromptSelector})`
    )
    const nestedMiddleLayer = nestedPromptSection.locator(
      '.prompt-folder-section-middle-layer'
    )

    await expect(nestedMiddleLayer).toHaveCount(1)
    await expect(
      grandchildPromptSection.locator('.prompt-folder-section-middle-layer')
    ).toHaveCount(2)
    await expect(nestedMiddleLayer).toHaveCSS('border-left-width', '1px')
    await expect(
      mainWindow
        .locator(PROMPT_FOLDER_HOST_SELECTOR)
        .locator('.promptFolderSectionGutter, [data-indent-guide-line]')
    ).toHaveCount(0)

    if (
      !rootBeforeBox ||
      !nestedFolderBox ||
      !nestedPromptBox ||
      !grandchildFolderBox ||
      !grandchildPromptBox
    ) {
      throw new Error('Missing prompt folder hierarchy row geometry')
    }

    const nestedMiddleLayerBox = await nestedMiddleLayer.boundingBox()
    if (!nestedMiddleLayerBox) throw new Error('Missing nested folder middle layer geometry')

    expect(Math.abs(nestedFolderBox.x - rootBeforeBox.x)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(nestedPromptBox.x - rootBeforeBox.x - PROMPT_FOLDER_SECTION_INSET_PX)
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(grandchildFolderBox.x - nestedPromptBox.x)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        grandchildPromptBox.x - rootBeforeBox.x - PROMPT_FOLDER_SECTION_INSET_PX * 2
      )
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(nestedPromptBox.x - nestedMiddleLayerBox.x - PROMPT_FOLDER_SECTION_INSET_PX)
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        nestedMiddleLayerBox.x +
          nestedMiddleLayerBox.width -
          (nestedPromptBox.x + nestedPromptBox.width) -
          PROMPT_FOLDER_SECTION_INSET_PX
      )
    ).toBeLessThanOrEqual(1)

    const nestedSegmentColors = await nestedMiddleLayer.evaluate((element) => {
      const reference = document.createElement('div')
      reference.style.backgroundColor = 'var(--ui-card-nested-surface)'
      reference.style.borderColor = 'var(--ui-card-nested-border)'
      reference.style.borderStyle = 'solid'
      document.body.append(reference)
      const referenceStyles = getComputedStyle(reference)
      const colors = {
        expectedBackground: referenceStyles.backgroundColor,
        expectedBorder: referenceStyles.borderColor
      }
      reference.remove()
      const elementStyles = getComputedStyle(element)
      return {
        background: elementStyles.backgroundColor,
        border: elementStyles.borderLeftColor,
        ...colors
      }
    })
    expect(nestedSegmentColors.background).toBe(nestedSegmentColors.expectedBackground)
    expect(nestedSegmentColors.border).toBe(nestedSegmentColors.expectedBorder)

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    const nestedTopCapBorder = await mainWindow
      .locator(nestedFolderSelector)
      .locator('.editor-card-surface')
      .evaluate((element) => {
        const reference = document.createElement('div')
        reference.style.borderColor = 'var(--ui-card-nested-border)'
        reference.style.borderStyle = 'solid'
        document.body.append(reference)
        const expected = getComputedStyle(reference).borderColor
        reference.remove()
        return { actual: getComputedStyle(element).borderTopColor, expected }
      })
    expect(nestedTopCapBorder.actual).toBe(nestedTopCapBorder.expected)
    expect(
      Math.abs(
        nestedPromptBox.x +
          nestedPromptBox.width -
          (rootBeforeBox.x + rootBeforeBox.width - PROMPT_FOLDER_SECTION_INSET_PX)
      )
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(
        grandchildPromptBox.x +
          grandchildPromptBox.width -
          (rootBeforeBox.x + rootBeforeBox.width - PROMPT_FOLDER_SECTION_INSET_PX * 2)
      )
    ).toBeLessThanOrEqual(1)

    await revealVirtualRow(mainWindow, testHelpers, nestedBottomCapSelector)
    const nestedBottomCap = mainWindow.locator(nestedBottomCapSelector)
    await expect(nestedBottomCap).toHaveCSS('height', '8px')
    await expect(nestedBottomCap).toHaveCSS('border-top-width', '0px')
    await expect(nestedBottomCap).toHaveCSS('border-bottom-left-radius', '8px')
    await expect(nestedBottomCap).toHaveCSS('border-bottom-right-radius', '8px')
    const nestedSurfaceColors = await nestedBottomCap.evaluate((element) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = 'var(--ui-card-nested-surface)'
      probe.style.borderColor = 'var(--ui-card-nested-border)'
      probe.style.borderStyle = 'solid'
      document.body.append(probe)
      const probeStyles = getComputedStyle(probe)
      const colors = {
        expectedBackground: probeStyles.backgroundColor,
        expectedBorder: probeStyles.borderColor
      }
      probe.remove()
      return {
        background: getComputedStyle(element).backgroundColor,
        border: getComputedStyle(element).borderBottomColor,
        ...colors
      }
    })
    expect(nestedSurfaceColors.background).toBe(nestedSurfaceColors.expectedBackground)
    expect(nestedSurfaceColors.border).toBe(nestedSurfaceColors.expectedBorder)

    const nestedInitialDividerSelector = testIdSelector(dividerTestId(nestedFolderId, null))
    await revealVirtualRow(mainWindow, testHelpers, nestedInitialDividerSelector)
    await expect(
      mainWindow
        .locator(nestedInitialDividerSelector)
        .locator('.prompt-folder-section-middle-layer')
    ).toHaveCount(1)

    const rowOrder = await collectVirtualRowTestIds(mainWindow, testHelpers, orderedRowSelector)
    expect(rowOrder).toEqual(orderedRowTestIds)

    for (const activeDividerTestId of activeDividerTestIds) {
      const dividerSelector = testIdSelector(activeDividerTestId)
      await revealVirtualRow(mainWindow, testHelpers, dividerSelector)
      await expect(
        mainWindow.locator(dividerSelector).getByRole('button', { name: 'Add Prompt', exact: true })
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

  test('collapsing one subfolder hides only that folder descendants', async ({ testSetup }) => {
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
    const nestedFolderTitleBar = mainWindow
      .locator(nestedFolderSelector)
      .locator(folderTitleBarSelector)
    const nestedFolderChevron = nestedFolderToggle.locator('.prompt-folder-editor-chevron')
    const nestedFolderCard = mainWindow
      .locator(nestedFolderSelector)
      .locator('.editor-card-surface')
    const readChevronRotationDegrees = async (): Promise<number> =>
      await nestedFolderChevron.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform)
        return Math.round((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI)
      })
    await expect(nestedFolderToggle).toHaveClass(/cthulhuUiIconButton/)
    await expect(nestedFolderToggle).toHaveAttribute('data-hover-variant', 'neutral')
    await expect(nestedFolderToggle).toHaveCSS('border-top-style', 'none')
    await expect(nestedFolderToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(nestedFolderCard).toHaveCSS('border-top-left-radius', '8px')
    await expect(nestedFolderCard).toHaveCSS('border-bottom-left-radius', '0px')
    await expect(nestedFolderCard).toHaveCSS('border-bottom-right-radius', '0px')
    await expect(nestedFolderTitleBar).toContainText('1 prompt')
    await expect(nestedFolderTitleBar).toContainText('1 subfolder')
    await expect.poll(readChevronRotationDegrees).toBe(90)
    await nestedFolderTitleBar.click({ position: { x: 100, y: 20 } })
    await expect(nestedFolderToggle).toHaveAttribute('aria-expanded', 'true')
    await nestedFolderToggle.click()
    await expect(nestedFolderToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(nestedFolderCard).toHaveCSS('border-bottom-left-radius', '8px')
    await expect(nestedFolderCard).toHaveCSS('border-bottom-right-radius', '8px')
    await expect(nestedFolderTitleBar).toContainText('1 prompt')
    await expect(nestedFolderTitleBar).toContainText('1 subfolder')
    await expect.poll(readChevronRotationDegrees).toBe(0)

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

  test('renames a subfolder with sibling-scoped validation and preserves its id', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    const nameInput = mainWindow.locator('[data-testid="rename-prompt-folder-name-input"]')
    const renameButton = mainWindow.locator('[data-testid="rename-prompt-folder-button"]')
    const errorMessage = mainWindow.locator('[data-testid="rename-prompt-folder-name-error"]')

    const siblingRenameResult = await mainWindow.evaluate(
      async ({ workspaceId, rootFolderId, targetFolderId }) => {
        const loadResult = await window.electron.ipcRenderer.invoke('load-prompt-folder-initial', {
          requestId: `test-load-${rootFolderId}-${Date.now()}`,
          clientId: window.ipcClientId,
          payload: { workspaceId, promptFolderId: rootFolderId }
        })
        const targetFolder = loadResult.promptFolders.find(
          (folder: { id: string }) => folder.id === targetFolderId
        )

        return await window.electron.ipcRenderer.invoke('rename-prompt-folder', {
          requestId: `test-rename-${targetFolderId}-${Date.now()}`,
          clientId: window.ipcClientId,
          payload: {
            promptFolder: {
              id: targetFolder.id,
              expectedRevision: targetFolder.revision,
              data: targetFolder.data
            },
            displayName: 'Empty Nested'
          }
        })
      },
      {
        workspaceId: createDeterministicId(WORKSPACE_PATH),
        rootFolderId: hierarchyFolderId,
        targetFolderId: nestedFolderId
      }
    )
    expect(siblingRenameResult).toMatchObject({
      success: false,
      error: 'A folder with this name already exists'
    })

    await mainWindow.locator('[data-testid="prompt-folder-root-title-edit"]').click()
    await nameInput.fill('Grandchild')
    await expect(errorMessage).toHaveCount(0)
    await expect(renameButton).toBeEnabled()
    await mainWindow.keyboard.press('Escape')

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await mainWindow.locator(nestedFolderSelector).locator(folderTitleEditSelector).click()

    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeFocused()
    await expect(nameInput).toHaveValue('Nested')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Empty Nested')
    await expect(errorMessage).toContainText('A folder with this name already exists')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Grandchild')
    await expect(errorMessage).toHaveCount(0)
    await expect(renameButton).toBeEnabled()
    await renameButton.click()

    await expect(nameInput).toHaveCount(0)
    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await expect(
      mainWindow.locator(nestedFolderSelector).getByText('Grandchild', { exact: true })
    ).toBeVisible()

    await mainWindow.locator(nestedFolderSelector).locator(folderTitleEditSelector).click()
    await expect(nameInput).toHaveValue('Grandchild')

    await nameInput.fill('Renamed Nested')
    await renameButton.click()

    await expect(nameInput).toHaveCount(0)
    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await expect(
      mainWindow.locator(nestedFolderSelector).getByText('Renamed Nested', { exact: true })
    ).toBeVisible()

    const renamedFolderPath = `${WORKSPACE_PATH}/Prompts/Hierarchy/RenamedNested`
    const renamedFolderInfo = JSON.parse(
      await readTextFile(electronApp, `${renamedFolderPath}/_FolderInfo/FolderInfo.json`)
    ) as {
      displayName: string
      promptFolderId: string
    }
    expect(renamedFolderInfo).toEqual({
      displayName: 'Renamed Nested',
      promptFolderId: nestedFolderId
    })
    await expect
      .poll(async () => ({
        oldFolderInfo: await checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/_FolderInfo/FolderInfo.json`
        ),
        nestedPrompt: await checkFileExists(
          electronApp,
          `${renamedFolderPath}/Nested Prompt.prompt.md`
        ),
        completedPrompt: await checkFileExists(
          electronApp,
          `${renamedFolderPath}/_Completed/Nested Completed One.prompt.md`
        ),
        grandchildPrompt: await checkFileExists(
          electronApp,
          `${renamedFolderPath}/Grandchild/Grandchild Prompt.prompt.md`
        )
      }))
      .toEqual({
        oldFolderInfo: false,
        nestedPrompt: true,
        completedPrompt: true,
        grandchildPrompt: true
      })
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

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    const nestedFolder = mainWindow.locator(nestedFolderSelector)
    const nestedSettingsToggle = nestedFolder.locator(folderSettingsToggleSelector)
    await expect(nestedSettingsToggle).toHaveAttribute('aria-pressed', 'false')
    await expect(nestedFolder.locator(folderSettingsSeparatorSelector)).toHaveCount(0)
    await nestedSettingsToggle.click()
    await expect(nestedSettingsToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(nestedFolder.locator(folderSettingsSeparatorSelector)).toHaveCount(1)
    await expect(nestedFolder.locator(folderDescriptionSectionSelector)).toHaveCount(1)

    const nestedDescriptionSelector = `${nestedFolderSelector} ${folderDescriptionSectionSelector}`
    await waitForMonacoEditor(mainWindow, nestedDescriptionSelector)
    await expect
      .poll(async () => getMonacoEditorText(mainWindow, nestedDescriptionSelector))
      .toContain('Nested folder description.')

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
    const grandchildDescriptionSelector = `${grandchildFolderSelector} ${folderDescriptionSectionSelector}`
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

    await nestedSettingsToggle.click()
    await expect(nestedSettingsToggle).toHaveAttribute('aria-pressed', 'false')
    await expect(nestedFolder.locator(folderSettingsSeparatorSelector)).toHaveCount(0)
  })

  test('adds and deletes only the subfolder settings the user chooses', async ({
    electronApp,
    testSetup
  }) => {
    test.setTimeout(60000)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await revealVirtualRow(mainWindow, testHelpers, emptyNestedFolderSelector)
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      emptyNestedFolderSelector,
      80
    )

    const emptyNestedFolder = mainWindow.locator(emptyNestedFolderSelector)
    await emptyNestedFolder.locator(folderSettingsToggleSelector).click()

    const descriptionSection = `${emptyNestedFolderSelector} ${folderDescriptionSectionSelector}`
    const descriptionPath = `${emptyNestedSettingsInfoPath}/Description.md`
    const prefixPath = `${emptyNestedSettingsInfoPath}/PromptPrefix.md`
    const suffixPath = `${emptyNestedSettingsInfoPath}/PromptSuffix.md`
    await expect(
      emptyNestedFolder.locator('[data-testid^="prompt-folder-settings-add-"]')
    ).toHaveCount(3)
    await expect(emptyNestedFolder.locator('.monaco-editor')).toHaveCount(0)
    expect(
      await Promise.all(
        [descriptionPath, prefixPath, suffixPath].map((filePath) =>
          checkFileExists(electronApp, filePath)
        )
      )
    ).toEqual([false, false, false])

    await emptyNestedFolder
      .locator('[data-testid="prompt-folder-settings-add-folderDescription"]')
      .click()
    expect(await checkFileExists(electronApp, descriptionPath)).toBe(false)
    await waitForMonacoEditor(mainWindow, descriptionSection)
    await expect
      .poll(() => isMonacoEditorFocused(mainWindow, descriptionSection))
      .toBe(true)
    await expect
      .poll(() => checkFileExists(electronApp, descriptionPath), { timeout: 15000 })
      .toBe(true)
    expect(await readTextFile(electronApp, descriptionPath)).toBe('')
    expect(await checkFileExists(electronApp, prefixPath)).toBe(false)
    expect(await checkFileExists(electronApp, suffixPath)).toBe(false)
    await expect(
      emptyNestedFolder.locator(
        '[data-testid="prompt-folder-settings-section-folderPrefix"] .monaco-editor, [data-testid="prompt-folder-settings-section-folderSuffix"] .monaco-editor'
      )
    ).toHaveCount(0)

    const marker = 'Setting that requires confirmation'
    await typeInMonacoEditor(mainWindow, descriptionSection, marker)
    await expect
      .poll(() => readTextFile(electronApp, descriptionPath), { timeout: 15000 })
      .toContain(marker)
    await focusMonacoEditor(mainWindow, descriptionSection)
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.press('Backspace')
    await expect
      .poll(() => readTextFile(electronApp, descriptionPath), { timeout: 15000 })
      .toBe('')
    expect(await checkFileExists(electronApp, descriptionPath)).toBe(true)

    await typeInMonacoEditor(mainWindow, descriptionSection, marker)
    await emptyNestedFolder.locator(folderSettingsToggleSelector).click()
    await expect
      .poll(() => readSettingsEditorViewStateCount(electronApp, emptyNestedFolderId), {
        timeout: 15000
      })
      .toBe(1)
    await emptyNestedFolder.locator(folderSettingsToggleSelector).click()
    await waitForMonacoEditor(mainWindow, descriptionSection)

    const descriptionActions = emptyNestedFolder.locator(
      '[data-testid="editor-card-section-actions-prompt-folder-settings-section-folderDescription"]'
    )
    await descriptionActions
      .locator('[data-testid="prompt-folder-settings-delete-folderDescription"]')
      .click()
    const confirmationDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Folder Description"]'
    )
    await expect(confirmationDialog).toBeVisible()
    await confirmationDialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(confirmationDialog).toHaveCount(0)
    await expect
      .poll(() => getMonacoEditorText(mainWindow, descriptionSection))
      .toContain(marker)

    await descriptionActions
      .locator('[data-testid="prompt-folder-settings-delete-folderDescription"]')
      .click()
    await confirmationDialog
      .locator('[data-testid="prompt-folder-settings-confirm-delete-folderDescription"]')
      .click()
    await expect(
      emptyNestedFolder.locator('[data-testid="prompt-folder-settings-add-folderDescription"]')
    ).toBeVisible()
    expect(await checkFileExists(electronApp, descriptionPath)).toBe(true)
    await expect
      .poll(() => checkFileExists(electronApp, descriptionPath), { timeout: 15000 })
      .toBe(false)
    await expect
      .poll(() => readSettingsEditorViewStateCount(electronApp, emptyNestedFolderId), {
        timeout: 15000
      })
      .toBe(0)

    await emptyNestedFolder
      .locator('[data-testid="prompt-folder-settings-add-folderDescription"]')
      .click()
    await waitForMonacoEditor(mainWindow, descriptionSection)
    await expect
      .poll(() => isMonacoEditorFocused(mainWindow, descriptionSection))
      .toBe(true)
    expect(await getMonacoEditorText(mainWindow, descriptionSection)).toBe('')
    expect(await getMonacoCursorPosition(mainWindow, descriptionSection)).toEqual({
      lineNumber: 1,
      column: 1
    })
    await expect
      .poll(() => checkFileExists(electronApp, descriptionPath), { timeout: 15000 })
      .toBe(true)
    await mainWindow.keyboard.type('   ')

    await emptyNestedFolder
      .locator('[data-testid="prompt-folder-settings-delete-folderDescription"]')
      .click()
    await expect(confirmationDialog).toHaveCount(0)
    await expect
      .poll(() => checkFileExists(electronApp, descriptionPath), { timeout: 15000 })
      .toBe(false)
  })

  test('keeps subfolder editor cards flush with their virtual rows', async ({ testSetup }) => {
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

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    const nestedGeometry = await readEditorGeometry(nestedFolderSelector)
    if (!nestedGeometry) throw new Error('Missing nested folder editor geometry')

    expect(Math.abs(nestedGeometry.cardTopOffsetPx)).toBeLessThanOrEqual(1)
    expect(Math.abs(nestedGeometry.heightDifferencePx)).toBeLessThanOrEqual(1)
  })

  test('always renders root contents without a root editor row', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST_SELECTOR, { state: 'attached' })

    await expect(mainWindow.locator(hierarchyFolderSelector)).toHaveCount(0)
    const rowOrder = await collectVirtualRowTestIds(
      mainWindow,
      testHelpers,
      orderedRowTestIds.map(testIdSelector).join(', ')
    )
    expect(rowOrder).toEqual(orderedRowTestIds)
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
    await expectNoPromptFolderSettingsFiles(
      electronApp,
      `${WORKSPACE_PATH}/Prompts/Hierarchy/InitialChild`
    )

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
    await expectNoPromptFolderSettingsFiles(
      electronApp,
      `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/AfterPrompt`
    )

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
    const nestedSharedChildId = (await readFolderEntryIds(electronApp, nestedFolderOrderPath))[1]
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
    await expectCreatedFolderVisible(mainWindow, emptyNestedSharedChildId, 'Shared Child')
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
    expect(nestedOrder.slice(0, 2)).toEqual(['subfolders-ui-nested-prompt', grandchildFolderId])
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

  test('deletes empty and populated prompt folders and returns home after root deletion', async ({
    electronApp,
    testSetup
  }) => {
    const filesystem = setupWorkspaceScenario(WORKSPACE_PATH, 'subfolders-ui')
    filesystem[`${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/Unmanaged.txt`] =
      'Delete this unmanaged file with its prompt folder.'
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart()

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Hierarchy')

    await revealVirtualRow(mainWindow, testHelpers, emptyNestedFolderSelector)
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      emptyNestedFolderSelector,
      12
    )
    await mainWindow
      .locator(emptyNestedFolderSelector)
      .locator('[data-testid="prompt-folder-editor-delete-button"]')
      .click()
    await expect(
      mainWindow.locator('[role="dialog"][aria-label="Delete Prompt Folder"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator(emptyNestedFolderSelector)).toHaveCount(0)
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, rootFolderOrderPath))
      .toEqual(['subfolders-ui-root-before', nestedFolderId, 'subfolders-ui-root-after'])
    await expect
      .poll(
        async () =>
          await checkFileExists(electronApp, `${WORKSPACE_PATH}/Prompts/Hierarchy/EmptyNested`)
      )
      .toBe(false)

    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      nestedFolderSelector,
      12
    )
    await mainWindow
      .locator(nestedFolderSelector)
      .locator('[data-testid="prompt-folder-editor-delete-button"]')
      .click()
    const subfolderDialog = mainWindow.locator('[role="dialog"][aria-label="Delete Prompt Folder"]')
    await expect(subfolderDialog).toBeVisible()
    await expect(subfolderDialog).toContainText('Nested')
    await subfolderDialog.locator('[data-testid="prompt-folder-confirm-delete-button"]').click()
    await expect(mainWindow.locator(nestedFolderSelector)).toHaveCount(0)
    await expect(mainWindow.locator(grandchildFolderSelector)).toHaveCount(0)
    await expect
      .poll(
        async () => await checkFileExists(electronApp, `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested`)
      )
      .toBe(false)
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, rootFolderOrderPath))
      .toEqual(['subfolders-ui-root-before', 'subfolders-ui-root-after'])

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST_SELECTOR, 0)
    await mainWindow.locator('[data-testid="prompt-folder-delete-button"]').click()
    const rootFolderDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Prompt Folder"]'
    )
    await expect(rootFolderDialog).toBeVisible()
    await expect(rootFolderDialog).toContainText('Hierarchy')
    await rootFolderDialog.locator('[data-testid="prompt-folder-confirm-delete-button"]').click()

    await expect.poll(async () => await testHelpers.getActiveScreen()).toBe('home')
    await expect
      .poll(async () => await checkFileExists(electronApp, `${WORKSPACE_PATH}/Prompts/Hierarchy`))
      .toBe(false)
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, workspaceFolderOrderPath))
      .toEqual([emptyRootFolderId])

    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    await testHelpers.setupWorkspaceViaUI()
    await expect.poll(async () => await testHelpers.getActiveScreen()).toBe('home')
    await testHelpers.navigateToPromptFolders('Empty Root')
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-title"]')).toHaveText(
      'Empty Root'
    )
  })

  test('enables nested prompt movement and removes subfolder arrows', async ({
    testSetup,
    electronApp
  }) => {
    const workspacePath = '/ws/subfolders-controls'
    const rootFolderId = createDeterministicId(`${workspacePath}:Controls`)
    const controlledNestedFolderId = createDeterministicId(`${workspacePath}:Controls/Nested`)
    const controlledRootSelector = `[data-testid="prompt-folder-editor-${rootFolderId}"]`
    const controlledNestedSelector = `[data-testid="prompt-folder-editor-${controlledNestedFolderId}"]`
    const controlledPromptSelector = '[data-testid="prompt-editor-subfolders-controls-first"]'
    const controlledRootOrderPath = `${workspacePath}/Prompts/Controls/_FolderInfo/FolderOrder.json`
    const controlledNestedOrderPath = `${workspacePath}/Prompts/Controls/Nested/_FolderInfo/FolderOrder.json`
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
      mainWindow.locator(`${controlledNestedSelector} ${folderTitleEditSelector}`)
    ).toBeVisible()

    await expect(
      mainWindow.locator(`${controlledNestedSelector} [data-testid="prompt-folder-drag-handle"]`)
    ).toBeEnabled()
    await expect(
      mainWindow.locator(
        `${controlledNestedSelector} [data-testid="prompt-folder-move-up"], ${controlledNestedSelector} [data-testid="prompt-folder-move-down"]`
      )
    ).toHaveCount(0)

    await revealVirtualRow(mainWindow, testHelpers, controlledPromptSelector)
    await expect(
      mainWindow.locator(`${controlledPromptSelector} [data-testid="prompt-drag-handle"]`)
    ).toBeEnabled()

    const moveUpButton = mainWindow.locator(
      `${controlledPromptSelector} [data-testid="prompt-move-up"]`
    )
    await expect(moveUpButton).toBeEnabled()
    await moveUpButton.click()
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, controlledRootOrderPath))
      .toEqual([
        'subfolders-controls-first',
        controlledNestedFolderId,
        createDeterministicId(`${workspacePath}:Controls/Sibling`)
      ])
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, controlledNestedOrderPath))
      .toEqual(['subfolders-controls-second'])

    await revealVirtualRow(mainWindow, testHelpers, controlledPromptSelector)
    const moveDownButton = mainWindow.locator(
      `${controlledPromptSelector} [data-testid="prompt-move-down"]`
    )
    await expect(moveDownButton).toBeEnabled()
    await moveDownButton.click()
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, controlledRootOrderPath))
      .toEqual([
        controlledNestedFolderId,
        createDeterministicId(`${workspacePath}:Controls/Sibling`)
      ])
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, controlledNestedOrderPath))
      .toEqual(['subfolders-controls-first', 'subfolders-controls-second'])
  })

  test('moves a complete subfolder to the first position of another root dropdown folder', async ({
    testSetup,
    electronApp
  }) => {
    const destinationFolderName = 'Destination'
    const destinationFolderId = createDeterministicId(`${WORKSPACE_PATH}:${destinationFolderName}`)
    const filesystem = createWorkspaceWithFolders(WORKSPACE_PATH, [
      { folderName: 'Hierarchy', displayName: 'Hierarchy' },
      {
        folderName: destinationFolderName,
        displayName: destinationFolderName,
        prompts: [
          {
            id: 'destination-existing',
            title: 'Existing Destination Prompt',
            promptText: 'Existing destination prompt.'
          }
        ]
      }
    ])
    const hierarchyFilesystem = setupWorkspaceScenario(WORKSPACE_PATH, 'subfolders-ui')
    for (const [filePath, contents] of Object.entries(hierarchyFilesystem)) {
      if (filePath.includes(`${WORKSPACE_PATH}/Prompts/Hierarchy/`)) {
        filesystem[filePath] = contents
      }
    }
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])

    const { mainWindow, testHelpers } = await testSetup.setupAndStart()
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await revealVirtualRow(mainWindow, testHelpers, nestedFolderSelector)
    await beginPromptFolderHandleDrag(mainWindow, nestedFolderId)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(destinationFolderId)
    )
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(promptFolderSelectorTriggerSelector)).toContainText(
      destinationFolderName
    )
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, rootFolderOrderPath))
      .toEqual(['subfolders-ui-root-before', emptyNestedFolderId, 'subfolders-ui-root-after'])
    await expect
      .poll(async () =>
        readFolderEntryIds(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/${destinationFolderName}/_FolderInfo/FolderOrder.json`
        )
      )
      .toEqual([nestedFolderId, 'destination-existing'])
    await expect
      .poll(async () => ({
        oldCompletedOne: await checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/_Completed/Nested Completed One.prompt.md`
        ),
        oldCompletedTwo: await checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Hierarchy/Nested/_Completed/Nested Completed Two.prompt.md`
        ),
        newCompletedOne: await checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/${destinationFolderName}/Nested/_Completed/Nested Completed One.prompt.md`
        ),
        newCompletedTwo: await checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/${destinationFolderName}/Nested/_Completed/Nested Completed Two.prompt.md`
        ),
        activePrompt: await checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/${destinationFolderName}/Nested/Nested Prompt.prompt.md`
        ),
        grandchildPrompt: await checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/${destinationFolderName}/Nested/Grandchild/Grandchild Prompt.prompt.md`
        )
      }))
      .toEqual({
        oldCompletedOne: false,
        oldCompletedTwo: false,
        newCompletedOne: true,
        newCompletedTwo: true,
        activePrompt: true,
        grandchildPrompt: true
      })

    await expect(mainWindow.locator(nestedFolderSelector)).toBeVisible()
    await expect(
      mainWindow.locator(`${nestedFolderSelector} ${folderSettingsToggleSelector}`)
    ).toHaveAttribute('aria-pressed', 'false')
    await expect(
      mainWindow.locator(promptTreeFolderSelector('Nested')).locator('xpath=..')
    ).toHaveAttribute('data-row-state', 'active')

    await beginPromptTreeFolderRowDrag(mainWindow, 'Nested')
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(hierarchyFolderId)
    )
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(promptFolderSelectorTriggerSelector)).toContainText('Hierarchy')
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, rootFolderOrderPath))
      .toEqual([
        nestedFolderId,
        'subfolders-ui-root-before',
        emptyNestedFolderId,
        'subfolders-ui-root-after'
      ])
    await expect(mainWindow.locator(nestedFolderSelector)).toBeVisible()
    await expect(
      mainWindow.locator(promptTreeFolderSelector('Nested')).locator('xpath=..')
    ).toHaveAttribute('data-row-state', 'active')
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

    const deepestDivider = mainWindow.locator(testIdSelector(dividerTestId(levelEightId, null)))
    await expect(deepestDivider.locator('[data-testid="prompt-divider-add-initial"]')).toBeVisible()
    await expect(
      deepestDivider.locator('[data-testid="prompt-divider-add-subfolder-initial"]')
    ).toHaveCount(0)
  })

  test('persists nested prompt edits and copies with direct-owner settings', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await revealVirtualRow(mainWindow, testHelpers, nestedPromptSelector)
    await waitForMonacoEditor(mainWindow, nestedPromptSelector)

    const updatedTitle = 'Nested Prompt Updated'
    const bodyMarker = '[nested-prompt-body-persisted]'
    await expectStatusIndicator(mainWindow, 'subfolders-ui-nested-prompt', 'Todo', false, null)
    await mainWindow.locator(promptTitleSelector('subfolders-ui-nested-prompt')).fill(updatedTitle)
    await expectStatusIndicator(
      mainWindow,
      'subfolders-ui-nested-prompt',
      'Todo',
      true,
      '--ui-info-strong-border'
    )
    await typeInMonacoEditor(mainWindow, nestedPromptSelector, bodyMarker)
    const updatedPromptLookup = {
      workspacePath: WORKSPACE_PATH,
      folderName: 'Hierarchy/Nested',
      promptId: 'subfolders-ui-nested-prompt',
      promptTitle: updatedTitle
    }
    await expect
      .poll(
        async () => await checkPersistedPromptFilesExistByTitle(electronApp, updatedPromptLookup),
        { timeout: 15000 }
      )
      .toEqual({ markdownExists: true })
    expect(await readPersistedPromptTextById(electronApp, updatedPromptLookup)).toContain(
      bodyMarker
    )

    await testHelpers.navigateToPromptFolders('Empty Root')
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await revealVirtualRow(mainWindow, testHelpers, nestedPromptSelector)
    await waitForMonacoEditor(mainWindow, nestedPromptSelector)
    await expect(
      mainWindow.locator(promptTitleSelector('subfolders-ui-nested-prompt'))
    ).toHaveValue(updatedTitle)
    await expectStatusIndicator(
      mainWindow,
      'subfolders-ui-nested-prompt',
      'Todo',
      true,
      '--ui-info-strong-border'
    )
    await expect
      .poll(async () => getMonacoEditorText(mainWindow, nestedPromptSelector))
      .toContain(bodyMarker)

    await stubClipboard(mainWindow)
    await mainWindow.locator(`${nestedPromptSelector} [data-testid="prompt-copy-button"]`).click()
    const normalizeNewlines = (value: string): string => value.replace(/\r\n?/g, '\n')
    await expect
      .poll(async () =>
        normalizeNewlines(
          await mainWindow.evaluate(() => (window as any).__testClipboardText ?? '')
        )
      )
      .toContain(bodyMarker)
    const clipboardText = normalizeNewlines(
      await mainWindow.evaluate(() => (window as any).__testClipboardText ?? '')
    )
    expect(clipboardText).toMatch(/^Nested folder prefix\n\n/)
    expect(clipboardText).toMatch(/\n\nNested folder suffix$/)
    await expect(mainWindow.locator(statusPillSelector('subfolders-ui-nested-prompt'))).toHaveText(
      'In Progress'
    )
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')
    await expect
      .poll(async () => await readPersistedPromptTextById(electronApp, updatedPromptLookup))
      .toContain('status: InProgress')
  })

  test('uses the direct owner for every nested prompt status transition', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    const promptId = 'subfolders-ui-grandchild-prompt'
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await revealVirtualRow(mainWindow, testHelpers, grandchildPromptSelector)
    await testHelpers.scrollVirtualElementIntoView(
      PROMPT_FOLDER_HOST_SELECTOR,
      grandchildPromptSelector,
      12
    )
    await waitForMonacoEditor(mainWindow, grandchildPromptSelector)

    await expect(mainWindow.locator(statusPillSelector(promptId))).toHaveText('Todo')
    await expectStatusIndicator(mainWindow, promptId, 'Todo', false, null)

    await mainWindow.locator(statusMoreOptionsSelector(promptId)).click()
    await mainWindow.locator('[data-testid="prompt-status-option-in-progress"]').click()
    await expect(mainWindow.locator(statusPillSelector(promptId))).toHaveText('In Progress')
    await expectStatusIndicator(
      mainWindow,
      promptId,
      'InProgress',
      true,
      '--ui-warning-icon-glyph'
    )
    await mainWindow.locator(statusMoreOptionsSelector(promptId)).click()
    await mainWindow.locator('[data-testid="prompt-status-option-todo"]').click()
    await expect(mainWindow.locator(statusPillSelector(promptId))).toHaveText('Todo')
    await expectStatusIndicator(
      mainWindow,
      promptId,
      'Todo',
      true,
      '--ui-info-strong-border'
    )

    await mainWindow
      .locator(`${grandchildPromptSelector} [data-testid="prompt-complete-button"]`)
      .click()
    await expect(mainWindow.locator(grandchildPromptSelector)).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')

    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await revealVirtualRow(mainWindow, testHelpers, grandchildPromptSelector)
    await expect(mainWindow.locator(statusPillSelector(promptId))).toHaveText('Completed')
    await expectStatusIndicator(
      mainWindow,
      promptId,
      'Completed',
      true,
      '--ui-success-normal-text'
    )
    await mainWindow.locator(statusMoreOptionsSelector(promptId)).click()
    await mainWindow.locator('[data-testid="prompt-status-option-in-progress"]').click()
    await expect(mainWindow.locator(grandchildPromptSelector)).toHaveCount(0)

    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await revealVirtualRow(mainWindow, testHelpers, grandchildPromptSelector)
    await expect(mainWindow.locator(statusPillSelector(promptId))).toHaveText('In Progress')
    await expectStatusIndicator(
      mainWindow,
      promptId,
      'InProgress',
      true,
      '--ui-warning-icon-glyph'
    )
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, grandchildFolderOrderPath))
      .toEqual([promptId])
    await expect
      .poll(
        async () =>
          await readPersistedPromptTextById(electronApp, {
            workspacePath: WORKSPACE_PATH,
            folderName: 'Hierarchy/Nested/Grandchild',
            promptId,
            promptTitle: 'Grandchild Prompt'
          })
      )
      .toContain('status: InProgress')
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')
  })

  test('deletes a nested active prompt from its direct owner and persists it', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await revealVirtualRow(mainWindow, testHelpers, nestedPromptSelector)
    await mainWindow.locator(`${nestedPromptSelector} [data-testid="prompt-delete-button"]`).click()
    const dialog = mainWindow.locator('[role="dialog"][aria-label="Delete Prompt"]')
    await expect(dialog).toBeVisible()
    await dialog.locator('button:has-text("Delete")').click()

    await expect(mainWindow.locator(nestedPromptSelector)).toHaveCount(0)
    await expect
      .poll(async () => await readFolderEntryIds(electronApp, nestedFolderOrderPath))
      .toEqual([grandchildFolderId])
    await expect
      .poll(
        async () =>
          await checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: WORKSPACE_PATH,
            folderName: 'Hierarchy/Nested',
            promptId: 'subfolders-ui-nested-prompt',
            promptTitle: 'Nested Prompt'
          })
      )
      .toEqual({ markdownExists: false })

    await testHelpers.navigateToPromptFolders('Empty Root')
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await expect(mainWindow.locator(nestedPromptSelector)).toHaveCount(0)
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')
  })

  test('deletes a nested completed prompt from its direct owner', async ({
    testSetup,
    electronApp
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'subfolders-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    const promptId = 'subfolders-ui-nested-completed-1'
    const promptSelector = `[data-testid="prompt-editor-${promptId}"]`
    await testHelpers.navigateToPromptFolders('Hierarchy')
    await mainWindow.locator('[data-testid="toggle-completed-prompts-button"]').click()
    await revealVirtualRow(mainWindow, testHelpers, promptSelector)
    await mainWindow.locator(`${promptSelector} [data-testid="prompt-delete-button"]`).click()
    const dialog = mainWindow.locator('[role="dialog"][aria-label="Delete Prompt"]')
    await expect(dialog).toBeVisible()
    await dialog.locator('button:has-text("Delete")').click()

    await expect(mainWindow.locator(promptSelector)).toHaveCount(0)
    await expect
      .poll(
        async () =>
          await checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: WORKSPACE_PATH,
            folderName: 'Hierarchy/Nested/_Completed',
            promptId,
            promptTitle: 'Nested Completed One'
          })
      )
      .toEqual({ markdownExists: false })
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]')
    ).toContainText('Hierarchy')
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
      .poll(
        async () =>
          await mainWindow
            .locator('[data-testid^="prompt-editor-"]')
            .evaluateAll((rows) =>
              rows.map((row) => row.getAttribute('data-testid')?.replace('prompt-editor-', ''))
            )
      )
      .toEqual(completedPromptIds)

    await expect(
      mainWindow.locator('[data-testid="prompt-folder-completed-filter"] span')
    ).toHaveText('3')
    await expect(mainWindow.locator(nestedFolderSelector)).toHaveCount(0)
    await expect(mainWindow.locator(grandchildFolderSelector)).toHaveCount(0)
    await expect(mainWindow.locator(emptyNestedFolderSelector)).toHaveCount(0)
    await expect(mainWindow.locator(folderTitleEditSelector)).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid^="prompt-divider-add-subfolder"]')).toHaveCount(0)
    await expect(
      mainWindow.locator(
        '[data-testid^="prompt-editor-"] [data-testid="prompt-drag-handle"], [data-testid^="prompt-editor-"] [data-testid="prompt-move-up"], [data-testid^="prompt-editor-"] [data-testid="prompt-move-down"]'
      )
    ).toHaveCount(0)

    const completedPromptXs = await Promise.all(
      completedPromptIds.map(
        async (promptId) =>
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
