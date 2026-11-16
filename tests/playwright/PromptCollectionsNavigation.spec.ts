import { resolvePaletteColor } from '../helpers/PaletteHelpers'
import { clickPromptCollectionItem, showCollectionBrowser, openCollectionCreation } from '../helpers/PromptCollectionHelpers'
import { selectedCollectionTitleSelector } from '../helpers/PromptCollectionSelectors'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import type { ConsoleMessage, Page } from 'playwright'
import {
  checkFileExists,
  checkPersistedPromptFilesExistByTitle,
  readTextFile
} from '../helpers/PromptPersistenceTestHelpers'
import {
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { readPromptNavigationHighlightAnimation } from '../helpers/PromptNavigationHighlightHelpers'
import { typeInMonacoEditor } from '../helpers/MonacoHelpers'
import { readWorkspaceCollectionOrder } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const EXAMPLES_PROMPT_ROW = '[data-testid="prompt-tree-active-prompt-simple-1"]'
const DEVELOPMENT_PROMPT_ROW = '[data-testid="prompt-tree-active-prompt-dev-1"]'
const TOGGLE_ALL_CATEGORIES_BUTTON = '[data-testid="toggle-all-categories-button"]'
const SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON =
  '[data-testid="selected-prompt-collection-actions-button"]'
const DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM =
  '[data-testid="delete-selected-prompt-collection-menu-item"]'
const MANAGE_CATEGORIES_SELECTED_PROMPT_COLLECTION_MENU_ITEM =
  '[data-testid="manage-categories-selected-prompt-collection-menu-item"]'
const SHORT_PROMPT_50 = '[data-testid="prompt-tree-active-prompt-short-50"]'
const SHORT_EDITOR_50 = '[data-testid="prompt-editor-short-50"]'
const PROMPT_TREE_HOST = '[data-testid="prompt-tree-active-virtual-window"]'
const SIDEBAR_COLLECTION_OVERVIEW_BUTTON = '[data-testid="sidebar-collection-overview-button"]'
const PROMPT_COLLECTION_HOST = '[data-testid="prompt-collection-virtual-window"]'
const SAMPLE_WORKSPACE_PATH = '/ws/sample'
const CATEGORIES_WORKSPACE_PATH = '/ws/categories'
const TEMPLATE_WORKSPACE_PATH = '/ws/templates'


describe('Prompt Collection Navigation (non-virtual)', () => {

  test('opens template collections and renders template-specific controls', async ({ testSetup }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithTemplateCollections(TEMPLATE_WORKSPACE_PATH, [
        {
          folderName: 'CodeReview',
          displayName: 'Code Review Templates',
          collectionId: 'template-collection-1',
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
    expect(workspaceSetupResult!.workspaceReady).toBe(true)
    await showCollectionBrowser(mainWindow)
    await expect(
      mainWindow
        .locator('[data-testid="new-tab-collection-template-collection-1"]')
        .locator('.lucide-layers')
    ).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await testHelpers.navigateToPromptCollections('Code Review Templates')

    await expect(mainWindow.locator('[data-testid="prompt-collection-title"]')).toHaveText(
      'Code Review Templates'
    )
    await expect(mainWindow.locator('[data-testid="prompt-collection-header-section"]')).toHaveText(
      'Active'
    )
    await expect(mainWindow.locator('[data-testid="prompt-collection-header-category"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-collection-active-filter"]')).toHaveText(
      'Active 2'
    )
    await expect(mainWindow.locator('[data-testid="prompt-collection-completed-filter"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="toggle-completed-prompts-button"]')).toHaveCount(0)
    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(MANAGE_CATEGORIES_SELECTED_PROMPT_COLLECTION_MENU_ITEM)).toHaveText(
      'Manage Categories'
    )
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.locator(MANAGE_CATEGORIES_SELECTED_PROMPT_COLLECTION_MENU_ITEM)).toHaveCount(0)
    const templateEditor = mainWindow.locator('[data-testid="prompt-editor-template-1"]')
    await expect(templateEditor).toBeVisible()
    /** Template tree row uses the same direct-navigation animation path as prompts. */
    const templateTreeRow = mainWindow.locator('[data-testid="prompt-tree-template-prompt-template-1"]')
    /** Templates use the same full-height editor rail highlight as prompts. */
    const templateHighlight = templateEditor.locator('[data-testid="prompt-sidebar-highlight"]')
    await templateTreeRow.click()
    await expect(templateHighlight).toHaveAttribute('data-navigation-highlight', 'true')
    /** Template animation snapshot verifies the shared muted violet color and timing. */
    const templateAnimation = await readPromptNavigationHighlightAnimation(templateHighlight)
    expect(templateAnimation).toEqual({
      durationMs: 1000,
      keyframeTimesMs: [0, 50, 550, 1000],
      holdColor: templateAnimation.accentColor,
      accentColor: templateAnimation.accentColor,
      finalKeyframeColor: templateAnimation.normalColor,
      normalColor: templateAnimation.normalColor
    })
    await expect(templateEditor.locator('[data-testid="prompt-move-up"]')).toHaveCount(0)
    await expect(templateEditor.locator('[data-testid="prompt-drag-handle"]')).toBeVisible()
    await expect(templateEditor.locator('[data-testid="prompt-move-down"]')).toHaveCount(0)
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
    await expect(mainWindow.locator('.prompt-editor-metadata-template')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-status-pill"]')).toHaveCount(0)

    const categoryEditor = mainWindow.locator(
      '[data-testid="category-editor-template-category"]'
    )
    await expect(categoryEditor).toContainText('1 template')
    await expect(categoryEditor).not.toContainText('completed prompt')
    await expect(
      categoryEditor.locator('[data-testid="category-drag-handle"]')
    ).toBeVisible()
    /** Content expansion state that must remain unchanged by the inactive pencil. */
    const categoryContentToggle = categoryEditor.locator(
      '[data-testid="category-editor-content-toggle"]'
    )
    /** Category management action that opens directly to this category. */
    const categoryManageButton = categoryEditor.locator(
      '[data-testid="category-editor-manage-button"]'
    )
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(categoryManageButton).toHaveAttribute('aria-label', 'Manage category')
    await expect(
      categoryEditor.locator('[data-testid="category-drag-handle"]')
    ).toHaveAttribute('aria-label', 'Drag category')
    /** Visible category pencil opens management with the complete name selected. */
    const categoryRenameButton = categoryEditor.locator(
      '[data-testid="category-editor-title-edit"]'
    )
    await expect(categoryRenameButton).toHaveAttribute('aria-label', 'Rename category')
    await categoryRenameButton.click()
    const manageCategoriesDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Manage Categories"]'
    )
    const managedNameInput = manageCategoriesDialog.locator(
      '[data-testid="manage-category-name-input"]'
    )
    await expect(manageCategoriesDialog).toBeVisible()
    await expect(managedNameInput).toBeFocused()
    expect(
      await managedNameInput.evaluate((input: HTMLInputElement) => ({
        start: input.selectionStart,
        end: input.selectionEnd
      }))
    ).toEqual({ start: 0, end: 'Category Templates'.length })
    await manageCategoriesDialog.locator('[data-testid="manage-categories-close-button"]').click()
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'true')

    await categoryManageButton.click()
    await expect(manageCategoriesDialog).toBeVisible()
    await expect(
      manageCategoriesDialog.locator('[data-testid="dialog-subtitle"]')
    ).toHaveText('Code Review Templates')
    await expect(managedNameInput).toHaveValue('Category Templates')
    await manageCategoriesDialog.locator('[data-testid="manage-categories-close-button"]').click()

    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 0)
    await expect(mainWindow.locator('[data-testid="prompt-collection-title-edit"]')).toHaveAttribute(
      'aria-label',
      'Rename collection'
    )
    await expect(mainWindow.locator('[data-testid="prompt-collection-delete-button"]')).toHaveAttribute(
      'aria-label',
      'Delete collection'
    )
    await mainWindow.locator('[data-testid="prompt-collection-title-edit"]').click()
    const renameTemplateCollectionDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Rename Collection"]'
    )
    await expect(renameTemplateCollectionDialog).toBeVisible()
    await renameTemplateCollectionDialog.getByRole('button', { name: 'Cancel' }).click()
    await mainWindow.locator('[data-testid="prompt-collection-delete-button"]').click()
    const deleteTemplateCollectionDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Collection"]'
    )
    await expect(deleteTemplateCollectionDialog).toBeVisible()
    await expect(deleteTemplateCollectionDialog.getByRole('checkbox')).not.toBeChecked()
    await expect(deleteTemplateCollectionDialog.getByRole('button', { name: 'Delete collection' })).toBeDisabled()
    await deleteTemplateCollectionDialog.getByRole('checkbox').check()
    await expect(deleteTemplateCollectionDialog.getByRole('button', { name: 'Delete collection' })).toBeEnabled()
    await deleteTemplateCollectionDialog.getByRole('button', { name: 'Cancel' }).click()

  })

  test('renders prompts when opening Examples', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    const screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText(
      'Example Prompts'
    )
  })

  test('loads and renders category entries in the prompt collection screen', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Main')
    await mainWindow.waitForSelector('[data-testid="prompt-editor-base-before"]', {
      state: 'attached'
    })
    await mainWindow.waitForSelector('[data-testid="prompt-editor-base-after"]', {
      state: 'attached'
    })

    const screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.promptCount).toBe(3)
    await expect(mainWindow.locator('[data-testid="prompt-editor-category-prompt"]')).toBeAttached()
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-prompt-category-prompt"]')
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

    expect(workspaceSetupResult!.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptCollections('Hierarchy')

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
      `[data-testid="prompt-collection-category-separator-${categoryId}"]`
    /** Fixed breadcrumb segment displaying the selected status group. */
    const headerSection = mainWindow.locator('[data-testid="prompt-collection-header-section"]')
    /** Optional breadcrumb segment displaying the sampled category. */
    const headerCategory = mainWindow.locator('[data-testid="prompt-collection-header-category"]')
    await expect(mainWindow.locator(categorySelector)).toBeAttached()
    await expect(headerSection).toHaveText('Active')
    await expect(headerCategory).toHaveCount(0)
    await mainWindow.mouse.move(0, 0)
    /** Muted ancestor color used when a category follows the status group. */
    const ancestorBreadcrumbColor = await mainWindow
      .locator('[data-testid="prompt-collection-header-collection"]')
      .evaluate((element) => getComputedStyle(element).color)
    /** Light trailing-segment color shared by the group and category breadcrumbs. */
    const currentBreadcrumbColor = await headerSection.evaluate(
      (element) => getComputedStyle(element).color
    )
    expect(currentBreadcrumbColor).not.toBe(ancestorBreadcrumbColor)

    /** Reads a rendered row's top edge relative to the virtual viewport. */
    const readRowTopInset = async (selector: string): Promise<number | null> => {
      /** Virtual viewport bounds used as the local coordinate origin. */
      const viewportBox = await mainWindow.locator(PROMPT_COLLECTION_HOST).boundingBox()
      /** Requested row bounds in page coordinates. */
      const rowBox = await mainWindow.locator(selector).first().boundingBox()
      return viewportBox && rowBox ? rowBox.y - viewportBox.y : null
    }

    /** Reads a rendered row's absolute offset within the virtual content. */
    const readRowContentOffset = async (selector: string): Promise<number | null> => {
      /** Current virtual scroll position preceding the viewport-relative row inset. */
      const currentScrollTopPx = await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)
      /** Requested row inset relative to the virtual viewport. */
      const rowTopInset = await readRowTopInset(selector)
      return rowTopInset === null ? null : currentScrollTopPx + rowTopInset
    }

    /** Initial measured category offset within the complete virtual content. */
    const categoryOffsetPx = await readRowContentOffset(categorySelector)
    expect(categoryOffsetPx).not.toBeNull()

    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, categoryOffsetPx! - 86)
    await expect(headerSection).toHaveText('Active')
    await expect(headerCategory).toHaveCount(0)

    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, categoryOffsetPx! - 82)
    await expect(headerCategory).toHaveText('Primary')
    await expect(headerSection).toHaveText('Active')
    await expect(headerSection).toHaveCSS('color', ancestorBreadcrumbColor)
    await expect(headerCategory).toHaveCSS('color', currentBreadcrumbColor)
    await expect(mainWindow.locator('.prompt-collection-header-breadcrumb button')).toHaveText([
      'Hierarchy',
      'Active',
      'Primary'
    ])

    /** Separator offset used to verify the preceding category remains active through the gap. */
    const categorySeparatorOffsetPx = await readRowContentOffset(categorySeparatorSelector)
    expect(categorySeparatorOffsetPx).not.toBeNull()
    await testHelpers.scrollVirtualWindowTo(
      PROMPT_COLLECTION_HOST,
      categorySeparatorOffsetPx! - 80
    )
    await expect(headerCategory).toHaveText('Primary')

    /** Following category offset used to verify the breadcrumb changes only at its header. */
    const emptyCategoryOffsetPx = await readRowContentOffset(emptyCategorySelector)
    expect(emptyCategoryOffsetPx).not.toBeNull()
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, emptyCategoryOffsetPx! - 86)
    await expect(headerCategory).toHaveText('Primary')
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, emptyCategoryOffsetPx! - 82)
    await expect(headerCategory).toHaveText('Empty')

    /** Full virtual height used to place the sample point in final trailing category space. */
    const virtualHeightPx = await testHelpers.getVirtualWindowScrollHeight(PROMPT_COLLECTION_HOST)
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, virtualHeightPx)
    await expect(headerCategory).toHaveText('Empty')
    await expect(headerSection).toHaveText('Active')

    await mainWindow
      .locator('[data-testid="prompt-tree-active-category-toggle-button-Primary"]')
      .click({ button: 'right' })
    await mainWindow
      .locator('[data-testid="prompt-tree-active-category-open-menu-item-Primary"]')
      .click()
    await expect(headerCategory).toHaveText('Primary')

    /** Category content toggle used to verify breadcrumb clicks preserve expansion state. */
    const categoryContentToggle = mainWindow
      .locator(categorySelector)
      .locator('[data-testid="category-editor-content-toggle"]')
    await categoryContentToggle.click()
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'false')
    await testHelpers.scrollVirtualWindowBy(PROMPT_COLLECTION_HOST, 100)
    await expect(headerCategory).toHaveText('Primary')

    await headerCategory.click()
    await expect
      .poll(async () => Math.abs((await readRowTopInset(categorySelector))! - 80))
      .toBeLessThanOrEqual(2)
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('.monaco-editor textarea:focus')).toHaveCount(0)

    await headerSection.click()
    await mainWindow.mouse.move(0, 0)
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(0)
    await expect(headerSection).toHaveText('Active')
    await expect(headerCategory).toHaveCount(0)
    await expect(headerSection).toHaveCSS('color', currentBreadcrumbColor)
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON)).not.toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator('.monaco-editor textarea:focus')).toHaveCount(0)
  })

  test('restores prompt content when revisiting collections', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    let screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    let examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    await testHelpers.navigateToPromptCollections('Development')
    await mainWindow.waitForSelector(DEVELOPMENT_PROMPT_ROW, { state: 'attached' })
    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', { state: 'attached' })

    screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(2)

    const developmentPrompt = await testHelpers.verifyPromptVisible('Code Review')
    expect(developmentPrompt.found).toBe(true)
    expect(developmentPrompt.hasPromptEditor).toBe(true)

    examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(false)

    await testHelpers.navigateToPromptCollections('Examples')
    await mainWindow.waitForSelector(EXAMPLES_PROMPT_ROW, { state: 'attached' })

    screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    examplesPrompt = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(examplesPrompt.found).toBe(true)
    expect(examplesPrompt.hasPromptEditor).toBe(true)

    const lingeringDevelopmentPrompt = await testHelpers.verifyPromptVisible('Code Review')
    expect(lingeringDevelopmentPrompt.found).toBe(false)
  })

  // Coverage merged from ScreenNavigationTests.spec.ts.
  test('navigates between prompt collections and renders expected prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Examples')

    let screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText(
      'Example Prompts'
    )

    const promptResult = await testHelpers.verifyPromptVisible('Simple Greeting')
    expect(promptResult.found).toBe(true)
    expect(promptResult.hasPromptEditor).toBe(true)
    expect(promptResult.titleText).toContain('Simple Greeting')

    await testHelpers.navigateToPromptCollections('Development')
    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', { state: 'attached' })

    screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(2)
    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText(
      'Development Tools'
    )

    const codeReviewResult = await testHelpers.verifyPromptVisible('Code Review')
    expect(codeReviewResult.found).toBe(true)

    const bugAnalysisResult = await testHelpers.verifyPromptVisible('Bug Analysis')
    expect(bugAnalysisResult.found).toBe(true)
  })








  test('shows only the selected collection prompt rows in the prompt tree', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Examples')
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toBeVisible()
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toHaveCount(0)

    const screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)

    await testHelpers.navigateToPromptCollections('Development')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await expect(mainWindow.locator(EXAMPLES_PROMPT_ROW)).toHaveCount(0)
  })

  test('collapses and expands all categories from the sidebar action', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptCollections('Main')

    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toBeEnabled()
    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Categories'
    )
    await expect(
      mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).locator('.lucide-chevrons-down-up')
    ).toHaveCount(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-category-toggle-button-Category"]')
    ).toHaveAttribute('aria-expanded', 'true')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-prompt-category-prompt"]')
    ).toBeVisible()
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).click()

    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toHaveAttribute(
      'aria-label',
      'Expand All Categories'
    )
    await expect(
      mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).locator('.lucide-chevrons-up-down')
    ).toHaveCount(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-prompt-category-prompt"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-prompt-base-before"]')).toBeVisible()

    await mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).click()

    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toHaveAttribute(
      'aria-label',
      'Collapse All Categories'
    )
    await expect(
      mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON).locator('.lucide-chevrons-down-up')
    ).toHaveCount(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-prompt-category-prompt"]')
    ).toBeVisible()
  })

  test('opens prompt collection deletion from the sidebar actions', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Development')
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 500)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST))
      .toBeGreaterThan(0)
    const scrollTopBefore = await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)

    await expect(mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON)).toBeEnabled()
    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    const deleteMenuItem = mainWindow.locator(DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM)
    await expect(deleteMenuItem).toBeVisible()
    await expect(deleteMenuItem).toHaveText('Delete Collection')
    await expect(deleteMenuItem).toHaveAttribute('data-variant', 'danger')
    const dangerHoverColor = await deleteMenuItem.evaluate((element) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = 'var(--ui-danger-action-hover-fill)'
      element.ownerDocument.body.append(probe)
      const color = getComputedStyle(probe).backgroundColor
      probe.remove()
      return color
    })
    await deleteMenuItem.hover()
    await expect(deleteMenuItem).toHaveCSS('background-color', dangerHoverColor)
    await deleteMenuItem.click()
    const deleteDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Collection"]'
    )
    await expect(deleteDialog).toBeVisible()
    await expect(deleteDialog).toContainText(
      'This collection and everything inside it will be permanently deleted, including completed and archived prompts.'
    )
    /** Acknowledgement must gate deletion and reset after dismissing the dialog. */
    const acknowledgement = deleteDialog.getByRole('checkbox', {
      name: 'Yes, I want to delete this collection and all of its contents.'
    })
    /** Destructive action remains unavailable until explicitly acknowledged. */
    const confirmDelete = deleteDialog.getByRole('button', { name: 'Delete collection' })
    await expect(acknowledgement).not.toBeChecked()
    await expect(confirmDelete).toBeDisabled()
    await acknowledgement.focus()
    await mainWindow.keyboard.press('Space')
    await expect(confirmDelete).toBeEnabled()
    await acknowledgement.uncheck()
    await expect(confirmDelete).toBeDisabled()
    await acknowledgement.check()
    await expect
      .poll(async () =>
        Math.abs((await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)) - scrollTopBefore)
      )
      .toBeLessThanOrEqual(1)
    await mainWindow.locator('.cthulhuUiDialogLayer').click({ position: { x: 2, y: 2 } })
    await expect(deleteDialog).toBeHidden()
    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    await mainWindow.locator(DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM).click()
    await expect(acknowledgement).not.toBeChecked()
    await expect(confirmDelete).toBeDisabled()
    await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
  })


  test('root title rename button does not hide prompts', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Development')
    const pencilButton = mainWindow.locator('[data-testid="prompt-collection-title-edit"]')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await pencilButton.click()
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.locator(DEVELOPMENT_PROMPT_ROW)).toBeVisible()
  })



  test('creates and navigates to a new collection', async ({ electronApp, testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await openCollectionCreation(mainWindow)

    const collectionNameInput = mainWindow.locator('[data-testid="create-prompt-collection-name-input"]')
    const errorMessage = mainWindow.locator('[data-testid="create-prompt-collection-name-error"]')
    const createButton = mainWindow.locator('[data-testid="create-prompt-collection-button"]')

    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeDisabled()

    await collectionNameInput.fill('Test Collection')
    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeEnabled()

    await collectionNameInput.fill('')
    await expect(errorMessage).toBeVisible()
    await expect(createButton).toBeDisabled()

    await collectionNameInput.fill('Test Collection')
    await expect(errorMessage).toHaveCount(0)
    await expect(createButton).toBeEnabled()

    await mainWindow.evaluate(() => {
      const testWindow = window as typeof window & {
        __promptCollectionCreateDuplicateErrorObserver?: MutationObserver
        __promptCollectionCreateDuplicateErrorSeen?: boolean
      }

      testWindow.__promptCollectionCreateDuplicateErrorSeen = false

      const observer = new MutationObserver(() => {
        const errorMessage = document.querySelector(
          '[data-testid="create-prompt-collection-name-error"]'
        )

        if (errorMessage?.textContent?.includes('A collection with this name already exists')) {
          testWindow.__promptCollectionCreateDuplicateErrorSeen = true
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })
      testWindow.__promptCollectionCreateDuplicateErrorObserver = observer
    })

    await createButton.click()
    await clickPromptCollectionItem(mainWindow, 'Test Collection')
    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText(
      'Test Collection'
    )
    expect(
      await mainWindow.evaluate(() => {
        const testWindow = window as typeof window & {
          __promptCollectionCreateDuplicateErrorObserver?: MutationObserver
          __promptCollectionCreateDuplicateErrorSeen?: boolean
        }

        testWindow.__promptCollectionCreateDuplicateErrorObserver?.disconnect()
        return testWindow.__promptCollectionCreateDuplicateErrorSeen
      })
    ).toBe(false)

    await testHelpers.navigateToPromptCollections('Test Collection')

    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText(
      'Test Collection'
    )
    await expect(mainWindow.locator(PROMPT_COLLECTION_HOST)).toBeVisible()
    await expect(mainWindow.locator(PROMPT_TREE_HOST)).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-empty-status"]')).toHaveText(
      'No active prompts. Click to add.'
    )
    // The selected collection is represented by the collection action, not a duplicate category row.
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-active-category-toggle-button-TestCollection"]')
    ).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-collection-header"]')).toContainText(
      'Test Collection'
    )
    await expect(
      mainWindow
        .locator(PROMPT_COLLECTION_HOST)
        .getByText('No active prompts in this collection.')
    ).toBeVisible()
    await expect
      .poll(async () => {
        const infoPath = '/ws/minimal/DefaultProject/Prompts/TestCollection/_CollectionInfo'
        return await Promise.all(
          ['Description.md'].map((filename) =>
            checkFileExists(electronApp, `${infoPath}/${filename}`)
          )
        )
      })
      .toEqual([false])

    const emptyPromptCollectionPlaceholderHasGutter = await mainWindow.evaluate((hostSelector) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      if (!host) return null

      const emptyMessage = Array.from(host.querySelectorAll('p')).find(
        (paragraph) =>
          paragraph.textContent?.trim() === 'No active prompts in this collection.'
      )
      const placeholderRow = emptyMessage?.closest('.prompt-collection-section-row')
      return Boolean(placeholderRow?.querySelector('.promptCollectionSectionGutter'))
    }, PROMPT_COLLECTION_HOST)

    expect(emptyPromptCollectionPlaceholderHasGutter).toBe(false)
    expect(await testHelpers.getActiveScreen()).toBe('prompt-collection')
  })

  test('creates and opens a prompt template collection', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    /** Combined order repaired when the prompt-only sample workspace loads. */
    const initialWorkspaceCollectionEntries = (
      (await readWorkspaceCollectionOrder(electronApp, SAMPLE_WORKSPACE_PATH))!
    ).entries

    await showCollectionBrowser(mainWindow)
    await openCollectionCreation(mainWindow, 'template')
    const createTemplateCollectionDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Template Collection"]'
    )
    await expect(createTemplateCollectionDialog).toBeVisible()
    await expect(createTemplateCollectionDialog.getByLabel('Collection Name')).toBeVisible()
    await mainWindow.locator('[data-testid="create-prompt-collection-name-input"]').fill('Examples')
    await mainWindow.locator('[data-testid="create-prompt-collection-button"]').click()
    await mainWindow.locator('[data-testid^="new-tab-collection-"]').filter({ has: mainWindow.getByText('Examples', { exact: true }) }).click()

    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText('Examples')
    await expect(mainWindow.locator('[data-testid="prompt-collection-title"]')).toHaveText(
      'Examples'
    )
    // The created template collection identifies its type in the subtitle.
    await expect(
      mainWindow.getByTestId('prompt-collection-subtitle')
    ).toHaveText('Prompt Templates')
    await expect(mainWindow.locator('[data-testid="prompt-collection-active-filter"]')).toHaveText(
      'Active 0'
    )
    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(MANAGE_CATEGORIES_SELECTED_PROMPT_COLLECTION_MENU_ITEM)).toHaveText(
      'Manage Categories'
    )
    await mainWindow.keyboard.press('Escape')
    await expect(mainWindow.locator(MANAGE_CATEGORIES_SELECTED_PROMPT_COLLECTION_MENU_ITEM)).toHaveCount(0)
    await expect
      .poll(() => checkFileExists(electronApp, `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Templates/Examples`))
      .toBe(true)

    const collectionInfo = JSON.parse(
      await readTextFile(
        electronApp,
        `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Templates/Examples/_CollectionInfo.json`
      )
    ) as { displayName: string; collectionId: string; kind: string }
    expect(collectionInfo).toEqual({
      displayName: 'Examples',
      collectionId: expect.any(String),
      kind: 'template'
    })
    const workspaceCollectionOrder = (await readWorkspaceCollectionOrder(electronApp, SAMPLE_WORKSPACE_PATH))!
    expect(workspaceCollectionOrder.entries).toEqual([
      { kind: 'collection', id: collectionInfo.collectionId },
      ...initialWorkspaceCollectionEntries
    ])
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Templates/Examples/Active/_CategoryOrder.json`
        )
      )
    ).toEqual({ categories: [{ categoryId: null, entries: [] }] })
    expect(
      await checkFileExists(electronApp, `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Templates/Examples/Completed`)
    ).toBe(false)
    await showCollectionBrowser(mainWindow)
    await openCollectionCreation(mainWindow, 'template')
    await mainWindow.locator('[data-testid="create-prompt-collection-name-input"]').fill('Examples')
    await expect(
      mainWindow.locator('[data-testid="create-prompt-collection-name-error"]')
    ).toContainText('A collection with this name already exists')
    await expect(mainWindow.locator('[data-testid="create-prompt-collection-button"]')).toBeDisabled()
  })

  test('renames a prompt collection and persists descendant edits at the new path', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    const developmentCollectionId = createDeterministicId(`${SAMPLE_WORKSPACE_PATH}:Development`)

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Development')
    const rootHeader = mainWindow.locator('[data-testid="prompt-collection-header"]')
    const rootTitle = rootHeader.locator('[data-testid="prompt-collection-title"]')
    await expect(rootHeader).toBeVisible()
    await expect(rootTitle).toHaveText('Development Tools')
    await expect(rootHeader.locator('h1')).toHaveCount(0)
    expect(
      await rootTitle.evaluate((element) => element.scrollHeight - element.clientHeight)
    ).toBeLessThanOrEqual(0)
    /** Header geometry guards the fixed virtualizer estimate and toolbar alignment. */
    const rootHeaderGeometry = await rootHeader.evaluate((element) => {
      const filterBar = element.querySelector<HTMLElement>('[role="group"][aria-label="Filter prompts"]')
      const titleRow = element.querySelector<HTMLElement>('.prompt-collection-screen-header')
      const subtitle = element.querySelector<HTMLElement>('[data-testid="prompt-collection-subtitle"]')
      const titleLine = element.querySelector<HTMLElement>('.cthulhuUiPageHeaderTitleLine')
      /** Action bar and rename glyph must align with their respective rows. */
      const actions = element.querySelector<HTMLElement>('.prompt-collection-actions')!
      /** Enlarged pencil retains its size beside the title. */
      const pencil = element.querySelector<SVGElement>('[data-testid="prompt-collection-title-edit"] svg')!
      if (!filterBar || !titleRow || !subtitle || !titleLine) return null

      const rowRect = element.getBoundingClientRect()
      const filterRect = filterBar.getBoundingClientRect()
      /** Measured action container used to check the trailing inset and common row. */
      const actionsRect = actions.getBoundingClientRect()
      /** Glyph bounds used to check size. */
      const pencilRect = pencil.getBoundingClientRect()
      return {
        height: rowRect.height,
        titleRowHeight: titleRow.getBoundingClientRect().height,
        subtitleHeight: subtitle.getBoundingClientRect().height,
        titleLineHeight: titleLine.getBoundingClientRect().height,
        filterRowHeight: filterRect.height,
        bottomInset: rowRect.bottom - filterRect.bottom,
        filterLeftInset: filterRect.left - rowRect.left,
        actionsRightInset: rowRect.right - actionsRect.right,
        actionsHeight: actionsRect.height,
        toolbarAlignment: actionsRect.top - filterRect.top,
        toolbarGap: actionsRect.left - filterRect.right,
        pencilHeight: pencilRect.height
      }
    })
    expect(rootHeaderGeometry).not.toBeNull()
    expect(rootHeaderGeometry!.height).toBe(144)
    expect(rootHeaderGeometry!.titleRowHeight).toBe(60)
    expect(rootHeaderGeometry!.subtitleHeight).toBe(20)
    expect(rootHeaderGeometry!.titleLineHeight).toBe(36)
    expect(rootHeaderGeometry!.filterRowHeight).toBe(44)
    expect(Math.abs(rootHeaderGeometry!.bottomInset - 6)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootHeaderGeometry!.filterLeftInset - 24)).toBeLessThanOrEqual(1)
    expect(Math.abs(rootHeaderGeometry!.actionsRightInset - 24)).toBeLessThanOrEqual(1)
    expect(rootHeaderGeometry!.actionsHeight).toBe(44)
    expect(Math.abs(rootHeaderGeometry!.toolbarAlignment)).toBeLessThanOrEqual(1)
    expect(rootHeaderGeometry!.toolbarGap).toBeGreaterThanOrEqual(16)
    expect(rootHeaderGeometry!.pencilHeight).toBe(20)
    await expect(rootHeader.locator('.cthulhuUiPageHeaderTitleLine')).toHaveCSS('align-items', 'baseline')
    await expect(rootHeader.locator('[data-testid="prompt-collection-manage-categories-button"]')).toHaveText('Categories')
    await expect(rootHeader.locator('[data-testid="prompt-collection-manage-categories-button"]')).toHaveCSS('border-top-width', '0px')
    await expect(rootHeader.locator('[data-testid="prompt-collection-delete-button"]')).toHaveCSS('border-top-width', '0px')

    /** Selected status uses the shared accent palette without relying on the removed collection selector. */
    const activeFilter = rootHeader.locator('[data-testid="prompt-collection-active-filter"]')
    await expect(activeFilter).toHaveCSS('background-color', await resolvePaletteColor(activeFilter, '--ui-accent-action-fill'))
    await expect(activeFilter).toHaveCSS('border-top-color', await resolvePaletteColor(activeFilter, '--ui-accent-muted-border'))
    await expect(activeFilter).toHaveCSS('color', await resolvePaletteColor(activeFilter, '--ui-normal-text'))
    await rootHeader.locator('[data-testid="prompt-collection-title-edit"]').click()

    const renameDialog = mainWindow.getByRole('dialog', { name: 'Rename Collection' })
    const nameInput = mainWindow.locator('[data-testid="rename-prompt-collection-name-input"]')
    const renameButton = mainWindow.locator('[data-testid="rename-prompt-collection-button"]')
    const errorMessage = mainWindow.locator('[data-testid="rename-prompt-collection-name-error"]')

    await expect(renameDialog).toBeVisible()
    await expect(renameDialog.locator('[data-testid="dialog-subtitle"]')).toHaveText(
      'Change the name shown in the app and on disk.'
    )
    const renameDialogBox = await renameDialog.locator('.cthulhuUiPopupSurface').boundingBox()
    expect(renameDialogBox).not.toBeNull()
    expect(Math.abs(renameDialogBox!.width - 520)).toBeLessThanOrEqual(2)
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
    await expect(renameButton).toBeEnabled()
    await renameButton.click()
    await expect(renameDialog).toHaveCount(0)
    await expect(rootTitle).toHaveText('Development')

    await rootHeader.locator('[data-testid="prompt-collection-title-edit"]').click()
    await expect(renameButton).toBeDisabled()
    await nameInput.fill(' Development ')
    await expect(renameButton).toBeDisabled()

    // Inserting an internal space changes only the display name, leaving the disk path intact.
    await nameInput.fill('Devel opment')
    await expect(renameButton).toBeEnabled()
    await renameButton.click()
    await expect(renameDialog).toHaveCount(0)
    await expect(rootTitle).toHaveText('Devel opment')
    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText(
      'Devel opment'
    )
    await expect
      .poll(async () => JSON.parse(await readTextFile(
        electronApp,
        `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Prompts/Development/_CollectionInfo.json`
      )).displayName)
      .toBe('Devel opment')

    await rootHeader.locator('[data-testid="prompt-collection-title-edit"]').click()
    await expect(nameInput).toHaveValue('Devel opment')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Examples')
    await expect(errorMessage).toContainText('A collection with this name already exists')
    await expect(renameButton).toBeDisabled()

    await nameInput.fill('Renamed Development')
    await expect(errorMessage).toHaveCount(0)
    await expect(renameButton).toBeEnabled()
    await renameButton.click()

    await expect(nameInput).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-collection-header-collection"]')).toContainText(
      'Renamed Development'
    )
    await expect(mainWindow.locator(selectedCollectionTitleSelector)).toContainText(
      'Renamed Development'
    )
    await expect(rootHeader).toContainText('Renamed Development')

    const renamedCollectionInfoPath = `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Prompts/RenamedDevelopment/_CollectionInfo.json`
    /** Descendant prompt path expected to remain authoritative after the collection rename. */
    const renamedPromptPath = `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Prompts/RenamedDevelopment/Active/Code Review.prompt.md`
    const renamedCollectionInfo = JSON.parse(
      await readTextFile(electronApp, renamedCollectionInfoPath)
    ) as {
      displayName: string
      collectionId: string
      kind: 'prompt'
    }
    expect(renamedCollectionInfo).toEqual({
      displayName: 'Renamed Development',
      collectionId: developmentCollectionId,
      kind: 'prompt'
    })
    await expect
      .poll(
        async () =>
          await checkFileExists(
            electronApp,
            `${SAMPLE_WORKSPACE_PATH}/DefaultProject/Prompts/Development/_CollectionInfo.json`
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

    /** Renamed collection's loaded descendant editor used to verify its in-memory persistence path. */
    const promptEditorSelector = '[data-testid="prompt-editor-dev-1"]'
    /** Unique body text proving the post-rename edit reached the renamed directory. */
    const editMarker = 'post-rename descendant edit'
    await typeInMonacoEditor(mainWindow, promptEditorSelector, editMarker)
    await expect
      .poll(async () => await readTextFile(electronApp, renamedPromptPath))
      .toContain(editMarker)
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

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Short')
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST, 1700)
    await mainWindow.waitForSelector(SHORT_PROMPT_50, { state: 'attached' })
    await mainWindow.evaluate((selector) => {
      const button = document.querySelector<HTMLButtonElement>(selector)
      if (!button) {
        throw new Error(`Missing prompt tree row: ${selector}`)
      }
      button.click()
    }, SHORT_PROMPT_50)

    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })
    await mainWindow.waitForSelector(SHORT_EDITOR_50, { state: 'attached' })
    await expect(mainWindow.locator(SHORT_PROMPT_50)).toHaveAttribute('data-row-state', 'active')
  })

  test('highlights the first prompt at the top and opens the collection delete action', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Short')
    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })

    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 1200)
    await expect(
      mainWindow.locator('[data-testid^="prompt-tree-active-prompt-short-"][aria-current="true"]')
    ).toBeVisible()

    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 0)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(0)
    await expect(mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON)).not.toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.getByTestId('prompt-tree-active-prompt-short-1')).toHaveAttribute('aria-current', 'true')
    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    await expect(mainWindow.locator(DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM)).toBeVisible()
    await mainWindow.locator(DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM).click()
    const deleteDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Collection"]'
    )
    await expect(deleteDialog).toBeVisible()
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(0)
    await expect(mainWindow.locator('[data-testid="prompt-collection-header"]')).toBeVisible()
    await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
  })

  test('maps prompt header navigation to the collection root target', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Short')
    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 1200)
    await expect(mainWindow.locator('[data-testid="prompt-collection-header-section"]')).toHaveText(
      'Active'
    )

    await mainWindow.locator('[data-testid="prompt-collection-header-section"]').click()
    await expect.poll(() => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(0)
    await expect(mainWindow.locator('[data-testid="prompt-collection-header-category"]')).toHaveCount(0)
    await expect(mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON)).not.toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator('[data-testid="prompt-tree-active-prompt-short-1"]')).toHaveAttribute(
      'data-row-state',
      'active'
    )
  })

  test('recycles virtualized Monaco editors without stale tokenization errors', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    /** Captured DOM identity remains inspectable after its Monaco instance is disposed. */
    let originalEditor: import('@playwright/test').ElementHandle<HTMLElement | SVGElement> | null = null
    await mainWindow.evaluate(() => window.playwrightTestControls!.tokenization.pause())
    try {
      await testHelpers.navigateToPromptCollections('Short')
      await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })
      await expect.poll(() => mainWindow.evaluate(() =>
        window.playwrightTestControls!.tokenization.getHeldReplyCount('/cthulhu-prompt/prompts/short-1.md')
      )).toBeGreaterThan(0)
      /** Original editor must be recycled before its held worker replies are delivered. */
      originalEditor = await mainWindow.locator('[data-testid="prompt-editor-short-1"] .monaco-editor')
        .elementHandle()
      expect(originalEditor).not.toBeNull()

      /** Rapid viewport changes exercise disposal and remounting while replies are held. */
      const scrollPositions = [0, 1200, 2400, 0, 1800, 600, 2400, 0]
      for (const scrollTopPx of scrollPositions) {
        await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, scrollTopPx)
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
            }, PROMPT_COLLECTION_HOST)
          })
          .toBe(true)
        if (scrollTopPx === 2400) {
          expect(await originalEditor!.evaluate((element) => element.isConnected)).toBe(false)
        }
      }
    } finally {
      try {
        await mainWindow.evaluate(() => window.playwrightTestControls!.tokenization.release())
      } finally {
        await originalEditor?.dispose()
      }
    }
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

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Development')
    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })

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

  test('collection breadcrumb scrolls to top', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Short')
    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 1200)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(1200)

    await mainWindow.locator('[data-testid="prompt-collection-header-collection"]').click()

    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(0)
    await expect(mainWindow.locator('[data-testid="prompt-collection-header"]')).toBeVisible()
  })

  test('sidebar collection root button scrolls to top', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Short')
    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 1200)
    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(1200)
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST, 0)
    await expect(mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON)).not.toHaveAttribute(
      'data-active',
      'true'
    )

    await mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON).click()

    await expect.poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)).toBe(0)
    await expect(mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON)).not.toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.getByTestId('prompt-tree-active-prompt-short-1')).toHaveAttribute('aria-current', 'true')
  })
})
