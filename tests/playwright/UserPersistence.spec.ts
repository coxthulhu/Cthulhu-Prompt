import { setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite, createTestRequestId } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-virtual-window"]'

const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

const toSqlText = (value: string): string => {
  return `'${value.replace(/'/g, "''")}'`
}

const runSqlQuery = async (
  electronApp: any,
  sql: string
): Promise<{ success: boolean; rows?: Array<Record<string, unknown>>; error?: string }> => {
  const requestId = createTestRequestId('sql')
  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { query, requestId } = payload
      return await new Promise<{
        success: boolean
        rows?: Array<Record<string, unknown>>
        error?: string
      }>((resolve) => {
        app.once(`test-run-sql-query-ready:${requestId}`, (nextPayload) => {
          resolve(nextPayload)
        })
        app.emit('test-run-sql-query', { requestId, sql: query })
      })
    },
    { query: sql, requestId }
  )
}

const runSqlStatement = async (electronApp: any, sql: string): Promise<void> => {
  const result = await runSqlQuery(electronApp, sql)

  if (!result.success) {
    throw new Error(result.error ?? 'SQL query failed')
  }
}

const seedUserPersistence = async (
  electronApp: any,
  data: {
    lastWorkspacePath: string | null
    appSidebarWidthPx?: number
  }
): Promise<void> => {
  const lastWorkspacePathSql =
    data.lastWorkspacePath === null ? 'NULL' : toSqlText(data.lastWorkspacePath)

  await runSqlStatement(
    electronApp,
    `
    INSERT INTO app_persistence (
      id,
      last_workspace_path,
      app_sidebar_width_px
    )
    VALUES (
      1,
      ${lastWorkspacePathSql},
      ${data.appSidebarWidthPx ?? 275}
    )
    ON CONFLICT(id) DO UPDATE SET
      last_workspace_path = excluded.last_workspace_path,
      app_sidebar_width_px = excluded.app_sidebar_width_px
    `
  )
}

const toSqlNullableInteger = (value: number | null): string => {
  return value === null ? 'NULL' : `${Math.round(value)}`
}

const toSqlNullableBoolean = (value: boolean | null): string => {
  if (value === null) {
    return 'NULL'
  }

  return value ? '1' : '0'
}

const seedWindowPersistence = async (
  electronApp: any,
  data: {
    x: number | null
    y: number | null
    width: number | null
    height: number | null
    isMaximized: boolean | null
    isFullScreen: boolean | null
  }
): Promise<void> => {
  await runSqlStatement(
    electronApp,
    `
    UPDATE app_persistence
    SET
      window_x_px = ${toSqlNullableInteger(data.x)},
      window_y_px = ${toSqlNullableInteger(data.y)},
      window_width_px = ${toSqlNullableInteger(data.width)},
      window_height_px = ${toSqlNullableInteger(data.height)},
      window_is_maximized = ${toSqlNullableBoolean(data.isMaximized)},
      window_is_fullscreen = ${toSqlNullableBoolean(data.isFullScreen)}
    WHERE id = 1
    `
  )
}

const seedWorkspacePersistence = async (
  electronApp: any,
  data: {
    workspaceId: string
    selectedScreen: 'home' | 'settings' | 'prompt-folders'
    selectedPromptFolderId: string | null
    promptFolderPromptTreeEntries: Array<{
      promptFolderId: string
      promptTreeEntryId: string
      promptTreeIsExpanded?: boolean
    }>
  }
): Promise<void> => {
  const selectedPromptFolderIdSql =
    data.selectedPromptFolderId === null ? 'NULL' : toSqlText(data.selectedPromptFolderId)

  await runSqlStatement(
    electronApp,
    `
    INSERT INTO workspace_ui_state (
      workspace_id,
      selected_screen,
      selected_prompt_folder_id
    )
    VALUES (
      ${toSqlText(data.workspaceId)},
      ${toSqlText(data.selectedScreen)},
      ${selectedPromptFolderIdSql}
    )
    ON CONFLICT(workspace_id) DO UPDATE SET
      selected_screen = excluded.selected_screen,
      selected_prompt_folder_id = excluded.selected_prompt_folder_id
    `
  )

  await runSqlStatement(
    electronApp,
    `DELETE FROM prompt_folder_ui_state WHERE workspace_id = ${toSqlText(data.workspaceId)}`
  )

  for (const entry of data.promptFolderPromptTreeEntries) {
    await runSqlStatement(
      electronApp,
      `
      INSERT INTO prompt_folder_ui_state (
        workspace_id,
        prompt_folder_id,
        prompt_tree_entry_id,
        prompt_tree_is_expanded
      )
      VALUES (
        ${toSqlText(data.workspaceId)},
        ${toSqlText(entry.promptFolderId)},
        ${toSqlText(entry.promptTreeEntryId)},
        ${entry.promptTreeIsExpanded === false ? 0 : 1}
      )
      `
    )
  }
}

const readUserPersistence = async (
  electronApp: any
): Promise<{
  lastWorkspacePath: string | null
  appSidebarWidthPx: number
}> => {
  const queryResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      last_workspace_path AS lastWorkspacePath,
      app_sidebar_width_px AS appSidebarWidthPx
    FROM app_persistence
    WHERE id = 1
    `
  )

  if (!queryResult.success || !queryResult.rows?.[0]) {
    throw new Error(queryResult.error ?? 'Failed to read app persistence')
  }

  return queryResult.rows[0] as {
    lastWorkspacePath: string | null
    appSidebarWidthPx: number
  }
}

const readWorkspacePersistence = async (
  electronApp: any,
  workspaceId: string
): Promise<{
  workspaceId: string
  selectedScreen: 'home' | 'settings' | 'prompt-folders'
  selectedPromptFolderId: string | null
  promptFolderPromptTreeEntries: Array<{
    promptFolderId: string
    promptTreeEntryId: string
    promptTreeIsExpanded: boolean
  }>
}> => {
  const workspaceStateResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      selected_screen AS selectedScreen,
      selected_prompt_folder_id AS selectedPromptFolderId
    FROM workspace_ui_state
    WHERE workspace_id = ${toSqlText(workspaceId)}
    `
  )

  if (!workspaceStateResult.success) {
    throw new Error(workspaceStateResult.error ?? 'Failed to read workspace state')
  }

  const promptFolderStateResult = await runSqlQuery(
    electronApp,
    `
    SELECT
      prompt_folder_id AS promptFolderId,
      prompt_tree_entry_id AS promptTreeEntryId,
      prompt_tree_is_expanded AS promptTreeIsExpanded
    FROM prompt_folder_ui_state
    WHERE workspace_id = ${toSqlText(workspaceId)}
    `
  )

  if (!promptFolderStateResult.success) {
    throw new Error(promptFolderStateResult.error ?? 'Failed to read prompt folder state')
  }

  const workspaceRow = workspaceStateResult.rows?.[0] as
    | {
        selectedScreen: 'home' | 'settings' | 'prompt-folders'
        selectedPromptFolderId: string | null
      }
    | undefined

  return {
    workspaceId,
    selectedScreen: workspaceRow?.selectedScreen ?? 'home',
    selectedPromptFolderId: workspaceRow?.selectedPromptFolderId ?? null,
    promptFolderPromptTreeEntries: (promptFolderStateResult.rows ?? []).map((entry) => ({
      promptFolderId: String(entry.promptFolderId),
      promptTreeEntryId: String(entry.promptTreeEntryId),
      promptTreeIsExpanded: entry.promptTreeIsExpanded !== 0
    }))
  }
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
      'button[data-active="true"][data-testid^="prompt-folder-"]'
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
      lastWorkspacePath: persistedWorkspacePath
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
      lastWorkspacePath: persistedWorkspacePath,
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
      lastWorkspacePath: persistedWorkspacePath
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedPromptFolderId: persistedPromptFolderId,
      promptFolderPromptTreeEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(
      mainWindow.locator('[data-testid="regular-prompt-folder-Development"]')
    ).toHaveAttribute('data-active', 'true')
  })

  test('resets invalid persisted prompt-folder startup screen to home and saves it', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-invalid-screen'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspacePath: persistedWorkspacePath
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedPromptFolderId: 'missing-folder-id',
      promptFolderPromptTreeEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${persisted.selectedPromptFolderId}`
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
        return `${persisted.selectedScreen}:${persisted.selectedPromptFolderId}`
      })
      .toBe(`prompt-folders:${developmentPromptFolderId}`)

    await testHelpers.navigateToSettingsScreen()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistence(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${persisted.selectedPromptFolderId}`
      })
      .toBe('settings:null')
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
    const bugAnalysisButton = mainWindow.locator('[data-testid="prompt-folder-prompt-dev-2"]')
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('data-active', 'true')
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
    const bugAnalysisButton = mainWindow.locator('[data-testid="prompt-folder-prompt-dev-2"]')
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('data-active', 'true')

    await testHelpers.navigateToPromptFolders('Examples')
    const simpleGreetingButton = mainWindow.locator('[data-testid="prompt-folder-prompt-simple-1"]')
    await simpleGreetingButton.click()
    await expect(simpleGreetingButton).toHaveAttribute('data-active', 'true')
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

  test('autosaves prompt tree folder expanded state', async ({ electronApp, testSetup }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const examplesPromptFolderId = createDeterministicId(`${workspacePath}:Examples`)
    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    const examplesToggle = mainWindow.locator('[data-testid="prompt-folder-toggle-Examples"]')
    await expect(examplesToggle).toHaveAttribute('aria-expanded', 'true')
    await examplesToggle.click()
    await expect(examplesToggle).toHaveAttribute('aria-expanded', 'false')

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entry = persisted.promptFolderPromptTreeEntries.find(
            (promptTreeEntry) => promptTreeEntry.promptFolderId === examplesPromptFolderId
          )
          return entry?.promptTreeIsExpanded ?? null
        },
        { timeout: 15000 }
      )
      .toBe(false)
  })

  test('persists prompt tree auto-expand state after scroll-follow expansion', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/virtual'
    const workspaceId = createDeterministicId(workspacePath)
    const shortPromptFolderId = createDeterministicId(`${workspacePath}:Short`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'virtual' }
    })

    await testHelpers.navigateToPromptFolders('Short')
    const shortToggle = mainWindow.locator('[data-testid="prompt-folder-toggle-Short"]')
    await shortToggle.click()
    await expect(shortToggle).toHaveAttribute('aria-expanded', 'false')

    await testHelpers.scrollVirtualWindowTo('[data-testid="prompt-folder-virtual-window"]', 1200)
    await expect(shortToggle).toHaveAttribute('aria-expanded', 'true')

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entry = persisted.promptFolderPromptTreeEntries.find(
            (promptTreeEntry) => promptTreeEntry.promptFolderId === shortPromptFolderId
          )
          return entry?.promptTreeIsExpanded ?? null
        },
        { timeout: 15000 }
      )
      .toBe(true)
  })

  test('restores persisted prompt tree entry on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-tree-entry'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspacePath: persistedWorkspacePath
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedPromptFolderId: developmentPromptFolderId,
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
    await expect(
      mainWindow.locator('[data-testid="regular-prompt-folder-Development"]')
    ).toHaveAttribute('data-active', 'true')
    await expect.poll(async () => getActivePromptTreeTitle(mainWindow)).toBe('Bug Analysis')
  })

  test('restores persisted prompt tree expanded state on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-tree-expanded-state'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const examplesPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Examples`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspacePath: persistedWorkspacePath
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'home',
      selectedPromptFolderId: null,
      promptFolderPromptTreeEntries: [
        {
          promptFolderId: examplesPromptFolderId,
          promptTreeEntryId: 'folder-settings',
          promptTreeIsExpanded: false
        }
      ]
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(
      mainWindow.locator('[data-testid="prompt-folder-toggle-Examples"]')
    ).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid="prompt-folder-settings-Examples"]')).toHaveCount(
      0
    )
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
      lastWorkspacePath: persistedWorkspacePath
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedPromptFolderId: longPromptFolderId,
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
      lastWorkspacePath: persistedWorkspacePath
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedPromptFolderId: developmentPromptFolderId,
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
