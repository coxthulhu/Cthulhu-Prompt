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
import { getPromptEditorIds } from '../helpers/PromptDragDropHelpers'

const { test, describe, expect } = createPlaywrightTestSuite()

const WORKSPACE_PATH = '/ws/template-selection'
const PROMPT_FOLDER_ID = 'selection-prompts'
const SECOND_TEMPLATE_FOLDER_ID = 'selection-templates-second'
const FIRST_TEMPLATE_FOLDER_ID = 'selection-templates-first'
const TEMPLATE_CATEGORY_ID = 'selection-templates-category'
const EMPTY_TEMPLATE_FOLDER_ID = 'selection-templates-empty'
const UNUSABLE_CATEGORY_ID = 'selection-templates-unusable-category'
const PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Active/Select Template.prompt.md`
const NO_TEMPLATE_PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Active/Explicit No Template.prompt.md`
const STALE_PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Active/Stale Template.prompt.md`
const MULTI_TEMPLATE_PROMPT_PATH = `${WORKSPACE_PATH}/Prompts/Prompts/Active/Multiple Templates.prompt.md`
const PROMPT_ORDER_PATH =
  `${WORKSPACE_PATH}/Prompts/Prompts/Active/_FolderInfo/FolderOrderV2.json`

type TemplateIndicatorColorToken =
  | '--ui-muted-text'
  | '--ui-secondary-text'
  | '--ui-normal-text'

const readPromptOrderIds = async (electronApp: any): Promise<string[]> => {
  const order = JSON.parse(await readTextFile(electronApp, PROMPT_ORDER_PATH)) as {
    categories: Array<{ entries: Array<{ kind: 'prompt' | 'template'; id: string }> }>
  }
  return order.categories.flatMap(({ entries }) =>
    entries.flatMap((entry) => (entry.kind === 'prompt' ? [entry.id] : []))
  )
}

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
            { id: 'template-category' }
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
      categories: [
        {
          categoryName: 'Category',
          displayName: 'Category Templates',
          categoryId: TEMPLATE_CATEGORY_ID,
          templates: [
            {
              id: 'template-category',
              title: 'Category Template',
              templateText: 'Category [[PROMPT_TEXT]].'
            }
          ]
        },
        {
          categoryName: 'UnusableCategory',
          displayName: 'Unusable Category Templates',
          categoryId: UNUSABLE_CATEGORY_ID,
          templates: [
            {
              id: 'template-unusable-category',
              title: 'Unusable Category Template',
              templateText: 'No prompt insertion point.'
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
          { kind: 'folder', id: FIRST_TEMPLATE_FOLDER_ID },
          { kind: 'folder', id: EMPTY_TEMPLATE_FOLDER_ID }
        ]
      },
      null,
      2
    )
  }
}

describe('Prompt template selection', () => {
  test('stages and normalizes ordered template selections', async ({
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
    await expect(
      mainWindow.locator('[data-testid="prompt-tree-prompt-select-template-prompt"]')
    ).not.toHaveCSS('cursor', 'pointer')

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
    ).toEqual(['Select Template and Copy', 'Set Template'])
    expect(
      await stalePromptEditor
        .locator('.prompt-editor-title-button-bar button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
    ).toEqual(['Copy prompt', 'Set Template'])
    expect(
      await noTemplatePromptEditor
        .locator('.prompt-editor-title-button-bar button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
    ).toEqual(['Copy prompt', 'Set Template'])
    expect(
      await multiTemplatePromptEditor
        .locator('.prompt-editor-title-button-bar button')
        .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')))
    ).toEqual(['Copy prompt', 'Set Template'])

    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    const dialog = mainWindow.getByRole('dialog', { name: 'Configure Templates' })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-testid="dialog-header-icon"]')).toBeVisible()
    await expect(dialog.locator('[data-testid="dialog-subtitle"]')).toHaveText(
      'Select one or more templates to apply to this prompt.'
    )
    expect(Math.abs((await dialog.boundingBox())!.width - 580)).toBeLessThanOrEqual(2)
    const firstBaseFolderHeader = dialog.locator('.prompt-template-base-folder-header').first()
    const firstBaseFolderHeaderSpacer = dialog
      .locator('.prompt-template-base-folder-header-spacer')
      .first()
    const firstBaseFolderContentRow = dialog
      .locator('.prompt-template-base-folder-content-row')
      .first()
    const firstBaseFolderHeaderBox = (await firstBaseFolderHeader.boundingBox())!
    const firstBaseFolderHeaderSpacerBox = (await firstBaseFolderHeaderSpacer.boundingBox())!
    const firstBaseFolderContentRowBox = (await firstBaseFolderContentRow.boundingBox())!
    expect(
      Math.abs(
        firstBaseFolderHeaderSpacerBox.y -
          (firstBaseFolderHeaderBox.y + firstBaseFolderHeaderBox.height)
      )
    ).toBeLessThanOrEqual(2)
    expect(Math.abs(firstBaseFolderHeaderSpacerBox.height - 6)).toBeLessThanOrEqual(2)
    expect(
      Math.abs(
        firstBaseFolderContentRowBox.y -
          (firstBaseFolderHeaderSpacerBox.y + firstBaseFolderHeaderSpacerBox.height)
      )
    ).toBeLessThanOrEqual(2)
    await expect(dialog.locator('.prompt-template-base-folder-copy strong')).toHaveText([
      'Second Templates',
      'First Templates'
    ])
    await expect(dialog.locator('.sidebarPromptTreeSettingsLabel')).toHaveText([
      'Second Root Template',
      'First Root Template',
      'Category Template'
    ])
    await expect(dialog.locator('.sidebarPromptTreeCategoryLabel')).toHaveText([
      'Category Templates'
    ])
    await expect(
      dialog.locator(`[data-testid="prompt-template-base-folder-header-${EMPTY_TEMPLATE_FOLDER_ID}"]`)
    ).toHaveCount(0)
    await expect(
      dialog.locator(
        '[data-testid="prompt-tree-category-toggle-button-UnusableCategoryTemplates"]'
      )
    ).toHaveCount(0)
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveCSS(
      'cursor',
      'pointer'
    )
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-second"]')
    ).toHaveCSS('cursor', 'pointer')
    await expect(
      dialog.locator('[data-testid="prompt-tree-category-toggle-button-CategoryTemplates"]')
    ).toHaveCSS('cursor', 'pointer')
    await expect(
      dialog
        .locator('[data-testid="prompt-tree-category-toggle-button-CategoryTemplates"]')
        .locator('.sidebarPromptTreeCategoryIcon')
    ).toBeVisible()
    await expect(
      dialog.locator('.prompt-template-base-folder-header .prompt-template-base-folder-icon')
    ).toHaveCount(2)
    await expect(
      dialog.locator('.prompt-template-base-folder-header .sidebarPromptTreeChevronWrap')
    ).toHaveCount(0)
    await expect(
      dialog.locator('[data-testid="prompt-template-option-none"] .sidebarPromptTreeCategoryIcon')
    ).toHaveCount(0)
    await expect(dialog.locator('[data-testid="prompt-tree-prompt-template-invalid"]')).toHaveCount(
      0
    )
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    const templateTree = dialog.locator('[data-testid="prompt-template-selection-tree"]')
    const templateTreeSpacer = dialog.locator(
      '[data-testid="prompt-template-selection-tree-spacer"]'
    )
    await expect
      .poll(async () => {
        const treeBox = await templateTree.boundingBox()
        const spacerBox = await templateTreeSpacer.boundingBox()
        return Math.abs((treeBox?.height ?? 0) - (spacerBox?.height ?? 0))
      })
      .toBeLessThanOrEqual(2)
    const expandedDialogHeight = (await dialog.boundingBox())!.height
    const expandedTreeHeight = (await templateTree.boundingBox())!.height

    await dialog
      .locator('[data-testid="prompt-tree-category-toggle-button-CategoryTemplates"]')
      .click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-category"]')
    ).toHaveCount(0)
    await expect
      .poll(async () => (await templateTree.boundingBox())?.height ?? Number.POSITIVE_INFINITY)
      .toBeLessThan(expandedTreeHeight)
    const collapsedDialogHeight = (await dialog.boundingBox())!.height
    const collapsedTreeHeight = (await templateTree.boundingBox())!.height
    expect(
      Math.abs(
        expandedDialogHeight - collapsedDialogHeight - (expandedTreeHeight - collapsedTreeHeight)
      )
    ).toBeLessThanOrEqual(2)
    expect(
      Math.abs(collapsedTreeHeight - (await templateTreeSpacer.boundingBox())!.height)
    ).toBeLessThanOrEqual(2)

    await dialog
      .locator('[data-testid="prompt-tree-category-toggle-button-CategoryTemplates"]')
      .click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-category"]')
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await noTemplatePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await dialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(
      parsePromptMarkdown(await readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH))?.templates
    ).toBeNull()
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()

    await dialog.locator('[data-testid="prompt-tree-prompt-template-category"]').click()
    await expect(dialog).toBeVisible()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-category"]')
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await readTextFile(electronApp, PROMPT_PATH)).not.toContain('templates:')
    await dialog.locator('[data-testid="prompt-template-confirm-button"]').click()
    await expect(dialog).toBeHidden()
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Category Template'
    )
    await expectTemplateIndicator(promptEditor, 'selected', '--ui-normal-text')
    await expect(promptEditor.locator('[data-testid="prompt-copy-button"]')).toBeVisible()
    await expect(
      promptEditor.locator('[data-testid="prompt-template-and-copy-button"]')
    ).toHaveCount(0)
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .toContain('templates:\n  - id: template-category')

    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-category"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await dialog.locator('[data-testid="prompt-tree-prompt-template-category"]').click()
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    expect(
      parsePromptMarkdown(await readTextFile(electronApp, PROMPT_PATH))?.templates
    ).toEqual([{ id: 'template-category' }])
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    await dialog
      .locator('[data-testid="prompt-tree-category-toggle-button-CategoryTemplates"]')
      .click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-category"]')
    ).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-category"]')
    ).toBeVisible()
    await dialog.locator('[data-testid="prompt-template-option-none"]').click()
    await expect(dialog).toBeVisible()
    await dialog.locator('[data-testid="prompt-template-confirm-button"]').click()
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText('No Template')
    await expectTemplateIndicator(promptEditor, 'no-template', '--ui-muted-text')
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .toContain('templates: null')

    await stalePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(dialog.locator('[data-testid="prompt-template-option-none"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await dialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await mainWindow.locator('.cthulhuUiDialogLayer').click({ position: { x: 2, y: 2 } })
    await expect(dialog).toBeHidden()
    expect(await readTextFile(electronApp, STALE_PROMPT_PATH)).toContain(
      'templates:\n  - id: deleted-template'
    )
    expect(await readTextFile(electronApp, STALE_PROMPT_PATH)).not.toContain('templateId:')
    expect(await readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH)).not.toContain('templateId:')
    await stalePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await dialog.locator('[data-testid="prompt-template-confirm-button"]').click()
    await expect
      .poll(
        async () => parsePromptMarkdown(await readTextFile(electronApp, STALE_PROMPT_PATH))?.templates
      )
      .toBeNull()

    await multiTemplatePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await dialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await mainWindow.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(
      parsePromptMarkdown(await readTextFile(electronApp, MULTI_TEMPLATE_PROMPT_PATH))?.templates
    ).toEqual([
      { id: 'deleted-template' },
      { id: 'template-second' },
      { id: 'deleted-template-after' },
      { id: 'template-second' },
      { id: 'template-category' }
    ])

    await multiTemplatePromptEditor.locator('[data-testid="prompt-template-button"]').click()
    await expect(dialog.locator('.prompt-template-tree-label')).toContainText('2 selected')
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-second"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-template-category"]')
    ).toHaveAttribute('aria-pressed', 'true')
    await dialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await dialog.locator('[data-testid="prompt-tree-prompt-template-second"]').click()
    await dialog.locator('[data-testid="prompt-tree-prompt-template-second"]').click()
    await dialog.locator('[data-testid="prompt-template-confirm-button"]').click()
    await expect(multiTemplatePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Category Template + 2 More'
    )
    await expect
      .poll(
        async () =>
          parsePromptMarkdown(
            await readTextFile(electronApp, MULTI_TEMPLATE_PROMPT_PATH)
          )?.templates
      )
      .toEqual([
        { id: 'template-category' },
        { id: 'template-first' },
        { id: 'template-second' }
      ])

    await testHelpers.navigateToPromptFolders('First Templates')
    const templateEditor = mainWindow.locator(promptEditorSelector('template-first'))
    await expect(templateEditor.locator('[data-testid="prompt-template-button"]')).toHaveCount(0)
    await expect(
      templateEditor.locator('[data-testid="prompt-template-and-copy-button"]')
    ).toHaveCount(0)
    await expect(templateEditor.locator('.prompt-editor-metadata-folder')).toHaveCount(0)
  })

  test('copies prompts after a template decision and quick-selects before copying', async ({
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

    const initialPromptOrder = [
      'select-template-prompt',
      'stale-template-prompt',
      'no-template-prompt',
      'multi-template-prompt'
    ]
    await expect.poll(() => getPromptEditorIds(mainWindow)).toEqual(initialPromptOrder)
    await expect.poll(() => readPromptOrderIds(electronApp)).toEqual(initialPromptOrder)

    const promptEditor = mainWindow.locator(promptEditorSelector('select-template-prompt'))
    const noTemplatePromptEditor = mainWindow.locator(
      promptEditorSelector('no-template-prompt')
    )
    const multiTemplatePromptEditor = mainWindow.locator(
      promptEditorSelector('multi-template-prompt')
    )
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'Not Selected'
    )
    await expect(promptEditor.locator('[data-testid="prompt-copy-button"]')).toHaveCount(0)
    await expect(
      promptEditor.locator('[data-testid="prompt-template-and-copy-button"]')
    ).toBeVisible()
    expect(await readTextFile(electronApp, PROMPT_PATH)).not.toContain('templates:')

    await multiTemplatePromptEditor.locator('[data-testid="prompt-copy-button"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('Category Second root Second root Copy with several templates....')
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
      { id: 'template-category' }
    ])
    await expect.poll(() => getPromptEditorIds(mainWindow)).toEqual(initialPromptOrder)
    await expect.poll(() => readPromptOrderIds(electronApp)).toEqual(initialPromptOrder)

    await noTemplatePromptEditor.locator('[data-testid="prompt-copy-button"]').click()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('Copy without a template.')
    await expect(noTemplatePromptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'No Template'
    )
    await expect(
      noTemplatePromptEditor.locator('[data-testid="prompt-template-and-copy-button"]')
    ).toHaveCount(0)
    await expect
      .poll(() => readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH))
      .toContain('templates: null')
    await expect.poll(() => readTextFile(electronApp, NO_TEMPLATE_PROMPT_PATH)).toContain(
      'status: InProgress'
    )
    await expect.poll(() => getPromptEditorIds(mainWindow)).toEqual(initialPromptOrder)
    await expect.poll(() => readPromptOrderIds(electronApp)).toEqual(initialPromptOrder)

    await promptEditor.locator('[data-testid="prompt-template-and-copy-button"]').click()
    const quickDialog = mainWindow.getByRole('dialog', { name: 'Quick Template Selection' })
    await expect(quickDialog).toBeVisible()
    await expect(quickDialog.locator('[data-testid="dialog-header-icon"]')).toBeVisible()
    await expect(quickDialog.locator('[data-testid="dialog-subtitle"]')).toHaveText(
      'Click a template to apply it and copy this prompt immediately.'
    )
    await expect(
      quickDialog.locator('[data-testid="prompt-template-option-none"]')
    ).not.toHaveAttribute('aria-pressed', 'true')
    await expect(
      quickDialog.locator('[data-testid="prompt-template-option-none"]')
    ).toHaveCSS('cursor', 'pointer')
    await expect(
      quickDialog.locator('[data-testid="prompt-tree-prompt-template-first"]')
    ).toHaveCSS('cursor', 'pointer')
    await expect(
      quickDialog.locator(
        '[data-testid="prompt-template-option-none"] .prompt-template-no-template-control[data-control="copy"]'
      )
    ).toBeVisible()
    await expect(
      quickDialog.locator(
        '[data-testid="prompt-tree-prompt-template-first"] .prompt-tree-selection-control[data-control="copy"]'
      )
    ).toBeVisible()
    await quickDialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await expect(quickDialog).toBeHidden()
    await expect
      .poll(() => mainWindow.evaluate(() => (window as any).__testClipboardText ?? ''))
      .toBe('First root Choose a template..')
    await expect(promptEditor.locator('.prompt-editor-metadata-folder')).toHaveText(
      'First Root Template'
    )
    await expect
      .poll(() => readTextFile(electronApp, PROMPT_PATH))
      .toContain('templates:\n  - id: template-first')
    await expect.poll(() => readTextFile(electronApp, PROMPT_PATH)).toContain('status: InProgress')
    await expect.poll(() => getPromptEditorIds(mainWindow)).toEqual(initialPromptOrder)
    await expect.poll(() => readPromptOrderIds(electronApp)).toEqual(initialPromptOrder)
    await expect(promptEditor.locator('[data-testid="prompt-copy-button"]')).toBeVisible()
    await expect(
      promptEditor.locator('[data-testid="prompt-template-and-copy-button"]')
    ).toHaveCount(0)
  })

  test('virtualizes the complete template library folder cards', async ({
    electronApp,
    testSetup
  }) => {
    const virtualWorkspacePath = '/ws/template-selection-virtual'
    const promptWorkspace = createWorkspaceWithFolders(virtualWorkspacePath, [
      {
        folderName: 'Prompts',
        displayName: 'Prompts',
        promptFolderId: 'virtual-selection-prompts',
        prompts: [
          {
            id: 'virtual-selection-prompt',
            title: 'Virtual Selection',
            promptText: 'Choose from a long template library.'
          }
        ]
      }
    ])
    const templateWorkspace = createWorkspaceWithTemplateFolders(virtualWorkspacePath, [
      {
        folderName: 'Templates',
        displayName: 'Virtual Templates',
        folderId: 'virtual-selection-templates',
        templates: Array.from({ length: 60 }, (_value, index) => ({
          id: `virtual-template-${index + 1}`,
          title: `Virtual Template ${index + 1}`,
          templateText: `Virtual ${index + 1} [[PROMPT_TEXT]]`
        }))
      }
    ])
    await testSetup.setupFilesystem({
      ...promptWorkspace,
      ...templateWorkspace,
      [`${virtualWorkspacePath}/WorkspaceFolderOrder.json`]: JSON.stringify(
        {
          entries: [
            { kind: 'folder', id: 'virtual-selection-prompts' },
            { kind: 'folder', id: 'virtual-selection-templates' }
          ]
        },
        null,
        2
      )
    })
    await testSetup.setupFileDialog([getWorkspaceInfoPath(virtualWorkspacePath)])
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'none' }
    })
    expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
    await testHelpers.navigateToPromptFolders('Prompts')

    const promptEditor = mainWindow.locator(promptEditorSelector('virtual-selection-prompt'))
    await promptEditor.locator('[data-testid="prompt-template-button"]').click()
    const dialog = mainWindow.getByRole('dialog', { name: 'Configure Templates' })
    const virtualWindowSelector = '[data-testid="prompt-template-selection-tree"]'
    const spacerSelector = '[data-testid="prompt-template-selection-tree-spacer"]'
    const headerSelector =
      '[data-testid="prompt-template-base-folder-header-virtual-selection-templates"]'
    const footerSelector =
      '[data-testid="prompt-template-base-folder-footer-virtual-selection-templates"]'
    await expect(dialog.locator(headerSelector)).toBeVisible()
    await expect(dialog.locator(footerSelector)).toHaveCount(0)
    await expect(dialog.locator('[data-testid="prompt-tree-prompt-virtual-template-1"]')).toBeVisible()
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-virtual-template-60"]')
    ).toHaveCount(0)

    const metrics = await mainWindow.evaluate(
      ({ virtualWindowSelector, spacerSelector }) => {
        const virtualWindow = document.querySelector<HTMLElement>(virtualWindowSelector)
        const spacer = document.querySelector<HTMLElement>(spacerSelector)
        if (!virtualWindow || !spacer) return null
        return {
          innerHeight: window.innerHeight,
          viewportHeight: virtualWindow.clientHeight,
          spacerHeight: spacer.offsetHeight
        }
      },
      { virtualWindowSelector, spacerSelector }
    )
    expect(metrics).not.toBeNull()
    expect(
      Math.abs(
        (metrics?.viewportHeight ?? 0) -
          Math.min(metrics?.spacerHeight ?? 0, 470, (metrics?.innerHeight ?? 0) - 295)
      )
    ).toBeLessThanOrEqual(2)
    expect(metrics?.spacerHeight).toBeGreaterThan(metrics?.viewportHeight ?? 0)

    await electronApp.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) throw new Error('Missing main window')
      window.setSize(800, 600)
    })
    await expect
      .poll(() =>
        mainWindow.evaluate(({ virtualWindowSelector, spacerSelector }) => {
          const virtualWindow = document.querySelector<HTMLElement>(virtualWindowSelector)
          const spacer = document.querySelector<HTMLElement>(spacerSelector)
          if (!virtualWindow || !spacer) return Number.POSITIVE_INFINITY
          return Math.abs(
            virtualWindow.clientHeight -
              Math.min(spacer.offsetHeight, 470, window.innerHeight - 295)
          )
        }, { virtualWindowSelector, spacerSelector })
      )
      .toBeLessThanOrEqual(2)

    const scrollHeight = await testHelpers.getVirtualWindowScrollHeight(virtualWindowSelector)
    await testHelpers.scrollVirtualWindowTo(virtualWindowSelector, scrollHeight)
    await expect(
      dialog.locator('[data-testid="prompt-tree-prompt-virtual-template-60"]')
    ).toBeVisible()
    await expect(dialog.locator(headerSelector)).toHaveCount(0)
    await expect(dialog.locator(footerSelector)).toBeVisible()
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
    const dialog = mainWindow.getByRole('dialog', { name: 'Configure Templates' })
    await dialog.locator('[data-testid="prompt-tree-prompt-template-first"]').click()
    await dialog.locator('[data-testid="prompt-template-confirm-button"]').click()

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
      .toBe('Draft Choose a template. wrapper')

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
      .toBe('Choose a template.')
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
