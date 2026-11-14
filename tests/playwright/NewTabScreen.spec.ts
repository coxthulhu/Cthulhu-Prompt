import type { ElectronApplication, Page } from 'playwright'
import { createDeterministicId } from '../fixtures/FixtureIds'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import { promptCollectionSelectorTriggerSelector } from '../helpers/PromptCollectionSelectors'
import { seedWorkspaceState } from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

/** Workspace whose two projects fill the New Tab screen. */
const workspacePath = '/ws/new-tab'
/** Identity owning the seeded project and collection orders. */
const workspaceId = createDeterministicId(workspacePath)
/** Default project holding two task collections and a template collection. */
const defaultProjectId = createDeterministicId(`${workspacePath}:DefaultProject`)
/** Second project holding one collection of each kind. */
const harborProjectId = 'harbor'

/** Moves a fixture's default-project files into another project's directory. */
const moveToProject = (files: Record<string, string | null>, folderName: string): Record<string, string | null> =>
  Object.fromEntries(Object.entries(files)
    .filter(([file]) => file.startsWith(`${workspacePath}/DefaultProject/`))
    .map(([file, bytes]) => [file.replace('/DefaultProject/', `/${folderName}/`), bytes]))

/** Both projects' collections, with prompt and template counts that tell the tiles apart. */
const workspaceFiles = {
  ...createWorkspaceWithCollections(workspacePath, [
    {
      folderName: 'BugTriage', displayName: 'Bug Triage', promptCollectionId: 'bug-triage',
      prompts: [
        { id: 'bug-1', title: 'Crash Report', promptText: 'Investigate the crash.' },
        { id: 'bug-2', title: 'Flaky Test', promptText: 'Stabilize the test.' }
      ]
    },
    {
      folderName: 'FeatureWork', displayName: 'Feature Work', promptCollectionId: 'feature-work',
      prompts: [{ id: 'feature-1', title: 'Search Bar', promptText: 'Add a search bar.' }]
    }
  ]),
  ...createWorkspaceWithTemplateCollections(workspacePath, [{
    folderName: 'CodeReview', displayName: 'Code Review', collectionId: 'code-review',
    templates: [{ id: 'review-1', title: 'Review', templateText: 'Review [[PROMPT_TEXT]]' }]
  }]),
  ...moveToProject(createWorkspaceWithCollections(workspacePath, [{
    folderName: 'EndpointTests', displayName: 'Endpoint Tests', promptCollectionId: 'endpoint-tests',
    prompts: [{ id: 'endpoint-1', title: 'Auth Endpoint', promptText: 'Test the auth endpoint.' }]
  }]), 'HarborApi'),
  ...moveToProject(createWorkspaceWithTemplateCollections(workspacePath, [{
    folderName: 'ReleaseNotes', displayName: 'Release Notes', collectionId: 'release-notes',
    templates: [
      { id: 'notes-1', title: 'Notes', templateText: 'Notes [[PROMPT_TEXT]]' },
      { id: 'notes-2', title: 'Summary', templateText: 'Summary [[PROMPT_TEXT]]' }
    ]
  }]), 'HarborApi'),
  [`${workspacePath}/HarborApi/ProjectInfo.json`]: JSON.stringify({ id: harborProjectId, name: 'Harbor API', abbreviation: 'HA' })
}

/** Tile text for each fixture collection: name, then its count. */
const tileText = {
  bugTriage: /Bug Triage\s*2 prompts/,
  featureWork: /Feature Work\s*1 prompt(?!s)/,
  codeReview: /Code Review\s*1 template(?!s)/,
  endpointTests: /Endpoint Tests\s*1 prompt(?!s)/,
  releaseNotes: /Release Notes\s*2 templates/
}

/** Project sections in display order. */
const getSections = (page: Page) => page.getByTestId('new-tab-screen').locator('section')

/** Collection tiles of one project section. */
const getTiles = (page: Page, projectId: string) =>
  page.getByTestId(`new-tab-project-${projectId}`).locator('[data-testid^="new-tab-collection-"]')

/** Asserts the project sections shown, by name, in display order. */
const expectSectionNames = async (page: Page, names: string[]): Promise<void> => {
  await expect.poll(() => getSections(page).evaluateAll((sections) => sections.map((section) => section.getAttribute('aria-label'))))
    .toEqual(names)
}

/** Manage Projects dialog opened from the New Tab screen. */
const projectDialog = (page: Page) => page.getByRole('dialog', { name: 'Manage Projects' })

/** Opens the two-project workspace, with Harbor API first and a reordered default project, on a New Tab. */
const openNewTab = async (electronApp: ElectronApplication, testSetup: TestSetup): Promise<Page> => {
  await seedWorkspaceState(electronApp, workspaceId, 'project-order', null, { ids: [harborProjectId, defaultProjectId] })
  await seedWorkspaceState(electronApp, workspaceId, 'collection-order', defaultProjectId, {
    entries: ['code-review', 'feature-work', 'bug-triage'].map((id) => ({ kind: 'collection', id }))
  })
  await testSetup.setupFilesystem(workspaceFiles)
  await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
  const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await testHelpers.setupWorkspaceViaUI()
  await mainWindow.getByTestId('new-tab-button').click()
  await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
  return mainWindow
}

describe('New Tab Screen', () => {
  test('lists projects in activity bar order with their collections in Show All order', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)

    // The workspace name heads the screen, above the search bar, New Project button, and reorder hint.
    await expect(mainWindow.getByTestId('new-tab-workspace-title')).toHaveText('new-tab')
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveAttribute('placeholder', 'Search projects and collections')
    await expect(mainWindow.getByTestId('new-tab-new-project-button')).toHaveText('New Project')
    await expect(mainWindow.getByText('Drag to reorder projects and collections')).toBeVisible()

    // Projects follow the activity bar, and each one's collections follow its Show All order with kind icons and counts.
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['HA', 'DE'])
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project'])
    await expect(getTiles(mainWindow, harborProjectId)).toHaveText([tileText.endpointTests, tileText.releaseNotes])
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveText([tileText.codeReview, tileText.featureWork, tileText.bugTriage])
    await expect(getTiles(mainWindow, defaultProjectId).locator('svg')).toContainClass([
      'lucide-layers', 'lucide-file-text', 'lucide-file-text'
    ])

    // Clicking a tile, or pressing a project title's drag handle, leaves the New Tab screen as it is.
    await mainWindow.getByTestId('new-tab-collection-bug-triage').click()
    await mainWindow.getByTestId(`new-tab-project-title-${harborProjectId}`).click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveAttribute('aria-selected', 'true')

    // The default project's Show All dropdown lists the same collections in the same order.
    await mainWindow.getByRole('button', { name: 'Default Project', exact: true }).click()
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    await expect(mainWindow.locator('[data-dropdown-section="all"] [role="menuitem"]'))
      .toHaveText([tileText.codeReview, tileText.featureWork, tileText.bugTriage])
  })

  test('filters projects and collections by case-insensitive name matches', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    const search = mainWindow.getByTestId('new-tab-search-input')
    const noResults = mainWindow.getByTestId('new-tab-no-results')

    // A matching project name keeps every collection in that project and hides the other project.
    await search.fill('hArBoR')
    await expectSectionNames(mainWindow, ['Harbor API'])
    await expect(getTiles(mainWindow, harborProjectId)).toHaveText([tileText.endpointTests, tileText.releaseNotes])

    // Otherwise only matching collections show, in their projects' order, and projects without matches hide.
    await search.fill('RE')
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project'])
    await expect(getTiles(mainWindow, harborProjectId)).toHaveText([tileText.releaseNotes])
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveText([tileText.codeReview, tileText.featureWork])
    // Surrounding spaces are ignored.
    await search.fill(' triage ')
    await expectSectionNames(mainWindow, ['Default Project'])
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveText([tileText.bugTriage])
    await expect(noResults).toHaveCount(0)

    // Nothing matching shows the empty-search message instead of any project.
    await search.fill('zzz')
    await expectSectionNames(mainWindow, [])
    await expect(noResults).toHaveText('No projects or collections match your search.')

    // Clearing the search shows everything again.
    await search.fill('')
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project'])
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveCount(3)
    await expect(noResults).toHaveCount(0)
  })

  test('creates and edits projects in Manage Projects without leaving the New Tab screen', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    const dialog = projectDialog(mainWindow)

    // New Project opens Manage Projects to a focused new draft after the existing projects.
    await mainWindow.getByTestId('new-tab-new-project-button').click()
    await expect(dialog.getByTestId('manage-project-name-input')).toBeFocused()
    await expect(dialog.locator('[data-testid^="manage-project-selector-"]'))
      .toHaveText([/Harbor API/, /Default Project/, /New Project/])
    await dialog.getByTestId('manage-project-name-input').fill('Lantern Mobile')
    await dialog.getByTestId('manage-project-abbreviation-input').fill('LM')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)

    // Saving keeps the New Tab screen and its tab selected, and appends the project with its starter collections.
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveAttribute('aria-selected', 'true')
    await expect(mainWindow.getByTestId('nav-button-project')).toHaveText(['HA', 'DE', 'LM'])
    await expect(mainWindow.locator('[data-testid="nav-button-project"][aria-current="page"]')).toHaveCount(0)
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project', 'Lantern Mobile'])
    await expect(getSections(mainWindow).nth(2).locator('[data-testid^="new-tab-collection-"]'))
      .toHaveText([/My Prompts\s*0 prompts/, /My Templates\s*0 templates/])

    // Edit Project opens Manage Projects to that project, and a rename shows on the New Tab screen.
    await mainWindow.getByTestId(`new-tab-edit-project-${harborProjectId}`).click()
    await expect(dialog.getByTestId(`manage-project-selector-${harborProjectId}`)).toHaveAttribute('aria-pressed', 'true')
    await dialog.getByTestId('manage-project-name-input').fill('Harbor Web')
    await dialog.getByTestId('manage-projects-save-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expectSectionNames(mainWindow, ['Harbor Web', 'Default Project', 'Lantern Mobile'])
    await expect(mainWindow.getByTestId(`new-tab-project-title-${harborProjectId}`)).toHaveText('Harbor Web')
  })

  test('creates task and template collections in a project from its New Collection menu', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    const menu = mainWindow.getByTestId('new-tab-new-collection-menu')
    const nameInput = mainWindow.getByTestId('create-prompt-collection-name-input')
    const createButton = mainWindow.getByTestId('create-prompt-collection-button')

    // The menu offers both kinds under the creation dialogs' names.
    await mainWindow.getByTestId(`new-tab-new-collection-${harborProjectId}`).click()
    await expect(menu.getByRole('menuitem')).toHaveText(['Create Task Collection', 'Create Template Collection'])

    // A task collection may reuse another project's task collection name.
    await mainWindow.getByTestId('new-tab-create-task-collection-item').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Create Task Collection' })).toBeVisible()
    await nameInput.fill('Bug Triage')
    await createButton.click()
    await expect(mainWindow.getByRole('dialog', { name: 'Create Task Collection' })).toHaveCount(0)

    // A template collection's name must be unique among this project's template collections.
    await mainWindow.getByTestId(`new-tab-new-collection-${harborProjectId}`).click()
    await mainWindow.getByTestId('new-tab-create-template-collection-item').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Create Template Collection' })).toBeVisible()
    await nameInput.fill('Release Notes')
    await expect(createButton).toBeDisabled()
    await nameInput.fill('Changelog')
    await createButton.click()
    await expect(mainWindow.getByRole('dialog', { name: 'Create Template Collection' })).toHaveCount(0)

    // Both new collections show in that project only, with their kind icons, and the New Tab screen stays.
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    /** Harbor API's tiles, created ones included. */
    const harborTiles = getTiles(mainWindow, harborProjectId)
    await expect(harborTiles).toHaveCount(4)
    await expect(harborTiles.filter({ hasText: 'Bug Triage' }).locator('svg.lucide-file-text')).toHaveCount(1)
    await expect(harborTiles.filter({ hasText: 'Changelog' }).locator('svg.lucide-layers')).toHaveCount(1)
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveCount(3)
  })
})
