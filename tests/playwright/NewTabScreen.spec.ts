import type { ElectronApplication, Page } from 'playwright'
import { createDeterministicId } from '../fixtures/FixtureIds'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite, type TestSetup } from '../helpers/PlaywrightTestFramework'
import { resolvePaletteColor } from '../helpers/PaletteHelpers'
import { beginDragFromLocator, dragGhostSelector, finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'
import { collectionTileSelector } from '../helpers/PromptCollectionSelectors'
import { readWorkspaceState, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'

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
  routines: /My Routines\s*0 routines/,
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

/** Card after one project section's tiles counting the collections a search hides. */
const getHiddenCollections = (page: Page, projectId: string) =>
  page.getByTestId(`new-tab-project-${projectId}`).getByTestId('new-tab-hidden-collections')

/** Asserts the project sections shown, by name, in display order. */
const expectSectionNames = async (page: Page, names: string[]): Promise<void> => {
  await expect.poll(() => getSections(page).evaluateAll((sections) => sections.map((section) => section.getAttribute('aria-label'))))
    .toEqual(names)
}

/** Manage Projects dialog opened from the New Tab screen. */
const projectDialog = (page: Page) => page.getByRole('dialog', { name: 'Manage Projects' })

/** Opens the two-project workspace, with Harbor API first and a reordered default project, on a New Tab; extra files
 *  add projects after those two. */
const openNewTab = async (
  electronApp: ElectronApplication,
  testSetup: TestSetup,
  extraFiles: Record<string, string | null> = {}
): Promise<Page> => {
  await seedWorkspaceState(electronApp, workspaceId, 'project-order', null, { ids: [harborProjectId, defaultProjectId] })
  await seedWorkspaceState(electronApp, workspaceId, 'collection-order', defaultProjectId, {
    entries: ['code-review', 'feature-work', 'bug-triage'].map((id) => ({ kind: 'collection', id }))
  })
  await testSetup.setupFilesystem({ ...workspaceFiles, ...extraFiles })
  testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(workspacePath))
  const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await testHelpers.setupWorkspaceViaUI()
  await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
  return mainWindow
}

/** Third project, appended after the seeded two, whose middle collection is hidden by a "release" search. */
const lanternProjectId = 'lantern'
/** Lantern Mobile's three task collections. */
const lanternCollections = [
  { folderName: 'ReleaseChecklist', displayName: 'Release Checklist', promptCollectionId: 'release-checklist' },
  { folderName: 'OfflineSync', displayName: 'Offline Sync', promptCollectionId: 'offline-sync' },
  { folderName: 'ReleaseBuilds', displayName: 'Release Builds', promptCollectionId: 'release-builds' }
]
/** Lantern Mobile's files holding the given task collections. */
const createLanternFiles = (collections: typeof lanternCollections): Record<string, string | null> => ({
  ...moveToProject(createWorkspaceWithCollections(workspacePath, collections), 'LanternMobile'),
  [`${workspacePath}/LanternMobile/ProjectInfo.json`]: JSON.stringify({ id: lanternProjectId, name: 'Lantern Mobile', abbreviation: 'LM' })
})

/** Starts a real pointer drag on a project title or collection tile. */
const beginPointerDrag = async (page: Page, testId: string): Promise<void> =>
  await beginDragFromLocator(page, page.getByTestId(testId), `Missing drag geometry for ${testId}`)


/** Move Here indicator marking a dragged project's drop boundary. */
const getProjectDropIndicator = (page: Page) => page.getByTestId('new-tab-project-drop-indicator')

/** Vertical line marking a dragged tile's drop boundary. */
const getTileDropIndicator = (page: Page) => page.getByTestId('new-tab-tile-drop-indicator')

/** Asserts the Move Here indicator sits inside one project's section, centered 11px above or below it, in blue with its
 *  label or as one gray bar. */
const expectProjectDropIndicator = async (page: Page, projectId: string, side: 'above' | 'below', blocked: boolean): Promise<void> => {
  /** Section the indicator belongs to. */
  const section = page.getByTestId(`new-tab-project-${projectId}`)
  const indicator = section.getByTestId('new-tab-project-drop-indicator')
  await expect(indicator).toBeVisible()
  if (blocked) await expect(indicator).not.toContainText('Move Here')
  else await expect(indicator).toHaveText('Move Here')
  await expect(indicator.locator('.cthulhuUiSeparator').first()).toHaveCSS('background-color',
    await resolvePaletteColor(page.locator('body'), blocked ? '--ui-muted-icon-glyph' : '--ui-info-strong-border'))
  // The overlay centers in the middle of the 22px gap beside the section.
  const sectionBox = (await section.boundingBox())!
  const indicatorBox = (await indicator.boundingBox())!
  /** Middle of the gap the indicator marks. */
  const expectedCenterY = side === 'above' ? sectionBox.y - 11 : sectionBox.y + sectionBox.height + 11
  expect(Math.abs(indicatorBox.y + indicatorBox.height / 2 - expectedCenterY)).toBeLessThanOrEqual(1)
}

/** Asserts the only tile drop line sits on one side of one tile's grid cell, centered in the 8px gap and spanning the
 *  cell's height less its 2px bottom inset, in blue or gray. */
const expectTileDropIndicator = async (page: Page, collectionId: string, side: 'left' | 'right', blocked: boolean): Promise<void> => {
  const indicator = getTileDropIndicator(page)
  /** Grid cell holding the tile, the line on its left, and for the last tile, the line after it. */
  const cell = page.locator(collectionTileSelector(collectionId)).locator('..')
  await expect(indicator).toHaveCount(1)
  await expect(cell.getByTestId('new-tab-tile-drop-indicator')).toHaveCount(1)
  await expect(indicator.locator('line')).toHaveCSS('stroke',
    await resolvePaletteColor(page.locator('body'), blocked ? '--ui-muted-icon-glyph' : '--ui-info-strong-border'))
  const cellBox = (await cell.boundingBox())!
  const indicatorBox = (await indicator.boundingBox())!
  /** Middle of the 8px gap beside the cell. */
  const expectedCenterX = side === 'left' ? cellBox.x - 4 : cellBox.x + cellBox.width + 4
  expect(Math.abs(indicatorBox.x + indicatorBox.width / 2 - expectedCenterX)).toBeLessThanOrEqual(1)
  expect(Math.abs(indicatorBox.y - cellBox.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(indicatorBox.y + indicatorBox.height - (cellBox.y + cellBox.height - 2))).toBeLessThanOrEqual(1)
}

/** Moves an active drag below the last project section at the screen's left edge, outside the centered content column. */
const moveActiveDragBelowProjects = async (page: Page): Promise<void> => {
  const screenBox = (await page.getByTestId('new-tab-screen').boundingBox())!
  const lastSectionBox = (await getSections(page).last().boundingBox())!
  await page.mouse.move(screenBox.x + 4, lastSectionBox.y + lastSectionBox.height + 10, { steps: 12 })
}

/** Reads one project's saved collection order as collection IDs. */
const readCollectionOrder = async (electronApp: ElectronApplication, projectId: string): Promise<string[] | undefined> =>
  (await readWorkspaceState<{ entries: { id: string }[] }>(electronApp, workspaceId, 'collection-order', projectId))
    ?.entries.map((entry) => entry.id)

/** Reads the saved project order. */
const readProjectOrder = async (electronApp: ElectronApplication): Promise<string[] | undefined> =>
  (await readWorkspaceState<{ ids: string[] }>(electronApp, workspaceId, 'project-order', null))?.ids

describe('New Tab Screen', () => {
  test('lists projects in workspace order with their collections in Show All order', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)

    // The workspace name heads the screen, above the search bar, New Project button, and reorder hint.
    await expect(mainWindow.getByTestId('new-tab-workspace-title')).toHaveText('new-tab')
    await expect(mainWindow.getByTestId('new-tab-search-input')).toHaveAttribute('placeholder', 'Search projects and collections')
    await expect(mainWindow.getByTestId('new-tab-new-project-button')).toHaveText('New Project')
    await expect(mainWindow.getByText('Drag to reorder projects and collections')).toBeVisible()

    // Projects follow the workspace, and each one's collections follow its Show All order with kind icons and counts.
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project'])
    await expect(getTiles(mainWindow, harborProjectId)).toHaveText([tileText.endpointTests, tileText.releaseNotes, tileText.routines])
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveText([tileText.codeReview, tileText.featureWork, tileText.bugTriage, tileText.routines])
    await expect(getTiles(mainWindow, defaultProjectId).locator('svg')).toContainClass([
      'lucide-layers', 'lucide-file-text', 'lucide-file-text', 'lucide-repeat'
    ])

    // Pressing a project title's drag handle leaves the New Tab screen as it is.
    await mainWindow.getByTestId(`new-tab-project-title-${harborProjectId}`).click()
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveAttribute('aria-selected', 'true')


  })

  test('filters projects and collections by case-insensitive name matches', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    const search = mainWindow.getByTestId('new-tab-search-input')
    const noResults = mainWindow.getByTestId('new-tab-no-results')

    // A matching project name keeps every collection in that project and hides the other project.
    await search.fill('hArBoR')
    await expectSectionNames(mainWindow, ['Harbor API'])
    await expect(getTiles(mainWindow, harborProjectId)).toHaveText([tileText.endpointTests, tileText.releaseNotes, tileText.routines])

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
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveCount(4)
    await expect(noResults).toHaveCount(0)
  })

  test('counts the collections and projects a search hides after the visible ones', async ({ electronApp, testSetup }) => {
    await seedWorkspaceState(electronApp, workspaceId, 'collection-order', lanternProjectId, {
      entries: ['release-checklist', 'offline-sync', 'release-builds', 'crash-reports'].map((id) => ({ kind: 'collection', id }))
    })
    const mainWindow = await openNewTab(electronApp, testSetup, createLanternFiles([
      ...lanternCollections,
      { folderName: 'CrashReports', displayName: 'Crash Reports', promptCollectionId: 'crash-reports' }
    ]))
    const search = mainWindow.getByTestId('new-tab-search-input')
    /** Label after the last project section counting the projects a search hides. */
    const hiddenProjects = mainWindow.getByTestId('new-tab-hidden-projects')
    /** Every project's hidden-collections card. */
    const hiddenCollectionCards = mainWindow.getByTestId('new-tab-hidden-collections')

    // Without a search nothing is hidden or counted.
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project', 'Lantern Mobile'])
    await expect(hiddenCollectionCards).toHaveCount(0)
    await expect(hiddenProjects).toHaveCount(0)

    // A matching project name keeps every collection without a card, and the hidden projects are counted in a label
    // 22px below the last section.
    await search.fill('hArBoR')
    await expectSectionNames(mainWindow, ['Harbor API'])
    await expect(hiddenCollectionCards).toHaveCount(0)
    await expect(hiddenProjects).toHaveText('2 Projects Hidden')
    const harborSectionBox = (await mainWindow.getByTestId(`new-tab-project-${harborProjectId}`).boundingBox())!
    const hiddenProjectsBox = (await hiddenProjects.boundingBox())!
    expect(Math.abs(hiddenProjectsBox.y - (harborSectionBox.y + harborSectionBox.height + 22))).toBeLessThanOrEqual(1)

    // Projects showing only matching collections end their grids with a card counting the rest, in the cell after the
    // last tile at a tile's height, with a hidden icon and muted text and border.
    await search.fill('release')
    await expectSectionNames(mainWindow, ['Harbor API', 'Lantern Mobile'])
    await expect(getTiles(mainWindow, lanternProjectId)).toHaveText([/Release Checklist/, /Release Builds/])
    await expect(getHiddenCollections(mainWindow, harborProjectId)).toHaveText('2 Collections Hidden')
    /** Lantern Mobile's hidden-collections card. */
    const lanternHiddenCard = getHiddenCollections(mainWindow, lanternProjectId)
    await expect(lanternHiddenCard).toHaveText('3 Collections Hidden')
    await expect(lanternHiddenCard.locator('svg')).toContainClass('lucide-eye-off')
    await expect(lanternHiddenCard).toHaveCSS('color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-muted-text'))
    await expect(lanternHiddenCard).toHaveCSS('border-top-style', 'dashed')
    await expect(lanternHiddenCard).toHaveCSS('border-top-color',
      await resolvePaletteColor(mainWindow.locator('body'), '--ui-neutral-muted-border'))
    const checklistBox = (await mainWindow.getByTestId('new-tab-collection-release-checklist').boundingBox())!
    const buildsBox = (await mainWindow.getByTestId('new-tab-collection-release-builds').boundingBox())!
    const inRowCardBox = (await lanternHiddenCard.boundingBox())!
    expect(Math.abs(inRowCardBox.x - (buildsBox.x + (buildsBox.x - checklistBox.x)))).toBeLessThanOrEqual(1)
    expect(Math.abs(inRowCardBox.y - buildsBox.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(inRowCardBox.width - buildsBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(inRowCardBox.height - buildsBox.height)).toBeLessThanOrEqual(1)
    // The one fully hidden project is counted in the singular.
    await expect(hiddenProjects).toHaveText('1 Project Hidden')

    // After a full row of tiles the card starts the next row, still at a tile's height, and no label shows while every
    // project is visible.
    await search.fill('RE')
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project', 'Lantern Mobile'])
    await expect(getTiles(mainWindow, lanternProjectId)).toHaveText([/Release Checklist/, /Release Builds/, /Crash Reports/])
    await expect(hiddenCollectionCards).toHaveText(['2 Collections Hidden', '2 Collections Hidden', '2 Collections Hidden'])
    const firstRowBox = (await mainWindow.getByTestId('new-tab-collection-release-checklist').boundingBox())!
    const nextRowCardBox = (await lanternHiddenCard.boundingBox())!
    expect(Math.abs(nextRowCardBox.x - firstRowBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(nextRowCardBox.y - (firstRowBox.y + firstRowBox.height + 8))).toBeLessThanOrEqual(1)
    expect(Math.abs(nextRowCardBox.width - firstRowBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(nextRowCardBox.height - firstRowBox.height)).toBeLessThanOrEqual(1)
    await expect(hiddenProjects).toHaveCount(0)

    // Hiding every project shows only the empty-search message, without a label.
    await search.fill('zzz')
    await expectSectionNames(mainWindow, [])
    await expect(mainWindow.getByTestId('new-tab-no-results')).toBeVisible()
    await expect(hiddenProjects).toHaveCount(0)
  })

  test('creates and edits projects in Manage Projects without leaving the New Tab screen', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    const dialog = projectDialog(mainWindow)

    // Closing an untouched New Project draft skips the discard confirmation.
    await mainWindow.getByTestId('new-tab-new-project-button').click()
    await dialog.getByTestId('manage-projects-close-button').click()
    await expect(dialog).toHaveCount(0)
    await expect(mainWindow.getByRole('dialog', { name: 'Discard Changes' })).toHaveCount(0)

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
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project', 'Lantern Mobile'])
    await expect(getSections(mainWindow).nth(2).locator('[data-testid^="new-tab-collection-"]'))
      .toHaveText([/My Prompts\s*0 prompts/, /My Templates\s*0 templates/, tileText.routines])

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

  test('creates task, template, and routine collections in a project from its New Collection dialog type picker', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    /** Creation dialog opened by each project's New Collection button. */
    const dialog = mainWindow.getByRole('dialog', { name: 'Create Collection' })
    const taskOption = dialog.getByTestId('create-prompt-collection-type-prompt')
    /** Third card creates a routine collection in this project. */
    const routineOption = dialog.getByTestId('create-prompt-collection-type-routine')
    const templateOption = dialog.getByTestId('create-prompt-collection-type-template')
    const nameInput = dialog.getByTestId('create-prompt-collection-name-input')
    const createButton = dialog.getByTestId('create-prompt-collection-button')
    const nameError = dialog.getByTestId('create-prompt-collection-name-error')

    // The focused name field comes first, and the type picker below it shows the Task and Template cards side by side
    // at equal sizes across the field, each listing its bullets under its label. Task is selected with an accent border
    // and an accent fill on its header row only, leaving the bullet body clear.
    await mainWindow.getByTestId(`new-tab-new-collection-${harborProjectId}`).click()
    await expect(dialog.getByTestId('create-prompt-collection-type-selector').getByRole('button')).toHaveText([
      /Task Collection\s*Describes one piece of work.*Apply a template to guide the work/,
      /Template Collection\s*Wraps a task when applied to it.*Sets response rules, like "be concise"/,
      /Routine Collection\s*Save work you do repeatedly/
    ])
    const typeFieldBox = (await dialog.getByTestId('create-prompt-collection-type-field').boundingBox())!
    const nameFieldBox = (await dialog.getByTestId('prompt-collection-name-field').boundingBox())!
    expect(nameFieldBox.y + nameFieldBox.height).toBeLessThanOrEqual(typeFieldBox.y)
    const taskBox = (await taskOption.boundingBox())!
    const templateBox = (await templateOption.boundingBox())!
    expect(Math.abs(taskBox.x - typeFieldBox.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(templateBox.x - (taskBox.x + taskBox.width + 12))).toBeLessThanOrEqual(1)
    /** The third card completes the row at the right edge of the field. */
    const routineBox = (await routineOption.boundingBox())!
    expect(Math.abs(routineBox.x - (templateBox.x + templateBox.width + 12))).toBeLessThanOrEqual(1)
    expect(Math.abs(routineBox.width - templateBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(routineBox.x + routineBox.width - (typeFieldBox.x + typeFieldBox.width))).toBeLessThanOrEqual(1)
    expect(Math.abs(templateBox.width - taskBox.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(templateBox.y - taskBox.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(templateBox.height - taskBox.height)).toBeLessThanOrEqual(1)
    await expect(taskOption).toHaveAttribute('aria-pressed', 'true')
    await expect(templateOption).toHaveAttribute('aria-pressed', 'false')
    await expect(taskOption).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(taskOption).toHaveCSS('border-top-color',
      await resolvePaletteColor(mainWindow.locator('body'), '--ui-accent-normal-border'))
    await expect(taskOption.locator('.cthulhuUiOptionCardSelectorHeader')).toHaveCSS('background-color',
      await resolvePaletteColor(mainWindow.locator('body'), '--ui-accent-action-fill'))
    await expect(nameInput).toBeFocused()

    // The existing template reserves its name for both types, including case and whitespace variants.
    await templateOption.click()
    await expect(templateOption).toHaveAttribute('aria-pressed', 'true')
    await expect(taskOption).toHaveAttribute('aria-pressed', 'false')
    await nameInput.fill('releaseNOTES')
    await expect(nameError).toHaveText('A collection with this name already exists')
    await expect(createButton).toBeDisabled()
    await taskOption.click()
    await expect(nameError).toHaveText('A collection with this name already exists')
    await expect(createButton).toBeDisabled()
    await templateOption.click()
    await nameInput.fill('Endpoint Tests')
    await expect(nameError).toHaveText('A collection with this name already exists')
    await expect(createButton).toBeDisabled()
    await nameInput.fill('Changelog')
    await createButton.click()
    await expect(dialog).toHaveCount(0)

    // Reopening selects Task again, and a task collection may reuse another project's task collection name.
    await mainWindow.getByTestId(`new-tab-new-collection-${harborProjectId}`).click()
    await expect(taskOption).toHaveAttribute('aria-pressed', 'true')
    await nameInput.fill('Bug Triage')
    await createButton.click()
    await expect(dialog).toHaveCount(0)

    await mainWindow.getByTestId(`new-tab-new-collection-${harborProjectId}`).click()
    await routineOption.click()
    await nameInput.fill('Release Checks')
    await createButton.click()
    await expect(dialog).toHaveCount(0)

    // The new collections show in that project only, with their kind icons, and the New Tab screen stays.
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    /** Harbor API's tiles, created ones included. */
    const harborTiles = getTiles(mainWindow, harborProjectId)
    await expect(harborTiles).toHaveCount(6)
    await expect(harborTiles.filter({ hasText: 'Release Checks' }).locator('svg.lucide-repeat')).toHaveCount(1)
    await expect(harborTiles.filter({ hasText: 'Bug Triage' }).locator('svg.lucide-file-text')).toHaveCount(1)
    await expect(harborTiles.filter({ hasText: 'Changelog' }).locator('svg.lucide-layers')).toHaveCount(1)
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveCount(4)
  })

  test('keeps existing same-name collections and allows renaming one to a name used in another project', async ({ electronApp, testSetup }) => {
    /** The default project already has a task collection named Bug Triage. */
    const mainWindow = await openNewTab(electronApp, testSetup, createWorkspaceWithTemplateCollections(workspacePath, [{
      folderName: 'BugTriage', displayName: 'Bug Triage', collectionId: 'bug-triage-templates'
    }]))
    await expect(mainWindow.getByTestId('new-tab-collection-bug-triage')).toContainText('Bug Triage')
    await mainWindow.getByTestId('new-tab-collection-bug-triage-templates').click()
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Bug Triage')
    await mainWindow.getByTestId('prompt-collection-title-edit').click()
    /** Rename dialog for the template half of the existing pair. */
    const dialog = mainWindow.getByRole('dialog', { name: 'Rename Collection' })
    /** Project-wide validation runs as the collection name is edited. */
    const nameInput = dialog.getByTestId('rename-prompt-collection-name-input')
    /** Submitting persists the name on this collection alone. */
    const renameButton = dialog.getByTestId('rename-prompt-collection-button')
    await nameInput.fill('Feature Work')
    await expect(dialog.getByTestId('rename-prompt-collection-name-error')).toHaveText('A collection with this name already exists')
    await expect(renameButton).toBeDisabled()

    // Only Harbor API uses Release Notes, so it is available in the default project.
    await nameInput.fill('Release Notes')
    await renameButton.click()
    await expect(dialog).toHaveCount(0)
    await mainWindow.getByTestId('new-tab-button').click()
    await expect(mainWindow.getByTestId('new-tab-collection-bug-triage-templates')).toContainText('Release Notes')
    await expect(mainWindow.getByTestId('new-tab-collection-bug-triage')).toContainText('Bug Triage')
    await expect(mainWindow.getByTestId('new-tab-collection-release-notes')).toContainText('Release Notes')
  })

  test('reorders projects by dragging their titles onto a Move Here indicator placed by the pointer\'s height', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    /** Default Project's drag handle. */
    const defaultTitle = mainWindow.getByTestId(`new-tab-project-title-${defaultProjectId}`)
    /** Cursor ghost naming the dragged project. */
    const dragGhost = mainWindow.locator(dragGhostSelector)

    // Dragging a project's title gives it the dragged-row fill and border and a ghost with the project icon and name.
    await beginPointerDrag(mainWindow, `new-tab-project-title-${defaultProjectId}`)
    await expect(defaultTitle).toHaveAttribute('data-dragging', 'true')
    await expect(defaultTitle).toHaveCSS('background-color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-normal-surface'))
    await expect(defaultTitle).toHaveCSS('box-shadow',
      `${await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-muted-border')} 0px 0px 0px 1px inset`)
    await expect(dragGhost).toHaveText('Default Project')
    await expect(dragGhost.getByTestId('drag-ghost-icon')).toHaveClass(/(^|\s)lucide-folder(\s|$)/)

    // Both of the dragged project's own boundaries change nothing, so the indicator is one gray bar: above its section
    // over its own title, and below it past the last section's middle.
    await expectProjectDropIndicator(mainWindow, defaultProjectId, 'above', true)
    await moveActiveDragBelowProjects(mainWindow)
    await expectProjectDropIndicator(mainWindow, defaultProjectId, 'below', true)

    // Over Harbor API's title, a blue Move Here indicator marks the gap above Harbor API while the sections stay put
    // and the dragged title stays blue.
    await moveActiveDragToTarget(mainWindow, `[data-testid="new-tab-project-title-${harborProjectId}"]`)
    await expectProjectDropIndicator(mainWindow, harborProjectId, 'above', false)
    await expect(defaultTitle).toHaveAttribute('data-dragging', 'true')
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project'])
    expect(await readProjectOrder(electronApp)).toEqual([harborProjectId, defaultProjectId])

    // The drop saves the indicated order and clears the ghost and indicator.
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readProjectOrder(electronApp)).toEqual([defaultProjectId, harborProjectId])
    await expectSectionNames(mainWindow, ['Default Project', 'Harbor API'])
    await expect(defaultTitle).toHaveAttribute('data-dragging', 'false')
    await expect(getProjectDropIndicator(mainWindow)).toHaveCount(0)
    await expect(dragGhost).toHaveCount(0)

    // Only the pointer's height matters: below every section, even at the screen's left edge outside the content
    // column, the indicator is below the last section; above them, over the search bar, it is above the first, which
    // is gray for the first project.
    await beginPointerDrag(mainWindow, `new-tab-project-title-${defaultProjectId}`)
    await moveActiveDragBelowProjects(mainWindow)
    await expectProjectDropIndicator(mainWindow, harborProjectId, 'below', false)
    await moveActiveDragToTarget(mainWindow, '[data-testid="new-tab-search-input"]')
    await expectProjectDropIndicator(mainWindow, defaultProjectId, 'above', true)

    // Dropping on the gray indicator changes nothing.
    await finishActiveDrag(mainWindow)
    await expect(getProjectDropIndicator(mainWindow)).toHaveCount(0)
    await expectSectionNames(mainWindow, ['Default Project', 'Harbor API'])
    expect(await readProjectOrder(electronApp)).toEqual([defaultProjectId, harborProjectId])

    // Dropping below every section saves the project last.
    await beginPointerDrag(mainWindow, `new-tab-project-title-${defaultProjectId}`)
    await moveActiveDragBelowProjects(mainWindow)
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readProjectOrder(electronApp)).toEqual([harborProjectId, defaultProjectId])
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project'])
  })

  test('reorders collections by dragging their tiles onto a vertical drop line within their own project', async ({ electronApp, testSetup }) => {
    const mainWindow = await openNewTab(electronApp, testSetup)
    /** The routine tile follows Bug Triage at the start of the next row. */
    const routineId = (await readCollectionOrder(electronApp, defaultProjectId))!.at(-1)!
    /** Bug Triage closes the first row. */
    const bugTriageTile = mainWindow.getByTestId('new-tab-collection-bug-triage')
    /** Cursor ghost naming the dragged collection. */
    const dragGhost = mainWindow.locator(dragGhostSelector)

    // Dragging a tile gives it the dragged-row fill and border, idles the other tiles, and shows a ghost with the
    // tile's icon and name.
    await beginPointerDrag(mainWindow, 'new-tab-collection-bug-triage')
    await expect(bugTriageTile).toHaveAttribute('data-row-state', 'dragging')
    await expect(bugTriageTile).toHaveCSS('background-color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-normal-surface'))
    await expect(bugTriageTile).toHaveCSS('border-top-color', await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-muted-border'))
    await expect(mainWindow.getByTestId('new-tab-collection-code-review')).toHaveAttribute('data-row-state', 'drag-idle')
    await expect(dragGhost).toHaveText('Bug Triage')
    await expect(dragGhost.getByTestId('drag-ghost-icon')).toHaveClass(/lucide-file-text/)

    // Both of the dragged tile's own lines change nothing, so they are gray: past its own middle, the line after it, and
    // past the middle of the tile before it, the line on its own left.
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('bug-triage'), 'center', 'right')
    await moveActiveDragToTarget(mainWindow, collectionTileSelector(routineId), 'center', 'left')
    await expectTileDropIndicator(mainWindow, routineId, 'left', true)
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('feature-work'), 'center', 'right')
    await expectTileDropIndicator(mainWindow, 'bug-triage', 'left', true)

    // Before the first tile's middle, a blue line marks its left side while the tiles stay put and the dragged tile
    // stays blue.
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('code-review'), 'center', 'left')
    await expectTileDropIndicator(mainWindow, 'code-review', 'left', false)
    await expect(bugTriageTile).toHaveAttribute('data-row-state', 'dragging')
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveText([tileText.codeReview, tileText.featureWork, tileText.bugTriage, tileText.routines])

    // More than 100px above its own grid, over the top of another project's tile, there is no drop line.
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('endpoint-tests'), 'top')
    await expect(getTileDropIndicator(mainWindow)).toHaveCount(0)

    // Dropping there changes nothing and opens neither collection.
    await finishActiveDrag(mainWindow)
    await expect(bugTriageTile).toHaveAttribute('data-row-state', 'idle')
    await expect(dragGhost).toHaveCount(0)
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveText([tileText.codeReview, tileText.featureWork, tileText.bugTriage, tileText.routines])
    await expect(getTiles(mainWindow, harborProjectId)).toHaveText([tileText.endpointTests, tileText.releaseNotes, tileText.routines])
    expect(await readCollectionOrder(electronApp, defaultProjectId)).toEqual(['code-review', 'feature-work', 'bug-triage', routineId])
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['New Tab'])

    // Dropping on the blue line saves the tile first without opening it.
    await beginPointerDrag(mainWindow, 'new-tab-collection-bug-triage')
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('code-review'), 'center', 'left')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readCollectionOrder(electronApp, defaultProjectId)).toEqual(['bug-triage', 'code-review', 'feature-work', routineId])
    await expect(getTiles(mainWindow, defaultProjectId)).toHaveText([tileText.bugTriage, tileText.codeReview, tileText.featureWork, tileText.routines])
    await expect(getTileDropIndicator(mainWindow)).toHaveCount(0)
    await expect(mainWindow.getByTestId('new-tab-screen')).toBeVisible()
    await expect(mainWindow.getByTestId('work-tab').getByRole('tab')).toHaveText(['New Tab'])

    // The empty cell beside My Routines on the second row targets the end of the project.
    await beginPointerDrag(mainWindow, 'new-tab-collection-feature-work')
    /** The empty cell starts one column to the right of the last tile. */
    const lastBox = (await mainWindow.getByTestId(`new-tab-collection-${routineId}`).boundingBox())!
    await mainWindow.mouse.move(lastBox.x + lastBox.width * 1.5, lastBox.y + lastBox.height / 2, { steps: 12 })
    await expectTileDropIndicator(mainWindow, routineId, 'right', false)
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readCollectionOrder(electronApp, defaultProjectId)).toEqual(['bug-triage', 'code-review', routineId, 'feature-work'])

  })

  test('snaps a dragged tile to the nearest line in the row nearest the pointer, up to 100px outside its grid', async ({ electronApp, testSetup }) => {
    await seedWorkspaceState(electronApp, workspaceId, 'collection-order', lanternProjectId, {
      entries: ['release-checklist', 'offline-sync', 'release-builds', 'crash-reports'].map((id) => ({ kind: 'collection', id }))
    })
    const mainWindow = await openNewTab(electronApp, testSetup, createLanternFiles([
      ...lanternCollections,
      { folderName: 'CrashReports', displayName: 'Crash Reports', promptCollectionId: 'crash-reports' }
    ]))
    /** Release Checklist, first in Lantern Mobile's full first row and at its grid's left edge. */
    const checklistBox = (await mainWindow.getByTestId('new-tab-collection-release-checklist').boundingBox())!
    /** Release Builds, last in the first row and at the grid's right edge. */
    const buildsBox = (await mainWindow.getByTestId('new-tab-collection-release-builds').boundingBox())!
    /** The routine starter is the last tile on the second row. */
    const routineId = (await readCollectionOrder(electronApp, lanternProjectId))!.at(-1)!
    /** Crash Reports starts the second row. */
    const crashBox = (await mainWindow.getByTestId('new-tab-collection-crash-reports').boundingBox())!
    /** Vertical middles of the grid's two rows. */
    const firstRowY = buildsBox.y + buildsBox.height / 2
    const secondRowY = crashBox.y + crashBox.height / 2

    await beginPointerDrag(mainWindow, 'new-tab-collection-release-checklist')

    // The first row has no line at its end: past its last tile's middle, and 40px right of the grid, the line stays on
    // that tile's left.
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('release-builds'), 'center', 'right')
    await expectTileDropIndicator(mainWindow, 'release-builds', 'left', false)
    await mainWindow.mouse.move(buildsBox.x + buildsBox.width + 40, firstRowY, { steps: 12 })
    await expectTileDropIndicator(mainWindow, 'release-builds', 'left', false)

    // The second row's empty third cell is nearer the line on Release Builds' left than either of Crash Reports' lines,
    // but it is in the second row, so it marks the line after Crash Reports.
    await mainWindow.mouse.move(buildsBox.x + buildsBox.width / 2, secondRowY, { steps: 12 })
    await expectTileDropIndicator(mainWindow, routineId, 'right', false)

    // 60px below the grid still snaps to the line after Crash Reports, but 120px below it there is no line.
    await mainWindow.mouse.move(buildsBox.x + buildsBox.width / 2, crashBox.y + crashBox.height + 60, { steps: 12 })
    await expectTileDropIndicator(mainWindow, routineId, 'right', false)
    await mainWindow.mouse.move(buildsBox.x + buildsBox.width / 2, crashBox.y + crashBox.height + 120, { steps: 12 })
    await expect(getTileDropIndicator(mainWindow)).toHaveCount(0)

    // 120px left of the grid there is no line, but 40px left of it snaps to the second row's first line, and dropping
    // there saves the tile right before Crash Reports.
    await mainWindow.mouse.move(checklistBox.x - 120, secondRowY, { steps: 12 })
    await expect(getTileDropIndicator(mainWindow)).toHaveCount(0)
    await mainWindow.mouse.move(checklistBox.x - 40, secondRowY, { steps: 12 })
    await expectTileDropIndicator(mainWindow, 'crash-reports', 'left', false)
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readCollectionOrder(electronApp, lanternProjectId))
      .toEqual(['offline-sync', 'release-builds', 'release-checklist', 'crash-reports', routineId])
    await expect(getTiles(mainWindow, lanternProjectId))
      .toHaveText([/Offline Sync/, /Release Builds/, /Release Checklist/, /Crash Reports/, tileText.routines])
  })

  test('reorders filtered projects and collections right after the visible item before them', async ({ electronApp, testSetup }) => {
    await seedWorkspaceState(electronApp, workspaceId, 'collection-order', lanternProjectId, {
      entries: ['release-checklist', 'offline-sync', 'release-builds'].map((id) => ({ kind: 'collection', id }))
    })
    const mainWindow = await openNewTab(electronApp, testSetup, createLanternFiles(lanternCollections))
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project', 'Lantern Mobile'])

    /** Search hides the migrated routine, whose position must survive both drops. */
    const routineId = (await readCollectionOrder(electronApp, lanternProjectId))!.at(-1)!
    // The search hides Default Project between the other two, and Offline Sync between Lantern Mobile's release tiles.
    await mainWindow.getByTestId('new-tab-search-input').fill('release')
    await expectSectionNames(mainWindow, ['Harbor API', 'Lantern Mobile'])
    await expect(getTiles(mainWindow, lanternProjectId)).toHaveText([/Release Checklist/, /Release Builds/])

    // Dragging Harbor API after Lantern Mobile saves it right after Lantern Mobile, which leaves the hidden Default
    // Project ahead of both rather than keeping Harbor API at its old position.
    await beginPointerDrag(mainWindow, `new-tab-project-title-${harborProjectId}`)
    await moveActiveDragBelowProjects(mainWindow)
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readProjectOrder(electronApp)).toEqual([defaultProjectId, lanternProjectId, harborProjectId])
    await expectSectionNames(mainWindow, ['Lantern Mobile', 'Harbor API'])

    // Dragging it back to the start of the visible projects saves it first, ahead of the hidden Default Project.
    await beginPointerDrag(mainWindow, `new-tab-project-title-${harborProjectId}`)
    await moveActiveDragToTarget(mainWindow, `[data-testid="new-tab-project-title-${lanternProjectId}"]`)
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readProjectOrder(electronApp)).toEqual([harborProjectId, defaultProjectId, lanternProjectId])
    await expectSectionNames(mainWindow, ['Harbor API', 'Lantern Mobile'])

    // Dragging Release Checklist after Release Builds saves it right after Release Builds, which leaves the hidden
    // Offline Sync ahead of both.
    await beginPointerDrag(mainWindow, 'new-tab-collection-release-checklist')
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('release-builds'), 'center', 'right')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readCollectionOrder(electronApp, lanternProjectId))
      .toEqual(['offline-sync', 'release-builds', 'release-checklist', routineId])
    await expect(getTiles(mainWindow, lanternProjectId)).toHaveText([/Release Builds/, /Release Checklist/])

    // Dragging it back to the start of the visible tiles saves it first, ahead of the hidden Offline Sync.
    await beginPointerDrag(mainWindow, 'new-tab-collection-release-checklist')
    await moveActiveDragToTarget(mainWindow, collectionTileSelector('release-builds'), 'center', 'left')
    await finishActiveDrag(mainWindow)
    await expect.poll(() => readCollectionOrder(electronApp, lanternProjectId))
      .toEqual(['release-checklist', 'offline-sync', 'release-builds', routineId])

    // Clearing the search shows the hidden items where the saved orders put them.
    await mainWindow.getByTestId('new-tab-search-input').fill('')
    await expectSectionNames(mainWindow, ['Harbor API', 'Default Project', 'Lantern Mobile'])
    await expect(getTiles(mainWindow, lanternProjectId)).toHaveText([/Release Checklist/, /Offline Sync/, /Release Builds/, tileText.routines])
  })
})
