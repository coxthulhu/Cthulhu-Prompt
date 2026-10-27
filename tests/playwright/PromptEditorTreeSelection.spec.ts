import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { stubClipboard } from '../helpers/ClipboardHelpers'
import { PROMPT_COLLECTION_HOST_SELECTOR, promptEditorSelector } from '../helpers/PromptCollectionSelectors'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'

/** Real Electron coverage of temporary editor-driven sidebar selection. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Isolated workspace used by both prompt and template variants. */
const WORKSPACE_PATH = '/ws/editor-tree-selection'

/** Builds enough short editors to scroll the sidebar independently of the main viewport. */
const createSelectionWorkspace = (kind: 'prompt' | 'template', categorized = false) => {
  /** Stable content identities allow the same assertions for both content kinds. */
  const entries = Array.from({ length: categorized ? 3 : 35 }, (_, index) => ({
    id: `entry-${index}`, title: `Entry ${index}`, text: `Body ${index}.`
  }))
  if (kind === 'template') {
    return createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [{
      folderName: 'Content', displayName: 'Content', collectionId: 'content',
      templates: entries.filter((_, index) => !categorized || index === 0).map((entry) => ({
        id: entry.id, title: entry.title, templateText: entry.text
      })),
      categories: categorized ? [{
        categoryName: 'Category', displayName: 'Category', categoryId: 'category',
        templates: entries.slice(1).map((entry) => ({
          id: entry.id, title: entry.title, templateText: entry.text
        }))
      }] : []
    }])
  }
  /** Task fixture metadata places the later entries in a real sidebar category. */
  const structure = createWorkspaceWithCollections(WORKSPACE_PATH, [{
    folderName: 'Content', displayName: 'Content', promptCollectionId: 'content',
    prompts: entries.map((entry, index) => ({
      id: entry.id, title: entry.title, promptText: entry.text, templates: [],
      ...(categorized && index > 0 ? { category: 'category' } : {})
    }))
  }])
  if (categorized) {
    structure[`${WORKSPACE_PATH}/Prompts/Content/Categories/Category.category.json`] = JSON.stringify({
      id: 'category', displayName: 'Category', shortDescription: null, description: ''
    })
  }
  return structure
}

describe('Editor-driven prompt tree selection', () => {
  // Both wrappers must share edit, activation, and scroll-release behavior.
  for (const kind of ['prompt', 'template'] as const) {
    test(`${kind} edits and toolbar activation hold selection until main scrolling or tree navigation`, async ({ testSetup }) => {
      await testSetup.setupFilesystem(createSelectionWorkspace(kind))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      /** Window and virtual-scroll helpers for this content kind. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      if (kind === 'template') await testHelpers.navigateToPromptTemplateCollections('Content')
      else await testHelpers.navigateToPromptCollections('Content')
      await stubClipboard(mainWindow)
      /** Sidebar namespace distinguishes the two content kinds. */
      const group = kind === 'template' ? 'template' : 'active'
      /** Initial overview selection belongs to the first editor. */
      const firstTreeRow = mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-0`)
      /** Second editor must take selection only after an actual interaction. */
      const secondTreeRow = mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-1`)
      /** Shared editor chrome used for title, copy, and dropdown interactions. */
      const editor = mainWindow.getByTestId('prompt-editor-entry-1')
      /** Editable title used to distinguish focus from a content change. */
      const title = editor.getByTestId('prompt-title')
      await waitForMonacoEditor(mainWindow, promptEditorSelector('entry-1'))
      await expect(firstTreeRow).toHaveAttribute('aria-current', 'true')
      await title.focus()
      await title.press('ArrowLeft')
      await expect(firstTreeRow).toHaveAttribute('aria-current', 'true')
      await title.press('End')
      await title.pressSequentially(' edited')
      await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')

      // Sidebar scrolling must not release the edited prompt, even when its row is virtualized away.
      await testHelpers.scrollVirtualWindowTo(`[data-testid="prompt-tree-${group}-virtual-window"]`, 500)
      await testHelpers.scrollVirtualWindowTo(`[data-testid="prompt-tree-${group}-virtual-window"]`, 0)
      await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')

      // Scrolling the main viewport restores ordinary selection, including its overview behavior.
      await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST_SELECTOR, 100)
      await testHelpers.scrollVirtualWindowTo(PROMPT_COLLECTION_HOST_SELECTOR, 0)
      await expect(firstTreeRow).toHaveAttribute('aria-current', 'true')
      await focusMonacoEditor(mainWindow, promptEditorSelector('entry-1'))
      await expect(firstTreeRow).toHaveAttribute('aria-current', 'true')
      await mainWindow.keyboard.type(' changed')
      await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')
      await firstTreeRow.click()
      await expect(firstTreeRow).toHaveAttribute('aria-current', 'true')

      /** Native keyboard activation must select even a dropdown that changes no content. */
      const dropdown = editor.getByTestId('prompt-delete-more-options-button')
      await dropdown.focus()
      await expect(firstTreeRow).toHaveAttribute('aria-current', 'true')
      await dropdown.press('Enter')
      await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')
      await expect(mainWindow.getByTestId('prompt-delete-more-options-menu')).toBeVisible()
      await mainWindow.keyboard.press('Escape')

      if (kind === 'prompt') {
        await firstTreeRow.click()
        await editor.getByTestId('prompt-status-more-options-button').click()
        await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')
        await mainWindow.getByTestId('prompt-status-option-in-progress').click()
        await firstTreeRow.click()
        await editor.getByTestId('prompt-previous-status-button').click()
        await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')
        await firstTreeRow.click()
        await editor.getByTestId('prompt-template-button').click()
        await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')
        await expect(mainWindow.getByRole('dialog')).toBeVisible()
        await mainWindow.keyboard.press('Escape')
      }

      await firstTreeRow.click()
      await editor.getByTestId('prompt-copy-button').click()
      await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')

      if (kind === 'template') {
        await firstTreeRow.click()
        await editor.getByTestId('prompt-template-parameter-prompt-text').click()
        await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')
        // A configured parameter only focuses Monaco, but activating its button still selects.
        await firstTreeRow.click()
        await editor.getByTestId('prompt-template-parameter-prompt-text').click()
        await expect(secondTreeRow).toHaveAttribute('aria-current', 'true')
      }
    })

    test(`${kind} editing and move shortcuts preserve collapsed tree categories`, async ({ testSetup }) => {
      await testSetup.setupFilesystem(createSelectionWorkspace(kind, true))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      /** Window and navigation helpers for a root with a categorized editor. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      if (kind === 'template') await testHelpers.navigateToPromptTemplateCollections('Content')
      else await testHelpers.navigateToPromptCollections('Content')
      /** Content kind determines the sidebar test IDs. */
      const group = kind === 'template' ? 'template' : 'active'
      /** Collapsing the sidebar must leave the main editors available. */
      const category = mainWindow.getByTestId(`prompt-tree-${group}-category-toggle-button-Category`)
      /** Editor under the collapsed category whose edits must retain the collapsed state. */
      const editor = mainWindow.getByTestId('prompt-editor-entry-1')
      await category.click()
      await editor.getByTestId('prompt-title').fill('Edited inside collapsed category')
      await expect(category).toHaveAttribute('aria-expanded', 'false')
      await category.click()
      await expect(mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-1`)).toHaveAttribute('aria-current', 'true')
      await category.click()

      // Moving up crosses into Uncategorized; moving down returns without expanding the category.
      await editor.getByTestId('prompt-title').focus()
      await mainWindow.keyboard.press('Control+Shift+ArrowUp')
      await expect(editor.getByTestId('prompt-title')).toBeFocused()
      await expect(mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-1`)).toHaveAttribute('aria-current', 'true')
      await editor.getByTestId('prompt-title').focus()
      await mainWindow.keyboard.press('Control+Shift+ArrowDown')
      await expect(editor.getByTestId('prompt-title')).toBeFocused()
      await expect(mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-1`)).toHaveCount(0)
      await expect(category).toHaveAttribute('aria-expanded', 'false')
      await category.click()
      await expect(mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-1`)).toHaveAttribute('aria-current', 'true')
      await mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-0`).click()
      await editor.getByTestId('prompt-title').focus()
      await mainWindow.keyboard.press('Control+Shift+ArrowDown')
      await expect(editor.getByTestId('prompt-title')).toBeFocused()
      await expect(mainWindow.getByTestId(`prompt-tree-${group}-prompt-entry-1`)).toHaveAttribute('aria-current', 'true')
    })

    test(`${kind} internal Monaco scrolling retains the edited selection`, async ({ testSetup }) => {
      /** Long second body ensures that the editor has its own scrollbar. */
      const body = Array.from({ length: 100 }, (_, index) => `Line ${index}`).join('\n')
      await testSetup.setupFilesystem(kind === 'template'
        ? createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [{
            folderName: 'Content', displayName: 'Content', collectionId: 'content', templates: [
              { id: 'first', title: 'First', templateText: 'Short.' },
              { id: 'second', title: 'Second', templateText: body }
            ]
          }])
        : createWorkspaceWithCollections(WORKSPACE_PATH, [{
            folderName: 'Content', displayName: 'Content', promptCollectionId: 'content', prompts: [
              { id: 'first', title: 'First', promptText: 'Short.' },
              { id: 'second', title: 'Second', promptText: body }
            ]
          }]))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      /** Window and virtual-scroll helpers for the long-body fixture. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      if (kind === 'template') await testHelpers.navigateToPromptTemplateCollections('Content')
      else await testHelpers.navigateToPromptCollections('Content')
      /** Sidebar namespace for the long editor's selected row. */
      const group = kind === 'template' ? 'template' : 'active'
      await focusMonacoEditor(mainWindow, promptEditorSelector('second'))
      await mainWindow.getByTestId('prompt-editor-second').getByTestId('prompt-title').fill('Edited')
      await focusMonacoEditor(mainWindow, promptEditorSelector('second'))
      /** Main virtual offset must remain stationary while Monaco consumes the wheel. */
      const mainScrollTop = await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR)
      await mainWindow.mouse.wheel(0, 240)
      await expect.poll(() => mainWindow.evaluate(() => {
        /** Registered editor exposes its actual internal scroll position. */
        const entry = window.__cthulhuMonacoEditors?.find((item) =>
          item.container?.closest('[data-testid="prompt-editor-second"]'))
        return entry?.editor.getScrollTop() ?? 0
      })).toBeGreaterThan(0)
      expect(await testHelpers.getElementScrollTop(PROMPT_COLLECTION_HOST_SELECTOR)).toBe(mainScrollTop)
      await expect(mainWindow.getByTestId(`prompt-tree-${group}-prompt-second`)).toHaveAttribute('aria-current', 'true')
    })
  }
})
