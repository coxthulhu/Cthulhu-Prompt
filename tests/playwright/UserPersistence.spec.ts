import { selectedQuickCollectionSelector } from '../helpers/PromptCollectionSelectors'
import { createDeterministicId } from '../fixtures/FixtureIds'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath,
  setupWorkspaceScenario
} from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createTestRequestId } from '../helpers/TestRequestId'
import {
  readUserPersistence,
  readWorkspaceState,
  readWorkspaceUiState,
  seedWorkspaceState,
  seedUserPersistence,
  seedWindowPersistence,
  seedWorkspaceUiState,
} from '../helpers/UserPersistenceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()
const PROMPT_TREE_HOST_SELECTOR = '[data-testid="prompt-tree-active-virtual-window"]'
/** Main prompt-collection virtual viewport used to verify restored reveal positions. */
const PROMPT_COLLECTION_HOST_SELECTOR = '[data-testid="prompt-collection-virtual-window"]'
const SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER =
  '[data-testid="sidebar-prompt-collection-selector-trigger"]'
/** Preferred viewport-top offset used when restoring a prompt selection. */
const PROMPT_COLLECTION_VERTICAL_BIAS_PX = 300
/** Retained viewport-top offset used when restoring a category selection. */
const PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX = 80
/** Minimum viewport-top offset used when a restored prompt row is too tall. */
const PROMPT_COLLECTION_MINIMUM_TOP_OFFSET_PX = 20

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
          { hostSelector: PROMPT_COLLECTION_HOST_SELECTOR, targetSelector: rowSelector }
        ),
        testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR),
        testHelpers.getVirtualWindowScrollHeight(PROMPT_COLLECTION_HOST_SELECTOR)
      ])
      if (!geometry) return Number.POSITIVE_INFINITY

      /** Symmetric space available around the complete restored row. */
      const availableSymmetricBiasPx =
        (geometry.viewportHeightPx - geometry.rowHeightPx) / 2
      /** Bias expected after fitting the row and enforcing the minimum top offset. */
      const effectiveBiasPx = Math.max(
        PROMPT_COLLECTION_MINIMUM_TOP_OFFSET_PX,
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
      'button[data-row-state="active"][data-testid^="prompt-tree-active-prompt-"]'
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
  // Both sidebar modes restore a saved collapsed preference, and switching activities saves it expanded again.
  for (const screen of ['project', 'settings']) {
    test(`restores a collapsed ${screen} sidebar and persists its forced expansion across reloads`, async ({
      electronApp,
      testSetup
    }) => {
      /** Real workspace allows startup to restore the active screen alongside sidebar visibility. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'sample' }
      })
      await testHelpers.navigateToPromptCollections('Development')
      if (screen === 'settings') await testHelpers.navigateToSettingsScreen()

      /** Activity restored as the selected screen after each reload. */
      const activity = mainWindow.getByTestId(`nav-button-${screen}`)
      /** Other sidebar mode shares the same application preference. */
      const nextScreen = screen === 'project' ? 'settings' : 'project'
      /** Activity that forces the collapsed sidebar open by switching screens. */
      const nextActivity = mainWindow.getByTestId(`nav-button-${nextScreen}`)
      /** Workspace whose saved screen selection is restored on reload. */
      const workspaceId = createDeterministicId('/ws/sample')
      /** Sidebar surface and sash must agree with the saved expansion preference. */
      const sidebar = mainWindow.getByTestId('app-sidebar')
      /** Resize handle must remain unavailable while the sidebar is collapsed. */
      const resizeHandle = mainWindow.getByTestId('app-sidebar-resize-handle')
      await expect(sidebar).toBeVisible()
      await expect.poll(async () => (await readWorkspaceUiState(electronApp, workspaceId)).selectedScreen).toBe(screen)

      // No control collapses the sidebar yet, so the saved preference is written directly before reloading.
      await seedWorkspaceState(electronApp, null, 'application-user', null, {
        hasShownWelcome: true,
        appSidebarExpanded: false
      })
      await mainWindow.reload()
      await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
      await expect(activity).toHaveAttribute('aria-current', 'page')
      await expect(sidebar).toBeHidden()
      await expect(resizeHandle).toBeHidden()
      // Re-clicking the restored activity never shows or hides the sidebar.
      await activity.click()
      await expect(sidebar).toBeHidden()

      // Switching activities forces the sidebar open and saves that preference for the next startup.
      await nextActivity.click()
      await expect(sidebar).toBeVisible()
      await expect.poll(async () =>
        (await readWorkspaceState(electronApp, null, 'application-user', null))?.appSidebarExpanded
      ).toBe(true)
      await expect.poll(async () => (await readWorkspaceUiState(electronApp, workspaceId)).selectedScreen).toBe(nextScreen)
      await mainWindow.reload()
      await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
      await expect(nextActivity).toHaveAttribute('aria-current', 'page')
      await expect(sidebar).toBeVisible()
      await expect(resizeHandle).toBeVisible()
    })
  }

  test('reopens the persisted workspace on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-workspace'

    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'minimal'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })

    // Startup should restore the workspace directly from user persistence.
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await testHelpers.assertWorkspaceReadyPath(persistedWorkspacePath)
    await expect(
      mainWindow.getByTestId('home-primary-card').locator('.cthulhuUiRow .cthulhuUiTitle')
    ).toHaveText('persisted-workspace')
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

    await testHelpers.assertWorkspaceReadyPath(persistedWorkspacePath)

    await testHelpers.navigateToPromptCollections('Development')

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

    await testHelpers.navigateToPromptCollections('Development')

    await dragSidebarHandleBy(mainWindow, 'app-sidebar-resize-handle', -40)

    await expect
      .poll(async () => {
        const persisted = await readUserPersistence(electronApp)
        return `${persisted.appSidebarWidthPx}`
      })
      .toBe('240')
  })

  test('reopens the persisted prompt-collection screen on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-screen'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const persistedPromptCollectionId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'project',
      selectedScreenData: { promptCollectionId: persistedPromptCollectionId },
      promptCollectionViewEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toBeVisible()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Development Tools'
    )
  })

  test('resets invalid persisted prompt-collection startup screen to home and saves it', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-invalid-screen'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'project',
      selectedScreenData: { promptCollectionId: 'missing-collection-id' },
      promptCollectionViewEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await expect
      .poll(async () => {
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
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
    await seedWorkspaceState(electronApp, workspaceId, 'workspace-navigation', null, {
      selectedScreen: 'project', selectedScreenData: '{malformed',
      lastCollectionId: null
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await expect
      .poll(async () => {
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${JSON.stringify(persisted.selectedScreenData)}`
      })
      .toBe('home:null')
  })

  test('syncs workspace screen persistence and clears collection when leaving prompt collections', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const developmentPromptCollectionId = createDeterministicId(`${workspacePath}:Development`)
    const { testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptCollections('Development')

    await expect
      .poll(async () => {
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
        return [
          persisted.selectedScreen,
          JSON.stringify(persisted.selectedScreenData),
          persisted.lastCollectionId
        ].join(':')
      })
      .toBe(
        `project:{"projectId":"${createDeterministicId(`${workspacePath}:DefaultProject`)}","promptCollectionId":"${developmentPromptCollectionId}","contentOwnerId":"${developmentPromptCollectionId}","openPromptId":null}:${developmentPromptCollectionId}`
      )

    await testHelpers.navigateToSettingsScreen()

    await expect
      .poll(async () => {
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
        return [
          persisted.selectedScreen,
          JSON.stringify(persisted.selectedScreenData),
          persisted.lastCollectionId
        ].join(':')
      })
      .toBe(`settings:null:${developmentPromptCollectionId}`)
  })

  test('remembers the last collection of either kind', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-last-collection'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const taskAlphaId = 'persisted-task-alpha'
    const taskBetaId = 'persisted-task-beta'
    const templateAlphaId = 'persisted-template-alpha'
    /** Mixed-kind workspace whose last collection may be either kind. */
    const filesystem = {
      ...createWorkspaceWithCollections(persistedWorkspacePath, [
        { folderName: 'TaskAlpha', displayName: 'Task Alpha', promptCollectionId: taskAlphaId },
        { folderName: 'TaskBeta', displayName: 'Task Beta', promptCollectionId: taskBetaId }
      ]),
      ...createWorkspaceWithTemplateCollections(persistedWorkspacePath, [
        { folderName: 'TemplateAlpha', displayName: 'Template Alpha', collectionId: templateAlphaId }
      ])
    }
    await testSetup.setupFilesystem(filesystem)
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'home',
      selectedScreenData: null,
      lastCollectionId: taskBetaId,
      promptCollectionViewEntries: []
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await mainWindow.locator('[data-testid="nav-button-project"]').click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Task Beta')
    await expect(mainWindow.locator('[data-testid="nav-button-project"]')).toHaveAttribute(
      'data-active',
      'true'
    )

    await mainWindow.locator(SIDEBAR_PROMPT_COLLECTION_SELECTOR_TRIGGER).click()
    await mainWindow
      .locator(`[data-testid="sidebar-prompt-collection-dropdown-item-${templateAlphaId}"]`)
      .click()
    await expect
      .poll(async () => {
        /** Persisted selection captured after choosing a template collection. */
        const persisted = await readWorkspaceUiState(electronApp, workspaceId)
        return [persisted.selectedScreen, persisted.lastCollectionId].join(':')
      })
      .toBe(`project:${templateAlphaId}`)

    await mainWindow.locator('[data-testid="nav-button-home"]').click()
    await mainWindow.locator('[data-testid="nav-button-project"]').click()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText('Template Alpha')
  })

  test('autosaves active prompt tree entry id in workspace persistence', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const developmentPromptCollectionId = createDeterministicId(`${workspacePath}:Development`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptCollections('Development')
    const bugAnalysisButton = mainWindow.locator('[data-testid="prompt-tree-active-prompt-dev-2"]')
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('data-row-state', 'active')
    await testHelpers.navigateToHomeScreen()

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspaceUiState(electronApp, workspaceId)
          const entries = persisted.promptCollectionViewEntries
          const viewEntry = entries.find(
            (entry) => entry.contentOwnerId === developmentPromptCollectionId
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
    /** prompt-collection identity derived by the categories fixture. */
    const promptCollectionId = createDeterministicId(`${workspacePath}:Main`)
    /** Category identity derived by the categories fixture. */
    const categoryId = createDeterministicId(`${workspacePath}:Main/Category`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    await testHelpers.navigateToPromptCollections('Main')
    /** Category toggle used to open the row's context menu. */
    const categoryToggle = mainWindow.locator(
      '[data-testid="prompt-tree-active-category-toggle-button-Category"]'
    )
    await categoryToggle.click({ button: 'right' })
    await mainWindow.locator('[data-testid="prompt-tree-active-category-open-menu-item-Category"]').click()

    await testHelpers.pauseIpcChannel('window-confirm-close')
    /** Whether the final close gate has already been released successfully. */
    let didReleaseCloseGate = false
    try {
      await mainWindow.evaluate(() => window.windowControls.close())

      await expect
        .poll(
          async () => {
            /** Workspace persistence flushed while final window confirmation remains gated. */
            const persisted = await readWorkspaceUiState(electronApp, workspaceId)
            /** Category view entry written by the close-time selection flush. */
            const categoryEntry = persisted.promptCollectionViewEntries.find(
              (entry) => entry.contentOwnerId === categoryId
            )
            /** Prompt-collection screen data containing the newly persisted owner pointer. */
            const selectedScreenData =
              persisted.selectedScreen === 'project'
                ? (persisted.selectedScreenData as {
                    promptCollectionId: string | null
                    contentOwnerId?: string | null
                  })
                : null
            return `${selectedScreenData?.promptCollectionId ?? 'none'}:${selectedScreenData?.contentOwnerId ?? 'none'}:${categoryEntry?.selectedEntryId ?? 'none'}`
          },
          { timeout: 15000 }
        )
        .toBe(`${promptCollectionId}:${categoryId}:category-details`)

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

  test('autosaves prompt tree entries for multiple collections', async ({ electronApp, testSetup }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const examplesPromptCollectionId = createDeterministicId(`${workspacePath}:Examples`)
    const developmentPromptCollectionId = createDeterministicId(`${workspacePath}:Development`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptCollections('Development')
    const bugAnalysisButton = mainWindow.locator('[data-testid="prompt-tree-active-prompt-dev-2"]')
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('data-row-state', 'active')

    await testHelpers.navigateToPromptCollections('Examples')
    const simpleGreetingButton = mainWindow.locator('[data-testid="prompt-tree-active-prompt-simple-1"]')
    await simpleGreetingButton.click()
    await expect(simpleGreetingButton).toHaveAttribute('data-row-state', 'active')
    await testHelpers.navigateToHomeScreen()

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspaceUiState(electronApp, workspaceId)
          const entries = persisted.promptCollectionViewEntries
          const examplesEntry = entries.find(
            (entry) => entry.contentOwnerId === examplesPromptCollectionId
          )
          const developmentEntry = entries.find(
            (entry) => entry.contentOwnerId === developmentPromptCollectionId
          )
          return `${examplesEntry?.selectedEntryId ?? 'none'}:${developmentEntry?.selectedEntryId ?? 'none'}:${entries.length}`
        },
        { timeout: 15000 }
      )
      .toBe('simple-1:dev-2:2')
  })

  test('autosaves prompt collection prompts section expanded state', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/categories'
    const workspaceId = createDeterministicId(workspacePath)
    const categoryId = createDeterministicId(`${workspacePath}:Main/Category`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'categories' }
    })

    await testHelpers.navigateToPromptCollections('Main')
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
          const persisted = await readWorkspaceUiState(electronApp, workspaceId)
          const entry = persisted.promptCollectionViewEntries.find(
            (viewEntry) => viewEntry.contentOwnerId === categoryId
          )
          const promptsExpanded = entry?.contentSectionIsExpanded ?? null
          return promptsExpanded
        },
        { timeout: 15000 }
      )
      .toBe(false)
  })

  test('restores persisted prompt tree entry on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-tree-entry'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptCollectionId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'project',
      selectedScreenData: { promptCollectionId: developmentPromptCollectionId },
      promptCollectionViewEntries: [
        {
          contentOwnerId: developmentPromptCollectionId,
          selectedEntryId: 'dev-2'
        }
      ]
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toBeVisible()
    await expect(mainWindow.locator(selectedQuickCollectionSelector)).toContainText(
      'Development Tools'
    )
    await expect.poll(async () => getActivePromptTreeTitle(mainWindow)).toBe('Bug Analysis')
  })

  test('restores a persisted category selection on startup', async ({ electronApp, testSetup }) => {
    /** Workspace path isolated from the other persistence startup cases. */
    const persistedWorkspacePath = '/ws/persisted-category-selection'
    /** Stable workspace identity derived by the categories fixture. */
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    /** prompt-collection identity derived by the categories fixture. */
    const promptCollectionId = createDeterministicId(`${persistedWorkspacePath}:Main`)
    /** Category identity derived by the categories fixture. */
    const categoryId = createDeterministicId(`${persistedWorkspacePath}:Main/Category`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'categories'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'project',
      selectedScreenData: { promptCollectionId, contentOwnerId: categoryId },
      promptCollectionViewEntries: [
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
      .locator('[data-testid="prompt-tree-active-category-toggle-button-Category"]')
      .locator('..')
    await expect(categoryRow).toHaveAttribute('data-row-state', 'active')
    /** Main category row restored at the retained category-navigation offset. */
    const categoryEditorSelector = `[data-testid="category-editor-${categoryId}"]`
    await expectRestoredRowVerticalBias(
      mainWindow,
      testHelpers,
      categoryEditorSelector,
      PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX
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
    /** prompt-collection identity derived by the categories fixture. */
    const promptCollectionId = createDeterministicId(`${persistedWorkspacePath}:Main`)
    /** Category identity derived by the categories fixture. */
    const categoryId = createDeterministicId(`${persistedWorkspacePath}:Main/Category`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'categories'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'project',
      selectedScreenData: { promptCollectionId, contentOwnerId: categoryId },
      promptCollectionViewEntries: [
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
      PROMPT_COLLECTION_VERTICAL_BIAS_PX
    )
  })

  test('restores and auto-scrolls prompt tree to persisted entry on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-prompt-tree-entry-long'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const longPromptCollectionId = createDeterministicId(`${persistedWorkspacePath}:Long`)
    const persistedPromptId = 'virtualization-test-45'
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'virtual'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'project',
      selectedScreenData: { promptCollectionId: longPromptCollectionId },
      promptCollectionViewEntries: [
        {
          contentOwnerId: longPromptCollectionId,
          selectedEntryId: persistedPromptId
        }
      ]
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toBeVisible()
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
    const developmentPromptCollectionId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    await testSetup.setupFilesystem(setupWorkspaceScenario(persistedWorkspacePath, 'sample'))
    await seedUserPersistence(electronApp, {
      lastWorkspaceInfoPath: getWorkspaceInfoPath(persistedWorkspacePath)
    })
    await seedWorkspaceUiState(electronApp, {
      workspaceId,
      selectedScreen: 'project',
      selectedScreenData: { promptCollectionId: developmentPromptCollectionId },
      promptCollectionViewEntries: [
        {
          contentOwnerId: developmentPromptCollectionId,
          selectedEntryId: 'missing-prompt-id'
        }
      ]
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-collection-screen"]')).toBeVisible()
    await expect
      .poll(async () =>
        testHelpers.getElementScrollTop('[data-testid="prompt-collection-virtual-window"]')
      )
      .toBe(0)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(PROMPT_TREE_HOST_SELECTOR))
      .toBe(0)
  })
})
