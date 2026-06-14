import type { ElectronApplication, Page } from 'playwright'
import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { finishActiveDrag, moveActiveDragToTarget } from '../helpers/PromptDragDropHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order'
const CREATE_FOLDER_WORKSPACE_PATH = '/ws/folder-order-create'
const DROPDOWN_DRAG_FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order-dropdown-drag'
const DROPDOWN_FOOTER_FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order-dropdown-footer'
const DROPDOWN_NOOP_FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order-dropdown-noop'
const PROMPT_FOLDER_SELECTOR_MENU = '[data-testid="sidebar-prompt-folder-selector-menu"]'
const PROMPT_FOLDER_SELECTOR_TRIGGER = '[data-testid="sidebar-prompt-folder-selector-trigger"]'
const PROMPT_FOLDER_DROPDOWN_ITEM_PREFIX = 'sidebar-prompt-folder-dropdown-item-'
const PROMPT_FOLDER_DROPDOWN_DROP_INDICATOR_PREFIX =
  'sidebar-prompt-folder-dropdown-drop-indicator-'

const workspaceFolderOrderPath = (workspacePath: string): string =>
  `${workspacePath}/Prompts/FolderOrder.json`

const readTextFile = async (
  electronApp: ElectronApplication,
  filePath: string
): Promise<string> => {
  const requestId = createTestRequestId('read')

  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { targetPath, requestId } = payload
      return await new Promise<string>((resolve) => {
        app.once(`test-read-file-ready:${requestId}`, (result: { content: string }) => {
          resolve(result.content)
        })
        app.emit('test-read-file', { filePath: targetPath, requestId })
      })
    },
    { targetPath: filePath, requestId }
  )
}

const readWorkspacePromptFolderIds = async (
  electronApp: ElectronApplication,
  workspacePath: string
): Promise<string[]> => {
  const fileContents = await readTextFile(electronApp, workspaceFolderOrderPath(workspacePath))
  return (JSON.parse(fileContents) as { promptFolderIds: string[] }).promptFolderIds
}

const readPromptTreeFolderTestIds = async (page: Page): Promise<string[]> => {
  return await page
    .locator('[data-testid^="prompt-tree-folder-open-button-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''))
}

const readPromptFolderDropdownItemTestIds = async (page: Page): Promise<string[]> => {
  return await page
    .locator(`[data-testid^="${PROMPT_FOLDER_DROPDOWN_ITEM_PREFIX}"]`)
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''))
}

const promptFolderDropdownItemSelector = (folderId: string): string =>
  `[data-testid="${PROMPT_FOLDER_DROPDOWN_ITEM_PREFIX}${folderId}"]`

const promptFolderDropdownDragHandleSelector = (folderId: string): string =>
  `[data-testid="sidebar-prompt-folder-dropdown-drag-handle-${folderId}"]`

const promptFolderDropdownDropIndicatorSelector = (folderId: string): string =>
  `[data-testid="${PROMPT_FOLDER_DROPDOWN_DROP_INDICATOR_PREFIX}${folderId}"]`

const beginPromptFolderDropdownDrag = async (page: Page, folderId: string): Promise<void> => {
  const item = page.locator(promptFolderDropdownItemSelector(folderId))
  await item.scrollIntoViewIfNeeded()
  await expect(item).toBeVisible()

  const box = await item.boundingBox()
  if (!box) {
    throw new Error(`Missing prompt folder dropdown geometry for ${folderId}`)
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 8, box.y + box.height / 2 + 8, { steps: 4 })
  await expect(page.locator('body')).toHaveCSS('cursor', 'grabbing')
}

const createEmptyFolderWorkspace = (workspacePath: string, folderNames: string[]) =>
  createWorkspaceWithFolders(
    workspacePath,
    folderNames.map((folderName) => ({
      folderName,
      displayName: folderName,
      promptFolderId: `folder-${folderName.toLowerCase()}`
    }))
  )

describe('Prompt Folder Order', () => {
  test('loads explicitly ordered folders before unordered folders sorted by disk name', async ({
    electronApp,
    testSetup
  }) => {
    const filesystem = createWorkspaceWithFolders(FOLDER_ORDER_WORKSPACE_PATH, [
      { folderName: 'zeta', displayName: 'Zeta', promptFolderId: 'folder-zeta' },
      { folderName: 'Alpha', displayName: 'Alpha', promptFolderId: 'folder-alpha' },
      { folderName: 'middle', displayName: 'Middle', promptFolderId: 'folder-middle' },
      { folderName: 'beta', displayName: 'Beta', promptFolderId: 'folder-beta' }
    ])
    filesystem[workspaceFolderOrderPath(FOLDER_ORDER_WORKSPACE_PATH)] = JSON.stringify(
      { promptFolderIds: ['missing-folder', 'folder-middle', 'folder-zeta'] },
      null,
      2
    )

    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(FOLDER_ORDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await expect
      .poll(async () => await readPromptTreeFolderTestIds(mainWindow))
      .toEqual([
        'prompt-tree-folder-open-button-middle',
        'prompt-tree-folder-open-button-zeta',
        'prompt-tree-folder-open-button-Alpha',
        'prompt-tree-folder-open-button-beta'
      ])
    await expect(
      await readWorkspacePromptFolderIds(electronApp, FOLDER_ORDER_WORKSPACE_PATH)
    ).toEqual(['missing-folder', 'folder-middle', 'folder-zeta'])
  })

  test('adds new folders to the top of the persisted folder order', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createWorkspaceWithFolders(CREATE_FOLDER_WORKSPACE_PATH, [
        { folderName: 'Alpha', displayName: 'Alpha', promptFolderId: 'folder-alpha' },
        { folderName: 'Beta', displayName: 'Beta', promptFolderId: 'folder-beta' }
      ])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(CREATE_FOLDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator('[data-testid="sidebar-prompt-folder-selector-trigger"]').click()
    await mainWindow.locator('[data-testid="sidebar-prompt-folder-dropdown-add-item"]').click()
    await mainWindow.locator('[data-testid="create-prompt-folder-name-input"]').fill('New Folder')
    await mainWindow.locator('[data-testid="create-prompt-folder-button"]').click()

    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-open-button-NewFolder"]')
    ).toHaveCount(1)
    await expect
      .poll(async () => await readPromptTreeFolderTestIds(mainWindow))
      .toEqual([
        'prompt-tree-folder-open-button-NewFolder',
        'prompt-tree-folder-open-button-Alpha',
        'prompt-tree-folder-open-button-Beta'
      ])
    await expect
      .poll(
        async () => await readWorkspacePromptFolderIds(electronApp, CREATE_FOLDER_WORKSPACE_PATH)
      )
      .toEqual([expect.not.stringMatching(/^folder-(alpha|beta)$/), 'folder-alpha', 'folder-beta'])
  })

  test('reorders folders from the folder selector dropdown without changing selection', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createEmptyFolderWorkspace(DROPDOWN_DRAG_FOLDER_ORDER_WORKSPACE_PATH, [
        'Alpha',
        'Beta',
        'Gamma'
      ])
    )
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(DROPDOWN_DRAG_FOLDER_ORDER_WORKSPACE_PATH)
    ])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Beta')

    await mainWindow.locator(PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await expect(mainWindow.locator(PROMPT_FOLDER_SELECTOR_MENU)).toBeVisible()
    await mainWindow.locator(promptFolderDropdownDragHandleSelector('folder-gamma')).hover()
    await expect(
      mainWindow.locator(promptFolderDropdownDragHandleSelector('folder-gamma'))
    ).toHaveCSS('cursor', 'grab')

    await beginPromptFolderDropdownDrag(mainWindow, 'folder-gamma')
    await expect(
      mainWindow.locator(promptFolderDropdownItemSelector('folder-gamma'))
    ).toHaveAttribute('data-dragging', 'true')
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderDropdownItemSelector('folder-alpha'),
      'top'
    )
    await expect(
      mainWindow.locator(promptFolderDropdownDropIndicatorSelector('folder-alpha'))
    ).toHaveCount(1)
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(PROMPT_FOLDER_SELECTOR_MENU)).toBeVisible()
    await expect(mainWindow.locator(PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText('Beta')
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-folder-open-button-Beta"]')
    ).toHaveAttribute('data-active', 'true')
    await expect
      .poll(async () => await readPromptFolderDropdownItemTestIds(mainWindow))
      .toEqual([
        'sidebar-prompt-folder-dropdown-item-folder-gamma',
        'sidebar-prompt-folder-dropdown-item-folder-alpha',
        'sidebar-prompt-folder-dropdown-item-folder-beta'
      ])
    await expect
      .poll(
        async () =>
          await readWorkspacePromptFolderIds(electronApp, DROPDOWN_DRAG_FOLDER_ORDER_WORKSPACE_PATH)
      )
      .toEqual(['folder-gamma', 'folder-alpha', 'folder-beta'])
  })

  test('ignores folder selector dropdown drops on the add folder footer', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createEmptyFolderWorkspace(DROPDOWN_FOOTER_FOLDER_ORDER_WORKSPACE_PATH, [
        'Alpha',
        'Beta',
        'Gamma'
      ])
    )
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(DROPDOWN_FOOTER_FOLDER_ORDER_WORKSPACE_PATH)
    ])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await beginPromptFolderDropdownDrag(mainWindow, 'folder-alpha')
    await moveActiveDragToTarget(
      mainWindow,
      '[data-testid="sidebar-prompt-folder-dropdown-add-item"]'
    )
    await expect(
      mainWindow.locator(`[data-testid^="${PROMPT_FOLDER_DROPDOWN_DROP_INDICATOR_PREFIX}"]`)
    ).toHaveCount(0)
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(PROMPT_FOLDER_SELECTOR_MENU)).toBeVisible()
    await expect(
      await readWorkspacePromptFolderIds(electronApp, DROPDOWN_FOOTER_FOLDER_ORDER_WORKSPACE_PATH)
    ).toEqual(['folder-alpha', 'folder-beta', 'folder-gamma'])
  })

  test('suppresses no-op folder selector dropdown drops', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(
      createEmptyFolderWorkspace(DROPDOWN_NOOP_FOLDER_ORDER_WORKSPACE_PATH, [
        'Alpha',
        'Beta',
        'Gamma'
      ])
    )
    await testSetup.setupFileDialog([
      getWorkspaceInfoPath(DROPDOWN_NOOP_FOLDER_ORDER_WORKSPACE_PATH)
    ])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await mainWindow.locator(PROMPT_FOLDER_SELECTOR_TRIGGER).click()
    await beginPromptFolderDropdownDrag(mainWindow, 'folder-alpha')
    await moveActiveDragToTarget(mainWindow, promptFolderDropdownItemSelector('folder-beta'), 'top')
    await expect(
      mainWindow.locator(promptFolderDropdownDropIndicatorSelector('folder-beta'))
    ).toHaveCount(0)
    await finishActiveDrag(mainWindow)

    await expect(mainWindow.locator(PROMPT_FOLDER_SELECTOR_MENU)).toBeVisible()
    await expect(
      await readWorkspacePromptFolderIds(electronApp, DROPDOWN_NOOP_FOLDER_ORDER_WORKSPACE_PATH)
    ).toEqual(['folder-alpha', 'folder-beta', 'folder-gamma'])
  })
})
