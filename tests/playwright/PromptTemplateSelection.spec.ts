import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithFolders,
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'
import { readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import { parsePromptMarkdown } from '../../src/main/Persistence/PromptFrontmatter'
import {
  focusMonacoEditor,
  getMonacoEditorText,
  waitForMonacoEditor
} from '../helpers/MonacoHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/template-selection'
const PROMPT_FOLDER_ID = 'selection-prompts'
const SECOND_TEMPLATE_FOLDER_ID = 'selection-templates-second'
const FIRST_TEMPLATE_FOLDER_ID = 'selection-templates-first'
const NESTED_TEMPLATE_FOLDER_ID = 'selection-templates-nested'
const PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Select Template.prompt.md`
const NO_TEMPLATE_PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Explicit No Template.prompt.md`
const STALE_PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Stale Template.prompt.md`
const MULTI_TEMPLATE_PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Multiple Templates.prompt.md`

type TemplateIndicatorColorToken =
  | '--ui-muted-text'
  | '--ui-secondary-text'
  | '--ui-normal-text'

const expectTemplateIndicator = async (
  promptEditor: any,
  state: 'not-selected' | 'no-template' | 'selected',
  colorToken: TemplateIndicatorColorToken
) => {
  const indicator = promptEditor.locator('.prompt-editor-metadata-folder')
  await expect(indicator).toHaveAttribute('data-template-state', state)
  const colors = await indicator.evaluate((element: Element, token: string) => {
    const reference = document.createElement('span')
    reference.style.color = `var(${token})`
    document.body.append(reference)
    const expected = getComputedStyle(reference).color
    reference.remove()
    return {
      text: getComputedStyle(element).color,
      icon: getComputedStyle(element.querySelector('svg')!).color,
      expected
    }
  }, colorToken)
  expect(colors.text).toBe(colors.expected)
  expect(colors.icon).toBe(colors.expected)
}

const createTemplateSelectionWorkspace = (): Record<string, string | null> => {
  const promptWorkspace = createWorkspaceWithFolders(WORKSPACE_PATH, [
    {
      folderName: 'Prompts',
      displayName: 'Prompts',
      promptFolderId: PROMPT_FOLDER_ID,
      folderSettings: {
        folderPrefix: 'Prompt folder prefix',
        folderSuffix: 'Prompt folder suffix'
      },
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
          templates: [{ id: 'deleted-template' }]
        },
        {
          id: 'no-template-prompt',
          title: 'Explicit No Template',
          promptText: 'Copy without a template.',
          templates: null
        },
        {
          id: 'multi-template-prompt',
          title: 'Multiple Templates',
          promptText: 'Copy with several templates.',
          templates: [
            { id: 'deleted-template' },
            { id: 'template-second' },
            { id: 'deleted-template-after' },
            { id: 'template-second' },
            { id: 'template-nested' }
          ]
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
          templateText: 'Second root [[PROMPT_TEXT]].'
        },
        {
          id: 'template-invalid',
          title: 'Invalid Template',
          templateText: 'No prompt insertion point.'
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
          templateText: 'First root [[PROMPT_TEXT]].'
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
              templateText: 'Nested [[PROMPT_TEXT]].'
            }
          ]
        }
      ]
    }
  ])

  return {
    ...promptWorkspace,
    ...templateWorkspace,
    [STALE_PROMPT_PATH]: `---
id: stale-template-prompt
createdAt: '2026-01-01T00:00:00.000Z'
title: Stale Template
templateId: deleted-template
status: Todo
---
Keep the missing selection.`,
    [NO_TEMPLATE_PROMPT_PATH]: `---
id: no-template-prompt
createdAt: '2026-01-01T00:00:00.000Z'
title: Explicit No Template
templateId: null
status: Todo
---
Copy without a template.`,
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
    const noTemplatePromptEditor = mainWindow.locator(
      promptEditorSelector('no-template-prompt')
    )
    const multiTemplatePromptEditor = mainWindow.locator(
      promptEditorSelector('multi-template-prompt')
    )
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Not Selected'
    )
    await expect(stalePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'No Template'
    )
    await expect(noTemplatePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'No Template'
    )
    await expect(multiTemplatePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Second Root Template + 2 More'
    )
    await expectTemplateIndicator(promptEditor, 'not-selected', '--ui-secondary-text')
    await expectTemplateIndicator(stalePromptEditor, 'no-template', '--ui-muted-text')
    await expectTemplateIndicator(noTemplatePromptEditor, 'no-template', '--ui-muted-text')
    expect(
      await promptEditor
        .locator('.prompt-editor-title-button-bar button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
    ).toEqual([
      'Delete prompt',
      'Set Template',
      'Copy prompt',
      'Select Template and Copy'
    ])

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
    await expect(
      dialog
        .locator('[data-testid="prompt-tree-folder-toggle-button-Nested"]')
        .locator('.sidebarPromptTreeFolderIcon')
    ).toBeVisible()
    await expect(
      dialog.locator('.sidebarPromptTreeBaseFolderButton .sidebarPromptTreeFolderIcon')
    ).toHaveCount(2)
    await expect(
      dialog.locator('.sidebarPromptTreeBaseFolderButton .sidebarPromptTreeChevronWrap')
    ).toHaveCount(0)
    await expect(
      dialog.locator('[data-testid="prompt-template-option-none"] .sidebarPromptTreeFolderIcon')
    ).toHaveCount(0)
    await expect(dialog.locator('[data-testid="prompt-tree-prompt-template-invalid"]')).toHaveCount(
      0
    )
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).not.toHaveAttribute(
      'aria-current',
      'true'
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await noTemplatePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveAttribute(
      'aria-current',
      'true'
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()

    await dialog.locator('[data-testid="prompt-tree-prompt-template-nested"]').click()
    await expect(dialog).toBeHidden()
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Nested Template'
    )
    await expectTemplateIndicator(promptEditor, 'selected', '--ui-normal-text')
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .toContain('templates:\n  - id: template-nested')

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
    await expectTemplateIndicator(promptEditor, 'no-template', '--ui-muted-text')
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .toContain('templates: null')

    await stalePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveAttribute(
      'aria-current',
      'true'
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(await readTextFile(electronApp, STALE_PROMPT_PATH)).toContain(
      'templates:\n  - id: deleted-template'
    )
    expect(await readTextFile(electronApp, STALE_PROMPT_PATH)).not.toContain('templateId:')
    expect(await readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH)).not.toContain('templateId:')

    await multiTemplatePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await dialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await expect(multiTemplatePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'First Root Template'
    )
    await expect
      .poll(
        async () =>
          parsePromptMarkdown(
            await readTextFile(electronApp, MULTI_TEMPLATE_PROMPT_PATH)
          )?.templates
      )
      .toEqual([{ id: 'template-first' }])

    await testHelpers.navigateToPromptFolders('First Templates')
    const templateEditor = mainWindow.locator(promptEditorSelector('template-first'))
    await expect(templateEditor.locator('[data-testid="prompt-template-button"]')).toHaveCount(0)
    await expect(
      templateEditor.locator('[data-testid="prompt-template-and-copy-button"]')
    ).toHaveCount(0)
    await expect(templateEditor.locator('.prompt-editor-metadata-folder')).toHaveCount(0)
  })

  test('saves copy defaults and quick-selects templates before copying', async ({
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
    await stubClipboard(mainWindow)

    const promptEditor = mainWindow.locator(promptEditorSelector('select-template-prompt'))
    const quickPromptEditor = mainWindow.locator(promptEditorSelector('no-template-prompt'))
    const multiTemplatePromptEditor = mainWindow.locator(
      promptEditorSelector('multi-template-prompt')
    )
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Not Selected'
    )
    expect(await readTextFile(electronApp, PROMPT_PATH)).not.toContain('templates:')

    await multiTemplatePromptEditor.locator('[data-testid="prompt-copy-button"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe(
        'Nested Second root Second root Prompt folder prefix\n\nCopy with several templates.\n\nPrompt folder suffix...'
      )
    await expect(multiTemplatePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Second Root Template + 2 More'
    )
    expect(
      parsePromptMarkdown(await readTextFile(electronApp, MULTI_TEMPLATE_PROMPT_PATH))?.templates
    ).toEqual([
      { id: 'deleted-template' },
      { id: 'template-second' },
      { id: 'deleted-template-after' },
      { id: 'template-second' },
      { id: 'template-nested' }
    ])

    await promptEditor.locator('[data-testid="prompt-copy-button"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('Prompt folder prefix\n\nChoose a template.\n\nPrompt folder suffix')
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText('No Template')
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .toContain('templates: null')
    await expect.poll(() => readTextFile(electronApp, PROMPT_PATH)).toContain('status: InProgress')

    await quickPromptEditor.locator('[data-testid="prompt-template-and-copy-button"]').click()
    const quickDialog = mainWindow.getByRole('dialog', { name: 'Select Template and Copy' })
    await expect(quickDialog).toBeVisible()
    await expect(
      quickDialog.locator('[data-testid="prompt-template-option-none"]')
    ).toHaveAttribute('aria-current', 'true')
    await quickDialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await expect(quickDialog).toBeHidden()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('First root Prompt folder prefix\n\nCopy without a template.\n\nPrompt folder suffix.')
    await expect(quickPromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'First Root Template'
    )
    await expect
      .poll(() => readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH))
      .toContain('templates:\n  - id: template-first')
    await expect
      .poll(() => readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH))
      .toContain('status: InProgress')

    await mainWindow.evaluate(() => {
      const testWindow = window as any
      testWindow.__testClipboardText = 'sentinel'
    })
    await quickPromptEditor.locator('[data-testid="prompt-template-and-copy-button"]').click()
    await quickDialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('First root Prompt folder prefix\n\nCopy without a template.\n\nPrompt folder suffix.')

    await quickPromptEditor.locator('[data-testid="prompt-template-and-copy-button"]').click()
    await quickDialog.locator('[data-testid="prompt-template-option-none"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('Prompt folder prefix\n\nCopy without a template.\n\nPrompt folder suffix')
    await expect
      .poll(() => readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH))
      .toContain('templates: null')
  })

  test('copies with the current template draft and ignores it after its token is removed', async ({
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
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    const dialog = mainWindow.getByRole('dialog', { name: 'Select Template' })
    await dialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()

    await testHelpers.navigateToPromptFolders('First Templates')
    const templateEditorSelector = promptEditorSelector('template-first')
    await waitForMonacoEditor(mainWindow, templateEditorSelector)
    await focusMonacoEditor(mainWindow, templateEditorSelector)
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.insertText('Draft [[PROMPT_TEXT]] wrapper')
    await expect.poll(() => getMonacoEditorText(mainWindow, templateEditorSelector)).toBe(
      'Draft [[PROMPT_TEXT]] wrapper'
    )

    await testHelpers.navigateToPromptFolders('Prompts')
    await waitForMonacoEditor(mainWindow, promptEditorSelector('select-template-prompt'))
    await stubClipboard(mainWindow)
    await promptEditor.locator('[data-testid="prompt-copy-button"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe(
        'Draft Prompt folder prefix\n\nChoose a template.\n\nPrompt folder suffix wrapper'
      )

    await testHelpers.navigateToPromptFolders('First Templates')
    await focusMonacoEditor(mainWindow, templateEditorSelector)
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.insertText('Draft without a token')
    await expect.poll(() => getMonacoEditorText(mainWindow, templateEditorSelector)).toBe(
      'Draft without a token'
    )

    await testHelpers.navigateToPromptFolders('Prompts')
    await stubClipboard(mainWindow)
    await promptEditor.locator('[data-testid="prompt-copy-button"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('Prompt folder prefix\n\nChoose a template.\n\nPrompt folder suffix')
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'First Root Template'
    )
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(dialog.locator('[data-testid="prompt-tree-prompt-template-first"]')).toHaveCount(
      0
    )
    expect(await readTextFile(electronApp, PROMPT_PATH)).toContain(
      'templates:\n  - id: template-first'
    )
  })
})
