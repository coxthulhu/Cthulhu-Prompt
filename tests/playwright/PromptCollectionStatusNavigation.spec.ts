import { createPlaywrightTestSuite, type PlaywrightTestFixtures } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { clickPromptCollectionItem } from '../helpers/PromptCollectionHelpers'
import { readWorkspaceUiState, runSqlQuery, seedUserPersistence, seedWorkspaceUiState } from '../helpers/UserPersistenceHelpers'

/** Real sidebar and startup coverage for collection-specific status navigation. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Stable fixture path shared by the task and template activities. */
const WORKSPACE_PATH = '/ws/status-navigation'
/** Stable identity for direct SQLite persistence assertions. */
const WORKSPACE_ID = 'status-navigation-workspace'
/** Status modes exercised by the task-collection sidebar. */
type Mode = 'active' | 'backlog' | 'completed' | 'archived'

/** Starts two task collections and one template collection with deliberately collapsed accordion sections. */
const startWorkspace = async (
  { electronApp, testSetup }: Pick<PlaywrightTestFixtures, 'electronApp' | 'testSetup'>,
  selectedMode: Mode = 'active'
) => {
  await testSetup.setupFilesystem({
    ...createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [{
      folderName: 'Templates', displayName: 'Templates', collectionId: 'Templates'
    }]),
    ...createWorkspaceWithCollections(WORKSPACE_PATH, ['Alpha', 'Beta'].map((id) => ({
      folderName: id, displayName: id, promptCollectionId: id
    })), { settings: { workspaceId: WORKSPACE_ID } }),
    [`${WORKSPACE_PATH}/Templates/CollectionOrder.json`]: JSON.stringify({
      entries: [{ kind: 'collection', id: 'Templates' }]
    })
  })
  await seedUserPersistence(electronApp, { lastWorkspaceInfoPath: getWorkspaceInfoPath(WORKSPACE_PATH) })
  await seedWorkspaceUiState(electronApp, {
    workspaceId: WORKSPACE_ID,
    selectedScreen: 'prompt-task-collections',
    selectedScreenData: { promptCollectionId: 'Alpha' },
    promptCollectionViewEntries: [
      {
        contentOwnerId: 'Alpha', selectedEntryId: 'collection-header', selectedMode,
        shownFinalStatusGroups: {
          completed: selectedMode === 'completed', archived: selectedMode === 'archived'
        }
      },
      {
        contentOwnerId: 'Templates', selectedEntryId: 'collection-header', selectedMode: 'active',
        shownFinalStatusGroups: {}
      }
    ],
    accordionViewEntries: [{
      persistenceId: 'sidebar-prompt-statuses',
      sections: ['active', 'backlog', 'completed', 'archived'].map((id) => ({
        id, isExpanded: false, configuredExpandedHeightPx: id === 'active' ? 400 : 200
      }))
    }]
  })
  return testSetup.setupAndStart({ workspace: { scenario: 'none' } })
}

/** Reads saved modes and visibility independently of renderer-session memory. */
const readNavigation = async (electronApp: PlaywrightTestFixtures['electronApp']) => {
  /** Collection rows written through the normal UI-state autosave path. */
  const result = await runSqlQuery(electronApp,
    `SELECT content_owner_id AS id, selected_mode AS mode, shown_final_status_groups_json AS shown
     FROM prompt_collection_view_state WHERE workspace_id = '${WORKSPACE_ID}' ORDER BY content_owner_id`)
  expect(result.success).toBe(true)
  return result.rows?.map((row) => ({ ...row, shown: JSON.parse(String(row.shown)) }))
}

describe('Prompt collection status navigation', () => {
  // Startup must restore every nondefault mode without inventing a previous session visit.
  for (const mode of ['backlog', 'completed', 'archived'] as const) {
    test(`restores ${mode} at startup and expands its saved collapsed section`, async ({ electronApp, testSetup }) => {
      /** Renderer launched from persisted navigation with no in-memory return history. */
      const { mainWindow } = await startWorkspace({ electronApp, testSetup }, mode)
      await expect(mainWindow.getByTestId(`prompt-collection-${mode}-filter`)).toHaveAttribute('aria-pressed', 'true')
      await expect(mainWindow.getByTestId(`sidebar-prompt-status-accordion-header-${mode}`)).toHaveAttribute('aria-expanded', 'true')
      await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-active')).toHaveAttribute('aria-expanded', 'false')
      await expect(mainWindow.getByTestId(`sidebar-prompt-status-accordion-section-${mode === 'archived' ? 'completed' : 'archived'}`)).toHaveCount(0)
      await expect.poll(async () => (await readWorkspaceUiState(electronApp, WORKSPACE_ID))
        .accordionViewEntries[0]?.sections.find((section) => section.id === mode))
        .toEqual({ id: mode, isExpanded: true, configuredExpandedHeightPx: 200 })

      if (mode !== 'backlog') {
        await mainWindow.getByTestId(`toggle-${mode}-prompts-button`).click()
        await expect(mainWindow.getByTestId('prompt-collection-active-filter')).toHaveAttribute('aria-pressed', 'true')
        await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-active')).toHaveAttribute('aria-expanded', 'true')
      }
    })
  }

  test('returns through visible history independently for each root and leaves unselected closures in place', async ({ electronApp, testSetup }) => {
    /** Empty task collections keep navigation controls available throughout the history sequence. */
    const { mainWindow } = await startWorkspace({ electronApp, testSetup })
    await mainWindow.getByTestId('prompt-collection-backlog-filter').click()
    await mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog').click()
    await mainWindow.getByTestId('toggle-completed-prompts-button').click()
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await mainWindow.getByTestId('toggle-completed-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-archived-filter')).toHaveAttribute('aria-pressed', 'true')
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-backlog-filter')).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog')).toHaveAttribute('aria-expanded', 'true')

    await mainWindow.getByTestId('toggle-completed-prompts-button').click()
    await mainWindow.getByTestId('sidebar-prompt-status-accordion-header-completed').click()
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-completed-filter')).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-completed')).toHaveAttribute('aria-expanded', 'true')
    await mainWindow.getByTestId('sidebar-prompt-status-accordion-header-completed').click()

    await clickPromptCollectionItem(mainWindow, 'Beta')
    await expect(mainWindow.getByTestId('prompt-collection-active-filter')).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-section-completed')).toHaveCount(0)
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-active-filter')).toHaveAttribute('aria-pressed', 'true')
    await clickPromptCollectionItem(mainWindow, 'Alpha')
    await expect(mainWindow.getByTestId('prompt-collection-completed-filter')).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-completed')).toHaveAttribute('aria-expanded', 'true')
    await mainWindow.getByTestId('toggle-completed-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-backlog-filter')).toHaveAttribute('aria-pressed', 'true')
  })

  test('persists independent roots across other activities and a fresh renderer session', async ({ electronApp, testSetup }) => {
    /** Task and template collections share persistence plumbing while retaining separate navigation. */
    const { mainWindow, testHelpers } = await startWorkspace({ electronApp, testSetup })
    await mainWindow.getByTestId('toggle-completed-prompts-button').click()
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await clickPromptCollectionItem(mainWindow, 'Beta')
    await mainWindow.getByTestId('toggle-completed-prompts-button').click()
    await mainWindow.getByTestId('prompt-collection-backlog-filter').click()
    await testHelpers.navigateToPromptTemplateCollections('Templates')
    await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Active')
    await testHelpers.navigateToPromptCollections('Beta')
    await expect(mainWindow.getByTestId('prompt-collection-backlog-filter')).toHaveAttribute('aria-pressed', 'true')

    for (const activity of ['home', 'settings'] as const) {
      await mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog').click()
      await mainWindow.getByTestId(`nav-button-${activity}`).click()
      await mainWindow.getByTestId('nav-button-prompt-task-collections').click()
      await expect(mainWindow.getByTestId('prompt-collection-backlog-filter')).toHaveAttribute('aria-pressed', 'true')
      await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-header-backlog')).toHaveAttribute('aria-expanded', 'true')
    }
    await expect.poll(() => readNavigation(electronApp)).toEqual([
      { id: 'Alpha', mode: 'archived', shown: { completed: true, archived: true } },
      { id: 'Beta', mode: 'backlog', shown: { completed: true } },
      { id: 'Templates', mode: 'active', shown: {} }
    ])
    await testHelpers.navigateToHomeScreen()
    await expect.poll(async () => (await readWorkspaceUiState(electronApp, WORKSPACE_ID)).selectedScreen).toBe('home')
    await mainWindow.reload()
    await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
    await mainWindow.getByTestId('nav-button-prompt-task-collections').click()
    await expect(mainWindow.getByTestId('prompt-collection-backlog-filter')).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-section-completed')).toBeVisible()
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-section-archived')).toHaveCount(0)
    await clickPromptCollectionItem(mainWindow, 'Alpha')
    await expect(mainWindow.getByTestId('prompt-collection-archived-filter')).toHaveAttribute('aria-pressed', 'true')
    await expect(mainWindow.getByTestId('sidebar-prompt-status-accordion-section-completed')).toBeVisible()
    // Persisted visibility does not count as a visit in the new session's return history.
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-active-filter')).toHaveAttribute('aria-pressed', 'true')
    await testHelpers.navigateToPromptTemplateCollections('Templates')
    await expect(mainWindow.getByTestId('prompt-collection-header-section')).toHaveText('Active')
  })
})
