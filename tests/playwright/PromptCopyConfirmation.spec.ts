import { PromptStatus } from '@shared/domain/prompt/Prompt'
import { parsePromptMarkdown } from '../../src/main/Persistence/PromptFrontmatter'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, createWorkspaceWithTemplateFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { readClipboardText, stubClipboard } from '../helpers/ClipboardHelpers'

/** Real Electron workflows verify confirmation before clipboard and persistence changes. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Isolated workspace shared by each independently launched case. */
const WORKSPACE_PATH = '/ws/copy-confirmation'
/** Task root used to verify physical status-folder moves. */
const ROOT_PATH = `${WORKSPACE_PATH}/Prompts/Tasks`

/** Builds direct-copy and undecided prompts in the requested workflow with a usable template. */
const createCopyWorkspace = (status: PromptStatus) => {
  /** Task data preserves an explicit no-template choice for the direct-copy prompt. */
  const tasks = createWorkspaceWithFolders(WORKSPACE_PATH, [{
    folderName: 'Tasks', displayName: 'Tasks', promptFolderId: 'copy-tasks',
    prompts: [
      { id: 'direct', title: 'Direct', promptText: 'Direct body', templates: null, status },
      { id: 'quick-template', title: 'Quick Template', promptText: 'Template body', status },
      { id: 'quick-none', title: 'Quick None', promptText: 'Plain body', status }
    // Final-status documents require a finalization timestamp to pass frontmatter validation.
    ].map((prompt) => ({ ...prompt, finalizedAt: '2026-10-01T10:00:00.000Z' }))
  }])
  // The shared fixture builder treats non-final statuses as Active; place Backlog files explicitly.
  if (status === PromptStatus.Backlog) {
    // Move both prompt files and their category order into the Backlog fixture directory.
    for (const path of Object.keys(tasks)) {
      if (!path.startsWith(`${ROOT_PATH}/Active/`)) continue
      tasks[path.replace('/Active/', '/Backlog/')] = tasks[path]
      delete tasks[path]
    }
    tasks[`${ROOT_PATH}/Active/_FolderInfo/FolderOrder.json`] = JSON.stringify({
      categories: [{ categoryId: null, entries: [] }]
    })
  }
  /** Template fixture makes the selected choice observable in copied output. */
  const templates = createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [{
    folderName: 'Library', displayName: 'Library', folderId: 'copy-library',
    templates: [{ id: 'wrapper', title: 'Wrapper', templateText: 'Wrapped [[PROMPT_TEXT]]' }]
  }])
  return { ...tasks, ...templates, [`${WORKSPACE_PATH}/Prompts/FolderOrder.json`]: tasks[`${WORKSPACE_PATH}/Prompts/FolderOrder.json`] }
}

describe('Prompt copy confirmation', () => {
  // Exercise every non-active workflow because each owns a different physical status folder.
  for (const status of [PromptStatus.Backlog, PromptStatus.Completed, PromptStatus.Archived]) {
    test(`${status}: confirms direct copy and keeps Set Template independent`, async ({ testSetup, electronApp }) => {
      await testSetup.setupFilesystem(createCopyWorkspace(status))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      /** Real window and navigation helpers exercise the visible status view. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptFolders('Tasks')
      await stubClipboard(mainWindow)
      await mainWindow.evaluate(() => navigator.clipboard.writeText('Keep clipboard'))
      if (status !== PromptStatus.Backlog) {
        await mainWindow.getByTestId(`toggle-${status.toLowerCase()}-prompts-button`).click()
      }
      /** Selected filter must remain selected even after its copied prompt leaves the view. */
      const filter = mainWindow.getByTestId(`prompt-folder-${status.toLowerCase()}-filter`)
      await filter.click()
      /** Direct-copy editor begins with an explicit no-template choice. */
      const editor = mainWindow.locator(promptEditorSelector('direct'))
      await expect(editor.getByTestId('prompt-copy-button')).toBeVisible()
      await editor.getByTestId('prompt-template-button').click()
      /** Set Template saves only the template decision, without invoking copy confirmation. */
      const templateDialog = mainWindow.getByRole('dialog', { name: 'Select Template', exact: true })
      await templateDialog.getByTestId('prompt-tree-template-prompt-wrapper').click()
      await templateDialog.getByTestId('prompt-template-confirm-button').click()
      /** Original file remains in its workflow when only its template is changed. */
      const sourcePath = `${ROOT_PATH}/${status}/Direct.prompt.md`
      await expect.poll(async () => parsePromptMarkdown(await readTextFile(electronApp, sourcePath)))
        .toMatchObject({ status, templates: [{ id: 'wrapper' }] })
      await expect(mainWindow.getByRole('dialog')).toHaveCount(0)
      expect(await readClipboardText(mainWindow)).toBe('Keep clipboard')
      /** Byte comparison catches unintended timestamp or selection edits during cancellation. */
      const original = await readTextFile(electronApp, sourcePath)
      await editor.getByTestId('prompt-copy-button').click()
      /** Informational dialog explains the source workflow and uses the approved action text. */
      const confirmation = mainWindow.getByRole('dialog', { name: 'Copy Prompt', exact: true })
      await expect(confirmation).toContainText(`Copying this prompt will move it from ${status} to In Progress.`)
      await expect(confirmation.getByTestId('prompt-confirm-copy-button')).toHaveText('Copy and Move')
      expect(await readClipboardText(mainWindow)).toBe('Keep clipboard')
      expect(await readTextFile(electronApp, sourcePath)).toBe(original)
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(confirmation).toBeHidden()
      await expect(editor.getByTestId('prompt-status-pill')).toHaveText(status)
      expect(await readClipboardText(mainWindow)).toBe('Keep clipboard')
      expect(await readTextFile(electronApp, sourcePath)).toBe(original)
      await editor.getByTestId('prompt-copy-button').click()
      await confirmation.getByTestId('prompt-confirm-copy-button').click()
      await expect.poll(() => readClipboardText(mainWindow)).toBe('Wrapped Direct body')
      await expect.poll(async () => parsePromptMarkdown(await readTextFile(electronApp, `${ROOT_PATH}/Active/Direct.prompt.md`)))
        .toMatchObject({ status: PromptStatus.InProgress, templates: [{ id: 'wrapper' }] })
      await expect.poll(() => checkFileExists(electronApp, sourcePath)).toBe(false)
      await expect(filter).toHaveAttribute('aria-pressed', 'true')
      await expect(editor).toHaveCount(0)
      await expect(confirmation).toBeHidden()
    })

    test(`${status}: stages quick-copy choices until confirmation`, async ({ testSetup, electronApp }) => {
      await testSetup.setupFilesystem(createCopyWorkspace(status))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      /** Real window and navigation helpers exercise both quick-copy decisions. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptFolders('Tasks')
      await stubClipboard(mainWindow)
      if (status !== PromptStatus.Backlog) {
        await mainWindow.getByTestId(`toggle-${status.toLowerCase()}-prompts-button`).click()
      }
      /** Source filter remains selected after both confirmed moves. */
      const filter = mainWindow.getByTestId(`prompt-folder-${status.toLowerCase()}-filter`)
      await filter.click()
      // Both a real template and No template must wait for the same confirmation boundary.
      for (const choice of [
        { id: 'quick-template', title: 'Quick Template', option: 'prompt-tree-template-prompt-wrapper', output: 'Wrapped Template body', templates: [{ id: 'wrapper' }] },
        { id: 'quick-none', title: 'Quick None', option: 'prompt-template-option-none', output: 'Plain body', templates: null }
      ]) {
        await mainWindow.evaluate(() => navigator.clipboard.writeText('Keep clipboard'))
        /** Source document detects changes made before the confirmation is accepted. */
        const sourcePath = `${ROOT_PATH}/${status}/${choice.title}.prompt.md`
        /** Original bytes include the unset template decision and original workflow. */
        const original = await readTextFile(electronApp, sourcePath)
        /** Undecided editor exposes quick copy and Set Template just like an Active prompt. */
        const editor = mainWindow.locator(promptEditorSelector(choice.id))
        await expect(editor.getByTestId('prompt-template-button')).toBeVisible()
        await expect(editor.getByTestId('prompt-copy-button')).toHaveCount(0)
        await editor.getByTestId('prompt-template-and-copy-button').click()
        /** Picker appears before any copy confirmation. */
        const picker = mainWindow.getByRole('dialog', { name: 'Quick Template Selection' })
        /** Confirmation must appear only after the chosen row is activated. */
        const confirmation = mainWindow.getByRole('dialog', { name: 'Copy Prompt', exact: true })
        await expect(picker).toBeVisible()
        await expect(confirmation).toBeHidden()
        await picker.getByTestId(choice.option).click()
        await expect(picker).toBeHidden()
        await expect(confirmation).toBeVisible()
        expect(await readClipboardText(mainWindow)).toBe('Keep clipboard')
        expect(await readTextFile(electronApp, sourcePath)).toBe(original)
        if (choice.templates) await mainWindow.keyboard.press('Escape')
        else await confirmation.getByRole('button', { name: 'Close', exact: true }).click()
        await expect(mainWindow.getByRole('dialog')).toHaveCount(0)
        await expect(editor.locator('.prompt-editor-metadata-folder')).toHaveText('Not selected')
        await expect(editor.getByTestId('prompt-status-pill')).toHaveText(status)
        expect(await readClipboardText(mainWindow)).toBe('Keep clipboard')
        expect(await readTextFile(electronApp, sourcePath)).toBe(original)
        await editor.getByTestId('prompt-template-and-copy-button').click()
        await picker.getByTestId(choice.option).click()
        await confirmation.getByTestId('prompt-confirm-copy-button').click()
        await expect.poll(() => readClipboardText(mainWindow)).toBe(choice.output)
        await expect.poll(async () => parsePromptMarkdown(await readTextFile(electronApp, `${ROOT_PATH}/Active/${choice.title}.prompt.md`)))
          .toMatchObject({ status: PromptStatus.InProgress, templates: choice.templates })
        await expect.poll(() => checkFileExists(electronApp, sourcePath)).toBe(false)
        await expect(filter).toHaveAttribute('aria-pressed', 'true')
        await expect(editor).toHaveCount(0)
        await expect(confirmation).toBeHidden()
      }
    })
  }
})
