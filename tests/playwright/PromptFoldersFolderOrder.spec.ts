import type { ElectronApplication, Page } from 'playwright'
import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import {
  beginPromptTreeFolderDrag,
  dragPromptTreeFolderToTarget,
  finishActiveDrag,
  promptTreeFolderDropIndicatorSelector,
  promptTreeFolderSelector
} from '../helpers/PromptDragDropHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order'
const CREATE_FOLDER_WORKSPACE_PATH = '/ws/folder-order-create'
const DRAG_FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order-drag'
const SNAP_FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order-snap'
const OVERSCAN_FOLDER_ORDER_WORKSPACE_PATH = '/ws/folder-order-overscan'
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'

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
    .locator('[data-testid^="regular-prompt-folder-"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''))
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
        'regular-prompt-folder-middle',
        'regular-prompt-folder-zeta',
        'regular-prompt-folder-Alpha',
        'regular-prompt-folder-beta'
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
    await mainWindow.locator('[data-testid="folder-name-input"]').fill('New Folder')
    await mainWindow.locator('[data-testid="create-folder-button"]').click()

    await expect(mainWindow.locator('[data-testid="regular-prompt-folder-NewFolder"]')).toHaveCount(
      1
    )
    await expect
      .poll(async () => await readPromptTreeFolderTestIds(mainWindow))
      .toEqual([
        'regular-prompt-folder-NewFolder',
        'regular-prompt-folder-Alpha',
        'regular-prompt-folder-Beta'
      ])
    await expect
      .poll(
        async () => await readWorkspacePromptFolderIds(electronApp, CREATE_FOLDER_WORKSPACE_PATH)
      )
      .toEqual([expect.not.stringMatching(/^folder-(alpha|beta)$/), 'folder-alpha', 'folder-beta'])
  })

  test('reorders folders from folder row drag and drop edges', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createEmptyFolderWorkspace(DRAG_FOLDER_ORDER_WORKSPACE_PATH, ['Alpha', 'Beta', 'Gamma'])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(DRAG_FOLDER_ORDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await dragPromptTreeFolderToTarget(
      mainWindow,
      'Gamma',
      promptTreeFolderSelector('Alpha'),
      'top'
    )

    await expect
      .poll(async () => await readPromptTreeFolderTestIds(mainWindow))
      .toEqual([
        'regular-prompt-folder-Gamma',
        'regular-prompt-folder-Alpha',
        'regular-prompt-folder-Beta'
      ])
    await expect
      .poll(
        async () =>
          await readWorkspacePromptFolderIds(electronApp, DRAG_FOLDER_ORDER_WORKSPACE_PATH)
      )
      .toEqual(['folder-gamma', 'folder-alpha', 'folder-beta'])

    await dragPromptTreeFolderToTarget(
      mainWindow,
      'Gamma',
      promptTreeFolderSelector('Beta'),
      'bottom'
    )

    await expect
      .poll(async () => await readPromptTreeFolderTestIds(mainWindow))
      .toEqual([
        'regular-prompt-folder-Alpha',
        'regular-prompt-folder-Beta',
        'regular-prompt-folder-Gamma'
      ])
    await expect
      .poll(
        async () =>
          await readWorkspacePromptFolderIds(electronApp, DRAG_FOLDER_ORDER_WORKSPACE_PATH)
      )
      .toEqual(['folder-alpha', 'folder-beta', 'folder-gamma'])
  })

  test('silently ignores folder drops that would not move the folder', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(
      createEmptyFolderWorkspace(DRAG_FOLDER_ORDER_WORKSPACE_PATH, ['Alpha', 'Beta', 'Gamma'])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(DRAG_FOLDER_ORDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await beginPromptTreeFolderDrag(mainWindow, 'Alpha')
    await mainWindow.locator(promptTreeFolderSelector('Beta')).hover({
      position: { x: 12, y: 4 }
    })
    await expect(mainWindow.locator(promptTreeFolderDropIndicatorSelector('Beta'))).toHaveCount(0)
    await finishActiveDrag(mainWindow)

    await expect
      .poll(async () => await readPromptTreeFolderTestIds(mainWindow))
      .toEqual([
        'regular-prompt-folder-Alpha',
        'regular-prompt-folder-Beta',
        'regular-prompt-folder-Gamma'
      ])
    await expect(
      await readWorkspacePromptFolderIds(electronApp, DRAG_FOLDER_ORDER_WORKSPACE_PATH)
    ).toEqual(['folder-alpha', 'folder-beta', 'folder-gamma'])
  })

  test('snaps folder drops to the nearest visible row edge', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(
      createEmptyFolderWorkspace(SNAP_FOLDER_ORDER_WORKSPACE_PATH, ['Alpha', 'Beta', 'Gamma'])
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(SNAP_FOLDER_ORDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)

    await beginPromptTreeFolderDrag(mainWindow, 'Alpha')

    const gammaBox = await mainWindow.locator(promptTreeFolderSelector('Gamma')).boundingBox()
    if (!gammaBox) {
      throw new Error('Missing Gamma folder row geometry')
    }

    await mainWindow.mouse.move(gammaBox.x + gammaBox.width / 2, gammaBox.y + gammaBox.height + 8)
    await expect(mainWindow.locator(promptTreeFolderDropIndicatorSelector('Gamma'))).toHaveCount(1)
    await finishActiveDrag(mainWindow)

    await expect
      .poll(
        async () =>
          await readWorkspacePromptFolderIds(electronApp, SNAP_FOLDER_ORDER_WORKSPACE_PATH)
      )
      .toEqual(['folder-beta', 'folder-gamma', 'folder-alpha'])
  })

  test('does not snap folder drops to virtual overscan rows outside the viewport', async ({
    electronApp,
    testSetup
  }) => {
    const folderNames = Array.from(
      { length: 36 },
      (_, index) => `Folder${String(index + 1).padStart(2, '0')}`
    )
    await testSetup.setupFilesystem(
      createEmptyFolderWorkspace(OVERSCAN_FOLDER_ORDER_WORKSPACE_PATH, folderNames)
    )
    await testSetup.setupFileDialog([getWorkspaceInfoPath(OVERSCAN_FOLDER_ORDER_WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    const workspaceSetupResult = await testHelpers.setupWorkspaceViaUI()
    expect(workspaceSetupResult.workspaceReady).toBe(true)
    await testHelpers.scrollVirtualWindowTo(PROMPT_TREE_HOST_SELECTOR, 620)

    const geometry = await mainWindow.evaluate((hostSelector) => {
      const host = document.querySelector<HTMLElement>(hostSelector)
      if (!host) {
        return null
      }

      const hostRect = host.getBoundingClientRect()
      const folderButtons = Array.from(
        document.querySelectorAll<HTMLElement>('[data-testid^="prompt-folder-toggle-"]')
      )
      const visibleButton = folderButtons.find((button) => {
        const rect = button.getBoundingClientRect()
        return rect.top >= hostRect.top && rect.bottom <= hostRect.bottom
      })
      const overscanButton = folderButtons
        .filter((button) => button.getBoundingClientRect().bottom < hostRect.top)
        .at(-1)

      if (!visibleButton || !overscanButton) {
        return null
      }

      const visibleTestId = visibleButton.getAttribute('data-testid') ?? ''
      const overscanTestId = overscanButton.getAttribute('data-testid') ?? ''
      const overscanRect = overscanButton.getBoundingClientRect()

      return {
        sourceFolderName: visibleTestId.replace('prompt-folder-toggle-', ''),
        overscanFolderName: overscanTestId.replace('prompt-folder-toggle-', ''),
        x: overscanRect.left + overscanRect.width / 2,
        y: overscanRect.top + overscanRect.height / 2
      }
    }, PROMPT_TREE_HOST_SELECTOR)

    if (!geometry) {
      throw new Error('Missing prompt tree overscan geometry')
    }

    await beginPromptTreeFolderDrag(mainWindow, geometry.sourceFolderName)
    await mainWindow.mouse.move(geometry.x, geometry.y)
    await expect(
      mainWindow.locator(promptTreeFolderDropIndicatorSelector(geometry.overscanFolderName))
    ).toHaveCount(0)
    await finishActiveDrag(mainWindow)

    await expect(
      await readWorkspacePromptFolderIds(electronApp, OVERSCAN_FOLDER_ORDER_WORKSPACE_PATH)
    ).toEqual(folderNames.map((folderName) => `folder-${folderName.toLowerCase()}`))
  })
})
