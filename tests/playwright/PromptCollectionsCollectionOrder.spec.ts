import { showCollectionBrowser, openCollectionCreation } from '../helpers/PromptCollectionHelpers'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { readWorkspaceCollectionOrder, runSqlQuery, runSqlStatement, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import { readTextFile, checkFileExists } from '../helpers/PromptPersistenceTestHelpers'
import type { ElectronApplication, Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createLegacyWorkspaceFilesystem,
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import {
  finishActiveDrag,
  moveActiveDragToTarget
} from '../helpers/PromptDragDropHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const COLLECTION_ORDER_WORKSPACE_PATH = '/ws/collection-order'
const CREATE_COLLECTION_WORKSPACE_PATH = '/ws/collection-order-create'
const COMBINED_REPAIR_WORKSPACE_PATH = '/ws/collection-order-combined-repair'
const COMBINED_PERSISTED_WORKSPACE_PATH = '/ws/collection-order-combined-persisted'
const PROMPT_COLLECTION_SELECTOR_MENU = '[data-testid="new-tab-screen"]'
const PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX = 'new-tab-collection-'
/** Combined fallback order sorts both kinds' folder names together; equal names keep tasks first. */
const COMBINED_ALPHABETICAL_IDS = ['prompt-alpha', 'template-alpha', 'template-beta', 'prompt-zulu']

/** Resolves a legacy per-kind order file that must no longer exist on disk. */
const workspaceCollectionOrderPath = (
  workspacePath: string,
  kind: 'prompt' | 'template' = 'prompt'
): string =>
  `${workspacePath}/DefaultProject/${kind === 'template' ? 'Templates' : 'Prompts'}/CollectionOrder.json`


/** Reads stable IDs from the user's persisted combined SQLite order. */
const readWorkspacePromptCollectionIds = async (
  electronApp: ElectronApplication,
  workspacePath: string
): Promise<string[]> =>
  (await readWorkspaceCollectionOrder(electronApp, workspacePath))!.entries.map((entry) => entry.id)

/** Reads persisted references independently of the renderer's collection cache. */
const readWorkspacePromptCollectionEntries = async (
  electronApp: ElectronApplication,
  workspacePath: string
): Promise<Array<{ kind: 'collection'; id: string }>> =>
  (await readWorkspaceCollectionOrder(electronApp, workspacePath))!.entries

const readPromptCollectionDropdownItemTestIds = async (page: Page): Promise<string[]> => {
  if ((await page.locator(PROMPT_COLLECTION_SELECTOR_MENU).count()) === 0) {
    await showCollectionBrowser(page)
  }

  return await page
    .locator(`[data-testid^="${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}"]`)
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''))
}

const promptCollectionDropdownItemSelector = (collectionId: string): string =>
  `[data-testid="${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}${collectionId}"]`


const beginPromptCollectionDropdownDrag = async (page: Page, collectionId: string): Promise<void> => {
  const item = page.locator(promptCollectionDropdownItemSelector(collectionId))
  await item.scrollIntoViewIfNeeded()
  await expect(item).toBeVisible()

  const box = await item.boundingBox()
  if (!box) {
    throw new Error(`Missing prompt collection dropdown geometry for ${collectionId}`)
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8, { steps: 4 })
  await expect(page.locator('body')).toHaveCSS('cursor', 'grabbing')
}



const createCombinedCollectionWorkspace = (workspacePath: string) => ({
  ...createWorkspaceWithCollections(workspacePath, [
    { folderName: 'Zulu', displayName: 'Zulu', promptCollectionId: 'prompt-zulu' },
    { folderName: 'alpha', displayName: 'Prompt Alpha', promptCollectionId: 'prompt-alpha' }
  ]),
  ...createWorkspaceWithTemplateCollections(workspacePath, [
    { folderName: 'Beta', displayName: 'Template Beta', collectionId: 'template-beta' },
    { folderName: 'Alpha', displayName: 'Template Alpha', collectionId: 'template-alpha' }
  ])
})

describe('Prompt Collection Order', () => {
  test('persists fallback, creation, rename, and workspace isolation through reopening', async ({ electronApp, testSetup }) => {
    /** Folder and display names deliberately sort in opposite orders. */
    const workspacePath = '/ws/sqlite-order'
    /** Another workspace reuses collection IDs but owns an independent order. */
    const otherPath = `${workspacePath}-other`
    /** Both workspaces have the same IDs to expose incorrect storage scope. */
    const filesystem = {
      ...createCombinedCollectionWorkspace(workspacePath),
      ...createCombinedCollectionWorkspace(otherPath)
    }
    for (const [index, folderName] of ['alpha', 'Zulu'].entries()) {
      /** Existing collection identity remains unchanged while its display name is reversed. */
      const infoPath = `${workspacePath}/DefaultProject/Prompts/${folderName}/_CollectionInfo.json`
      filesystem[infoPath] = JSON.stringify({ ...JSON.parse(filesystem[infoPath]!), displayName: index === 0 ? 'Zulu Display' : 'Alpha Display' })
    }
    await seedWorkspaceState(electronApp, createDeterministicId(otherPath), 'collection-order', null, {
      entries: [...COMBINED_ALPHABETICAL_IDS].reverse().map((id) => ({ kind: 'collection', id }))
    })
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Real UI actions must persist through clearing the main and renderer caches. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    expect(await readWorkspacePromptCollectionIds(electronApp, workspacePath)).toEqual(COMBINED_ALPHABETICAL_IDS)
    for (const orderKind of ['prompt', 'template'] as const) {
      expect(await checkFileExists(electronApp, workspaceCollectionOrderPath(workspacePath, orderKind))).toBe(false)
    }
    expect((await runSqlQuery(electronApp, "SELECT DISTINCT storage_scope FROM workspace_state WHERE state_type = 'collection-order'")).rows).toEqual([{ storage_scope: 'user-specific' }])

    await testHelpers.navigateToPromptCollections('Zulu Display')
    await mainWindow.getByTestId('sidebar-collection-overview-button').click()
    await mainWindow.getByTestId('prompt-collection-title-edit').click()
    await mainWindow.getByTestId('rename-prompt-collection-name-input').fill('Zzz Renamed')
    await mainWindow.getByTestId('rename-prompt-collection-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Zzz Renamed')
    expect(await readWorkspacePromptCollectionIds(electronApp, workspacePath)).toEqual(COMBINED_ALPHABETICAL_IDS)

    await showCollectionBrowser(mainWindow)
    await openCollectionCreation(mainWindow, 'template')
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('New Collection')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect.poll(() => readWorkspacePromptCollectionIds(electronApp, workspacePath)).toEqual([
      expect.any(String), ...COMBINED_ALPHABETICAL_IDS
    ])
    /** Captured stable IDs must survive opening a workspace with conflicting orders. */
    const savedIds = await readWorkspacePromptCollectionIds(electronApp, workspacePath)
    for (const path of [otherPath, workspacePath]) {
      await testHelpers.navigateToHomeScreen()
      await testHelpers.clearWorkspaceViaUI()
      await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
      await testHelpers.setupWorkspaceViaUI()
        await expect.poll(() => readPromptCollectionDropdownItemTestIds(mainWindow)).toEqual(
        (path === otherPath ? [...COMBINED_ALPHABETICAL_IDS].reverse() : savedIds).map((id) => `${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}${id}`)
      )
      await mainWindow.keyboard.press('Escape')
    }
    expect(await readWorkspacePromptCollectionIds(electronApp, otherPath)).toEqual([...COMBINED_ALPHABETICAL_IDS].reverse())
    for (const orderKind of ['prompt', 'template'] as const) {
      expect(await checkFileExists(electronApp, workspaceCollectionOrderPath(workspacePath, orderKind))).toBe(false)
    }
  })

  test('rolls back the SQLite order and collection creation when the collection-order write fails', async ({ electronApp, testSetup }) => {
    /** The favorites write follows the order write, so the order must roll back when it fails. */
    const workspacePath = '/ws/sqlite-order-rollback'
    await testSetup.setupFilesystem(createCombinedCollectionWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Creation uses the real mutation and staged filesystem commit. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Prompt Alpha')
    await runSqlStatement(electronApp, `CREATE TRIGGER reject_collection_order BEFORE INSERT ON workspace_state
      WHEN NEW.state_type = 'collection-order' BEGIN SELECT RAISE(ABORT, 'Controlled collection order failure'); END`)
    await showCollectionBrowser(mainWindow)
    await openCollectionCreation(mainWindow)
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('Retry Collection')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect(mainWindow.getByTestId('create-prompt-collection-name-error')).toBeVisible()
    expect(await readWorkspacePromptCollectionIds(electronApp, workspacePath)).toEqual(COMBINED_ALPHABETICAL_IDS)
    expect(await checkFileExists(electronApp, `${workspacePath}/DefaultProject/Prompts/RetryCollection/_CollectionInfo.json`)).toBe(false)
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_collection_order')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await testHelpers.navigateToPromptCollections('Retry Collection')
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Retry Collection')
    await expect.poll(() => readWorkspacePromptCollectionIds(electronApp, workspacePath)).toEqual([
      expect.any(String), ...COMBINED_ALPHABETICAL_IDS
    ])
    expect(await checkFileExists(electronApp, `${workspacePath}/DefaultProject/Prompts/RetryCollection/_CollectionInfo.json`)).toBe(true)
    expect(testSetup.getRendererErrors().some((error) => error.message.includes('Controlled collection order failure'))).toBe(true)
    testSetup.removeRendererErrorsContaining('Controlled collection order failure')
  })

  test('loads explicitly ordered collections before unordered collections sorted by disk name', async ({
    electronApp,
    testSetup
  }) => {
    const filesystem = createWorkspaceWithCollections(COLLECTION_ORDER_WORKSPACE_PATH, [
      { folderName: 'zeta', displayName: 'Zeta', promptCollectionId: 'collection-zeta' },
      { folderName: 'Alpha', displayName: 'Alpha', promptCollectionId: 'collection-alpha' },
      { folderName: 'middle', displayName: 'Middle', promptCollectionId: 'collection-middle' },
      { folderName: 'beta', displayName: 'Beta', promptCollectionId: 'collection-beta' }
    ])
    await seedWorkspaceState(electronApp, createDeterministicId(COLLECTION_ORDER_WORKSPACE_PATH), 'collection-order', null, {
      entries: ['missing-collection', 'collection-middle', 'collection-middle', 'collection-zeta'].map((id) => ({ kind: 'collection', id }))
    })

    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COLLECTION_ORDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'new-tab-collection-collection-middle',
        'new-tab-collection-collection-zeta',
        'new-tab-collection-collection-alpha',
        'new-tab-collection-collection-beta'
      ])
    await expect(
      await readWorkspacePromptCollectionIds(electronApp, COLLECTION_ORDER_WORKSPACE_PATH)
    ).toEqual(['collection-middle', 'collection-zeta', 'collection-alpha', 'collection-beta'])
    await expect(
      await readWorkspacePromptCollectionEntries(electronApp, COLLECTION_ORDER_WORKSPACE_PATH)
    ).toEqual(
      ['collection-middle', 'collection-zeta', 'collection-alpha', 'collection-beta'].map((id) => ({
        kind: 'collection',
        id
      }))
    )
    await expect(
      mainWindow.locator('[data-testid="sidebar-prompt-collection-modified-time"]')
    ).toHaveCount(0)
  })

  test('repairs the combined order and reorders collections across kinds', async ({
    electronApp,
    testSetup
  }) => {
    const filesystem = createCombinedCollectionWorkspace(COMBINED_REPAIR_WORKSPACE_PATH)
    delete filesystem[workspaceCollectionOrderPath(COMBINED_REPAIR_WORKSPACE_PATH)]
    delete filesystem[workspaceCollectionOrderPath(COMBINED_REPAIR_WORKSPACE_PATH, 'template')]

    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(COMBINED_REPAIR_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    await expect
      .poll(async () => await readWorkspacePromptCollectionIds(electronApp, COMBINED_REPAIR_WORKSPACE_PATH))
      .toEqual(COMBINED_ALPHABETICAL_IDS)
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual(COMBINED_ALPHABETICAL_IDS.map((id) => `${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}${id}`))

    // A template collection can move ahead of task collections in the shared order.
    await beginPromptCollectionDropdownDrag(mainWindow, 'template-beta')
    await moveActiveDragToTarget(mainWindow, promptCollectionDropdownItemSelector('prompt-alpha'))
    await finishActiveDrag(mainWindow)
    await expect
      .poll(async () => await readWorkspacePromptCollectionIds(electronApp, COMBINED_REPAIR_WORKSPACE_PATH))
      .toEqual(['template-beta', 'prompt-alpha', 'template-alpha', 'prompt-zulu'])
  })

  test('discards an interleaved schema-one order and saves the alphabetical SQLite order', async ({
    electronApp,
    testSetup
  }) => {
    const filesystem = createLegacyWorkspaceFilesystem(createCombinedCollectionWorkspace(COMBINED_PERSISTED_WORKSPACE_PATH), 1)
    const persistedIds = ['template-beta', 'prompt-zulu', 'template-alpha', 'prompt-alpha']
    /** Workspace metadata downgraded to activate the schema-one collection-order migration. */
    const workspaceInfoPath = getWorkspaceInfoPath(COMBINED_PERSISTED_WORKSPACE_PATH)
    /** Current workspace identity retained while its schema marker is downgraded. */
    const workspaceInfo = JSON.parse(filesystem[workspaceInfoPath]!) as Record<string, unknown>
    filesystem[workspaceInfoPath] = JSON.stringify({ ...workspaceInfo, schemaVersion: 1 }, null, 2)
    delete filesystem[`${COMBINED_PERSISTED_WORKSPACE_PATH}/DefaultProject/Prompts/FolderOrder.json`]
    delete filesystem[`${COMBINED_PERSISTED_WORKSPACE_PATH}/DefaultProject/Templates/FolderOrder.json`]
    filesystem[`${COMBINED_PERSISTED_WORKSPACE_PATH}/WorkspaceFolderOrder.json`] = JSON.stringify(
      { entries: persistedIds.map((id) => ({ kind: 'folder', id })) },
      null,
      2
    )

    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([workspaceInfoPath])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    expect(
      await readWorkspacePromptCollectionIds(electronApp, COMBINED_PERSISTED_WORKSPACE_PATH)
    ).toEqual(COMBINED_ALPHABETICAL_IDS)
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual(COMBINED_ALPHABETICAL_IDS.map((id) => `${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}${id}`))
    expect(JSON.parse(await readTextFile(electronApp, workspaceInfoPath))).toMatchObject({
      schemaVersion: 8
    })
    await expect(
      checkFileExists(
        electronApp,
        `${COMBINED_PERSISTED_WORKSPACE_PATH}/WorkspaceFolderOrder.json`
      )
    ).resolves.toBe(false)
  })

  test('adds new collections to the top of the persisted collection order', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithCollections(CREATE_COLLECTION_WORKSPACE_PATH, [
        { folderName: 'Alpha', displayName: 'Alpha', promptCollectionId: 'collection-alpha' },
        { folderName: 'Beta', displayName: 'Beta', promptCollectionId: 'collection-beta' }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(CREATE_COLLECTION_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await showCollectionBrowser(mainWindow)
    await openCollectionCreation(mainWindow)
    await mainWindow.locator('[data-testid="create-prompt-collection-name-input"]').fill('New Collection')
    await mainWindow.locator('[data-testid="create-prompt-collection-button"]').click()

    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        expect.stringMatching(/^new-tab-collection-(?!collection-alpha|collection-beta)/),
        'new-tab-collection-collection-alpha',
        'new-tab-collection-collection-beta'
      ])
    await expect
      .poll(
        async () => await readWorkspacePromptCollectionIds(electronApp, CREATE_COLLECTION_WORKSPACE_PATH)
      )
      .toEqual([expect.not.stringMatching(/^collection-(alpha|beta)$/), 'collection-alpha', 'collection-beta'])
  })


})
