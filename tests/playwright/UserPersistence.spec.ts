import { join } from 'node:path'
import { setupWorkspaceScenario } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'

const { test, describe, expect } = createPlaywrightTestSuite()
const OUTLINER_HOST_SELECTOR = '[data-testid="prompt-outliner-virtual-window"]'

const createDeterministicId = (seed: string): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  }
  const suffix = hash.toString(16).padStart(12, '0').slice(0, 12)
  return `00000000000000000000${suffix}`
}

const readUserPersistenceFile = async (electronApp: any): Promise<{
  lastWorkspacePath: string | null
  appSidebarWidthPx: number
  promptOutlinerWidthPx: number
}> => {
  const userDataPath = await electronApp.evaluate(({ app }) => {
    return app.getPath('userData')
  })
  const userPersistencePath = join(userDataPath, 'UserPersistence.json')
  const persistedContent = await electronApp.evaluate(async ({ app }, filePath) => {
    return await new Promise<string>((resolve) => {
      const requestId = `read-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
      app.once(`test-read-file-ready:${requestId}`, (payload: { content: string }) => {
        resolve(payload.content)
      })
      app.emit('test-read-file', { filePath, requestId })
    })
  }, userPersistencePath)

  return JSON.parse(persistedContent)
}

const readWorkspacePersistenceFile = async (
  electronApp: any,
  workspaceId: string
): Promise<{
  workspaceId: string
  selectedScreen: 'home' | 'settings' | 'prompt-folders'
  selectedPromptFolderId: string | null
  promptFolderOutlinerEntryIds?: Array<{
    promptFolderId: string
    outlinerEntryId: string
  }>
}> => {
  const userDataPath = await electronApp.evaluate(({ app }) => {
    return app.getPath('userData')
  })
  const workspacePersistencePath = join(userDataPath, 'WorkspacePersistence', `${workspaceId}.json`)
  const persistedContent = await electronApp.evaluate(async ({ app }, filePath) => {
    return await new Promise<string>((resolve) => {
      const requestId = `read-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`
      app.once(`test-read-file-ready:${requestId}`, (payload: { content: string }) => {
        resolve(payload.content)
      })
      app.emit('test-read-file', { filePath, requestId })
    })
  }, workspacePersistencePath)

  return JSON.parse(persistedContent)
}

const getActiveOutlinerTitle = async (mainWindow: any): Promise<string | null> => {
  return await mainWindow.evaluate((hostSelector) => {
    const host = document.querySelector<HTMLElement>(hostSelector)
    if (!host) return null
    const activeButton = host.querySelector<HTMLButtonElement>('button[aria-current="true"]')
    return activeButton?.textContent?.trim() ?? null
  }, OUTLINER_HOST_SELECTOR)
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
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'minimal'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        { lastWorkspacePath: persistedWorkspacePath },
        null,
        2
      )
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
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'sample'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        {
          lastWorkspacePath: persistedWorkspacePath,
          appSidebarWidthPx: 260,
          promptOutlinerWidthPx: 180
        },
        null,
        2
      )
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
    await expect
      .poll(async () => getSidebarWidthByHandle(mainWindow, 'prompt-outliner-resize-handle'))
      .toBe(180)
  })

  test('autosaves sidebar width changes to user persistence', async ({ electronApp, testSetup }) => {
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')

    await dragSidebarHandleBy(mainWindow, 'app-sidebar-resize-handle', -40)
    await dragSidebarHandleBy(mainWindow, 'prompt-outliner-resize-handle', 20)

    await expect
      .poll(async () => {
        const persisted = await readUserPersistenceFile(electronApp)
        return `${persisted.appSidebarWidthPx}:${persisted.promptOutlinerWidthPx}`
      })
      .toBe('180:220')
  })

  test('reopens the persisted prompt-folder screen on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-screen'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const persistedPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'sample'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        { lastWorkspacePath: persistedWorkspacePath },
        null,
        2
      ),
      [join(userDataPath, 'WorkspacePersistence', `${workspaceId}.json`)]: JSON.stringify(
        {
          workspaceId,
          selectedScreen: 'prompt-folders',
          selectedPromptFolderId: persistedPromptFolderId
        },
        null,
        2
      )
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
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'sample'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        { lastWorkspacePath: persistedWorkspacePath },
        null,
        2
      ),
      [join(userDataPath, 'WorkspacePersistence', `${workspaceId}.json`)]: JSON.stringify(
        {
          workspaceId,
          selectedScreen: 'prompt-folders',
          selectedPromptFolderId: 'missing-folder-id'
        },
        null,
        2
      )
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="home-screen"]')).toBeVisible()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistenceFile(electronApp, workspaceId)
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
        const persisted = await readWorkspacePersistenceFile(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${persisted.selectedPromptFolderId}`
      })
      .toBe(`prompt-folders:${developmentPromptFolderId}`)

    await testHelpers.navigateToSettingsScreen()

    await expect
      .poll(async () => {
        const persisted = await readWorkspacePersistenceFile(electronApp, workspaceId)
        return `${persisted.selectedScreen}:${persisted.selectedPromptFolderId}`
      })
      .toBe('settings:null')
  })

  test('autosaves active outliner entry id in workspace persistence', async ({
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
    const bugAnalysisButton = mainWindow.locator(`${OUTLINER_HOST_SELECTOR} button`, {
      hasText: 'Bug Analysis'
    })
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('aria-current', 'true')

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistenceFile(electronApp, workspaceId)
          const entries = persisted.promptFolderOutlinerEntryIds ?? []
          const outlinerEntry = entries.find((entry) => entry.promptFolderId === developmentPromptFolderId)
          return outlinerEntry?.outlinerEntryId ?? null
        },
        { timeout: 15000 }
      )
      .toBe('dev-2')
  })

  test('autosaves outliner entries for multiple folders', async ({ electronApp, testSetup }) => {
    const workspacePath = '/ws/sample'
    const workspaceId = createDeterministicId(workspacePath)
    const examplesPromptFolderId = createDeterministicId(`${workspacePath}:Examples`)
    const developmentPromptFolderId = createDeterministicId(`${workspacePath}:Development`)
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })

    await testHelpers.navigateToPromptFolders('Development')
    const bugAnalysisButton = mainWindow.locator(`${OUTLINER_HOST_SELECTOR} button`, {
      hasText: 'Bug Analysis'
    })
    await bugAnalysisButton.click()
    await expect(bugAnalysisButton).toHaveAttribute('aria-current', 'true')

    await testHelpers.navigateToPromptFolders('Examples')
    const simpleGreetingButton = mainWindow.locator(`${OUTLINER_HOST_SELECTOR} button`, {
      hasText: 'Simple Greeting'
    })
    await simpleGreetingButton.click()
    await expect(simpleGreetingButton).toHaveAttribute('aria-current', 'true')

    await expect
      .poll(
        async () => {
          const persisted = await readWorkspacePersistenceFile(electronApp, workspaceId)
          const entries = persisted.promptFolderOutlinerEntryIds ?? []
          const examplesEntry = entries.find((entry) => entry.promptFolderId === examplesPromptFolderId)
          const developmentEntry = entries.find(
            (entry) => entry.promptFolderId === developmentPromptFolderId
          )
          return `${examplesEntry?.outlinerEntryId ?? 'none'}:${developmentEntry?.outlinerEntryId ?? 'none'}:${entries.length}`
        },
        { timeout: 15000 }
      )
      .toBe('simple-1:dev-2:2')
  })

  test('restores persisted outliner entry on startup', async ({ electronApp, testSetup }) => {
    const persistedWorkspacePath = '/ws/persisted-outliner-entry'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'sample'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        { lastWorkspacePath: persistedWorkspacePath },
        null,
        2
      ),
      [join(userDataPath, 'WorkspacePersistence', `${workspaceId}.json`)]: JSON.stringify(
        {
          workspaceId,
          selectedScreen: 'prompt-folders',
          selectedPromptFolderId: developmentPromptFolderId,
          promptFolderOutlinerEntryIds: [
            {
              promptFolderId: developmentPromptFolderId,
              outlinerEntryId: 'dev-2'
            }
          ]
        },
        null,
        2
      )
    })

    const { mainWindow } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="regular-prompt-folder-Development"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect.poll(async () => getActiveOutlinerTitle(mainWindow)).toBe('Bug Analysis')
  })

  test('restores and auto-scrolls outliner to persisted entry on startup', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-outliner-entry-long'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const longPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Long`)
    const persistedPromptId = 'virtualization-test-45'
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'virtual'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        { lastWorkspacePath: persistedWorkspacePath },
        null,
        2
      ),
      [join(userDataPath, 'WorkspacePersistence', `${workspaceId}.json`)]: JSON.stringify(
        {
          workspaceId,
          selectedScreen: 'prompt-folders',
          selectedPromptFolderId: longPromptFolderId,
          promptFolderOutlinerEntryIds: [
            {
              promptFolderId: longPromptFolderId,
              outlinerEntryId: persistedPromptId
            }
          ]
        },
        null,
        2
      )
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect(mainWindow.locator('[data-testid="regular-prompt-folder-Long"]')).toHaveAttribute(
      'data-active',
      'true'
    )
    await expect.poll(async () => getActiveOutlinerTitle(mainWindow)).toBe('Large Prompt 45')
    await expect
      .poll(async () => testHelpers.getElementScrollTop(OUTLINER_HOST_SELECTOR))
      .toBeGreaterThan(0)
  })

  test('stays scrolled to top when persisted outliner entry is missing', async ({
    electronApp,
    testSetup
  }) => {
    const persistedWorkspacePath = '/ws/persisted-outliner-entry-missing'
    const workspaceId = createDeterministicId(persistedWorkspacePath)
    const developmentPromptFolderId = createDeterministicId(`${persistedWorkspacePath}:Development`)
    const userDataPath = await electronApp.evaluate(({ app }) => {
      return app.getPath('userData')
    })

    await testSetup.setupFilesystem({
      ...setupWorkspaceScenario(persistedWorkspacePath, 'sample'),
      [join(userDataPath, 'UserPersistence.json')]: JSON.stringify(
        { lastWorkspacePath: persistedWorkspacePath },
        null,
        2
      ),
      [join(userDataPath, 'WorkspacePersistence', `${workspaceId}.json`)]: JSON.stringify(
        {
          workspaceId,
          selectedScreen: 'prompt-folders',
          selectedPromptFolderId: developmentPromptFolderId,
          promptFolderOutlinerEntryIds: [
            {
              promptFolderId: developmentPromptFolderId,
              outlinerEntryId: 'missing-prompt-id'
            }
          ]
        },
        null,
        2
      )
    })

    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })

    await expect(mainWindow.locator('[data-testid="prompt-folder-screen"]')).toBeVisible()
    await expect
      .poll(async () => testHelpers.getElementScrollTop('[data-testid="prompt-folder-virtual-window"]'))
      .toBe(0)
    await expect
      .poll(async () => testHelpers.getElementScrollTop(OUTLINER_HOST_SELECTOR))
      .toBe(0)
  })
})
