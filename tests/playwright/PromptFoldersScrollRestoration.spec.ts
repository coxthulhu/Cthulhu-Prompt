import { PromptStatus } from '@shared/domain/prompt/Prompt'
import type { ElectronApplication, Page } from 'playwright'
import {
  createPlaywrightTestSuite,
  type PlaywrightTestFixtures
} from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { clickPromptFolderItem } from '../helpers/PromptFolderHelpers'
import {
  runSqlQuery,
  seedUserPersistence,
  seedWorkspaceUiState
} from '../helpers/UserPersistenceHelpers'

/** Isolated suite for persisted status-mode viewport navigation. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Main content viewport, independent of each sidebar tree viewport. */
const HOST = '[data-testid="prompt-folder-virtual-window"]'
/** Stable workspace path and explicit IDs simplify persisted state assertions. */
const WORKSPACE_PATH = '/ws/status-scroll'
/** Workspace identity shared by fixtures and SQLite seed data. */
const WORKSPACE_ID = 'status-scroll-workspace'

/** Starts two populated roots with distinct saved offsets and a conflicting selected item. */
const startSavedWorkspace = async (
  { electronApp, testSetup }: Pick<PlaywrightTestFixtures, 'electronApp' | 'testSetup'>,
  initialActiveOffset = 137
) => {
  await testSetup.setupFilesystem(
    createWorkspaceWithFolders(
      WORKSPACE_PATH,
      ['Alpha', 'Beta'].map((folderName) => ({
        folderName,
        displayName: folderName,
        promptFolderId: folderName,
        prompts: [PromptStatus.Todo, PromptStatus.Completed, PromptStatus.Archived].flatMap(
          (status) =>
            Array.from({ length: 12 }, (_, index) => ({
              id: `${folderName}-${status}-${index}`,
              title: `${status} ${index}`,
              promptText: `Body for ${status} ${index}.`,
              status,
              finalizedAt: `2026-07-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`
            }))
        )
      })),
      { settings: { workspaceId: WORKSPACE_ID } }
    )
  )
  await seedUserPersistence(electronApp, {
    lastWorkspaceInfoPath: getWorkspaceInfoPath(WORKSPACE_PATH)
  })
  await seedWorkspaceUiState(electronApp, {
    workspaceId: WORKSPACE_ID,
    selectedScreen: 'prompt-task-folders',
    selectedScreenData: { promptFolderId: 'Alpha' },
    promptFolderViewEntries: [
      {
        contentOwnerId: 'Alpha',
        selectedEntryId: 'Alpha-Todo-10',
        scrollTopByMode: { active: initialActiveOffset, backlog: 900, completed: 271, archived: 389 }
      },
      {
        contentOwnerId: 'Beta',
        selectedEntryId: 'folder-settings',
        scrollTopByMode: { active: 223, completed: 317, archived: 431 }
      }
    ]
  })
  return await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
}

/** Reads saved offsets without extending existing snapshot equality contracts. */
const readOffsets = async (electronApp: ElectronApplication, folderId: 'Alpha' | 'Beta') => {
  /** SQLite result after the normal renderer autosave has flushed. */
  const result = await runSqlQuery(
    electronApp,
    `SELECT scroll_top_by_mode_json AS offsets FROM prompt_folder_view_state
     WHERE workspace_id = '${WORKSPACE_ID}' AND content_owner_id = '${folderId}'`
  )
  expect(result.success).toBe(true)
  return JSON.parse(String(result.rows?.[0]?.offsets)) as Record<string, number>
}

/** Checks actual viewport position with the repository's pixel tolerance. */
const expectScroll = async (
  testHelpers: { getElementScrollTop: (selector: string) => Promise<number> },
  expected: number
) => {
  await expect
    .poll(async () => Math.abs((await testHelpers.getElementScrollTop(HOST)) - expected))
    .toBeLessThanOrEqual(2)
}

describe('Prompt folder status scroll restoration', () => {
  test('restores exact startup and root offsets, while explicit item and overview navigation win', async ({ electronApp, testSetup }) => {
    /** Startup uses Active's saved viewport even though prompt 10 was selected. */
    const { mainWindow, testHelpers } = await startSavedWorkspace({ electronApp, testSetup }, 1200)
    await expect(mainWindow.getByTestId('prompt-folder-header-section')).toHaveText('Active')
    await expectScroll(testHelpers, 1200)
    await testHelpers.scrollVirtualWindowTo(HOST, 181)
    await expectScroll(testHelpers, 181)
    await clickPromptFolderItem(mainWindow, 'Beta')
    await expectScroll(testHelpers, 223)
    await clickPromptFolderItem(mainWindow, 'Alpha')
    await expectScroll(testHelpers, 181)
    await expect.poll(async () => (await readOffsets(electronApp, 'Alpha')).active).toBe(181)

    await testHelpers.scrollVirtualWindowTo('[data-testid="prompt-tree-active-virtual-window"]', 0)
    await mainWindow.getByTestId('prompt-tree-active-prompt-Alpha-Todo-0').click()
    await expect(mainWindow.getByTestId('prompt-editor-Alpha-Todo-0')).toBeVisible()
    await expect
      .poll(async () => Math.abs((await testHelpers.getElementScrollTop(HOST)) - 181))
      .toBeGreaterThan(2)
    await testHelpers.scrollVirtualWindowTo(HOST, 500)
    await mainWindow.getByTestId('sidebar-folder-root-button').click()
    await expectScroll(testHelpers, 0)
    await expect.poll(async () => (await readOffsets(electronApp, 'Alpha')).active).toBe(0)
  })

  test('header tabs copy the current offset and persist the reachable position in an empty mode', async ({ electronApp, testSetup }) => {
    /** A shallow scroll leaves the header tabs visible for a genuine pointer click. */
    const { mainWindow, testHelpers } = await startSavedWorkspace({ electronApp, testSetup })
    await expectScroll(testHelpers, 137)
    await testHelpers.scrollVirtualWindowTo(HOST, 40)
    await expectScroll(testHelpers, 40)
    await mainWindow.getByTestId('prompt-folder-completed-filter').click()
    await expectScroll(testHelpers, 40)
    await expect.poll(async () => (await readOffsets(electronApp, 'Alpha')).completed).toBe(40)
    await clickPromptFolderItem(mainWindow, 'Beta')
    await expectScroll(testHelpers, 317)
    await clickPromptFolderItem(mainWindow, 'Alpha')
    await expectScroll(testHelpers, 40)
    await mainWindow.getByTestId('prompt-folder-archived-filter').click()
    await expectScroll(testHelpers, 40)
    await expect.poll(async () => (await readOffsets(electronApp, 'Alpha')).archived).toBe(40)
    await clickPromptFolderItem(mainWindow, 'Beta')
    await expectScroll(testHelpers, 431)
    await testHelpers.scrollVirtualWindowTo(HOST, 0)
    await mainWindow.getByTestId('prompt-folder-backlog-filter').click()
    await clickPromptFolderItem(mainWindow, 'Alpha')
    /** Empty Backlog can still scroll through its header and proportional bottom spacer. */
    const reachableOffset = Math.max(
      0,
      (await testHelpers.getVirtualWindowScrollHeight(HOST)) -
        (await (mainWindow as Page).locator(HOST).evaluate((host) => host.clientHeight))
    )
    expect(reachableOffset).toBeLessThan(900)
    await expectScroll(testHelpers, reachableOffset)
    await expect
      .poll(async () => Math.abs((await readOffsets(electronApp, 'Alpha')).backlog - reachableOffset))
      .toBeLessThanOrEqual(2)
    await expect.poll(async () => (await readOffsets(electronApp, 'Alpha')).active).toBe(40)
    expect(await readOffsets(electronApp, 'Beta')).toEqual({
      active: 223,
      backlog: 0,
      completed: 317,
      archived: 0
    })
  })

  test('enabling a finalized sidebar section resets only that mode in the selected root', async ({ electronApp, testSetup }) => {
    /** Both finalized modes begin hidden while their saved offsets remain available. */
    const { mainWindow, testHelpers } = await startSavedWorkspace({ electronApp, testSetup })
    await expectScroll(testHelpers, 137)
    await mainWindow.getByTestId('toggle-completed-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-folder-completed-filter')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expectScroll(testHelpers, 0)
    await expect.poll(() => readOffsets(electronApp, 'Alpha')).toEqual({
      active: 137,
      backlog: 900,
      completed: 0,
      archived: 389
    })
    await testHelpers.scrollVirtualWindowTo(HOST, 191)
    await expectScroll(testHelpers, 191)
    await mainWindow.getByTestId('toggle-archived-prompts-button').click()
    await expect(mainWindow.getByTestId('prompt-folder-archived-filter')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await expectScroll(testHelpers, 0)
    await expect.poll(() => readOffsets(electronApp, 'Alpha')).toEqual({
      active: 137,
      backlog: 900,
      completed: 191,
      archived: 0
    })
    expect(await readOffsets(electronApp, 'Beta')).toEqual({
      active: 223,
      completed: 317,
      archived: 431
    })
  })
})
