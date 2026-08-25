import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import type { ConsoleMessage, Page } from 'playwright'
import {
  checkFileExists,
  checkPersistedPromptFilesExistByTitle,
  readTextFile
} from '../helpers/PromptPersistenceTestHelpers'
import {
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { readPromptNavigationHighlightAnimation } from '../helpers/PromptNavigationHighlightHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const EXAMPLES_PROMPT_ROW = '[data-testid="prompt-tree-prompt-simple-1"]'
const DEVELOPMENT_PROMPT_ROW = '[data-testid="prompt-tree-prompt-dev-1"]'
const TOGGLE_ALL_CATEGORIES_BUTTON = '[data-testid="toggle-all-categories-button"]'
const SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON =
  '[data-testid="selected-prompt-folder-actions-button"]'
const OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM =
  '[data-testid="open-selected-prompt-folder-settings-menu-item"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM = '[data-testid^="sidebar-prompt-folder-dropdown-item-"]'
const SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM =
  '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
const SIDEBAR_PROMPT_FOLDER_ADD_BUTTON = '[data-testid="sidebar-prompt-folder-add-button"]'
const SHORT_PROMPT_50 = '[data-testid="prompt-tree-prompt-short-50"]'
const SHORT_EDITOR_50 = '[data-testid="prompt-editor-short-50"]'
const PROMPT_TREE_HOST = '[data-testid="prompt-tree-virtual-window"]'
const SIDEBAR_FOLDER_ROOT_BUTTON = '[data-testid="sidebar-folder-root-button"]'
const PROMPT_FOLDER_HOST = '[data-testid="prompt-folder-virtual-window"]'
const SAMPLE_WORKSPACE_PATH = '/ws/sample'
const CATEGORIES_WORKSPACE_PATH = '/ws/categories'
const TEMPLATE_WORKSPACE_PATH = '/ws/templates'

const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

describe('Prompt Folder Navigation (non-virtual)', () => {
  test('opens template folders and renders template-specific controls', async ({ testSetup }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithTemplateFolders(TEMPLATE_WORKSPACE_PATH, [
        {
          folderName: 'CodeReview',
          displayName: 'Code Review Templates',
          folderId: 'template-folder-1',
          description: 'Templates for code reviews.',
          templates: [
            {
              id: 'template-1',
              title: 'Review Pull Request',
              templateText: 'Review {{diff}}.'
            }
          ],
          categories: [
            {
              categoryName: 'Category',
              displayName: 'Category Templates',
              categoryId: 'template-category',
              templates: [
                {
                  id: 'category-template',
                  fallbackTitle: 'Category Template',
                  templateText: 'Use {{category}}.'
                }
              ]
            }
          ]
        }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(TEMPLATE_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toBeVisible()
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-folder-dropdown-item-template-folder-1"]')
        .locator('.lucide-layers')
    ).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await testHelpers.navigateToPromptFolders('Code Review Templates')

    await expect(mainWindow.locator('[data-testid="prompt-folder-root-title"]')).toHaveText(
      'Code Review Templates'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-section"]')).toHaveText(
      'Templates'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"]')).toHaveText(
      'Templates 2'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-completed-filter"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="sidebar-add-category-button"]')).toHaveAttribute(
      'title',
      'Add Category'
    )
    const templateEditor = mainWindow.locator('[data-testid="prompt-editor-template-1"]')
    await expect(templateEditor).toBeVisible()
    /** Template tree row uses the same direct-navigation animation path as prompts. */
    const templateTreeRow = mainWindow.locator('[data-testid="prompt-tree-prompt-template-1"]')
    /** Template status line rendered beside the clicked tree entry. */
    const templateTreeIndicator = templateTreeRow
      .locator('..')
      .locator('[data-testid="prompt-tree-status-indicator"]')
    /** Template editor title status line paired with the clicked tree entry. */
    const templateEditorIndicator = templateEditor.locator(
      '[data-testid="prompt-title-status-indicator"]'
    )
    await templateTreeRow.click()
    await expect(templateTreeIndicator).toHaveAttribute('data-navigation-highlight', 'true')
    await expect(templateEditorIndicator).toHaveAttribute('data-navigation-highlight', 'true')
    /** Template animation snapshot proves templates share the requested timing and accent. */
    const templateAnimation = await readPromptNavigationHighlightAnimation(
      templateEditorIndicator
    )
    expect(templateAnimation).toEqual({
      durationMs: 670,
      keyframeTimesMs: [0, 50, 550, 670],
      holdColor: templateAnimation.accentColor,
      accentColor: templateAnimation.accentColor,
      finalKeyframeColor: templateAnimation.normalColor,
      normalColor: templateAnimation.normalColor
    })
    await expect(templateEditor.locator('[data-testid="prompt-move-up"]')).toBeVisible()
    await expect(templateEditor.locator('[data-testid="prompt-drag-handle"]')).toBeVisible()
    await expect(templateEditor.locator('[data-testid="prompt-move-down"]')).toBeVisible()
    await expect(templateEditor.locator('[data-testid="prompt-modified-time"]')).toBeVisible()
    await expect(templateEditor.locator('[data-testid="prompt-token-count"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-editor-category-template"]')).toBeVisible()
    await expect(
      mainWindow
        .locator('[data-testid="category-editor-template-category"]')
        .getByText('Category Templates', { exact: true })
    ).toBeVisible()
    await expect(
      mainWindow
        .locator('[data-testid="prompt-editor-category-template"]')
        .locator('[data-testid="prompt-title"]')
    ).toHaveAttribute('placeholder', 'Category Template...')
    await expect(mainWindow.locator('.prompt-editor-metadata-folder')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-status-pill"]')).toHaveCount(0)

    const categoryEditor = mainWindow.locator(
      '[data-testid="category-editor-template-category"]'
    )
    await expect(categoryEditor).toContainText('1 template')
    await expect(categoryEditor).not.toContainText('completed prompt')
    await expect(
      categoryEditor.locator('[data-testid="category-drag-handle"]')
    ).toBeVisible()
    await expect(
      categoryEditor.locator('[data-testid="category-editor-content-toggle"]')
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(
      categoryEditor.locator('[data-testid="category-editor-delete-button"]')
    ).toBeVisible()
    await expect(
      categoryEditor.locator('[data-testid="category-drag-handle"]')
    ).toHaveAttribute('aria-label', 'Drag category')
    await expect(
      categoryEditor.locator('[data-testid="category-editor-title-edit"]')
    ).toHaveAttribute('aria-label', 'Rename category')
    await expect(
      categoryEditor.locator('[data-testid="category-editor-delete-button"]')
    ).toHaveAttribute('aria-label', 'Delete category')

    await categoryEditor.locator('[data-testid="category-editor-title-edit"]').click()
    const renameCategoryDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Rename Category"]'
    )
    await expect(renameCategoryDialog).toBeVisible()
    await expect(
      renameCategoryDialog.locator('[data-testid="dialog-header-icon"]')
    ).toBeVisible()
    await expect(
      renameCategoryDialog.locator('[data-testid="dialog-subtitle"]')
    ).toHaveText('Choose a new name for this category.')
    await expect(renameCategoryDialog.getByLabel('Category Name')).toBeVisible()
    await renameCategoryDialog.getByRole('button', { name: 'Cancel' }).click()

    await categoryEditor.locator('[data-testid="category-editor-delete-button"]').click()
    const deleteCategoryDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Category"]'
    )
    await expect(deleteCategoryDialog).toBeVisible()
    await expect(
      deleteCategoryDialog.locator('[data-testid="dialog-header-icon"]')
    ).toBeVisible()
    await expect(
      deleteCategoryDialog.locator('[data-testid="dialog-subtitle"]')
    ).toHaveCount(0)
    await expect(
      deleteCategoryDialog.getByRole('button', { name: 'Delete Category' })
    ).toBeVisible()
    await deleteCategoryDialog.getByRole('button', { name: 'Cancel' }).click()

    await mainWindow.locator('[data-testid="prompt-folder-add-category-button"]').click()
    const createCategoryDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Category"]'
    )
    await expect(createCategoryDialog).toBeVisible()
    await expect(
      createCategoryDialog.locator('[data-testid="dialog-subtitle"]')
    ).toHaveText('Add a category to this root folder.')
    await expect(createCategoryDialog.getByLabel('Category Name')).toBeVisible()
    await createCategoryDialog.getByRole('button', { name: 'Cancel' }).click()

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-title-edit"]')).toHaveAttribute(
      'aria-label',
      'Rename prompt template folder'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-delete-button"]')).toHaveAttribute(
      'aria-label',
      'Delete prompt template folder'
    )
    await mainWindow.locator('[data-testid="prompt-folder-root-title-edit"]').click()
    const renameTemplateFolderDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Rename Prompt Template Folder"]'
    )
    await expect(renameTemplateFolderDialog).toBeVisible()
    await renameTemplateFolderDialog.getByRole('button', { name: 'Cancel' }).click()
    await mainWindow.locator('[data-testid="prompt-folder-delete-button"]').click()
    const deleteTemplateFolderDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Prompt Template Folder"]'
    )
    await expect(deleteTemplateFolderDialog).toBeVisible()
    await deleteTemplateFolderDialog.getByRole('button', { name: 'Cancel' }).click()

    await categoryEditor.locator('[data-testid="category-editor-settings-toggle"]').click()
    await expect(
      categoryEditor.locator('[data-testid^="category-settings-toggle-"]')
    ).toHaveCount(1)
  })

  test('renders prompts when opening Examples', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Example Prompts'
    )
  })

  test('loads and renders category entries in the root prompt folder screen', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Main')
    await mainWindow.waitForSelector('[data-testid="prompt-editor-base-before"]', {
      state: 'attached'
    })
    await mainWindow.waitForSelector('[data-testid="prompt-editor-base-after"]', {
      state: 'attached'
    })

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.promptCount).toBe(3)
    await expect(mainWindow.locator('[data-testid="prompt-editor-category-prompt"]')).toBeAttached()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toBeVisible()
    // Stable category identity connects the flattened fixture to its category row.
    const categoryId = createDeterministicId(`${CATEGORIES_WORKSPACE_PATH}:Main/Category`)
    await expect(
      mainWindow.locator(`[data-testid="category-editor-${categoryId}"]`)
    ).toContainText('Category')
  })

  test('tracks and navigates the category breadcrumb from the padded viewport edge', async ({
    testSetup
  }) => {
    /** Running category workspace and its browser helpers. */
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories-ui' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Hierarchy')

    /** Path used to derive both stable category identities in the hierarchy fixture. */
    const categoryWorkspacePath = '/ws/categories-ui'
    /** Primary category identity used for the first breadcrumb transition. */
    const categoryId = createDeterministicId(`${categoryWorkspacePath}:Hierarchy/Primary`)
    /** Empty category identity used for the following breadcrumb transition. */
    const emptyCategoryId = createDeterministicId(`${categoryWorkspacePath}:Hierarchy/Empty`)
    /** Primary category row whose measured position drives the breadcrumb transition. */
    const categorySelector = `[data-testid="category-editor-${categoryId}"]`
    /** Next category row used to verify ownership across the inter-category separator. */
    const emptyCategorySelector = `[data-testid="category-editor-${emptyCategoryId}"]`
    /** Separator row retaining the preceding category breadcrumb. */
    const categorySeparatorSelector =
      `[data-testid="prompt-folder-category-separator-${categoryId}"]`
    /** Fixed breadcrumb segment displaying the sampled content owner. */
    const headerSection = mainWindow.locator('[data-testid="prompt-folder-header-section"]')
    await expect(mainWindow.locator(categorySelector)).toBeAttached()
    await expect(headerSection).toHaveText('Prompts')

    /** Reads a rendered row's top edge relative to the virtual viewport. */
    const readRowTopInset = async (selector: string): Promise<number | null> => {
      /** Virtual viewport bounds used as the local coordinate origin. */
      const viewportBox = await mainWindow.locator(PROMPT_FOLDER_HOST).boundingBox()
      /** Requested row bounds in page coordinates. */
      const rowBox = await mainWindow.locator(selector).first().boundingBox()
      return viewportBox && rowBox ? rowBox.y - viewportBox.y : null
    }

    /** Reads a rendered row's absolute offset within the virtual content. */
    const readRowContentOffset = async (selector: string): Promise<number | null> => {
      /** Current virtual scroll position preceding the viewport-relative row inset. */
      const currentScrollTopPx = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)
      /** Requested row inset relative to the virtual viewport. */
      const rowTopInset = await readRowTopInset(selector)
      return rowTopInset === null ? null : currentScrollTopPx + rowTopInset
    }

    /** Initial measured category offset within the complete virtual content. */
    const categoryOffsetPx = await readRowContentOffset(categorySelector)
    expect(categoryOffsetPx).not.toBeNull()

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, categoryOffsetPx! - 86)
    await expect(headerSection).toHaveText('Prompts')

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, categoryOffsetPx! - 82)
    await expect(headerSection).toHaveText('Primary')

    /** Separator offset used to verify the preceding category remains active through the gap. */
    const categorySeparatorOffsetPx = await readRowContentOffset(categorySeparatorSelector)
    expect(categorySeparatorOffsetPx).not.toBeNull()
    await testHelpers.scrollVirtualWindowTo(
      PROMPT_FOLDER_HOST,
      categorySeparatorOffsetPx! - 80
    )
    await expect(headerSection).toHaveText('Primary')

    /** Following category offset used to verify the breadcrumb changes only at its header. */
    const emptyCategoryOffsetPx = await readRowContentOffset(emptyCategorySelector)
    expect(emptyCategoryOffsetPx).not.toBeNull()
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, emptyCategoryOffsetPx! - 86)
    await expect(headerSection).toHaveText('Primary')
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, emptyCategoryOffsetPx! - 82)
    await expect(headerSection).toHaveText('Empty')

    /** Full virtual height used to place the sample point in final trailing category space. */
    const virtualHeightPx = await testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST)
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, virtualHeightPx)
    await expect(headerSection).toHaveText('Empty')

    await mainWindow.locator('[data-testid="prompt-tree-category-toggle-button-Primary"]').hover()
    await mainWindow.locator('[data-testid="prompt-tree-category-open-button-Primary"]').click()
    await expect(headerSection).toHaveText('Primary')

    /** Category content toggle used to verify breadcrumb clicks preserve expansion state. */
    const categoryContentToggle = mainWindow
      .locator(categorySelector)
      .locator('[data-testid="category-editor-content-toggle"]')
    /** Category settings toggle used to verify details expansion remains independent. */
    const categorySettingsToggle = mainWindow
      .locator(categorySelector)
      .locator('[data-testid="category-editor-settings-toggle"]')
    await categorySettingsToggle.click()
    await expect(categorySettingsToggle).toHaveAttribute('aria-pressed', 'true')
    await categoryContentToggle.click()
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'false')
    await testHelpers.scrollVirtualWindowBy(PROMPT_FOLDER_HOST, 100)
    await expect(headerSection).toHaveText('Primary')

    await headerSection.click()
    await expect
      .poll(async () => Math.abs((await readRowTopInset(categorySelector))! - 80))
      .toBeLessThanOrEqual(2)
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(categorySettingsToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.locator('.monaco-editor textarea:focus')).toHaveCount(0)

    await mainWindow.locator('[data-testid="prompt-folder-header-folder"]').click()
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(headerSection).toHaveText('Prompts')

    await headerSection.click()
    await expect
      .poll(async () => {
        /** First root-level divider marks the beginning of Uncategorized prompts. */
        const dividerTopInset = await readRowTopInset(
          '[data-testid^="prompt-folder-divider-"][data-testid$="-initial"]'
        )
        return Math.abs(dividerTopInset! - 80)
      })
      .toBeLessThanOrEqual(2)
    await expect(mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON)).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator('.monaco-editor textarea:focus')).toHaveCount(0)
  })

  test('restores prompt content when revisiting folders', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    let screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    let examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(DEVELOPMENT_PROMPT_ROW, { state: 'attached' })
    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', { state: 'attached' })

    screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(2)

    const developmentPrompt = await testHelpers.verifyPromptVisible('Code Review')
    expect(developmentPrompt.found).toBe(true)
    expect(developmentPrompt.hasPromptEditor).toBe(true)

    examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(false)

    await testHelpers.navigateToPromptFolders('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    const lingeringDevelopmentPrompt = await testHelpers.verifyPromptVisible('Code Review')
    expect(lingeringDevelopmentPrompt.found).toBe(false)
  })

  // Coverage merged from ScreenNavigationTests.spec.ts.
  test('navigates between prompt folders and renders expected prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToRegularFolder('Examples')

    let screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Example Prompts'
    )

    const promptResult = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(promptResult.found).toBe(true)
    expect(promptResult.hasPromptEditor).toBe(true)
    expect(promptResult.titleText).toContain('Simple Greeting')

    await testHelpers.navigateToRegularFolder('Development')
    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', { state: 'attached' })

    screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(2)
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Development Tools'
    )

    const codeReviewResult = await testHelpers.verifyPromptVisible('Code Review')
    expect(codeReviewResult.found).toBe(true)

    const bugAnalysisResult = await testHelpers.verifyPromptVisible('Bug Analysis')
    expect(bugAnalysisResult.found).toBe(true)
  })

  test('opens Prompt Folders view and renders prompt list', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-screen"] .virtual-window-scrollbar')
    ).toHaveCSS('width', '14px')
  })

  test('opens the first folder from the activity bar when no folder was selected', async ({
    testSetup
  }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator('[data-testid="nav-button-prompt-folders"]').click()

    await mainWindow.waitForSelector('[data-testid="prompt-editor-simple-1"]', {
      state: 'attached'
    })
    await expect(mainWindow.locator('[data-testid="nav-button-prompt-folders"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Example Prompts'
    )
  })

  test('restores the last prompt folder scroll when opened from the activity bar', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 900)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST))
      .toBeGreaterThan(0)
    const savedScrollTop = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)

    await testHelpers.navigateToHomeScreen()
    await mainWindow.locator('[data-testid="nav-button-prompt-folders"]').click()
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    await expect(mainWindow.locator('[data-testid="nav-button-prompt-folders"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST))
      .toBe(savedScrollTop)
  })

  test('selects prompt folders and opens create dialog from the sidebar dropdown', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow
      .locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ITEM)
      .filter({ hasText: 'Development Tools' })
      .click()

    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', {
      state: 'attached'
    })
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Development Tools'
    )
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM).click()
    const createPromptFolderDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Prompt Folder"]'
    )
    await expect(createPromptFolderDialog).toBeVisible()
    await expect(
      createPromptFolderDialog.locator('[data-testid="dialog-header-icon"]')
    ).toBeVisible()
    await expect(
      createPromptFolderDialog.locator('[data-testid="dialog-subtitle"]')
    ).toHaveText('Choose the folder type and name for the new folder.')
    await expect(createPromptFolderDialog.getByLabel('Prompt Folder Name')).toBeVisible()
  })

  test('shows add prompt folder button when the workspace has no prompt folders', async ({
    testSetup
  }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON)).toBeVisible()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON)).toContainText(
      'Create Folder'
    )
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toHaveCount(0)
    await expect(mainWindow.locator('text=Create a Folder to Get Started')).toBeVisible()

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON).click()
    await expect(
      mainWindow.locator('[data-testid="create-prompt-folder-name-input"]')
    ).toBeVisible()
  })

  test('shows only the selected folder prompt rows in the prompt tree', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Examples')
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toBeVisible()
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toHaveCount(0)

    const screenInfo = await testHelpers.getPromptFolderScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    await testHelpers.navigateToPromptFolders('Development')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toHaveCount(0)
  })

  test('collapses and expands all categories from the sidebar action', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Main')

    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toBeEnabled()
    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Categories'
    )
    await expect(
      mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).locator('.lucide-chevrons-down-up')
    ).toHaveCount(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-category-toggle-button-Category"]')
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).click()

    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toHaveAttribute(
      'aria-label',
      'Expand All Categories'
    )
    await expect(
      mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).locator('.lucide-chevrons-up-down')
    ).toHaveCount(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).click()

    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Categories'
    )
    await expect(
      mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).locator('.lucide-chevrons-down-up')
    ).toHaveCount(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-category-prompt"]')
    ).toBeVisible()
  })

  test('leaves selected root folder settings as a no-op', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 500)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST))
      .toBeGreaterThan(0)
    const scrollTopBefore = await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)

    await expect(mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON)).toBeEnabled()
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect
      .poll(async () =>
        Math.abs((await testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)) - scrollTopBefore)
      )
      .toBeLessThanOrEqual(1)
    await expect(
      mainWindow.locator('[data-testid^="category-description-section"]')
    ).toHaveCount(0)
  })

  test('root title rename button does not hide prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    const pencilButton = mainWindow.locator('[data-testid="prompt-folder-root-title-edit"]')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await pencilButton.click()
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
  })

  test('disables selected folder settings when no prompt folder exists', async ({ testSetup }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect(mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON)).toBeDisabled()
    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toBeDisabled()
  })

  test('creates and navigates to a new folder', async ({ electronApp, testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_ADD_BUTTON).click()

    const folderNameInput = mainWindow.locator('[data-testid="create-prompt-folder-name-input"]')
    const errorMessage = mainWindow.locator('[data-testid="create-prompt-folder-name-error"]')
    const createButton = mainWindow.locator('[data-testid="create-prompt-folder-button"]')

    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeDisabled()

    await folderNameInput.fill('Test Folder')
    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeEnabled()

    await folderNameInput.fill('')
    await expect(errorMessage).toBeVisible()
    await expect(createButton).toBeDisabled()

    await folderNameInput.fill('Test Folder')
    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeEnabled()

    await mainWindow.evaluate(() => {
      const testWindow = window as typeof window & {
        __promptFolderCreateDuplicateErrorObserver?: MutationObserver
        __promptFolderCreateDuplicateErrorSeen?: boolean
      }

      testWindow.__promptFolderCreateDuplicateErrorSeen = false

      const observer = new MutationObserver(() => {
        const errorMessage = document.querySelector(
          '[data-testid="create-prompt-folder-name-error"]'
        )

        if (errorMessage?.textContent?.includes('A folder with this name already exists')) {
          testWindow.__promptFolderCreateDuplicateErrorSeen = true
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })
      testWindow.__promptFolderCreateDuplicateErrorObserver = observer
    })

    await createButton.click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Test Folder'
    )
    expect(
      await mainWindow.evaluate(() => {
        const testWindow = window as typeof window & {
          __promptFolderCreateDuplicateErrorObserver?: MutationObserver
          __promptFolderCreateDuplicateErrorSeen?: boolean
        }

        testWindow.__promptFolderCreateDuplicateErrorObserver?.disconnect()
        return testWindow.__promptFolderCreateDuplicateErrorSeen
      })
    ).toBe(false)

    await testHelpers.navigateToRegularFolder('Test Folder')

    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Test Folder'
    )
    await expect(mainWindow.locator(PROMPT_FOLDER_HOST)).toBeVisible()
    await expect(mainWindow.locator(PROMPT_TREE_HOST)).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-empty-status"]')).toHaveText(
      'No active prompts. Click to view.'
    )
    // The selected root folder is represented by the root action, not a duplicate category row.
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-category-toggle-button-TestFolder"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toContainText(
      'Test Folder'
    )
    await expect(
      mainWindow
        .locator(PROMPT_FOLDER_HOST)
        .getByText('No active prompts were found in this folder.')
    ).toBeVisible()
    await expect
      .poll(async () => {
        const infoPath = '/ws/minimal/Prompts/TestFolder/_FolderInfo'
        return await Promise.all(
          ['Description.md'].map((filename) =>
            checkFileExists(electronApp, `${infoPath}/${filename}`)
          )
        )
      })
      .toEqual([false])

    const emptyPromptFolderPlaceholderHasGutter = await mainWindow.evaluate((hostSelector) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      if (!host) return null

      const emptyMessage = Array.from(host.querySelectorAll('p')).find(
        (paragraph) =>
          paragraph.textContent?.trim() === 'No active prompts were found in this folder.'
      )
      const placeholderRow = emptyMessage?.closest('.prompt-folder-section-row')
      return Boolean(placeholderRow?.querySelector('.promptFolderSectionGutter'))
    }, PROMPT_FOLDER_HOST)

    expect(emptyPromptFolderPlaceholderHasGutter).toBe(false)
    expect(await testHelpers.getActiveScreen()).toBe('prompt-folder')
  })

  test('creates and opens a prompt template folder', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    const initialWorkspaceFolderEntries = (
      JSON.parse(
        await readTextFile(electronApp, `${SAMPLE_WORKSPACE_PATH}/WorkspaceFolderOrder.json`)
      ) as { entries: Array<{ kind: 'folder'; id: string }> }
    ).entries

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM).click()
    await expect(mainWindow.locator('[data-testid="create-prompt-folder-type-selector"]')).toHaveText(
      'Prompt Folder'
    )
    await mainWindow.locator('[data-testid="create-prompt-folder-type-selector"]').click()
    const folderTypeMenu = mainWindow.locator(
      '[data-testid="create-prompt-folder-type-menu"]'
    )
    await expect(folderTypeMenu.getByText('Prompt Folder', { exact: true })).toBeVisible()
    await expect(folderTypeMenu.getByText('Prompt Template Folder', { exact: true })).toBeVisible()
    await folderTypeMenu.getByText('Prompt Template Folder', { exact: true }).click()
    const createTemplateFolderDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Prompt Template Folder"]'
    )
    await expect(createTemplateFolderDialog).toBeVisible()
    await expect(createTemplateFolderDialog.getByLabel('Prompt Template Folder Name')).toBeVisible()
    await mainWindow.locator('[data-testid="create-prompt-folder-name-input"]').fill('Examples')
    await mainWindow.locator('[data-testid="create-prompt-folder-button"]').click()

    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Examples')
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-title"]')).toHaveText(
      'Examples'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-active-filter"]')).toHaveText(
      'Templates 0'
    )
    await expect(mainWindow.locator('[data-testid="sidebar-add-category-button"]')).toHaveAttribute(
      'title',
      'Add Category'
    )
    await expect
      .poll(() => checkFileExists(electronApp, `${SAMPLE_WORKSPACE_PATH}/Templates/Examples`))
      .toBe(true)

    const folderInfo = JSON.parse(
      await readTextFile(
        electronApp,
        `${SAMPLE_WORKSPACE_PATH}/Templates/Examples/_FolderInfo/FolderInfo.json`
      )
    ) as { displayName: string; folderId: string; kind: string }
    expect(folderInfo).toEqual({
      displayName: 'Examples',
      folderId: expect.any(String),
      kind: 'template'
    })
    const workspaceFolderOrder = JSON.parse(
      await readTextFile(electronApp, `${SAMPLE_WORKSPACE_PATH}/WorkspaceFolderOrder.json`)
    ) as { entries: Array<{ kind: 'folder'; id: string }> }
    expect(workspaceFolderOrder.entries).toEqual([
      { kind: 'folder', id: folderInfo.folderId },
      ...initialWorkspaceFolderEntries
    ])
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${SAMPLE_WORKSPACE_PATH}/Templates/Examples/_FolderInfo/FolderOrderV2.json`
        )
      )
    ).toEqual({ categories: [{ categoryId: null, entries: [] }] })
    expect(
      await checkFileExists(electronApp, `${SAMPLE_WORKSPACE_PATH}/Templates/Examples/Completed`)
    ).toBe(false)
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_FOLDER_DROPDOWN_ADD_ITEM).click()
    await mainWindow.locator('[data-testid="create-prompt-folder-type-selector"]').click()
    await mainWindow
      .locator('[data-testid="create-prompt-folder-type-menu"]')
      .getByRole('menuitem', { name: /^Prompt Template Folder\b/ })
      .click()
    await mainWindow.locator('[data-testid="create-prompt-folder-name-input"]').fill('Examples')
    await expect(
      mainWindow.locator('[data-testid="create-prompt-folder-name-error"]')
    ).toContainText('A folder with this name already exists')
    await expect(mainWindow.locator('[data-testid="create-prompt-folder-button"]')).toBeDisabled()
  })

  test('renames a prompt folder from the root page title without changing its id', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    const developmentFolderId = createDeterministicId(`${SAMPLE_WORKSPACE_PATH}:Development`)

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    const rootHeader = mainWindow.locator('[data-testid="prompt-folder-root-header"]')
    const rootTitle = rootHeader.locator('[data-testid="prompt-folder-root-title"]')
    await expect(rootHeader).toBeVisible()
    await expect(rootTitle).toHaveText('Development Tools')
    await expect(rootHeader.locator('h1')).toHaveCount(0)
    expect(
      await rootTitle.evaluate((element) => element.scrollHeight - element.clientHeight)
    ).toBeLessThanOrEqual(0)
    const rootHeaderGeometry = await rootHeader.evaluate((element) => {
      const filterBar = element.querySelector<HTMLElement>('.prompt-folder-root-filter-bar')
      const titleRow = element.querySelector<HTMLElement>('.prompt-folder-root-screen-header')
      const eyebrow = element.querySelector<HTMLElement>('.prompt-folder-root-eyebrow')
      const titleLine = element.querySelector<HTMLElement>('.prompt-folder-root-title-line')
      if (!filterBar || !titleRow || !eyebrow || !titleLine) return null

      const rowRect = element.getBoundingClientRect()
      const filterRect = filterBar.getBoundingClientRect()
      return {
        height: rowRect.height,
        titleRowHeight: titleRow.getBoundingClientRect().height,
        eyebrowHeight: eyebrow.getBoundingClientRect().height,
        titleLineHeight: titleLine.getBoundingClientRect().height,
        filterRowHeight: filterRect.height,
        bottomInset: rowRect.bottom - filterRect.bottom
      }
    })
    expect(rootHeaderGeometry).not.toBeNull()
    expect(rootHeaderGeometry!.height).toBe(140)
    expect(rootHeaderGeometry!.titleRowHeight).toBe(60)
    expect(rootHeaderGeometry!.eyebrowHeight).toBe(17)
    expect(rootHeaderGeometry!.titleLineHeight).toBe(36)
    expect(rootHeaderGeometry!.filterRowHeight).toBe(44)
    expect(Math.abs(rootHeaderGeometry!.bottomInset - 6)).toBeLessThanOrEqual(1)
    await rootHeader.locator('[data-testid="prompt-folder-root-title-edit"]').click()

    const nameInput = mainWindow.locator('[data-testid="rename-prompt-folder-name-input"]')
    const renameButton = mainWindow.locator('[data-testid="rename-prompt-folder-button"]')
    const errorMessage = mainWindow.locator('[data-testid="rename-prompt-folder-name-error"]')

    await expect(nameInput).toBeVisible()
    await expect(nameInput).toBeFocused()
    await expect(nameInput).toHaveValue('Development Tools')
    await expect(renameButton).toBeDisabled()
    await expect
      .poll(
        async () =>
          await nameInput.evaluate((input) => {
            if (!(input instanceof HTMLInputElement)) return null
            return input.selectionStart === 0 && input.selectionEnd === input.value.length
          })
      )
      .toBe(true)

    await nameInput.fill('Development')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Examples')
    await expect(errorMessage).toContainText('A folder with this name already exists')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Renamed Development')
    await expect(errorMessage).toHaveCount(0)
    await expect(renameButton).toBeEnabled()
    await renameButton.click()

    await expect(nameInput).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-folder"]')).toContainText(
      'Renamed Development'
    )
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Renamed Development'
    )
    await expect(rootHeader).toContainText('Renamed Development')

    const renamedFolderInfoPath = `${SAMPLE_WORKSPACE_PATH}/Prompts/RenamedDevelopment/_FolderInfo/FolderInfo.json`
    const renamedFolderInfo = JSON.parse(
      await readTextFile(electronApp, renamedFolderInfoPath)
    ) as {
      displayName: string
      folderId: string
      kind: 'prompt'
    }
    expect(renamedFolderInfo).toEqual({
      displayName: 'Renamed Development',
      folderId: developmentFolderId,
      kind: 'prompt'
    })
    await expect
      .poll(
        async () =>
          await checkFileExists(
            electronApp,
            `${SAMPLE_WORKSPACE_PATH}/Prompts/Development/_FolderInfo/FolderInfo.json`
          )
      )
      .toBe(false)

    await expect
      .poll(
        async () =>
          await checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: SAMPLE_WORKSPACE_PATH,
            folderName: 'RenamedDevelopment',
            promptId: 'dev-1',
            promptTitle: 'Code Review'
          })
      )
      .toEqual({ markdownExists: true })
    await expect
      .poll(
        async () =>
          await checkPersistedPromptFilesExistByTitle(electronApp, {
            workspacePath: SAMPLE_WORKSPACE_PATH,
            folderName: 'Development',
            promptId: 'dev-1',
            promptTitle: 'Code Review'
          })
      )
      .toEqual({ markdownExists: false })
  })

  test('jumps to a prompt when clicking a prompt tree prompt row', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST, 1700)
    await mainWindow.waitForSelector(SHORT_PROMPT_50, { state: 'attached' })
    await mainWindow.evaluate((selector) => {
      const button = document.querySelector<HTMLButtonElement>(selector)
      if (!button) {
        throw new Error(`Missing prompt tree row: ${selector}`)
      }
      button.click()
    }, SHORT_PROMPT_50)

    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await mainWindow.waitForSelector(SHORT_EDITOR_50, { state: 'attached' })
    await expect(mainWindow.locator(SHORT_PROMPT_50)).toHaveAttribute('data-row-state', 'active')
  })

  test('selects the root folder target at the top and keeps root settings action inert', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect(
      mainWindow.locator('[data-testid^="prompt-tree-prompt-short-"][aria-current="true"]')
    ).toBeVisible()

    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 0)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON)).toHaveAttribute(
      'data-active',
      'true'
    )
    await mainWindow.locator(SELECTED_PROMPT_FOLDER_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(OPEN_SELECTED_PROMPT_FOLDER_SETTINGS_MENU_ITEM).click()
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid^="category-description-section"]')
    ).toHaveCount(0)
  })

  test('maps prompt header navigation to the folder root target', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect(mainWindow.locator('[data-testid="prompt-folder-header-section"]')).toHaveText(
      'Prompts'
    )

    await mainWindow.locator('[data-testid="prompt-folder-header-section"]').click()
    await expect(mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON)).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator('[data-testid="prompt-tree-prompt-short-1"]')).toHaveAttribute(
      'data-row-state',
      'idle'
    )
  })

  test('recycles virtualized Monaco editors without stale tokenization errors', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    const scrollPositions = [0, 1200, 2400, 0, 1800, 600, 2400, 0]
    for (const scrollTopPx of scrollPositions) {
      await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, scrollTopPx)
      await expect
        .poll(async () => {
          return await mainWindow.evaluate((hostSelector) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            if (!host) return false
            const hostRect = host.getBoundingClientRect()
            return Array.from(host.querySelectorAll<HTMLElement>('.monaco-editor')).some(
              (editor) => {
                const editorRect = editor.getBoundingClientRect()
                return editorRect.bottom > hostRect.top && editorRect.top < hostRect.bottom
              }
            )
          }, PROMPT_FOLDER_HOST)
        })
        .toBe(true)
    }

    // Let already-posted TextMate worker results reach the renderer before asserting the capture.
    await mainWindow.waitForTimeout(100)
    expect(testSetup.getRendererErrors()).toEqual([])
  })

  test('runs VS Code extensions in a worker under the restrictive renderer CSP', async ({
    electronApp,
    testSetup
  }) => {
    const securityWarnings: string[] = []
    const captureSecurityWarning = (message: ConsoleMessage) => {
      if (message.text().includes('Electron Security Warning')) {
        securityWarnings.push(message.text())
      }
    }
    const captureWindowWarnings = (page: Page) => {
      page.on('console', captureSecurityWarning)
    }
    electronApp.on('window', captureWindowWarnings)

    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })

    await expect
      .poll(async () => {
        return await mainWindow.evaluate(() => {
          return document.querySelector('iframe.web-worker-ext-host-iframe') !== null
        })
      })
      .toBe(true)

    const allowsUnsafeEval = await mainWindow.evaluate(() => {
      const policy = document
        .querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')
        ?.content.split(';')
        .find((directive) => directive.trim().startsWith('script-src'))

      return policy?.trim().split(/\s+/).includes("'unsafe-eval'") ?? false
    })

    expect(allowsUnsafeEval).toBe(false)
    expect(securityWarnings).toEqual([])
    expect(testSetup.getRendererErrors()).toEqual([])
  })

  test('folder breadcrumb scrolls to top', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(1200)

    await mainWindow.locator('[data-testid="prompt-folder-header-folder"]').click()

    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator('[data-testid="prompt-folder-root-header"]')).toBeVisible()
  })

  test('sidebar folder root button scrolls to top', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptFolders('Short')
    await mainWindow.waitForSelector(PROMPT_FOLDER_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_FOLDER_HOST, 1200)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(1200)
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST, 0)
    await expect(mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON)).toHaveAttribute(
      'data-active',
      'false'
    )

    await mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON).click()

    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST)).toBe(0)
    await expect(mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON)).toHaveAttribute(
      'data-active',
      'true'
    )
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON)).toBeVisible()
    await expect(mainWindow.locator(SIDEBAR_FOLDER_ROOT_BUTTON)).toHaveAttribute(
      'data-active',
      'false'
    )
  })
})
