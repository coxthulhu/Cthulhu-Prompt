import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithCollections,
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { focusMonacoEditor, getMonacoEditorText, getMonacoCursorPosition, waitForMonacoEditor } from '../helpers/MonacoHelpers'

/** Shared Electron fixtures and assertions for workspace lifecycle regressions. */
const { test, describe, expect } = createPlaywrightTestSuite()

/** Builds workspaces with matching entity IDs to expose stale records and revisions. */
const createSwitchingWorkspace = (path: string, label: string): Record<string, string | null> => ({
  ...createWorkspaceWithCollections(path, [{
    folderName: 'Prompts',
    displayName: `${label} Prompts`,
    promptCollectionId: 'shared-prompt-collection',
    prompts: [{ id: 'shared-prompt', title: `${label} Prompt`, promptText: `${label} prompt body` }]
  }]),
  ...createWorkspaceWithTemplateCollections(path, [{
    folderName: 'Templates',
    displayName: `${label} Templates`,
    collectionId: 'shared-template-collection',
    templates: [{ id: 'shared-template', title: `${label} Template`, templateText: `${label} template body` }]
  }]),
  [`${path}/Prompts/CollectionOrder.json`]: JSON.stringify({
    entries: [{ kind: 'collection', id: 'shared-prompt-collection' }]
  }),
  [`${path}/Templates/CollectionOrder.json`]: JSON.stringify({
    entries: [{ kind: 'collection', id: 'shared-template-collection' }]
  })
})

describe('Workspace switching', () => {
  // Exercise both content types because their authoritative and client-state collections differ.
  for (const kind of ['prompt', 'template'] as const) {
    test(`flushes ${kind} edits across repeated close and reopen`, async ({ testSetup }) => {
      /** Workspace reopened without restarting Electron. */
      const path = `/ws/reopen-${kind}`
      await testSetup.setupFilesystem(createSwitchingWorkspace(path, 'A'))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
      /** Running application and its UI helpers. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      /** Shared content editor whose persisted text must survive every teardown. */
      const editor = `[data-testid="prompt-editor-shared-${kind}"]`
      /** collection containing this content type. */
      const collection = kind === 'prompt' ? 'A Prompts' : 'A Templates'
      await testHelpers.setupWorkspaceViaUI()

      for (const cycle of [1, 2]) {
        if (kind === 'template') await testHelpers.navigateToPromptTemplateCollections(collection)
        else await testHelpers.navigateToPromptCollections(collection)
        await focusMonacoEditor(mainWindow, editor)
        await mainWindow.keyboard.press('Control+End')
        /** Block persistence so closing must wait for this edit before clearing memory. */
        const updateChannel = kind === 'prompt' ? 'update-prompt' : 'update-prompt-template'
        await testSetup.pauseIpcChannel(updateChannel)
        /** Cursor captured before unmounting to verify saved editor UI state also survives. */
        let savedCursor: Awaited<ReturnType<typeof getMonacoCursorPosition>> = null
        try {
          await mainWindow.keyboard.insertText(` saved-${cycle}`)
          savedCursor = await getMonacoCursorPosition(mainWindow, editor)
          await testHelpers.navigateToHomeScreen()
          await mainWindow.locator('[data-testid="close-workspace-button"]').click()
          await expect(mainWindow.locator('[data-testid="open-workspace-button"]')).toBeDisabled()
          await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveText(path)
        } finally {
          await testSetup.resumeIpcChannel(updateChannel)
        }
        await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveCount(0)
        await testSetup.setupFileDialog([getWorkspaceInfoPath(path)])
        await testHelpers.setupWorkspaceViaUI()
        if (kind === 'template') await testHelpers.navigateToPromptTemplateCollections(collection)
        else await testHelpers.navigateToPromptCollections(collection)
        await waitForMonacoEditor(mainWindow, editor)
        await expect.poll(() => getMonacoEditorText(mainWindow, editor)).toBe(
          `A ${kind} body saved-1${cycle === 2 ? ' saved-2' : ''}`
        )
        await expect.poll(() => getMonacoCursorPosition(mainWindow, editor)).toEqual(savedCursor)
        await expect(mainWindow.locator('[role="dialog"]')).toHaveCount(0)
      }
    })
  }

  test('switches A to B to A and reselects A without retaining content from another workspace', async ({ testSetup }) => {
    /** First workspace uses the same entity IDs as the second workspace. */
    const pathA = '/ws/switch-a'
    /** Second workspace has different content under those shared IDs. */
    const pathB = '/ws/switch-b'
    await testSetup.setupFilesystem({
      ...createSwitchingWorkspace(pathA, 'A'),
      ...createSwitchingWorkspace(pathB, 'B')
    })
    /** Application stays running through every direct workspace selection. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })

    // The first A visit queues edits; returning to A must read those edits from persistence.
    for (const [visit, label] of ['A', 'B', 'A', 'A'].entries()) {
      await testHelpers.navigateToHomeScreen()
      await testSetup.setupFileDialog([getWorkspaceInfoPath(label === 'A' ? pathA : pathB)])
      await mainWindow.locator('[data-testid="open-workspace-button"]').click()
      await expect(mainWindow.locator('[data-testid="open-workspace-button"]')).toBeEnabled()
      await expect(mainWindow.locator('[data-testid="workspace-ready-path"]')).toHaveText(
        label === 'A' ? pathA : pathB
      )
      for (const kind of ['prompt', 'template'] as const) {
        /** Displayed root name selected through its kind-specific activity. */
        const folderName = `${label} ${kind === 'prompt' ? 'Prompts' : 'Templates'}`
        if (kind === 'template') {
          await testHelpers.navigateToPromptTemplateCollections(folderName)
        } else {
          await testHelpers.navigateToPromptCollections(folderName)
        }
        /** Editor reused across workspaces to expose stale full-content snapshots. */
        const editor = `[data-testid="prompt-editor-shared-${kind}"]`
        await waitForMonacoEditor(mainWindow, editor)
        await expect.poll(() => getMonacoEditorText(mainWindow, editor)).toBe(
          `${label} ${kind} body${label === 'A' && visit > 0 ? ' saved' : ''}`
        )
        if (visit === 0) {
          await focusMonacoEditor(mainWindow, editor)
          await mainWindow.keyboard.press('Control+End')
          await mainWindow.keyboard.insertText(' saved')
        }
      }
      await expect(mainWindow.locator('[role="dialog"]')).toHaveCount(0)
    }
  })
})
