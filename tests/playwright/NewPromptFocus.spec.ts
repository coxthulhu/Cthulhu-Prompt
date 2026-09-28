import { join } from 'node:path'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { setNewPromptFocus } from '../helpers/SettingsHelpers'
import { readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { getPromptEditorIds } from '../helpers/PromptFolderHelpers'
import { isMonacoEditorFocused, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'
import {
  createWorkspaceWithFolders,
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'

/** Shared Electron fixtures for creation focus and its persistent setting. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('New prompt focus', () => {
  // Checks the default, actual saved JSON, renderer hydration, and Reset through the settings UI.
  test('defaults to Editor, persists Title, and resets to Editor', async ({ testSetup, electronApp }) => {
    /** Settings navigation uses an ordinary workspace so reload restores the screen. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'minimal' }
    })
    /** Saved settings path in the test application's filesystem. */
    const settingsPath = join(await electronApp.evaluate(({ app }) => app.getPath('userData')), 'SystemSettings.json')
    await testHelpers.navigateToSettingsScreen()
    /** Existing dropdown and its row-local Reset action. */
    const selector = mainWindow.getByTestId('new-prompt-focus-selector')
    /** Reset must follow the same enabled state as the other settings. */
    const reset = mainWindow.getByTestId('editor-layout-new-prompt-focus-row').getByRole('button', { name: 'Reset', exact: true })
    await expect(selector).toHaveText('Editor')
    await expect(reset).toBeDisabled()
    await setNewPromptFocus(mainWindow, testHelpers, 'title')
    await expect.poll(async () => JSON.parse(await readTextFile(electronApp, settingsPath)).newPromptFocus).toBe('title')

    await mainWindow.reload()
    await expect(mainWindow.getByTestId('startup-loading-overlay')).toHaveCount(0)
    await testHelpers.navigateToSettingsScreen()
    await expect(selector).toHaveText('Title')
    await expect(reset).toBeEnabled()
    await reset.click()
    await expect(selector).toHaveText('Editor')
    await expect(reset).toBeDisabled()
    await expect.poll(async () => JSON.parse(await readTextFile(electronApp, settingsPath)).newPromptFocus).toBe('editor')
  })

  // Both content kinds share focus handling but have separate sidebar creation paths.
  for (const kind of ['prompt', 'template'] as const) {
    // Each field must work for sidebar creation and for a divider inserting a row.
    for (const target of ['title', 'editor'] as const) {
      test(`focuses ${target} for new ${kind}s from the sidebar and divider`, async ({ testSetup }) => {
        /** Isolated empty root lets the first creation exercise the sidebar's empty action. */
        const workspacePath = '/ws/new-prompt-focus'
        await testSetup.setupFilesystem(
          kind === 'prompt'
            ? createWorkspaceWithFolders(workspacePath, [{ folderName: 'Focus', displayName: 'Focus' }])
            : createWorkspaceWithTemplateFolders(workspacePath, [{ folderName: 'Focus', displayName: 'Focus' }])
        )
        await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
        /** Window and navigation helpers for the selected content kind. */
        const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
        expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
        await setNewPromptFocus(mainWindow, testHelpers, target)
        if (kind === 'prompt') {
          await testHelpers.navigateToPromptFolders('Focus')
          await testHelpers.navigateToHomeScreen()
        } else {
          await testHelpers.navigateToPromptTemplateFolders('Focus')
        }
        /** Sidebar group owning the newly created rows. */
        const group = kind === 'prompt' ? 'active' : 'template'
        /** Task prompts have a status action; templates have a root empty-state action. */
        const sidebarAction = kind === 'prompt' ? 'prompt-tree-active-empty-status' : 'prompt-tree-template-empty-state'
        // Prompt creation also opens the editor from Home; Home itself always shows task folders.
        for (const action of [sidebarAction, 'prompt-divider-add-initial']) {
          /** Existing IDs distinguish the inserted row without relying on fallback-title text. */
          const previousIds = await getPromptEditorIds(mainWindow)
          await mainWindow.getByTestId(action).click()
          await expect.poll(async () => (await getPromptEditorIds(mainWindow)).length).toBe(previousIds.length + 1)
          /** Generated ID connects the editor, title, and selected sidebar row. */
          const createdId = (await getPromptEditorIds(mainWindow)).find((id) => !previousIds.includes(id))!
          /** Editor selector used to wait through Monaco hydration before checking the final focus. */
          const editorSelector = promptEditorSelector(createdId)
          await waitForMonacoEditor(mainWindow, editorSelector)
          if (target === 'title') {
            await expect(mainWindow.locator(editorSelector).locator(PROMPT_TITLE_SELECTOR)).toBeFocused()
            await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(false)
            await mainWindow.keyboard.type('New title')
            await expect(mainWindow.locator(editorSelector).locator(PROMPT_TITLE_SELECTOR)).toHaveValue('New title')
          } else {
            await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
          }
          await expect(mainWindow.getByTestId(`prompt-tree-${group}-prompt-${createdId}`)).toHaveAttribute('aria-current', 'true')
        }
      })
    }
  }
})
