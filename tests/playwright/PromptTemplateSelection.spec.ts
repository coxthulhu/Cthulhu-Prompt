import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithFolders,
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/template-selection'
const PROMPT_FOLDER_ID = 'selection-prompts'
const SECOND_TEMPLATE_FOLDER_ID = 'selection-templates-second'
const FIRST_TEMPLATE_FOLDER_ID = 'selection-templates-first'
const NESTED_TEMPLATE_FOLDER_ID = 'selection-templates-nested'
const PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Select Template.prompt.md`
const STALE_PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Stale Template.prompt.md`

const createTemplateSelectionWorkspace = (): Record<string, string | null> => {
  const promptWorkspace = createWorkspaceWithFolders(WORKSPACE_PATH, [
    {
      folderName: 'Prompts',
      displayName: 'Prompts',
      promptFolderId: PROMPT_FOLDER_ID,
      prompts: [
        {
          id: 'select-template-prompt',
          title: 'Select Template',
          promptText: 'Choose a template.'
        },
        {
          id: 'stale-template-prompt',
          title: 'Stale Template',
          promptText: 'Keep the missing selection.',
          templateId: 'deleted-template'
        }
      ]
    }
  ])
  const templateWorkspace = createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [
    {
      folderName: 'Second',
      displayName: 'Second Templates',
      folderId: SECOND_TEMPLATE_FOLDER_ID,
      templates: [
        {
          id: 'template-second',
          title: 'Second Root Template',
          templateText: 'Second root.'
        }
      ]
    },
    {
      folderName: 'First',
      displayName: 'First Templates',
      folderId: FIRST_TEMPLATE_FOLDER_ID,
      templates: [
        {
          id: 'template-first',
          title: 'First Root Template',
          templateText: 'First root.'
        }
      ],
      subfolders: [
        {
          folderName: 'Nested',
          displayName: 'Nested Templates',
          folderId: NESTED_TEMPLATE_FOLDER_ID,
          templates: [
            {
              id: 'template-nested',
              title: 'Nested Template',
              templateText: 'Nested.'
            }
          ]
        }
      ]
    }
  ])

  return {
    ...promptWorkspace,
    ...templateWorkspace,
    [`${WORKSPACE_PATH}/WorkspaceFolderOrder.json`]: JSON.stringify(
      {
        entries: [
          { kind: 'folder', id: PROMPT_FOLDER_ID },
          { kind: 'folder', id: SECOND_TEMPLATE_FOLDER_ID },
          { kind: 'folder', id: FIRST_TEMPLATE_FOLDER_ID }
        ]
      },
      null,
      2
    ),
    [`${WORKSPACE_PATH}/Templates/First/_FolderInfo/FolderOrder.json`]: JSON.stringify(
      {
        entries: [
          { kind: 'folder', id: NESTED_TEMPLATE_FOLDER_ID },
          { kind: 'template', id: 'template-first' }
        ]
      },
      null,
      2
    )
  }
}

describe('Prompt template selection', () => {
  test('selects and clears ordered templates while preserving unresolved ids', async ({
    electronApp,
    testSetup
  }) => {
    await testSetup.setupFilesystem(createTemplateSelectionWorkspace())
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Prompts')

    const promptEditor = mainWindow.locator(promptEditorSelector('select-template-prompt'))
    const stalePromptEditor = mainWindow.locator(promptEditorSelector('stale-template-prompt'))
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText('No Template')
    await expect(stalePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'No Template'
    )
    expect(
      await promptEditor
        .locator('.prompt-editor-title-button-bar button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
    ).toEqual(['Delete prompt', 'Set Template', 'Copy prompt'])

    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    const dialog = mainWindow.getByRole('dialog', { name: 'Select Template' })
    await expect(dialog).toBeVisible()
    expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(482)
    await expect(
      dialog.locator('.sidebarPromptTreeSettingsLabel, .sidebarPromptTreeFolderLabel')
    ).toHaveText([
      'No Template',
      'Second Templates',
      'Second Root Template',
      'First Templates',
      'Nested Templates',
      'Nested Template',
      'First Root Template'
    ])

    await dialog.locator('[data-testid="prompt-tree-prompt-template-nested"]').click()
    await expect(dialog).toBeHidden()
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Nested Template'
    )
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .toContain('templateId: template-nested')

    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-nested"]')
    ).toHaveAttribute('aria-current', 'true')
    await dialog
      .locator('[data-testid="prompt-tree-folder-toggle-button-Nested"]')
      .click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-nested"]')
    ).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-nested"]')
    ).toBeVisible()
    await dialog.locator('[data-testid="prompt-template-option-none"]').click()
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText('No Template')
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .not.toContain('templateId:')

    await stalePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveAttribute(
      'aria-current',
      'true'
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(await readTextFile(electronApp, STALE_PROMPT_PATH)).toContain(
      'templateId: deleted-template'
    )

    await testHelpers.navigateToPromptFolders('First Templates')
    const templateEditor = mainWindow.locator(promptEditorSelector('template-first'))
    await expect(templateEditor.locator('[data-testid="prompt-template-button"]')).toHaveCount(0)
    await expect(templateEditor.locator('.prompt-editor-metadata-folder')).toHaveCount(0)
  })
})
