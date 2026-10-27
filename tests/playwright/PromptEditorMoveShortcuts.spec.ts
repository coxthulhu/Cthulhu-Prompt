import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, createWorkspaceWithTemplateCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { getPromptEditorIds } from '../helpers/PromptCollectionHelpers'
import { focusMonacoEditor, isMonacoEditorFocused, setMonacoSelections } from '../helpers/MonacoHelpers'
import { promptEditorSelector, promptCollectionSelectorTriggerSelector } from '../helpers/PromptCollectionSelectors'

/** Real editor coverage for shortcut ownership and retained editing selections. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Isolated workspace shared by the prompt and template variants. */
const WORKSPACE_PATH = '/ws/editor-move-shortcuts'

/** Builds three short entries so both directions and collection boundaries are visible. */
const createMoveWorkspace = (kind: 'prompt' | 'template') => {
  /** Stable identities and multiline bodies expose accidental Monaco editing commands. */
  const entries = ['first', 'second', 'third'].map((id) => ({
    id, title: `${id} title`, text: 'First line\nSecond line\nThird line'
  }))
  return kind === 'template'
    ? createWorkspaceWithTemplateCollections(WORKSPACE_PATH, [{
        folderName: 'Content', displayName: 'Content',
        templates: entries.map(({ id, title, text }) => ({ id, title, templateText: text }))
      }])
    : createWorkspaceWithCollections(WORKSPACE_PATH, [{
        folderName: 'Content', displayName: 'Content',
        prompts: entries.map(({ id, title, text }) => ({ id, title, promptText: text }))
      }])
}

describe('Editor move shortcuts', () => {
  // Both shared editor variants must keep the same field and selection through every move.
  for (const kind of ['prompt', 'template'] as const) {
    for (const field of ['title', 'body', 'note'] as const) {
      test(`moves the focused ${kind} from its ${field} without changing selection or text`, async ({ testSetup }) => {
        await testSetup.setupFilesystem(createMoveWorkspace(kind))
        await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
        /** Window and navigation helpers for the selected editor kind. */
        const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
        await testHelpers.setupWorkspaceViaUI()
        if (kind === 'template') await testHelpers.navigateToPromptTemplateCollections('Content')
        else await testHelpers.navigateToPromptCollections('Content')
        /** Second editor moves independently of the tree's initially selected first entry. */
        const selector = promptEditorSelector('second')
        /** Note selectors keep its registry lookup distinct from the main editor. */
        const editorSelector = field === 'note' ? `${selector} [data-testid="attached-note-editor"]` : selector
        /** Native title retains the direction as well as both ends of its selection. */
        const title = mainWindow.locator(selector).getByTestId('prompt-title')
        await expect(mainWindow.getByTestId('prompt-move-up')).toHaveCount(0)
        await expect(mainWindow.getByTestId('prompt-move-down')).toHaveCount(0)
        await focusMonacoEditor(mainWindow, selector)
        if (field === 'note') {
          await mainWindow.locator(selector).getByTestId('attached-note-button').click()
          await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
          await mainWindow.keyboard.insertText('First line\nSecond line\nThird line')
        }
        if (field === 'title') {
          await title.focus()
          await title.evaluate((input: HTMLInputElement) => input.setSelectionRange(1, 5, 'backward'))
        } else {
          await setMonacoSelections(mainWindow, editorSelector, [{
            selectionStartLineNumber: 2, selectionStartColumn: 7,
            positionLineNumber: 1, positionColumn: 3
          }])
        }
        /** Captures text and exact selection without focusing or otherwise repairing the editor. */
        const readEditingState = () => mainWindow.locator(selector).evaluate((row, field) => {
          /** Native field can retain selection even while Monaco owns focus. */
          const input = row.querySelector<HTMLInputElement>('[data-testid="prompt-title"]')!
          /** Registered editor exposes model text and oriented selections. */
          const editor = window.__cthulhuMonacoEditors!.find((entry) =>
            (field === 'note' ? row.querySelector('[data-testid="attached-note-editor"]')! : row).contains(entry.container))!.editor
          return {
            title: input.value,
            titleSelection: [input.selectionStart, input.selectionEnd, input.selectionDirection],
            text: editor.getValue(),
            selections: editor.getSelections()
          }
        }, field)
        /** Baseline catches native title selection and Monaco line-editing side effects. */
        const initialState = await readEditingState()
        // Press repeatedly without refocusing, including attempts beyond either boundary.
        for (const [key, order] of [
          ['ArrowUp', ['second', 'first', 'third']],
          ['ArrowUp', ['second', 'first', 'third']],
          ['ArrowDown', ['first', 'second', 'third']],
          ['ArrowDown', ['first', 'third', 'second']],
          ['ArrowDown', ['first', 'third', 'second']],
          ['ArrowUp', ['first', 'second', 'third']]
        ] as const) {
          await mainWindow.keyboard.press(`Control+Shift+${key}`)
          await mainWindow.evaluate(() => window.playwrightTestControls!.waitForMutations())
          await expect.poll(() => getPromptEditorIds(mainWindow)).toEqual([...order])
          if (field === 'title') await expect(title).toBeFocused()
          else await expect.poll(() => isMonacoEditorFocused(mainWindow, editorSelector)).toBe(true)
          expect(await readEditingState()).toEqual(initialState)
        }
      })
    }
  }

  test('ignores Find, toolbar, and dialog focus and yields to an open dropdown', async ({ testSetup }) => {
    /** Sample editors expose the production Find, category dialog, and collection dropdown. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'sample' } })
    await testHelpers.navigateToPromptCollections('Development')
    await focusMonacoEditor(mainWindow, promptEditorSelector('dev-2'))
    /** Order must stay unchanged while other controls own the keyboard. */
    const initialOrder = await getPromptEditorIds(mainWindow)
    /** Both directions would move an entry if a stale selected prompt were used. */
    const pressMoveShortcuts = async () => {
      for (const key of ['ArrowUp', 'ArrowDown']) {
        await mainWindow.keyboard.press(`Control+Shift+${key}`)
        await mainWindow.evaluate(() => window.playwrightTestControls!.waitForMutations())
        expect(await getPromptEditorIds(mainWindow)).toEqual(initialOrder)
      }
    }
    await mainWindow.keyboard.press('Control+F')
    await expect(mainWindow.getByTestId('prompt-find-input')).toBeFocused()
    await pressMoveShortcuts()
    await mainWindow.keyboard.press('Escape')
    await mainWindow.locator(promptEditorSelector('dev-2')).getByTestId('prompt-template-button').focus()
    await pressMoveShortcuts()
    await mainWindow.getByTestId('prompt-collection-manage-categories-button').click()
    await mainWindow.getByTestId('manage-categories-new-button').click()
    await expect(mainWindow.getByTestId('manage-category-name-input')).toBeFocused()
    await pressMoveShortcuts()
    await focusMonacoEditor(mainWindow, '[data-testid="manage-category-full-description-input"]')
    await pressMoveShortcuts()
    await mainWindow.getByTestId('manage-categories-close-button').click()
    await mainWindow.locator(promptCollectionSelectorTriggerSelector).click()
    // A popup must block the screen even if a background field is programmatically focused.
    await mainWindow.locator(promptEditorSelector('dev-2')).getByTestId('prompt-title').focus()
    await pressMoveShortcuts()
    await mainWindow.keyboard.press('Escape')
    await mainWindow.keyboard.press('Control+Shift+ArrowUp')
    await expect.poll(() => getPromptEditorIds(mainWindow)).toEqual(['dev-2', 'dev-1'])
  })
})
