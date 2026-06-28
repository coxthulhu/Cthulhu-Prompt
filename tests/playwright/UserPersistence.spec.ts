import { getWorkspaceInfoPath, setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'
import {
  readUserPersistence,
  readWorkspacePersistence,
  runSqlStatement,
  seedUserPersistence,
  seedWindowPersistence,
  seedWorkspacePersistence,
  toSqlText
} from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'

const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

const readMainWindowState = async (
  electronApp: any
): Promise<{
  x: number
  y: number
  width: number
  height: number
  isMaximized: boolean
  isFullScreen: boolean
}> => {
  const requestId = createTestRequestId('window-state')
  const result = await electronApp.evaluate(
    async ({ app }, payload) => {
      const { requestId } = payload
      return await new Promise<{ success: boolean; state?: unknown; error?: string }>((resolve) => {
        app.once(`test-read-main-window-state-ready:${requestId}`, (nextPayload) => {
          resolve(nextPayload)
        })
        app.emit('test-read-main-window-state', { requestId })
      })
    },
    { requestId }
  )

  if (!result.success || !result.state) {
    throw new Error(result.error ?? 'Main window is not available')
  }

  return result.state as {
    x: number
    y: number
    width: number
    height: number
    isMaximized: boolean
    isFullScreen: boolean
  }
}

const getActivePromptTreeTitle = async (mainWindow: any): Promise<string | null> => {
  return await mainWindow.evaluate((hostSelector) => {
    const host = document.querySelector<HTMLElement>(hostSelector)
    if (!host) return null
    const activeButton = host.querySelector<HTMLButtonElement>(
      'button[data-row-state="active"][data-testid^="prompt-tree-prompt-"]'
    )
    return activeButton?.textContent?.trim() ?? null
  }, PROMPT_TREE_HOST_SELECTOR)
}

const getSidebarWidthByHandle = async (mainWindow: any, handleTestId: string): Promise<number> => {
  const width = await mainWindow.evaluate((selector) => {
    const handle = document.querySelector<HTMLElement>(selector)
    if (!handle) return null
    const widthHost = handle.parentElement?.parentElement?.parentElement as HTMLElement | null
    if (!widthHost) return null
    return Math.round(widthHost.getBoundingClientRect().width)
  }, `[data-testid="${handleTestId}"]`)

  if (width == null) {
    throw new Error(`Failed to measure sidebar width for ${handleTestId}`)
  }

  return width
}

const dragSidebarHandleBy = async (
  mainWindow: any,
  handleTestId: string,
  distance: number
): Promise<void> => {
  const handle = mainWindow.locator(`[data-testid="${handleTestId}"]`)
  await handle.waitFor({ state: 'visible' })

  const handleBox = (await handle.boundingBox())!
  const handleCenterX = handleBox.x + handleBox.width / 2
  const handleCenterY = handleBox.y + handleBox.height / 2

  await mainWindow.mouse.move(handleCenterX, handleCenterY)
  await mainWindow.mouse.down()
  await mainWindow.mouse.move(handleCenterX + distance, handleCenterY, { steps: 10 })
  await mainWindow.mouse.up()
}

describe('User Persistence', () => {
  test('reopens the persisted workspace on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-workspace'

    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'minimal'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })

    // Startup should restore the workspace directly from user persistence.
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="sidebar-workspace-name"]')).toHaveText(
      'persisted-workspace'
    )
  })

  test('applies persisted sidebar widths from user persistence', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-widths'

    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath),
      appSidebarWidthPx: 260
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="sidebar-workspace-name"]')).toHaveText(
      'persisted-widths'
    )

    await testHelpers.navigateToPromptFolders('Development')

    await expect
      .poll(async () => getSidebarWidthByHandle(mainWindow, 'app-sidebar-resize-handle'))
      .toBe(260)
  })

  test('restores persisted window bounds on startup', async ({ electronApp, testSetup }) => {
    await seedWindowPersistence(electronApp, {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      isMaximized: false,
      isFullScreen: false
    })

    await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect
      .poll(async () => {
        const state = await readMainWindowState(electronApp)
        return `${state.x}:${state.y}:${state.width}:${state.height}`
      })
      .toBe('0:0:800:600')
  })

  test('uses default window size when persisted bounds are invalid', async ({
    electronApp,
    testSetup
  }) => {
    await seedWindowPersistence(electronApp, {
      x: 50000,
      y: 50000,
      width: 930,
      height: 690,
      isMaximized: false,
      isFullScreen: false
    })

    await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect
      .poll(async () => {
        const state = await readMainWindowState(electronApp)
        return `${state.width}:${state.height}`
      })
      .toBe('1366:768')
  })

  test('prefers fullscreen when fullscreen and maximized are both persisted', async ({
    electronApp,
    testSetup
  }) => {
    await seedWindowPersistence(electronApp, {
      x: 120,
      y: 140,
      width: 930,
      height: 690,
      isMaximized: true,
      isFullScreen: true
    })

    await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect
      .poll(async () => {
        const state = await readMainWindowState(electronApp)
        return state.isFullScreen
      })
      .toBe(true)
  })

  test('autosaves sidebar width changes to user persistence', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')

    await dragSidebarHandleBy(mainWindow, 'app-sidebar-resize-handle', -40)

    await expect
      .poll(async () => {
        const persisted = await readUserPersistence(electronApp)
        return `${persisted.appSidebarWidthPx}`
      })
      .toBe('240')
  })

  test('reopens the persisted prompt-folder screen on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-screen'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const persistedPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: persistedPromptFolderId },
      promptFolderPromptTreeEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Development Tools'
    )
  })

  test('resets invalid persisted prompt-folder startup screen to home and saves it', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-invalid-screen'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: 'missing-folder-id' },
      promptFolderPromptTreeEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${JSON.stringify(persisted.selectedScreenData)}`
      })
      .toBe('home:null')
  })

  test('resets invalid persisted mockup startup screen to home and saves it', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-invalid-mockup-screen'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'mockups',
      selectedScreenData: { mockupId: 'missing-mockup-id' },
      promptFolderPromptTreeEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${JSON.stringify(persisted.selectedScreenData)}`
      })
      .toBe('home:null')
  })

  test('resets malformed persisted screen data to home and saves it', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-malformed-screen-data'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await runSqlStatement(
      electronApp,
      `
      INSERT INTO workspace_ui_state (
        workspace_id,
        selected_screen,
        selected_screen_data_json
      )
      VALUES (
        ${toSqlText(workspaceId)},
        'mockups',
        '{malformed'
      )
      `
    )

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${JSON.stringify(persisted.selectedScreenData)}`
      })
      .toBe('home:null')
  })

  test('syncs workspace screen persistence and clears folder when leaving prompt folders', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const developmentPromptFolderId = createDeterministicId(`${workspacePath}:Development`)
    const { testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return [
          persisted.selectedScreen,
          JSON.stringify(persisted.selectedScreenData),
          persisted.lastPromptFolderId
        ].join(':')
      })
      .toBe(
        `prompt-folders:{"promptFolderId":"${developmentPromptFolderId}"}:${developmentPromptFolderId}`
      )

    await testHelpers.navigateToSettingsScreen()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return [
          persisted.selectedScreen,
          JSON.stringify(persisted.selectedScreenData),
          persisted.lastPromptFolderId
        ].join(':')
      })
      .toBe(`settings:null:${developmentPromptFolderId}`)
  })

  test('opens the persisted last prompt folder from the activity bar', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-last-folder'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      lastPromptFolderId: developmentPromptFolderId,
      promptFolderPromptTreeEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await mainWindow.locator('[data-testid="nav-button-prompt-folders"]').click()

    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Development Tools'
    )
    await expect(mainWindow.locator('[data-testid="nav-button-prompt-folders"]')).toHaveAttribute(
      'data-active',
      'true'
    )
  })

  test('autosaves active prompt tree entry id in workspace persistence', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const developmentPromptFolderId = createDeterministicId(`${workspacePath}:Development`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const bugAnalysisButton = mainWindow.locator('[data-testid="prompt-tree-prompt-dev-2"]')
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('data-row-state', 'active')
    await testHelpers.navigateToHomeScreen()

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entries = persisted.promptFolderPromptTreeEntries
          const promptTreeEntry = entries.find(
            (entry) => entry.promptFolderId === developmentPromptFolderId
          )
          return promptTreeEntry?.promptTreeEntryId ?? null
        },
        { timeout: 15000 }
      )
      .toBe('dev-2')
  })

  test('autosaves prompt tree entries for multiple folders', async ({ electronApp, testSetup }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const examplesPromptFolderId = createDeterministicId(`${workspacePath}:Examples`)
    const developmentPromptFolderId = createDeterministicId(`${workspacePath}:Development`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const bugAnalysisButton = mainWindow.locator('[data-testid="prompt-tree-prompt-dev-2"]')
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('data-row-state', 'active')

    await testHelpers.navigateToPromptFolders('Examples')
    const simpleGreetingButton = mainWindow.locator('[data-testid="prompt-tree-prompt-simple-1"]')
    await simpleGreetingButton.click()
    await expect(simpleGreetingButton).toHaveAttribute('data-row-state', 'active')
    await testHelpers.navigateToHomeScreen()

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entries = persisted.promptFolderPromptTreeEntries
          const examplesEntry = entries.find(
            (entry) => entry.promptFolderId === examplesPromptFolderId
          )
          const developmentEntry = entries.find(
            (entry) => entry.promptFolderId === developmentPromptFolderId
          )
          return `${examplesEntry?.promptTreeEntryId ?? 'none'}:${developmentEntry?.promptTreeEntryId ?? 'none'}:${entries.length}`
        },
        { timeout: 15000 }
      )
      .toBe('simple-1:dev-2:2')
  })


  test('autosaves prompt folder prompts section expanded state', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const developmentPromptFolderId = createDeterministicId(`${workspacePath}:Development`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const folderEditorToggle = mainWindow.locator(
      '[data-testid="prompt-folder-editor-title-toggle"]'
    )
    await expect(folderEditorToggle).toHaveAttribute('aria-expanded', 'true')

    await folderEditorToggle.click()
    await expect(folderEditorToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid^="prompt-folder-editor-"]')).not.toHaveCount(0)
    await expect(mainWindow.locator('[data-testid^="prompt-editor-"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-divider-add-initial"]')).toHaveCount(0)

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entry = persisted.promptFolderPromptTreeEntries.find(
            (promptTreeEntry) => promptTreeEntry.promptFolderId === developmentPromptFolderId
          )
          const settingsExpanded = entry?.folderSettingsSectionIsExpanded ?? null
          const promptsExpanded = entry?.promptsSectionIsExpanded ?? null
          return `${settingsExpanded}:${promptsExpanded}`
        },
        { timeout: 15000 }
      )
      .toBe('false:false')
  })

  test('autosaves prompt folder settings section expanded state', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const developmentPromptFolderId = createDeterministicId(`${workspacePath}:Development`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')

    const settingsToggle = mainWindow.locator(
      '[data-testid="prompt-folder-editor-settings-toggle"]'
    )
    await expect(settingsToggle).toHaveAttribute('aria-pressed', 'false')

    await settingsToggle.click()
    await expect(settingsToggle).toHaveAttribute('aria-pressed', 'true')

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entry = persisted.promptFolderPromptTreeEntries.find(
            (promptTreeEntry) => promptTreeEntry.promptFolderId === developmentPromptFolderId
          )
          return entry?.folderSettingsSectionIsExpanded ?? null
        },
        { timeout: 15000 }
      )
      .toBe(true)
  })

  test('restores collapsed prompt rows on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-folder-sections'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(
      `${persistedWorkspacePath}:Development`
    )
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: developmentPromptFolderId },
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: developmentPromptFolderId,
          promptTreeEntryId: 'folder-settings',
          folderSettingsSectionIsExpanded: false,
          promptsSectionIsExpanded: false
        }
      ]
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-editor-title-toggle"]')
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid^="prompt-folder-editor-"]')).not.toHaveCount(0)
    await expect(mainWindow.locator('[data-testid^="prompt-editor-"]')).toHaveCount(0)
  })

  test('restores expanded prompt folder settings on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-folder-settings'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(
      `${persistedWorkspacePath}:Development`
    )
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: developmentPromptFolderId },
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: developmentPromptFolderId,
          promptTreeEntryId: 'folder-settings',
          folderSettingsSectionIsExpanded: true,
          promptsSectionIsExpanded: true
        }
      ]
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="prompt-folder-editor-settings-toggle"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      mainWindow.locator('[data-testid^="prompt-folder-settings-section-"]')
    ).toHaveCount(3)
  })

  test('restores persisted prompt tree entry on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-tree-entry'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: developmentPromptFolderId },
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: developmentPromptFolderId,
          promptTreeEntryId: 'dev-2'
        }
      ]
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(mainWindow.locator(SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER)).toContainText(
      'Development Tools'
    )
    await expect.poll(async () => getActivePromptTreeTitle(mainWindow)).toBe('Bug Analysis')
  })

  test('restores and auto-scrolls prompt tree to persisted entry on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-tree-entry-long'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const longPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Long`)
    const persistedPromptId = 'virtualization-test-45'
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'virtual'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: longPromptFolderId },
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: longPromptFolderId,
          promptTreeEntryId: persistedPromptId
        }
      ]
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect.poll(async () => getActivePromptTreeTitle(mainWindow)).toBe('Large Prompt 45')
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_TREE_HOST_SELECTOR))
      .toBeGreaterThan(0)
  })

  test('stays scrolled to top when persisted prompt tree entry is missing', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-tree-entry-missing'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: developmentPromptFolderId },
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: developmentPromptFolderId,
          promptTreeEntryId: 'missing-prompt-id'
        }
      ]
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect
      .poll(async () =>
        testHelpers.getElementScrollTop('[data-testid="prompt-folder-virtual-window"]')
      )
      .toBe(0)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_TREE_HOST_SELECTOR))
      .toBe(0)
  })
})
