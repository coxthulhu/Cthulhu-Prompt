import { createDeterministicId } from '../fixtures/FixtureIds'
import { selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'
import { readWorkspaceCollectionOrder, runSqlQuery, runSqlStatement, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import { resolvePaletteColor } from '../helpers/PaletteHelpers'
import { readTextFile, checkFileExists } from '../helpers/PromptPersistenceTestHelpers'
import { expectPointerCapture, interruptPointerDrag, recordPointerId } from '../helpers/PointerCaptureHelpers'
import type { ElectronApplication, Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createLegacyWorkspaceFilesystem,
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import {
  dragGhostSelector,
  finishActiveDrag,
  moveActiveDragToTarget
} from '../helpers/PromptDragDropHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const COLLECTION_ORDER_WORKSPACE_PATH = '/ws/collection-order'
const CREATE_COLLECTION_WORKSPACE_PATH = '/ws/collection-order-create'
const DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH = '/ws/collection-order-dropdown-drag'
const DROPDOWN_SCROLL_COLLECTION_ORDER_WORKSPACE_PATH = '/ws/collection-order-dropdown-scroll'
const DROPDOWN_FOOTER_COLLECTION_ORDER_WORKSPACE_PATH = '/ws/collection-order-dropdown-footer'
const DROPDOWN_NOOP_COLLECTION_ORDER_WORKSPACE_PATH = '/ws/collection-order-dropdown-noop'
const COMBINED_REPAIR_WORKSPACE_PATH = '/ws/collection-order-combined-repair'
const COMBINED_PERSISTED_WORKSPACE_PATH = '/ws/collection-order-combined-persisted'
const PROMPT_COLLECTION_SELECTOR_MENU = '[data-testid="sidebar-prompt-collection-selector-menu"]'
const PROMPT_COLLECTION_SELECTOR_ITEMS = '[data-testid="sidebar-prompt-collection-selector-menu-items"]'
const PROMPT_COLLECTION_SELECTOR_TRIGGER = '[data-testid="sidebar-prompt-collection-selector-trigger"]'
const PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX = 'sidebar-prompt-collection-dropdown-item-'

/** Resolves the type-owned collection order used by this suite. */
const workspaceCollectionOrderPath = (
  workspacePath: string,
  kind: 'prompt' | 'template' = 'prompt'
): string =>
  `${workspacePath}/${kind === 'template' ? 'Templates' : 'Prompts'}/CollectionOrder.json`


/** Reads stable IDs from the user's persisted SQLite order. */
const readWorkspacePromptCollectionIds = async (
  electronApp: ElectronApplication,
  workspacePath: string,
  kind: 'prompt' | 'template' = 'prompt'
): Promise<string[]> =>
  (await readWorkspaceCollectionOrder(electronApp, workspacePath, kind))!.entries.map((entry) => entry.id)

/** Reads persisted references independently of the renderer's collection cache. */
const readWorkspacePromptCollectionEntries = async (
  electronApp: ElectronApplication,
  workspacePath: string
): Promise<Array<{ kind: 'collection'; id: string }>> =>
  (await readWorkspaceCollectionOrder(electronApp, workspacePath))!.entries

const readPromptCollectionDropdownItemTestIds = async (page: Page): Promise<string[]> => {
  if ((await page.locator(PROMPT_COLLECTION_SELECTOR_MENU).count()) === 0) {
    await page.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
  }

  return await page
    .locator(`[data-testid^="${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}"]`)
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''))
}

const promptCollectionDropdownItemSelector = (collectionId: string): string =>
  `[data-testid="${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}${collectionId}"]`

const promptCollectionDropdownDragHandleSelector = (collectionId: string): string =>
  `[data-testid="sidebar-prompt-collection-dropdown-drag-handle-${collectionId}"]`

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

const scrollPromptCollectionDropdownToBottom = async (page: Page): Promise<void> => {
  await page.locator(PROMPT_COLLECTION_SELECTOR_ITEMS).evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
}

const createEmptyCollectionWorkspace = (workspacePath: string, collectionNames: string[]) =>
  createWorkspaceWithCollections(
    workspacePath,
    collectionNames.map((folderName) => ({
      folderName,
      displayName: folderName,
      promptCollectionId: `collection-${folderName.toLowerCase()}`
    }))
  )

const createCombinedCollectionWorkspace = (workspacePath: string) => ({
  ...createWorkspaceWithCollections(workspacePath, [
    { folderName: 'Zulu', displayName: 'Zulu', promptCollectionId: 'prompt-zulu' },
    { folderName: 'alpha', displayName: 'Prompt Alpha', promptCollectionId: 'prompt-alpha' }
  ]),
  ...createWorkspaceWithTemplateCollections(workspacePath, [
    { folderName: 'Beta', displayName: 'Template Beta', collectionId: 'template-beta' },
    { folderName: 'Alpha', displayName: 'Template Alpha', collectionId: 'template-alpha' }
  ]),
  [`${workspacePath}/Prompts/CollectionOrder.json`]: JSON.stringify({
    entries: ['prompt-zulu', 'prompt-alpha'].map((id) => ({ kind: 'collection', id }))
  }),
  [`${workspacePath}/Templates/CollectionOrder.json`]: JSON.stringify({
    entries: ['template-beta', 'template-alpha'].map((id) => ({ kind: 'collection', id }))
  })
})

describe('Prompt Collection Order', () => {
  for (const kind of ['prompt', 'template'] as const) {
    test(`persists ${kind} fallback, creation, rename, and workspace isolation through reopening`, async ({ electronApp, testSetup }) => {
      /** Folder and display names deliberately sort in opposite orders. */
      const workspacePath = `/ws/sqlite-order-${kind}`
      /** Another workspace reuses collection IDs but owns an independent order. */
      const otherPath = `${workspacePath}-other`
      /** Both kinds have the same IDs in each workspace to expose incorrect storage scope. */
      const filesystem = {
        ...createCombinedCollectionWorkspace(workspacePath),
        ...createCombinedCollectionWorkspace(otherPath)
      }
      /** Collection metadata files whose display names must not control fallback ordering. */
      const root = kind === 'prompt' ? 'Prompts' : 'Templates'
      /** Template fixtures use Alpha/Beta while task fixtures use alpha/Zulu. */
      const folderNames = kind === 'prompt' ? ['alpha', 'Zulu'] : ['Alpha', 'Beta']
      for (const [index, folderName] of folderNames.entries()) {
        /** Existing collection identity remains unchanged while its display name is reversed. */
        const infoPath = `${workspacePath}/${root}/${folderName}/_CollectionInfo/CollectionInfo.json`
        filesystem[infoPath] = JSON.stringify({ ...JSON.parse(filesystem[infoPath]!), displayName: index === 0 ? 'Zulu Display' : 'Alpha Display' })
      }
      /** Expected initial order uses folders, independently for each kind. */
      const initialIds = kind === 'prompt' ? ['prompt-alpha', 'prompt-zulu'] : ['template-alpha', 'template-beta']
      await seedWorkspaceState(electronApp, createDeterministicId(otherPath), `${kind}-collection-order`, null, {
        entries: [...initialIds].reverse().map((id) => ({ kind: 'collection', id }))
      })
      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
      /** Real UI actions must persist through clearing the main and renderer caches. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      expect(await readWorkspacePromptCollectionIds(electronApp, workspacePath, kind)).toEqual(initialIds)
      for (const orderKind of ['prompt', 'template'] as const) {
        expect(await checkFileExists(electronApp, workspaceCollectionOrderPath(workspacePath, orderKind))).toBe(false)
      }
      expect((await runSqlQuery(electronApp, "SELECT DISTINCT storage_scope FROM workspace_state WHERE state_type IN ('prompt-collection-order', 'template-collection-order')")).rows).toEqual([{ storage_scope: 'user-specific' }])

      if (kind === 'prompt') await testHelpers.navigateToPromptCollections('Zulu Display')
      else await testHelpers.navigateToPromptTemplateCollections('Zulu Display')
      await mainWindow.getByTestId('sidebar-collection-overview-button').click()
      await mainWindow.getByTestId('prompt-collection-title-edit').click()
      await mainWindow.getByTestId('rename-prompt-collection-name-input').fill('Zzz Renamed')
      await mainWindow.getByTestId('rename-prompt-collection-button').click()
      await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Zzz Renamed')
      expect(await readWorkspacePromptCollectionIds(electronApp, workspacePath, kind)).toEqual(initialIds)

      await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
      await mainWindow.getByTestId('sidebar-prompt-collection-dropdown-add-item').click()
      await mainWindow.getByTestId('create-prompt-collection-name-input').fill('New Collection')
      await mainWindow.getByTestId('create-prompt-collection-button').click()
      await expect.poll(() => readWorkspacePromptCollectionIds(electronApp, workspacePath, kind)).toEqual([
        expect.any(String), ...initialIds
      ])
      /** Captured stable IDs must survive opening a workspace with conflicting orders. */
      const savedIds = await readWorkspacePromptCollectionIds(electronApp, workspacePath, kind)
      for (const path of [otherPath, workspacePath]) {
        await testHelpers.navigateToHomeScreen()
        await testHelpers.clearWorkspaceViaUI()
        await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
        await testHelpers.setupWorkspaceViaUI()
        await mainWindow.getByTestId(kind === 'prompt' ? 'nav-button-prompt-task-collections' : 'nav-button-prompt-template-collections').click()
        await expect.poll(() => readPromptCollectionDropdownItemTestIds(mainWindow)).toEqual(
          (path === otherPath ? [...initialIds].reverse() : savedIds).map((id) => `${PROMPT_COLLECTION_DROPDOWN_ITEM_PREFIX}${id}`)
        )
        await mainWindow.keyboard.press('Escape')
      }
      expect(await readWorkspacePromptCollectionIds(electronApp, otherPath, kind)).toEqual([...initialIds].reverse())
      for (const orderKind of ['prompt', 'template'] as const) {
        expect(await checkFileExists(electronApp, workspaceCollectionOrderPath(workspacePath, orderKind))).toBe(false)
      }
    })
  }

  test('rolls back both SQLite orders and collection creation when the second order write fails', async ({ electronApp, testSetup }) => {
    /** Separate kinds ensure the first SQLite write must roll back if the second fails. */
    const workspacePath = '/ws/sqlite-order-rollback'
    await testSetup.setupFilesystem(createCombinedCollectionWorkspace(workspacePath))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    /** Creation uses the real mutation and staged filesystem commit. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    await testHelpers.navigateToPromptCollections('Prompt Alpha')
    await runSqlStatement(electronApp, `CREATE TRIGGER reject_collection_order BEFORE INSERT ON workspace_state
      WHEN NEW.state_type = 'template-collection-order' BEGIN SELECT RAISE(ABORT, 'Controlled collection order failure'); END`)
    await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await mainWindow.getByTestId('sidebar-prompt-collection-dropdown-add-item').click()
    await mainWindow.getByTestId('create-prompt-collection-name-input').fill('Retry Collection')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect(mainWindow.getByTestId('create-prompt-collection-name-error')).toBeVisible()
    expect(await readWorkspacePromptCollectionIds(electronApp, workspacePath)).toEqual(['prompt-alpha', 'prompt-zulu'])
    expect(await readWorkspacePromptCollectionIds(electronApp, workspacePath, 'template')).toEqual(['template-alpha', 'template-beta'])
    expect(await checkFileExists(electronApp, `${workspacePath}/Prompts/RetryCollection/_CollectionInfo/CollectionInfo.json`)).toBe(false)
    await runSqlStatement(electronApp, 'DROP TRIGGER reject_collection_order')
    await mainWindow.getByTestId('create-prompt-collection-button').click()
    await expect(mainWindow.getByTestId('prompt-collection-title')).toHaveText('Retry Collection')
    await expect.poll(() => readWorkspacePromptCollectionIds(electronApp, workspacePath)).toEqual([
      expect.any(String), 'prompt-alpha', 'prompt-zulu'
    ])
    expect(await checkFileExists(electronApp, `${workspacePath}/Prompts/RetryCollection/_CollectionInfo/CollectionInfo.json`)).toBe(true)
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
    await seedWorkspaceState(electronApp, createDeterministicId(COLLECTION_ORDER_WORKSPACE_PATH), 'prompt-collection-order', null, {
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
        'sidebar-prompt-collection-dropdown-item-collection-middle',
        'sidebar-prompt-collection-dropdown-item-collection-zeta',
        'sidebar-prompt-collection-dropdown-item-collection-alpha',
        'sidebar-prompt-collection-dropdown-item-collection-beta'
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

  test('repairs, filters, and reorders independent collection orders', async ({
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
      .poll(
        async () =>
          await readWorkspacePromptCollectionIds(electronApp, COMBINED_REPAIR_WORKSPACE_PATH)
      )
      .toEqual(['prompt-alpha', 'prompt-zulu'])
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-prompt-alpha',
        'sidebar-prompt-collection-dropdown-item-prompt-zulu'
      ])

    await mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]').click()
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-template-alpha',
        'sidebar-prompt-collection-dropdown-item-template-beta'
    ])
    await mainWindow.locator('[data-testid="nav-button-prompt-task-collections"]').click()
    await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()

    await beginPromptCollectionDropdownDrag(mainWindow, 'prompt-zulu')
    await moveActiveDragToTarget(
      mainWindow,
      promptCollectionDropdownItemSelector('prompt-alpha')
    )
    await finishActiveDrag(mainWindow)
    await expect
      .poll(
        async () =>
          await readWorkspacePromptCollectionIds(electronApp, COMBINED_REPAIR_WORKSPACE_PATH)
      )
      .toEqual(['prompt-zulu', 'prompt-alpha'])
    expect(
      await readWorkspacePromptCollectionIds(
        electronApp,
        COMBINED_REPAIR_WORKSPACE_PATH,
        'template'
      )
    ).toEqual(['template-alpha', 'template-beta'])
  })

  test('discards an interleaved schema-one order and saves alphabetical SQLite orders', async ({
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
    delete filesystem[`${COMBINED_PERSISTED_WORKSPACE_PATH}/Prompts/FolderOrder.json`]
    delete filesystem[`${COMBINED_PERSISTED_WORKSPACE_PATH}/Templates/FolderOrder.json`]
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
    ).toEqual(['prompt-alpha', 'prompt-zulu'])
    expect(
      await readWorkspacePromptCollectionIds(
        electronApp,
        COMBINED_PERSISTED_WORKSPACE_PATH,
        'template'
      )
    ).toEqual(['template-alpha', 'template-beta'])
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-prompt-alpha',
        'sidebar-prompt-collection-dropdown-item-prompt-zulu'
      ])
    await mainWindow.locator('[data-testid="nav-button-prompt-template-collections"]').click()
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-template-alpha',
        'sidebar-prompt-collection-dropdown-item-template-beta'
      ])
    expect(JSON.parse(await readTextFile(electronApp, workspaceInfoPath))).toMatchObject({
      schemaVersion: 6
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

    await mainWindow.locator('[data-testid="sidebar-prompt-collection-selector-trigger"]').click()
    await mainWindow.locator('[data-testid="sidebar-prompt-collection-dropdown-add-item"]').click()
    await mainWindow.locator('[data-testid="create-prompt-collection-name-input"]').fill('New Collection')
    await mainWindow.locator('[data-testid="create-prompt-collection-button"]').click()

    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        expect.stringMatching(/^sidebar-prompt-collection-dropdown-item-(?!collection-alpha|collection-beta)/),
        'sidebar-prompt-collection-dropdown-item-collection-alpha',
        'sidebar-prompt-collection-dropdown-item-collection-beta'
      ])
    await expect
      .poll(
        async () => await readWorkspacePromptCollectionIds(electronApp, CREATE_COLLECTION_WORKSPACE_PATH)
      )
      .toEqual([expect.not.stringMatching(/^collection-(alpha|beta)$/), 'collection-alpha', 'collection-beta'])
  })

  test('reorders collections from the collection selector dropdown without changing selection', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createEmptyCollectionWorkspace(DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH, [
        'Alpha',
        'Beta',
        'Gamma'
      ])
    )
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH)
    ])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptCollections('Beta')

    await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await expect(mainWindow.locator(PROMPT_COLLECTION_SELECTOR_MENU)).toBeVisible()
    await mainWindow.locator(promptCollectionDropdownDragHandleSelector('collection-gamma')).hover()
    await expect(
      mainWindow.locator(promptCollectionDropdownDragHandleSelector('collection-gamma'))
    ).toHaveCSS('cursor', 'grab')

    await beginPromptCollectionDropdownDrag(mainWindow, 'collection-gamma')
    await expect(
      mainWindow.locator(promptCollectionDropdownItemSelector('collection-gamma'))
    ).toHaveAttribute('data-row-state', 'dragging')
    await expect(
      mainWindow.locator(promptCollectionDropdownItemSelector('collection-gamma'))
    ).toHaveCSS(
      'background-color',
      await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-normal-surface')
    )
    await expect(
      mainWindow.locator(promptCollectionDropdownItemSelector('collection-gamma'))
    ).toHaveCSS(
      'border-top-color',
      await resolvePaletteColor(mainWindow.locator('body'), '--ui-info-muted-border')
    )
    await expect(mainWindow.locator(dragGhostSelector)).toHaveCount(0)
    await moveActiveDragToTarget(mainWindow, promptCollectionDropdownItemSelector('collection-alpha'))
    await expect(
      mainWindow.locator(promptCollectionDropdownItemSelector('collection-alpha'))
    ).toHaveAttribute('data-row-state', 'drag-idle')
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-collection-gamma',
        'sidebar-prompt-collection-dropdown-item-collection-alpha',
        'sidebar-prompt-collection-dropdown-item-collection-beta'
      ])
    await expect(
      await readWorkspacePromptCollectionIds(electronApp, DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH)
    ).toEqual(['collection-alpha', 'collection-beta', 'collection-gamma'])
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(PROMPT_COLLECTION_SELECTOR_MENU)).toBeVisible()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Beta')
    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toBeVisible()
    await expect
      .poll(
        async () =>
          await readWorkspacePromptCollectionIds(electronApp, DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH)
      )
      .toEqual(['collection-gamma', 'collection-alpha', 'collection-beta'])
  })

  for (const interruption of ['pointercancel', 'lostpointercapture'] as const) {
    test(`discards collection-selector reorder previews after ${interruption}`, async ({ electronApp, testSetup }) => {
      await testSetup.setupFilesystem(
        createEmptyCollectionWorkspace(DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH, ['Alpha', 'Beta', 'Gamma'])
      )
      await testSetup.setupFileDialog([getWorkspaceInfoPath(DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH)])
      /** Workspace with a three-row selector whose preview can visibly change order. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'none' }
      })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptCollections('Beta')
      await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
      /** Stationary list owns capture while its keyed rows reorder for the preview. */
      const owner = mainWindow.locator(PROMPT_COLLECTION_SELECTOR_ITEMS)
      await recordPointerId(owner)
      await beginPromptCollectionDropdownDrag(mainWindow, 'collection-gamma')
      /** Browser pointer retained across the preview's DOM reordering. */
      const pointerId = await expectPointerCapture(owner)
      await moveActiveDragToTarget(mainWindow, promptCollectionDropdownItemSelector('collection-alpha'))
      await expect.poll(() => readPromptCollectionDropdownItemTestIds(mainWindow)).toEqual([
        'sidebar-prompt-collection-dropdown-item-collection-gamma',
        'sidebar-prompt-collection-dropdown-item-collection-alpha',
        'sidebar-prompt-collection-dropdown-item-collection-beta'
      ])
      await expectPointerCapture(owner)
      await interruptPointerDrag(mainWindow, owner, pointerId, interruption)
      await mainWindow.mouse.up()
      await expect.poll(() => readPromptCollectionDropdownItemTestIds(mainWindow)).toEqual([
        'sidebar-prompt-collection-dropdown-item-collection-alpha',
        'sidebar-prompt-collection-dropdown-item-collection-beta',
        'sidebar-prompt-collection-dropdown-item-collection-gamma'
      ])
      expect(await readWorkspacePromptCollectionIds(electronApp, DROPDOWN_DRAG_COLLECTION_ORDER_WORKSPACE_PATH))
        .toEqual(['collection-alpha', 'collection-beta', 'collection-gamma'])
      await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Beta')
      await expect(mainWindow.locator('body')).not.toHaveCSS('cursor', 'grabbing')
    })
  }

  test('reorders collections from a scrolled collection selector dropdown', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createEmptyCollectionWorkspace(DROPDOWN_SCROLL_COLLECTION_ORDER_WORKSPACE_PATH, [
        'Alpha',
        'Beta',
        'Gamma',
        'Delta',
        'Epsilon',
        'Zeta',
        'Eta',
        'Theta'
      ])
    )
    await seedWorkspaceState(electronApp, createDeterministicId(DROPDOWN_SCROLL_COLLECTION_ORDER_WORKSPACE_PATH), 'prompt-collection-order', null, {
      entries: ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'].map((name) => ({ kind: 'collection', id: `collection-${name}` }))
    })
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(DROPDOWN_SCROLL_COLLECTION_ORDER_WORKSPACE_PATH)
    ])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await expect(mainWindow.locator(PROMPT_COLLECTION_SELECTOR_MENU)).toBeVisible()
    await beginPromptCollectionDropdownDrag(mainWindow, 'collection-alpha')
    await scrollPromptCollectionDropdownToBottom(mainWindow)
    await moveActiveDragToTarget(mainWindow, promptCollectionDropdownItemSelector('collection-theta'))

    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-collection-beta',
        'sidebar-prompt-collection-dropdown-item-collection-gamma',
        'sidebar-prompt-collection-dropdown-item-collection-delta',
        'sidebar-prompt-collection-dropdown-item-collection-epsilon',
        'sidebar-prompt-collection-dropdown-item-collection-zeta',
        'sidebar-prompt-collection-dropdown-item-collection-eta',
        'sidebar-prompt-collection-dropdown-item-collection-theta',
        'sidebar-prompt-collection-dropdown-item-collection-alpha'
      ])
    await finishActiveDrag(mainWindow)

    await expect
      .poll(
        async () =>
          await readWorkspacePromptCollectionIds(
            electronApp,
            DROPDOWN_SCROLL_COLLECTION_ORDER_WORKSPACE_PATH
          )
      )
      .toEqual([
        'collection-beta',
        'collection-gamma',
        'collection-delta',
        'collection-epsilon',
        'collection-zeta',
        'collection-eta',
        'collection-theta',
        'collection-alpha'
      ])
  })

  test('ignores collection selector dropdown drops on the add collection footer', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createEmptyCollectionWorkspace(DROPDOWN_FOOTER_COLLECTION_ORDER_WORKSPACE_PATH, [
        'Alpha',
        'Beta',
        'Gamma'
      ])
    )
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(DROPDOWN_FOOTER_COLLECTION_ORDER_WORKSPACE_PATH)
    ])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await beginPromptCollectionDropdownDrag(mainWindow, 'collection-alpha')
    await moveActiveDragToTarget(
      mainWindow,
      '[data-testid="sidebar-prompt-collection-dropdown-add-item"]'
    )
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-collection-alpha',
        'sidebar-prompt-collection-dropdown-item-collection-beta',
        'sidebar-prompt-collection-dropdown-item-collection-gamma'
      ])
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(PROMPT_COLLECTION_SELECTOR_MENU)).toBeVisible()
    await expect(
      await readWorkspacePromptCollectionIds(electronApp, DROPDOWN_FOOTER_COLLECTION_ORDER_WORKSPACE_PATH)
    ).toEqual(['collection-alpha', 'collection-beta', 'collection-gamma'])
  })

  test('suppresses no-op collection selector dropdown drops', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(
      createEmptyCollectionWorkspace(DROPDOWN_NOOP_COLLECTION_ORDER_WORKSPACE_PATH, [
        'Alpha',
        'Beta',
        'Gamma'
      ])
    )
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(DROPDOWN_NOOP_COLLECTION_ORDER_WORKSPACE_PATH)
    ])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult!.workspaceReady).toBe(true)

    await mainWindow.locator(PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await beginPromptCollectionDropdownDrag(mainWindow, 'collection-alpha')
    await moveActiveDragToTarget(mainWindow, promptCollectionDropdownItemSelector('collection-alpha'))
    await expect
      .poll(async () => await readPromptCollectionDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-collection-dropdown-item-collection-alpha',
        'sidebar-prompt-collection-dropdown-item-collection-beta',
        'sidebar-prompt-collection-dropdown-item-collection-gamma'
      ])
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(PROMPT_COLLECTION_SELECTOR_MENU)).toBeVisible()
    await expect(
      await readWorkspacePromptCollectionIds(electronApp, DROPDOWN_NOOP_COLLECTION_ORDER_WORKSPACE_PATH)
    ).toEqual(['collection-alpha', 'collection-beta', 'collection-gamma'])
  })
})
