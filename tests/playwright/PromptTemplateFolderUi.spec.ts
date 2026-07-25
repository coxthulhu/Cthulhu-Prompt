import type { Page } from 'playwright'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import {
  focusMonacoEditor,
  getMonacoEditorText,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'
import {
  createWorkspaceWithFolders,
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { runSqlQuery } from '../helpers/UserPersistenceHelpers'
import {
  beginPromptHandleDrag,
  finishActiveDrag,
  moveActiveDragToTarget,
  promptFolderSelectorDropdownItemSelector,
  promptFolderSelectorMenuSelector,
  promptFolderSelectorTriggerSelector,
  readPromptFolderEntryIds
} from '../helpers/PromptDragDropHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/template-folder-ui'
const TEMPLATE_FOLDER_ID = 'template-ui-folder'
const EMPTY_TEMPLATE_FOLDER_ID = 'template-empty-folder'
const TEMPLATE_ID = 'template-ui-existing'
const TEMPLATE_EDITOR = promptEditorSelector(TEMPLATE_ID)
const FIND_MATCH = 'template-folder-find-marker'

const createTemplateUiWorkspace = () =>
  createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [
    {
      folderName: 'Templates',
      displayName: 'Templates',
      folderId: TEMPLATE_FOLDER_ID,
      templates: [
        {
          id: TEMPLATE_ID,
          title: 'Existing Template',
          templateText: Array.from(
            { length: 80 },
            (_, index) => (index === 24 ? FIND_MATCH : `Template line ${index + 1}`)
          ).join('\n')
        }
      ],
      subfolders: [
        {
          folderName: 'Nested',
          displayName: 'Nested Templates',
          folderId: 'template-ui-nested-folder',
          templates: [
            {
              id: 'template-ui-nested',
              title: 'Nested Template',
              templateText: `Nested ${FIND_MATCH}.`
            }
          ]
        }
      ]
    },
    {
      folderName: 'Empty',
      displayName: 'Empty Templates',
      folderId: EMPTY_TEMPLATE_FOLDER_ID
    }
  ])

const getEditorScrollTop = async (page: Page, editorSelector: string): Promise<number | null> =>
  await page.evaluate((selector) => {
    const monacoNode = document.querySelector(`${selector} .monaco-editor`)
    const registry = window.__cthulhuMonacoEditors
    const entry = registry?.find(
      (item) => item.container === monacoNode || item.container?.contains(monacoNode)
    )
    return entry ? Math.round(entry.editor.getScrollTop()) : null
  }, editorSelector)

const setEditorScrollTop = async (
  page: Page,
  editorSelector: string,
  scrollTop: number
): Promise<void> => {
  await page.evaluate(
    ({ selector, nextScrollTop }) => {
      const monacoNode = document.querySelector(`${selector} .monaco-editor`)
      const registry = window.__cthulhuMonacoEditors
      const entry = registry?.find(
        (item) => item.container === monacoNode || item.container?.contains(monacoNode)
      )
      entry?.editor.setScrollTop(nextScrollTop)
    },
    { selector: editorSelector, nextScrollTop: scrollTop }
  )
}

describe('Prompt template folder UI', () => {
  test('creates, edits, copies, and deletes a template', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(createTemplateUiWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Templates')
    await stubClipboard(mainWindow)

    await mainWindow.locator('[data-testid="sidebar-add-prompt-button"]').click()
    const editors = mainWindow.locator('[data-testid^="prompt-editor-"]')
    await expect(editors).toHaveCount(2)
    const newEditor = editors.filter({ has: mainWindow.locator('[placeholder="New Template..."]') })
    await expect(newEditor).toHaveCount(1)
    const newEditorTestId = await newEditor.getAttribute('data-testid')
    const newTemplateId = newEditorTestId?.replace('prompt-editor-', '')
    expect(newTemplateId).toBeTruthy()
    const createdEditor = mainWindow.locator(promptEditorSelector(newTemplateId!))

    const titleInput = createdEditor.locator('[data-testid="prompt-title"]')
    await titleInput.fill('UI Template')
    await focusMonacoEditor(mainWindow, promptEditorSelector(newTemplateId!))
    await mainWindow.keyboard.type('Use {{selection}}.', { delay: 20 })
    await expect
      .poll(() => getMonacoEditorText(mainWindow, promptEditorSelector(newTemplateId!)))
      .toContain('Use {{selection}}.')
    await expect(
      createdEditor.locator('[data-testid="prompt-title-status-indicator"]')
    ).toHaveAttribute('data-edited', 'true')

    const persistedPath = `${WORKSPACE_PATH}/Templates/Templates/UI Template.template.md`
    await expect.poll(() => checkFileExists(electronApp, persistedPath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, persistedPath)).toContain('Use {{selection}}.')

    await createdEditor.locator('[data-testid="prompt-copy-button"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => window.navigator.clipboard.readText()))
      .toBe('Use {{selection}}.')

    await createdEditor.locator('[data-testid="prompt-delete-button"]').click()
    await expect(mainWindow.getByText('Delete Template', { exact: true })).toBeVisible()
    await mainWindow.locator('[data-testid="prompt-confirm-delete-button"]').click()
    await expect(mainWindow.locator(promptEditorSelector(newTemplateId!))).toHaveCount(0)
    await expect.poll(() => checkFileExists(electronApp, persistedPath)).toBe(false)
  })

  test('wraps template actions only below 420 pixels', async ({ electronApp, testSetup }) => {
    await testSetup.setupFilesystem(createTemplateUiWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Templates')

    const titleRow = mainWindow.locator(`${TEMPLATE_EDITOR} .prompt-editor-title-row`)
    const setTitleRowWidth = async (targetWidthPx: number) => {
      const currentWidthPx = await titleRow.evaluate((row) => row.getBoundingClientRect().width)
      await electronApp.evaluate(
        ({ BrowserWindow }, widthDeltaPx) => {
          const window = BrowserWindow.getAllWindows()[0]
          if (!window) throw new Error('Missing main window')
          const bounds = window.getBounds()
          window.setSize(bounds.width + widthDeltaPx, bounds.height)
        },
        Math.round(targetWidthPx - currentWidthPx)
      )
      await expect
        .poll(async () =>
          Math.abs(
            targetWidthPx -
              Math.round(await titleRow.evaluate((row) => row.getBoundingClientRect().width))
          )
        )
        .toBeLessThanOrEqual(2)
    }

    await setTitleRowWidth(422)
    await expect(titleRow).toHaveAttribute('data-layout', 'default')
    await setTitleRowWidth(417)
    await expect(titleRow).toHaveAttribute('data-layout', 'compact')
  })

  test('finds template text and restores its persisted Monaco scroll state', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(createTemplateUiWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Templates')
    await waitForMonacoEditor(mainWindow, TEMPLATE_EDITOR)

    await focusMonacoEditor(mainWindow, TEMPLATE_EDITOR)
    await mainWindow.keyboard.press('Control+F')
    await mainWindow.locator('[data-testid="prompt-find-input"]').fill(FIND_MATCH)
    await expect(
      mainWindow.locator('[data-testid="prompt-find-widget"] .prompt-find-widget__matches')
    ).toHaveText('1 of 2')
    await mainWindow.locator('[data-testid="prompt-find-input"]').press('Enter')
    await expect(
      mainWindow.locator('[data-testid="prompt-find-widget"] .prompt-find-widget__matches')
    ).toHaveText('2 of 2')
    await mainWindow.locator('[data-testid="prompt-find-close"]').click()

    await setEditorScrollTop(mainWindow, TEMPLATE_EDITOR, 240)
    await expect
      .poll(async () => Math.abs((await getEditorScrollTop(mainWindow, TEMPLATE_EDITOR))! - 240))
      .toBeLessThanOrEqual(2)
    await testHelpers.navigateToPromptFolders('Empty Templates')
    await expect(mainWindow.locator(TEMPLATE_EDITOR)).toHaveCount(0)
    await expect(mainWindow.locator('[data-testid="prompt-tree-empty-state"]')).toContainText(
      'No templates found in this folder.'
    )
    await expect(mainWindow.locator('[data-testid="prompt-folder-virtual-window"]')).toContainText(
      'No templates found in this folder.'
    )
    await expect(mainWindow.locator('[data-testid="prompt-divider-add-initial"]')).toHaveText(
      'Add Template'
    )
    await expect
      .poll(async () => {
        const result = await runSqlQuery(
          electronApp,
          `SELECT content_id FROM markdown_content_ui_state WHERE content_id = '${TEMPLATE_ID}'`
        )
        return result.rows?.[0]?.content_id ?? null
      })
      .toBe(TEMPLATE_ID)

    await testHelpers.navigateToPromptFolders('Templates')
    await waitForMonacoEditor(mainWindow, TEMPLATE_EDITOR)
    await expect
      .poll(async () => Math.abs((await getEditorScrollTop(mainWindow, TEMPLATE_EDITOR))! - 240))
      .toBeLessThanOrEqual(2)
  })

  test('blocks prompt and template drops onto roots of the other kind', async ({
    electronApp,
    testSetup
  }) => {
    const workspacePath = '/ws/template-cross-kind-drag'
    const promptFolderId = 'cross-kind-prompts'
    const templateFolderId = 'cross-kind-templates'
    const filesystem = {
      ...createWorkspaceWithFolders(workspacePath, [
        {
          folderName: 'Prompts',
          displayName: 'Prompts',
          promptFolderId,
          prompts: [{ id: 'cross-kind-prompt', title: 'Prompt', promptText: 'Prompt text.' }]
        }
      ]),
      ...createWorkspaceWithTemplateFolders(workspacePath, [
        {
          folderName: 'Templates',
          displayName: 'Templates',
          folderId: templateFolderId,
          templates: [
            { id: 'cross-kind-template', title: 'Template', templateText: 'Template text.' }
          ]
        }
      ]),
      [`${workspacePath}/WorkspaceFolderOrder.json`]: JSON.stringify({
        entries: [
          { kind: 'folder', id: promptFolderId },
          { kind: 'folder', id: templateFolderId }
        ]
      })
    }
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(workspacePath)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)

    const tryCrossKindDrop = async (sourceName: string, contentId: string, destinationId: string) => {
      await testHelpers.navigateToPromptFolders(sourceName)
      await waitForMonacoEditor(mainWindow, promptEditorSelector(contentId))
      await beginPromptHandleDrag(mainWindow, contentId)
      await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
      await expect(mainWindow.locator(promptFolderSelectorMenuSelector)).toBeVisible()
      const destination = mainWindow.locator(
        promptFolderSelectorDropdownItemSelector(destinationId)
      )
      await moveActiveDragToTarget(mainWindow, promptFolderSelectorDropdownItemSelector(destinationId))
      await expect(destination).not.toHaveAttribute('data-row-state', 'over')
      await finishActiveDrag(mainWindow)
    }

    await tryCrossKindDrop('Prompts', 'cross-kind-prompt', templateFolderId)
    await tryCrossKindDrop('Templates', 'cross-kind-template', promptFolderId)
    await expect(
      readPromptFolderEntryIds(
        electronApp,
        `${workspacePath}/Prompts/Prompts/_FolderInfo/FolderOrder.json`
      )
    ).resolves.toEqual(['cross-kind-prompt'])
    await expect(
      readPromptFolderEntryIds(
        electronApp,
        `${workspacePath}/Templates/Templates/_FolderInfo/FolderOrder.json`
      )
    ).resolves.toEqual(['cross-kind-template'])
  })
})
