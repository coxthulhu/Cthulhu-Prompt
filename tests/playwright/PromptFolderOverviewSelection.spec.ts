import { PromptStatus } from '@shared/domain/prompt/Prompt'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, createWorkspaceWithTemplateFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'

/** Exercises overview highlights through the real sidebar and folder screen. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Isolated workspace shared by the overview fixtures. */
const WORKSPACE_PATH = '/ws/overview-selection'

describe('Prompt folder overview selection', () => {
  test('highlights only the current status first prompt and leaves an empty status unselected', async ({ testSetup }) => {
    /** Base fixture helper puts non-final content in Active; Backlog needs its own disk layout. */
    const structure = createWorkspaceWithFolders(WORKSPACE_PATH, [{
      folderName: 'Tasks', displayName: 'Tasks', promptFolderId: 'tasks',
      prompts: [PromptStatus.Todo, PromptStatus.Backlog, PromptStatus.Completed].flatMap((status) => [
        { id: `${status}-first`, title: `${status} first`, promptText: 'First body.', status,
          finalizedAt: '2026-07-02T00:00:00.000Z' },
        { id: `${status}-second`, title: `${status} second`, promptText: 'Second body.', status,
          finalizedAt: '2026-07-01T00:00:00.000Z' }
      ])
    }])
    // Move Backlog content into its authoritative status directory before loading the workspace.
    for (const [path, content] of Object.entries(structure)) {
      if (path.endsWith('.prompt.md') && content?.includes('id: Backlog-')) {
        structure[path.replace('/Active/', '/Backlog/')] = content
        delete structure[path]
      }
    }
    // Each category-ordered workflow owns only its own prompt references.
    for (const [directory, status] of [['Active', PromptStatus.Todo], ['Backlog', PromptStatus.Backlog]] as const) {
      structure[`${WORKSPACE_PATH}/Prompts/Tasks/${directory}/_FolderInfo/FolderOrder.json`] = JSON.stringify({
        categories: [{ categoryId: null, entries: ['first', 'second'].map((suffix) => ({ kind: 'prompt', id: `${status}-${suffix}` })) }]
      })
    }
    await testSetup.setupFilesystem(structure)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Real window and workspace navigation for the populated task root. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptFolders('Tasks')

    // Each workflow must highlight its own first entry without retaining another workflow's highlight.
    for (const [mode, status] of [['active', PromptStatus.Todo], ['backlog', PromptStatus.Backlog], ['completed', PromptStatus.Completed]] as const) {
      await mainWindow.getByTestId(`prompt-folder-${mode}-filter`).click()
      await mainWindow.getByTestId('sidebar-folder-root-button').click()
      await expect(mainWindow.getByTestId(`prompt-tree-${mode}-prompt-${status}-first`)).toHaveAttribute('aria-current', 'true')
      await expect(mainWindow.locator('.sidebarPromptTree [aria-current="true"]')).toHaveCount(1)
      await expect(mainWindow.getByTestId('sidebar-folder-root-button')).not.toHaveAttribute('data-active', 'true')
      await expect.poll(() => testHelpers.getElementScrollTop('[data-testid="prompt-folder-virtual-window"]')).toBe(0)
    }
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await mainWindow.getByTestId('sidebar-folder-root-button').click()
    await expect(mainWindow.getByTestId('prompt-folder-archived-filter')).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.locator('.sidebarPromptTree [aria-current="true"]')).toHaveCount(0)
    await expect(mainWindow.getByTestId('sidebar-folder-root-button')).not.toHaveAttribute('data-active', 'true')
  })

  // Both content kinds must retain a first category highlight even when that category is empty or collapsed.
  for (const kind of ['prompt', 'template'] as const) {
    test(`highlights an empty first category in a ${kind} folder while expanded and collapsed`, async ({ testSetup }) => {
      await testSetup.setupFilesystem(kind === 'template'
        ? createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [{
            folderName: 'Content', displayName: 'Content', folderId: 'content',
            categories: [
              { categoryName: 'First', displayName: 'First', categoryId: 'first' },
              { categoryName: 'Second', displayName: 'Second', categoryId: 'second', templates: [
                { id: 'later', title: 'Later', templateText: 'Later template.' }
              ] }
            ]
          }])
        : {
            ...createWorkspaceWithFolders(WORKSPACE_PATH, [{ folderName: 'Content', displayName: 'Content', promptFolderId: 'content', prompts: [
              { id: 'later', title: 'Later', promptText: 'Later prompt.', category: 'second' }
            ] }]),
            [`${WORKSPACE_PATH}/Prompts/Content/Categories/First.category.json`]: JSON.stringify({ id: 'first', displayName: 'First', shortDescription: null, description: '' }),
            [`${WORKSPACE_PATH}/Prompts/Content/Categories/Second.category.json`]: JSON.stringify({ id: 'second', displayName: 'Second', shortDescription: null, description: '' }),
            [`${WORKSPACE_PATH}/Prompts/Content/Active/_FolderInfo/FolderOrder.json`]: JSON.stringify({ categories: [{ categoryId: null, entries: [] }, { categoryId: 'first', entries: [] }, { categoryId: 'second', entries: [{ kind: 'prompt', id: 'later' }] }] })
          })
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      /** Real window and navigation helpers for this content kind. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      if (kind === 'template') await testHelpers.navigateToPromptTemplateFolders('Content')
      else await testHelpers.navigateToPromptFolders('Content')
      /** Category toggle controls expansion independently of the row highlight. */
      const category = mainWindow.getByTestId(`prompt-tree-${kind === 'template' ? 'template' : 'active'}-category-toggle-button-First`)
      /** Category wrapper owns the visible active styling. */
      const categoryRow = mainWindow.locator('.sidebarPromptTreeRow').filter({ has: category })
      await expect(categoryRow).toHaveAttribute('data-row-state', 'active')
      await expect(mainWindow.locator('.sidebarPromptTreeRow[data-row-state="active"]')).toHaveCount(1)
      await expect(category).toHaveAttribute('aria-expanded', 'true')
      await category.click()
      await expect(category).toHaveAttribute('aria-expanded', 'false')
      await mainWindow.getByTestId('sidebar-folder-root-button').click()
      await expect(categoryRow).toHaveAttribute('data-row-state', 'active')
      await expect(mainWindow.locator('.sidebarPromptTreeRow[data-row-state="active"]')).toHaveCount(1)
      await expect(category).toHaveAttribute('aria-expanded', 'false')
      await expect(mainWindow.getByTestId('sidebar-folder-root-button')).not.toHaveAttribute('data-active', 'true')
    })
  }

  test('highlights the first template and clears the highlight in an empty template folder', async ({ testSetup }) => {
    await testSetup.setupFilesystem(createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [
      { folderName: 'Content', displayName: 'Content', folderId: 'content', templates: [
        { id: 'first', title: 'First', templateText: 'First template.' },
        { id: 'second', title: 'Second', templateText: 'Second template.' }
      ] },
      { folderName: 'Empty', displayName: 'Empty', folderId: 'empty' }
    ]))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Real window and navigation helpers for populated and empty template roots. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptTemplateFolders('Content')
    await expect(mainWindow.getByTestId('prompt-tree-template-prompt-first')).toHaveAttribute('aria-current', 'true')
    await mainWindow.getByTestId('prompt-tree-template-prompt-second').click()
    await expect(mainWindow.getByTestId('prompt-tree-template-prompt-second')).toHaveAttribute('aria-current', 'true')
    await mainWindow.getByTestId('sidebar-folder-root-button').click()
    await expect(mainWindow.getByTestId('prompt-tree-template-prompt-first')).toHaveAttribute('aria-current', 'true')
    await testHelpers.navigateToPromptTemplateFolders('Empty')
    await expect(mainWindow.locator('.sidebarPromptTree [aria-current="true"]')).toHaveCount(0)
    await expect(mainWindow.getByTestId('sidebar-folder-root-button')).not.toHaveAttribute('data-active', 'true')
  })
})
