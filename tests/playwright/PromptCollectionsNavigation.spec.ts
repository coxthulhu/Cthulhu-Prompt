import { selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import type { ConsoleMessage, Page } from 'playwright'
import {
  checkFileExists,
  checkPersistedPromptFilesExistByTitle,
  readTextFile
} from '../helpers/PromptPersistenceTestHelpers'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { readPromptNavigationHighlightAnimation } from '../helpers/PromptNavigationHighlightHelpers'
import { typeInMonacoEditor } from '../helpers/MonacoHelpers'
import { readWorkspaceCollectionOrder, runSqlQuery, seedWorkspaceState, seedCollectionUiState } from '../helpers/UserPersistenceHelpers'
import { getMarkdownContentIds } from '@shared/domain/markdown-content/MarkdownContent'
import { getPromptCollectionCategoryIds, type PromptCollection } from '@shared/domain/prompt-collection/PromptCollection'

const { test, describe, expect } = createPlaywrightTestSuite()

const EXAMPLES_PROMPT_ROW = '[data-testid="prompt-tree-active-prompt-simple-1"]'
const DEVELOPMENT_PROMPT_ROW = '[data-testid="prompt-tree-active-prompt-dev-1"]'
const TOGGLE_ALL_CATEGORIES_BUTTON = '[data-testid="toggle-all-categories-button"]'
const SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON =
  '[data-testid="selected-prompt-collection-actions-button"]'
const DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM =
  '[data-testid="delete-selected-prompt-collection-menu-item"]'
const SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-collection-selector-trigger"]'
const SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ITEM = '[data-testid^="sidebar-prompt-collection-dropdown-item-"]'
const SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ADD_ITEM =
  '[data-testid="sidebar-prompt-collection-dropdown-add-item"]'
const SIDEBAR_PROMPT_COLLECTION_ADD_BUTTON = '[data-testid="sidebar-prompt-collection-add-button"]'
const SHORT_PROMPT_50 = '[data-testid="prompt-tree-active-prompt-short-50"]'
const SHORT_EDITOR_50 = '[data-testid="prompt-editor-short-50"]'
const PROMPT_TREE_HOST = '[data-testid="prompt-tree-active-virtual-window"]'
const SIDEBAR_COLLECTION_OVERVIEW_BUTTON = '[data-testid="sidebar-collection-overview-button"]'
const PROMPT_COLLECTION_HOST = '[data-testid="prompt-collection-virtual-window"]'
const SAMPLE_WORKSPACE_PATH = '/ws/sample'
const CATEGORIES_WORKSPACE_PATH = '/ws/categories'
const TEMPLATE_WORKSPACE_PATH = '/ws/templates'
/** Mixed-kind workspace used to verify ordered selection after collection deletion. */
const DELETE_NAVIGATION_WORKSPACE_PATH = '/ws/delete-navigation'


describe('Prompt Collection Navigation (non-virtual)', () => {
  test('deletes root-owned SQLite UI state with a prompt collection', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })
    await testHelpers.navigateToPromptCollections('Main')

    /** Collection category order used to identify one category-owned cached UI-state row. */
    const categoryOrder = JSON.parse(
      await readTextFile(
        electronApp,
        '/ws/categories/Prompts/Main/Active/_CollectionInfo/CategoryOrder.json'
      )
    )
    /** Category ID deleted with the prompt collection. */
    const categoryId = categoryOrder.categories.find(
      (category: { categoryId: string | null }) => category.categoryId !== null
    ).categoryId as string
    /** Persisted workspace selection identifying the active workspace and collection. */
    const workspaceRow = (
      await runSqlQuery(
        electronApp,
        `SELECT workspace_id AS workspaceId, json_extract(data_json, '$.selectedScreenData') AS selectedScreenDataJson
         FROM workspace_state WHERE state_type = 'workspace-navigation' LIMIT 1`
      )
    ).rows?.[0] as { workspaceId: string; selectedScreenDataJson: string }
    /** prompt-collection ID selected in the persisted workspace screen state. */
    const promptCollectionId = JSON.parse(workspaceRow.selectedScreenDataJson).promptCollectionId as string
    /** Current authoritative snapshots used to invoke the existing deletion IPC directly. */
    const workspaceLoadResult = await mainWindow.evaluate(async () => {
      return await window.electron.ipcRenderer.invoke('load-workspace-by-path', {
        requestId: `root-delete-load-${Date.now()}`,
        clientId: window.ipcClientId,
        payload: { workspaceInfoPath: '/ws/categories/categories.cthulhuprompt' }
      })
    })
    /** Authoritative workspace revision payload required by collection deletion. */
    const workspaceSnapshot = workspaceLoadResult.workspace as {
      id: string
      revision: number
      data: unknown
    }
    /** Authoritative collection revision payload required by collection deletion. */
    const promptCollectionSnapshot = workspaceLoadResult.promptCollections.find(
      (snapshot: { id: string }) => snapshot.id === promptCollectionId
    ) as { id: string; revision: number; data: unknown }

    for (const contentOwnerId of [promptCollectionId, categoryId, 'sibling-owner']) {
      await seedCollectionUiState(electronApp, workspaceRow.workspaceId, { contentOwnerId, selectedEntryId: 'collection-settings' })
    }
    for (const contentId of ['base-before', 'sibling-content']) {
      await seedWorkspaceState(electronApp, workspaceRow.workspaceId, 'markdown-editor', contentId, { editorViewStateJson: '{}' }, 'machine-specific')
    }
    /** Seed verification proving every target and sibling row exists before deletion. */
    const seededRow = (
      await runSqlQuery(
        electronApp,
        `SELECT
           (SELECT COUNT(*) FROM workspace_state
            WHERE state_type IN ('collection-user', 'collection-machine') AND workspace_id = '${workspaceRow.workspaceId}'
              AND entity_id IN (
                '${promptCollectionId}', '${categoryId}', 'sibling-owner'
              )) AS promptCollectionCount,
           (SELECT COUNT(*) FROM workspace_state
            WHERE state_type = 'markdown-editor' AND workspace_id = '${workspaceRow.workspaceId}'
              AND entity_id IN ('base-before', 'sibling-content')) AS markdownCount`
      )
    ).rows?.[0]
    expect(seededRow).toEqual({
      promptCollectionCount: 6,
      markdownCount: 2
    })

    /** Split UI-state load that hydrates the newly seeded SQLite records authoritatively. */
    const uiStateLoadResult = await mainWindow.evaluate(async (workspaceId) => {
      return await window.electron.ipcRenderer.invoke('load-workspace-ui-state', {
        requestId: `root-delete-ui-state-${Date.now()}`,
        clientId: window.ipcClientId,
        payload: { workspaceId }
      })
    }, workspaceRow.workspaceId)
    /** collection data used to derive every non-optional deletion target. */
    const promptCollectionData = promptCollectionSnapshot.data as PromptCollection
    /** Content IDs across every status folder owned by the deleted collection. */
    const contentIds = getMarkdownContentIds(promptCollectionData, promptCollectionData.kind)
    /** Category IDs whose files are deleted with the collection. */
    const categoryIds = getPromptCollectionCategoryIds(promptCollectionData)
    /** Required generic domain expectations; optional SQLite deletes are excluded by policy. */
    const deletionExpectations = [
      {
        entityType: 'workspace',
        id: workspaceSnapshot.id,
        expected: 'revision',
        revision: workspaceSnapshot.revision
      },
      ...contentIds.map((contentId) => {
        /** Workspace-load snapshot supplying the current content revision. */
        const snapshot = (
          promptCollectionData.kind === 'prompt'
            ? workspaceLoadResult.prompts
            : workspaceLoadResult.promptTemplates
        ).find((candidate: { id: string }) => candidate.id === contentId)
        return {
          entityType: promptCollectionData.kind === 'prompt' ? 'prompt' : 'promptTemplate',
          id: contentId,
          expected: 'revision',
          revision: snapshot.revision
        }
      }),
      ...categoryIds.map((ownedCategoryId) => {
        /** Workspace-load category snapshot supplying the current category revision. */
        const snapshot = workspaceLoadResult.categories.find(
          (candidate: { id: string }) => candidate.id === ownedCategoryId
        )
        return {
          entityType: 'category',
          id: ownedCategoryId,
          expected: 'revision',
          revision: snapshot.revision
        }
      }),
      {
        entityType: 'promptCollection',
        id: promptCollectionSnapshot.id,
        expected: 'revision',
        revision: promptCollectionSnapshot.revision
      },
      {
        entityType: 'workspaceUiState',
        id: workspaceRow.workspaceId,
        expected: 'revision',
        revision: uiStateLoadResult.workspaceUiState.revision
      }
    ]
    /** Direct generic-domain handler response for collection deletion. */
    const deleteResult = await mainWindow.evaluate(
      async ({ workspaceId, promptCollectionId, expectations }) => {
        return await window.electron.ipcRenderer.invoke('delete-prompt-collection', {
          requestId: `root-delete-${Date.now()}`,
          clientId: window.ipcClientId,
          payload: {
            command: { workspaceId, promptCollectionId },
            expectations
          }
        })
      },
      {
        workspaceId: workspaceRow.workspaceId,
        promptCollectionId,
        expectations: deletionExpectations
      }
    )
    expect(deleteResult).toMatchObject({ success: true })

    /** Counts and workspace selection left after the collection logical commit. */
    const cleanupRow = (
      await runSqlQuery(
        electronApp,
        `SELECT
           (SELECT COUNT(*) FROM workspace_state
            WHERE state_type IN ('collection-user', 'collection-machine') AND workspace_id = '${workspaceRow.workspaceId}'
              AND entity_id IN ('${promptCollectionId}', '${categoryId}')) AS promptCollectionCount,
           (SELECT COUNT(*) FROM workspace_state
            WHERE state_type = 'markdown-editor' AND workspace_id = '${workspaceRow.workspaceId}'
              AND entity_id = 'base-before') AS markdownCount,
           (SELECT COUNT(*) FROM workspace_state
            WHERE state_type IN ('collection-user', 'collection-machine') AND workspace_id = '${workspaceRow.workspaceId}'
              AND entity_id = 'sibling-owner') AS siblingPromptCollectionCount,
           (SELECT COUNT(*) FROM workspace_state
            WHERE state_type = 'markdown-editor' AND workspace_id = '${workspaceRow.workspaceId}'
              AND entity_id = 'sibling-content') AS siblingMarkdownCount,
           json_extract(data_json, '$.selectedScreen') AS selectedScreen,
           json_extract(data_json, '$.lastPromptTaskCollectionId') AS lastPromptTaskCollectionId
         FROM workspace_state
         WHERE state_type = 'workspace-navigation' AND workspace_id = '${workspaceRow.workspaceId}'`
      )
    ).rows?.[0]
    expect(cleanupRow).toEqual({
      promptCollectionCount: 0,
      markdownCount: 0,
      siblingPromptCollectionCount: 2,
      siblingMarkdownCount: 1,
      selectedScreen: 'prompt-task-collections',
      lastPromptTaskCollectionId: null
    })
  })

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
    await mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]').click()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER)).toBeVisible()
    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await expect(
      mainWindow
        .locator('[data-testid="sidebar-prompt-collection-dropdown-item-template-collection-1"]')
        .locator('.lucide-layers')
    ).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await testHelpers.navigateToPromptTemplateCollections('Code Review Templates')

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
    await expect(mainWindow.locator('[data-testid="sidebar-manage-categories-button"]')).toHaveAttribute(
      'title',
      'Manage Categories'
    )
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
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
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
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
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
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Development Tools'
    )

    const codeReviewResult = await testHelpers.verifyPromptVisible('Code Review')
    expect(codeReviewResult.found).toBe(true)

    const bugAnalysisResult = await testHelpers.verifyPromptVisible('Bug Analysis')
    expect(bugAnalysisResult.found).toBe(true)
  })

  test('opens Task Prompts view and renders prompt list', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Examples')

    const screenInfo = await testHelpers.getPromptCollectionScreenInfo()
    expect(screenInfo.hasPromptEditors).toBe(true)
    expect(screenInfo.promptCount).toBe(1)
    await expect(
      mainWindow.locator('[data-testid="prompt-collection-screen"] .virtual-window-scrollbar')
    ).toHaveCSS('width', '14px')
  })

  test('opens the first collection from the activity bar when no collection was selected', async ({
    testSetup
  }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    // Each collection kind has its own tooltip, accessible label, and activity position.
    await expect(mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]')).toHaveAttribute(
      'title',
      'Task Prompts'
    )
    await expect(mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]')).toHaveAttribute(
      'aria-label',
      'Task Prompts'
    )
    await expect(
      mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]')
    ).toHaveAttribute('title', 'Prompt Templates')
    await expect(
      mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]')
    ).toHaveAttribute('aria-label', 'Prompt Templates')
    /** Workspace details lead the unchanged primary-screen order. */
    const activityIds = await mainWindow
      .locator('[data-testid="app-activity-bar"] > button')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-testid')))
    expect(activityIds.slice(0, 4)).toEqual([
      'workspace-button',
      'nav-button-home',
      'nav-button-prompt-task-collections',
      'nav-button-prompt-template-collections'
    ])
    await expect(mainWindow.locator('[data-testid="app-activity-bar"] > div [data-testid="nav-button-settings"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="nav-button-prompt-task-collections"] svg')
    ).toHaveClass(/lucide-file-text/)
    await expect(
      mainWindow.locator('[data-testid="nav-button-prompt-template-collections"] svg')
    ).toHaveClass(/lucide-layers/)
    await mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]').click()

    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-1"]', {
      state: 'attached'
    })
    await expect(mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Development Tools'
    )
  })

  test('opens the first ordered template collection when no template collection was selected', async ({
    electronApp,
    testSetup
  }) => {
    /** Template-only workspace whose persisted order differs from alphabetical order. */
    const workspacePath = '/ws/template-activity-fallback'
    /** Two template collections used to prove the first persisted collection is selected. */
    const filesystem = createWorkspaceWithTemplateCollections(workspacePath, [
      { folderName: 'Alpha', displayName: 'Alpha Templates', collectionId: 'template-alpha' },
      { folderName: 'Zulu', displayName: 'Zulu Templates', collectionId: 'template-zulu' }
    ])
    await seedWorkspaceState(electronApp, createDeterministicId(workspacePath), 'template-collection-order', null, {
      entries: [
        { kind: 'collection', id: 'template-zulu' },
        { kind: 'collection', id: 'template-alpha' }
      ]
    })

    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Window and UI helpers for opening the custom workspace normally. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)

    await mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]').click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Zulu Templates'
    )
  })

  test('restores the last prompt collection scroll when opened from the activity bar', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Short')
    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })
    await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST, 900)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST))
      .toBeGreaterThan(0)
    const savedScrollTop = await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST)

    await testHelpers.navigateToHomeScreen()
    await mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]').click()
    await mainWindow.waitForSelector(PROMPT_COLLECTION_HOST, { state: 'attached' })

    await expect(mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST))
      .toBe(savedScrollTop)
  })

  test('selects prompt collections and opens create dialog from the sidebar dropdown', async ({
    testSetup
  }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await mainWindow
      .locator(SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ITEM)
      .filter({ hasText: 'Development Tools' })
      .click()

    await mainWindow.waitForSelector('[data-testid="prompt-editor-dev-2"]', {
      state: 'attached'
    })
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Development Tools'
    )
    expect(await testHelpers.getActiveScreen()).toBe('prompt-collection')

    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ADD_ITEM).click()
    const createPromptCollectionDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Prompt Collection"]'
    )
    await expect(createPromptCollectionDialog).toBeVisible()
    const createDialogBox = await createPromptCollectionDialog.locator('.cthulhuUiPopupSurface').boundingBox()
    expect(createDialogBox).not.toBeNull()
    expect(Math.abs(createDialogBox!.width - 520)).toBeLessThanOrEqual(2)
    await expect(
      createPromptCollectionDialog.locator('[data-testid="dialog-header-icon"]')
    ).toBeVisible()
    await expect(
      createPromptCollectionDialog.locator('[data-testid="dialog-subtitle"]')
    ).toHaveText('Organize one-time prompts for individual tasks.')
    const nameField = createPromptCollectionDialog.locator(
      '[data-testid="prompt-collection-name-field"]'
    )
    const nameInput = createPromptCollectionDialog.getByLabel('Collection Name')
    await expect(nameField.locator('.cthulhuUiTitle')).toHaveText('Collection Name')
    await expect(nameField.locator('.cthulhuUiSubtitle')).toHaveText(
      'Required. Names must be unique among task prompt collections.'
    )
    await expect(nameInput).toHaveAttribute(
      'aria-describedby',
      'create-prompt-collection-name-input-help'
    )
    const nameFieldBox = await nameField.boundingBox()
    const nameInputBox = await nameInput.boundingBox()
    expect(nameFieldBox).not.toBeNull()
    expect(nameInputBox).not.toBeNull()
    expect(nameInputBox!.y).toBeGreaterThan(nameFieldBox!.y)
    expect(Math.abs(nameInputBox!.width - nameFieldBox!.width)).toBeLessThanOrEqual(2)
  })

  test('shows add prompt collection button when the workspace has no prompt collections', async ({
    testSetup
  }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await expect(mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_ADD_BUTTON)).toBeVisible()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_ADD_BUTTON)).toContainText(
      'Create Collection'
    )
    await expect(mainWindow.locator('.sidebarPromptTreeStatus')).toHaveText(
      'Create a collection to get started.'
    )
    await expect(mainWindow.locator('.sidebarPromptTreeStatus')).toHaveCSS('font-size', '14px')
    await expect(mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER)).toHaveText('Show All')
    await mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]').click()
    await expect(mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="home-screen"]')).toHaveCount(0)

    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_ADD_BUTTON).click()
    await expect(
      mainWindow.locator('[data-testid="create-prompt-collection-name-input"]')
    ).toBeVisible()
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

  test('opens selected collection deletion after navigating from Home', async ({ testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Development')
    await testHelpers.navigateToHomeScreen()
    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    await mainWindow.locator(DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM).click()

    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toBeVisible()
    const deleteDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Delete Collection"]'
    )
    await expect(deleteDialog).toBeVisible()
    await expect(deleteDialog).toContainText('This collection and everything inside it will be permanently deleted')
    await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
  })

  /** Verifies ordered post-delete selection and the final-collection empty state. */
  test('selects the first remaining collection and retains the screen after deleting the last collection', async ({
    testSetup
  }) => {
    /** Mixed prompt and template collections used to verify kind-local deletion fallback. */
    const filesystem = {
      ...createWorkspaceWithCollections(DELETE_NAVIGATION_WORKSPACE_PATH, [
        {
          folderName: 'DeleteSecond',
          displayName: 'Delete Second',
          promptCollectionId: 'delete-second',
          prompts: [{ id: 'delete-prompt', title: 'Delete', promptText: 'Delete me.' }]
        },
        {
          folderName: 'LastPrompt',
          displayName: 'Last Prompt',
          promptCollectionId: 'last-prompt',
          prompts: [{ id: 'last-prompt-content', title: 'Last', promptText: 'Last prompt.' }]
        }
      ]),
      ...createWorkspaceWithTemplateCollections(DELETE_NAVIGATION_WORKSPACE_PATH, [
        {
          folderName: 'FirstTemplate',
          displayName: 'First Template',
          collectionId: 'first-template',
          templates: [{ id: 'first-template-content', title: 'First', templateText: 'First.' }]
        }
      ])
    }
    filesystem[`${DELETE_NAVIGATION_WORKSPACE_PATH}/Prompts/CollectionOrder.json`] = JSON.stringify(
      {
        entries: ['delete-second', 'last-prompt'].map((id) => ({
          kind: 'collection',
          id
        }))
      },
      null,
      2
    )
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(DELETE_NAVIGATION_WORKSPACE_PATH)])
    /** Mixed workspace window and helpers used for consecutive task-collection deletions. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    /** Result of selecting the custom workspace through the normal UI flow. */
    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await testHelpers.navigateToPromptCollections('Delete Second')
    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    await mainWindow.locator(DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM).click()
    /** Confirmation dialog for deleting the selected second collection. */
    const deleteDialog = mainWindow.locator('[role="dialog"][aria-label="Delete Collection"]')
    await expect(deleteDialog.getByRole('button', { name: 'Delete collection' })).toBeDisabled()
    await deleteDialog.getByRole('checkbox').check()
    await deleteDialog.getByRole('button', { name: 'Delete collection' }).click()

    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Last Prompt'
    )

    await mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON).click()
    await mainWindow.locator(DELETE_SELECTED_PROMPT_COLLECTION_MENU_ITEM).click()
    await expect(deleteDialog.getByRole('checkbox')).not.toBeChecked()
    await expect(deleteDialog.getByRole('button', { name: 'Delete collection' })).toBeDisabled()
    await deleteDialog.getByRole('checkbox').check()
    await deleteDialog.getByRole('button', { name: 'Delete collection' }).click()

    await expect(mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toHaveCount(0)
    await expect(mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_ADD_BUTTON)).toContainText(
      'Create Collection'
    )

    await mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]').click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'First Template'
    )
    await expect(mainWindow.locator('[data-testid="prompt-collection-active-filter"]')).toBeVisible()
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

  test('disables selected collection actions when no prompt collection exists', async ({ testSetup }) => {
    const { mainWindow, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await expect(mainWindow.locator(SELECTED_PROMPT_COLLECTION_ACTIONS_BUTTON)).toBeDisabled()
    await expect(mainWindow.locator(TOGGLE_ALL_CATEGORIES_BUTTON)).toBeDisabled()
  })

  test('creates and navigates to a new collection', async ({ electronApp, testSetup }) => {
    const { mainWindow, testHelpers, workspaceSetupResult } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })

    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_ADD_BUTTON).click()

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
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
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

    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
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
        const infoPath = '/ws/minimal/Prompts/TestCollection/_CollectionInfo'
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
    /** Empty template order repaired when the prompt-only sample workspace loads. */
    const initialWorkspaceCollectionEntries = (
      (await readWorkspaceCollectionOrder(electronApp, SAMPLE_WORKSPACE_PATH, 'template'))!
    ).entries

    await mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]').click()
    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_ADD_BUTTON).click()
    const createTemplateCollectionDialog = mainWindow.locator(
      '[role="dialog"][aria-label="Create Template Collection"]'
    )
    await expect(createTemplateCollectionDialog).toBeVisible()
    await expect(createTemplateCollectionDialog.getByLabel('Collection Name')).toBeVisible()
    await mainWindow.locator('[data-testid="create-prompt-collection-name-input"]').fill('Examples')
    await mainWindow.locator('[data-testid="create-prompt-collection-button"]').click()

    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Examples')
    await expect(mainWindow.locator('[data-testid="prompt-collection-title"]')).toHaveText(
      'Examples'
    )
    // The created template collection identifies its type while individual template controls stay concise.
    await expect(
      mainWindow.getByTestId('prompt-collection-subtitle')
    ).toHaveText('Prompt Templates')
    await expect(mainWindow.locator('[data-testid="prompt-collection-active-filter"]')).toHaveText(
      'Active 0'
    )
    await expect(mainWindow.locator('[data-testid="sidebar-manage-categories-button"]')).toHaveAttribute(
      'title',
      'Manage Categories'
    )
    await expect
      .poll(() => checkFileExists(electronApp, `${SAMPLE_WORKSPACE_PATH}/Templates/Examples`))
      .toBe(true)

    const collectionInfo = JSON.parse(
      await readTextFile(
        electronApp,
        `${SAMPLE_WORKSPACE_PATH}/Templates/Examples/_CollectionInfo/CollectionInfo.json`
      )
    ) as { displayName: string; collectionId: string; kind: string }
    expect(collectionInfo).toEqual({
      displayName: 'Examples',
      collectionId: expect.any(String),
      kind: 'template'
    })
    const workspaceCollectionOrder = (await readWorkspaceCollectionOrder(electronApp, SAMPLE_WORKSPACE_PATH, 'template'))!
    expect(workspaceCollectionOrder.entries).toEqual([
      { kind: 'collection', id: collectionInfo.collectionId },
      ...initialWorkspaceCollectionEntries
    ])
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${SAMPLE_WORKSPACE_PATH}/Templates/Examples/Active/_CollectionInfo/CategoryOrder.json`
        )
      )
    ).toEqual({ categories: [{ categoryId: null, entries: [] }] })
    expect(
      await checkFileExists(electronApp, `${SAMPLE_WORKSPACE_PATH}/Templates/Examples/Completed`)
    ).toBe(false)
    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ADD_ITEM).click()
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

    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    /** Actual sidebar selection provides the reference colors for the header selector. */
    const selectedCollection = mainWindow.locator(`${SIDEBAR_PROMPT_COLLECTION_DROPDOWN_ITEM}[data-selected="true"]`)
    await expect(selectedCollection).toBeVisible()
    /** Capture settled sidebar colors before moving focus to the header. */
    const selectedColors = await selectedCollection.evaluate((element) => {
      /** Computed selection colors resolve the current application palette. */
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, border: style.borderTopColor, text: style.color }
    })
    await mainWindow.keyboard.press('Escape')
    /** Active filter must share the sidebar's selected-entry colors. */
    const activeFilter = rootHeader.locator('[data-testid="prompt-collection-active-filter"]')
    await expect(activeFilter).toHaveCSS('background-color', selectedColors.background)
    await expect(activeFilter).toHaveCSS('border-top-color', selectedColors.border)
    await expect(activeFilter).toHaveCSS('color', selectedColors.text)
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
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Devel opment'
    )
    await expect
      .poll(async () => JSON.parse(await readTextFile(
        electronApp,
        `${SAMPLE_WORKSPACE_PATH}/Prompts/Development/_CollectionInfo/CollectionInfo.json`
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
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Renamed Development'
    )
    await expect(rootHeader).toContainText('Renamed Development')

    const renamedCollectionInfoPath = `${SAMPLE_WORKSPACE_PATH}/Prompts/RenamedDevelopment/_CollectionInfo/CollectionInfo.json`
    /** Descendant prompt path expected to remain authoritative after the collection rename. */
    const renamedPromptPath = `${SAMPLE_WORKSPACE_PATH}/Prompts/RenamedDevelopment/Active/Code Review.prompt.md`
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
            `${SAMPLE_WORKSPACE_PATH}/Prompts/Development/_CollectionInfo/CollectionInfo.json`
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
    await testHelpers.navigateToHomeScreen()
    await expect(mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON)).toBeVisible()
    await expect(mainWindow.locator(SIDEBAR_COLLECTION_OVERVIEW_BUTTON)).not.toHaveAttribute(
      'data-active',
      'true'
    )
  })
})
