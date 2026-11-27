import type { Page } from 'playwright'
import { createPlaywrightTestSuite, type PlaywrightTestFixtures } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { focusMonacoEditor, setMonacoSelections, waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { promptEditorSelector } from '../helpers/PromptCollectionSelectors'

/** Auto-sized prompt editors follow the lines that folding leaves visible. */
const { test, describe, expect } = createPlaywrightTestSuite()
const PATH = '/ws/prompt-editor-folding'
const EDITOR = promptEditorSelector('folding')
/** Line of the list item whose nested items fold under both Markdown and indentation folding. */
const PARENT_LINE = 3
const files = createWorkspaceWithCollections(PATH, [{
  folderName: 'Tasks', displayName: 'Tasks', promptCollectionId: 'tasks',
  prompts: [{
    id: 'folding',
    title: 'Folding',
    promptText: 'Intro\n\n- Parent item\n  - Child one\n  - Child two\n  - Child three\n\nOutro'
  }]
}], { settings: { workspaceId: 'prompt-editor-folding-workspace' } })

type EditorHeights = { editorHeight: number; contentHeight: number; sectionHeight: number }

/** Opens the fixture collection with the folding prompt's editor hydrated. */
const start = async (testSetup: PlaywrightTestFixtures['testSetup']): Promise<Page> => {
  await testSetup.setupFilesystem(files)
  testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(PATH))
  const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
  await testHelpers.setupWorkspaceViaUI()
  await mainWindow.getByTestId('new-tab-collection-tasks').click()
  await waitForMonacoEditor(mainWindow, EDITOR)
  // Folding ranges arrive asynchronously after the editor hydrates.
  await expect(mainWindow.locator(`${EDITOR} .codicon-folding-expanded`).first()).toBeAttached()
  return mainWindow
}

/** Reads the editor's laid-out and content heights and the height of the prompt section around it. */
const readHeights = (page: Page): Promise<EditorHeights | null> =>
  page.locator(EDITOR).evaluate((section) => {
    const entry = window.__cthulhuMonacoEditors?.find((item) => item.container && section.contains(item.container))
    if (!entry) return null
    return {
      editorHeight: Math.round(entry.editor.getLayoutInfo().height),
      contentHeight: Math.round(entry.editor.getContentHeight()),
      sectionHeight: Math.round(section.getBoundingClientRect().height)
    }
  })

/** Folds or unfolds the parent list item with Monaco's keyboard shortcuts. */
const toggleParentFold = async (page: Page, action: 'fold' | 'unfold'): Promise<void> => {
  await focusMonacoEditor(page, EDITOR)
  await setMonacoSelections(page, EDITOR, [{
    selectionStartLineNumber: PARENT_LINE, selectionStartColumn: 1, positionLineNumber: PARENT_LINE, positionColumn: 1
  }])
  await page.keyboard.press(action === 'fold' ? 'Control+Shift+BracketLeft' : 'Control+Shift+BracketRight')
}

/** Waits until the editor fills exactly its content and the section has the expected height. */
const expectHeights = async (page: Page, expected: { contentHeight: number; sectionHeight: number }): Promise<void> => {
  await expect.poll(async () => {
    const heights = await readHeights(page)
    if (!heights) return null
    return {
      editorFillsContent: heights.editorHeight === heights.contentHeight,
      contentHeight: heights.contentHeight,
      sectionWithinTolerance: Math.abs(heights.sectionHeight - expected.sectionHeight) <= 2
    }
  }).toEqual({ editorFillsContent: true, contentHeight: expected.contentHeight, sectionWithinTolerance: true })
}

/** Folds the parent item and returns the folded heights after checking the editor and section shrank together. */
const foldAndExpectShrink = async (page: Page, unfolded: EditorHeights): Promise<EditorHeights> => {
  await toggleParentFold(page, 'fold')
  await expect.poll(async () => (await readHeights(page))?.contentHeight ?? unfolded.contentHeight)
    .toBeLessThan(unfolded.contentHeight)
  const folded = (await readHeights(page))!
  await expectHeights(page, {
    contentHeight: folded.contentHeight,
    sectionHeight: unfolded.sectionHeight - (unfolded.contentHeight - folded.contentHeight)
  })
  return folded
}

describe('Prompt editor folding', () => {
  test('resizes the editor and its section when a section folds and unfolds', async ({ testSetup }) => {
    const page = await start(testSetup)
    const unfolded = (await readHeights(page))!
    expect(unfolded.editorHeight).toBe(unfolded.contentHeight)

    await foldAndExpectShrink(page, unfolded)

    await toggleParentFold(page, 'unfold')
    await expectHeights(page, unfolded)
  })

  test('restores the folded height after switching tabs', async ({ testSetup }) => {
    const page = await start(testSetup)
    const unfolded = (await readHeights(page))!
    const folded = await foldAndExpectShrink(page, unfolded)

    await page.getByTestId('new-tab-button').click()
    await expect(page.getByTestId('new-tab-collection-tasks')).toBeVisible()
    await page.getByTestId('work-tab').getByRole('tab').first().click()
    await waitForMonacoEditor(page, EDITOR)
    await expectHeights(page, folded)

    await toggleParentFold(page, 'unfold')
    await expectHeights(page, unfolded)
  })
})
