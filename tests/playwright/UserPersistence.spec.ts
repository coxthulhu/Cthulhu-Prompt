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
/** Main prompt-folder virtual viewport used to verify restored reveal positions. */
const PROMPT_FOLDER_HOST_SELECTOR = '[data-testid="prompt-folder-virtual-window"]'
const SIDEBAR_PROMPT_FOLDER_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-folder-selector-trigger"]'
/** Preferred viewport-top offset used when restoring a prompt selection. */
const PROMPT_FOLDER_VERTICAL_BIAS_PX = 300
/** Retained viewport-top offset used when restoring a category selection. */
const PROMPT_FOLDER_CATEGORY_TOP_OFFSET_PX = 80
/** Minimum viewport-top offset used when a restored prompt row is too tall. */
const PROMPT_FOLDER_MINIMUM_TOP_OFFSET_PX = 20

/** Verifies a restored row uses measured vertical-bias placement and boundary clamping. */
const expectRestoredRowVerticalBias = async (
  mainWindow: any,
  testHelpers: any,
  rowSelector: string,
  verticalBiasPx: number
): Promise<void> => {
  await expect
    .poll(async () => {
      const [geometry, scrollTopPx, scrollHeightPx] = await Promise.all([
        mainWindow.evaluate(
          ({ hostSelector, targetSelector }) => {
            const host = document.querySelector<HTMLElement>(hostSelector)
            const target = document.querySelector<HTMLElement>(targetSelector)
            if (!host || !target) return null
            const hostRect = host.getBoundingClientRect()
            const targetRect = target.getBoundingClientRect()
            return {
              topOffsetPx: targetRect.top - hostRect.top,
              rowHeightPx: targetRect.height,
              viewportHeightPx: hostRect.height
            }
          },
          { hostSelector: PROMPT_FOLDER_HOST_SELECTOR, targetSelector: rowSelector }
        ),
        testHelpers.getElementScrollTop(PROMPT_FOLDER_HOST_SELECTOR),
        testHelpers.getVirtualWindowScrollHeight(PROMPT_FOLDER_HOST_SELECTOR)
      ])
      if (!geometry) return Number.POSITIVE_INFINITY

      /** Symmetric space available around the complete restored row. */
      const availableSymmetricBiasPx =
        (geometry.viewportHeightPx - geometry.rowHeightPx) / 2
      /** Bias expected after fitting the row and enforcing the minimum top offset. */
      const effectiveBiasPx = Math.max(
        PROMPT_FOLDER_MINIMUM_TOP_OFFSET_PX,
        Math.min(verticalBiasPx, availableSymmetricBiasPx)
      )
      /** Stable row offset reconstructed from the current virtual scroll position. */
      const rowOffsetPx = scrollTopPx + geometry.topOffsetPx
      /** Maximum scroll position used to reproduce document-boundary clamping. */
      const maxScrollTopPx = Math.max(0, scrollHeightPx - geometry.viewportHeightPx)
      /** Expected scroll position for this row and bias. */
      const expectedScrollTopPx = Math.min(
        Math.max(0, rowOffsetPx - effectiveBiasPx),
        maxScrollTopPx
      )
      /** Expected row inset after the scroll position is clamped. */
      const expectedTopOffsetPx = rowOffsetPx - expectedScrollTopPx
      return Math.abs(geometry.topOffsetPx - expectedTopOffsetPx)
    })
    .toBeLessThanOrEqual(2)
}

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
    // Use the active Windows display origin so the minimum-size rectangle is fully on-screen.
    const displayBounds = await electronApp.evaluate(({ screen }) => {
      const bounds = screen.getPrimaryDisplay().bounds
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    })
    expect(displayBounds.width).toBeGreaterThanOrEqual(950)
    expect(displayBounds.height).toBeGreaterThanOrEqual(600)

    await seedWindowPersistence(electronApp, {
      x: displayBounds.x,
      y: displayBounds.y,
      width: 950,
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
      .toBe(`${displayBounds.x}:${displayBounds.y}:950:600`)
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
      promptFolderViewEntries: []
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
      promptFolderViewEntries: []
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
      promptFolderViewEntries: []
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
        `prompt-folders:{"promptFolderId":"${developmentPromptFolderId}","contentOwnerId":"${developmentPromptFolderId}"}:${developmentPromptFolderId}`
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
      promptFolderViewEntries: []
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
          const entries = persisted.promptFolderViewEntries
          const viewEntry = entries.find(
            (entry) => entry.contentOwnerId === developmentPromptFolderId
          )
          return viewEntry?.selectedEntryId ?? null
        },
        { timeout: 15000 }
      )
      .toBe('dev-2')
  })

  test('flushes the selected category owner before closing', async ({
    electronApp,
    testSetup
  }) => {
    /** Workspace path used by the categories fixture. */
    const workspacePath = '/ws/categories'
    /** Stable workspace identity derived by the categories fixture. */
    const workspaceId = createDeterministicId(workspacePath)
    /** Root prompt-folder identity derived by the categories fixture. */
    const promptFolderId = createDeterministicId(`${workspacePath}:Main`)
    /** Category identity derived by the categories fixture. */
    const categoryId = createDeterministicId(`${workspacePath}:Main/Category`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    await testHelpers.navigateToPromptFolders('Main')
    /** Category toggle used to open the row's context menu. */
    const categoryToggle = mainWindow.locator(
      '[data-testid="prompt-tree-category-toggle-button-Category"]'
    )
    await categoryToggle.click({ button: 'right' })
    await mainWindow.locator('[data-testid="prompt-tree-category-open-menu-item-Category"]').click()

    await testHelpers.pauseIpcChannel('window-confirm-close')
    /** Whether the final close gate has already been released successfully. */
    let didReleaseCloseGate = false
    try {
      await mainWindow.evaluate(() => window.windowControls.close())

      await expect
        .poll(
          async () => {
            /** Workspace persistence flushed while final window confirmation remains gated. */
            const persisted = await readWorkspacePersistence(electronApp, workspaceId)
            /** Category view entry written by the close-time selection flush. */
            const categoryEntry = persisted.promptFolderViewEntries.find(
              (entry) => entry.contentOwnerId === categoryId
            )
            /** Prompt-folder screen data containing the newly persisted owner pointer. */
            const selectedScreenData =
              persisted.selectedScreen === 'prompt-folders'
                ? (persisted.selectedScreenData as {
                    promptFolderId: string | null
                    contentOwnerId?: string | null
                  })
                : null
            return `${selectedScreenData?.promptFolderId ?? 'none'}:${selectedScreenData?.contentOwnerId ?? 'none'}:${categoryEntry?.selectedEntryId ?? 'none'}`
          },
          { timeout: 15000 }
        )
        .toBe(`${promptFolderId}:${categoryId}:category-details`)

      /** Window-close completion observed after releasing the held confirmation IPC. */
      const windowClosed = mainWindow.waitForEvent('close')
      await testHelpers.resumeIpcChannel('window-confirm-close')
      didReleaseCloseGate = true
      await windowClosed
    } finally {
      if (!didReleaseCloseGate) {
        await testHelpers.resumeIpcChannel('window-confirm-close')
      }
    }
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
          const entries = persisted.promptFolderViewEntries
          const examplesEntry = entries.find(
            (entry) => entry.contentOwnerId === examplesPromptFolderId
          )
          const developmentEntry = entries.find(
            (entry) => entry.contentOwnerId === developmentPromptFolderId
          )
          return `${examplesEntry?.selectedEntryId ?? 'none'}:${developmentEntry?.selectedEntryId ?? 'none'}:${entries.length}`
        },
        { timeout: 15000 }
      )
      .toBe('simple-1:dev-2:2')
  })

  test('autosaves prompt folder prompts section expanded state', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/categories'
    const workspaceId = createDeterministicId(workspacePath)
    const categoryId = createDeterministicId(`${workspacePath}:Main/Category`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    await testHelpers.navigateToPromptFolders('Main')
    const categoryContentToggle = mainWindow.locator(
      `[data-testid="category-editor-${categoryId}"] [data-testid="category-editor-content-toggle"]`
    )
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'true')

    await categoryContentToggle.click()
    await expect(categoryContentToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(mainWindow.locator('[data-testid="prompt-editor-category-prompt"]')).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-editor-base-before"]')).toBeVisible()

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entry = persisted.promptFolderViewEntries.find(
            (viewEntry) => viewEntry.contentOwnerId === categoryId
          )
          const settingsExpanded = entry?.detailsSectionIsExpanded ?? null
          const promptsExpanded = entry?.contentSectionIsExpanded ?? null
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
    const workspacePath = '/ws/categories'
    const workspaceId = createDeterministicId(workspacePath)
    const categoryId = createDeterministicId(`${workspacePath}:Main/Category`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    await testHelpers.navigateToPromptFolders('Main')

    const settingsToggle = mainWindow.locator(
      `[data-testid="category-editor-${categoryId}"] [data-testid="category-editor-settings-toggle"]`
    )
    await expect(settingsToggle).toHaveAttribute('aria-pressed', 'false')

    await settingsToggle.click()
    await expect(settingsToggle).toHaveAttribute('aria-pressed', 'true')

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistence(electronApp, workspaceId)
          const entry = persisted.promptFolderViewEntries.find(
            (viewEntry) => viewEntry.contentOwnerId === categoryId
          )
          return entry?.detailsSectionIsExpanded ?? null
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
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: developmentPromptFolderId },
      promptFolderViewEntries: [
        {
          contentOwnerId: developmentPromptFolderId,
          selectedEntryId: 'dev-2'
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

  test('restores a persisted category selection on startup', async ({ electronApp, testSetup }) => {
    /** Workspace path isolated from the other persistence startup cases. */
    const persistedWorkspacePath = '/ws/persisted-category-selection'
    /** Stable workspace identity derived by the categories fixture. */
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    /** Root prompt-folder identity derived by the categories fixture. */
    const promptFolderId = createDeterministicId(`${persistedWorkspacePath}:Main`)
    /** Category identity derived by the categories fixture. */
    const categoryId = createDeterministicId(`${persistedWorkspacePath}:Main/Category`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'categories'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId, contentOwnerId: categoryId },
      promptFolderViewEntries: [
        {
          contentOwnerId: categoryId,
          selectedEntryId: 'category-details'
        }
      ]
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    /** Sidebar category row whose active state proves owner-aware restoration. */
    const categoryRow = mainWindow
      .locator('[data-testid="prompt-tree-category-toggle-button-Category"]')
      .locator('..')
    await expect(categoryRow).toHaveAttribute('data-row-state', 'active')
    /** Main category row restored at the retained category-navigation offset. */
    const categoryEditorSelector = `[data-testid="category-editor-${categoryId}"]`
    await expectRestoredRowVerticalBias(
      mainWindow,
      testHelpers,
      categoryEditorSelector,
      PROMPT_FOLDER_CATEGORY_TOP_OFFSET_PX
    )
  })

  test('restores a persisted categorized prompt on startup', async ({
    electronApp,
    testSetup
  }) => {
    /** Workspace path isolated from the category-row startup case. */
    const persistedWorkspacePath = '/ws/persisted-categorized-prompt-selection'
    /** Stable workspace identity derived by the categories fixture. */
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    /** Root prompt-folder identity derived by the categories fixture. */
    const promptFolderId = createDeterministicId(`${persistedWorkspacePath}:Main`)
    /** Category identity derived by the categories fixture. */
    const categoryId = createDeterministicId(`${persistedWorkspacePath}:Main/Category`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'categories'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId, contentOwnerId: categoryId },
      promptFolderViewEntries: [
        {
          contentOwnerId: categoryId,
          selectedEntryId: 'category-prompt'
        }
      ]
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect.poll(async () => getActivePromptTreeTitle(mainWindow)).toBe('Category Prompt')
    await expect(mainWindow.locator('[data-testid="prompt-editor-category-prompt"]')).toBeVisible()
    await expectRestoredRowVerticalBias(
      mainWindow,
      testHelpers,
      '[data-testid="prompt-editor-category-prompt"]',
      PROMPT_FOLDER_VERTICAL_BIAS_PX
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
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspacePersistence(electronApp, {
      workspaceId,
      selectedScreen: 'prompt-folders',
      selectedScreenData: { promptFolderId: longPromptFolderId },
      promptFolderViewEntries: [
        {
          contentOwnerId: longPromptFolderId,
          selectedEntryId: persistedPromptId
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
      promptFolderViewEntries: [
        {
          contentOwnerId: developmentPromptFolderId,
          selectedEntryId: 'missing-prompt-id'
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
