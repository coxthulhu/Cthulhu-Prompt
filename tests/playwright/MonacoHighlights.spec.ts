import type { Locator, Page } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor, isMonacoEditorFocused } from '../helpers/MonacoHelpers'
import { PROMPT_TITLE_SELECTOR, promptEditorSelector } from '../helpers/PromptFolderSelectors'

/** Shared Electron fixtures and assertions for rendered highlight coverage. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Two sample editors let real clicks transfer focus without unmounting either editor. */
const FIRST_EDITOR = promptEditorSelector('dev-1')
/** Second sample editor receives focus from the highlighted editor. */
const SECOND_EDITOR = promptEditorSelector('dev-2')
/** Monaco decorations produced by semantic or textual word-occurrence providers. */
const WORD_HIGHLIGHTS = ':is(.wordHighlight, .wordHighlightText, .wordHighlightStrong)'
/** Repeated lines use the Windows line endings retained by Monaco's text model. */
const MULTILINE_TEXT = 'repeated phrase\r\nrepeated phrase'

/** Checks every remaining decoration so removed decorations also count as cleared. */
async function expectTransparentHighlights(highlights: Locator): Promise<void> {
  await expect.poll(() => highlights.evaluateAll((elements) => elements.every((element) => {
    /** Computed styles verify painted fills and borders, rather than DOM visibility. */
    const style = getComputedStyle(element)
    return style.backgroundColor === 'rgba(0, 0, 0, 0)' &&
      (style.borderTopStyle === 'none' || style.borderTopColor === 'rgba(0, 0, 0, 0)')
  }))).toBe(true)
}

/** Returns the actual selected text to catch accidental selection clearing on blur. */
async function getSelectedText(page: Page): Promise<string> {
  return page.evaluate((selector) => {
    /** Monaco root identifies this editor in the existing test registry. */
    const root = document.querySelector(`${selector} .monaco-editor`)
    /** Registered editor exposes the selection independently of its rendered decoration. */
    const editor = window.__cthulhuMonacoEditors!.find(
      (entry) => entry.container.contains(root)
    )!.editor
    return editor.getModel()!.getValueInRange(editor.getSelection()!)
  }, FIRST_EDITOR)
}

/** Restores text focus without a mouse click moving or collapsing the saved selection. */
async function refocusFirstEditor(page: Page): Promise<void> {
  await page.evaluate((selector) => {
    /** Monaco root identifies the instance whose selection must survive refocusing. */
    const root = document.querySelector(`${selector} .monaco-editor`)
    window.__cthulhuMonacoEditors!.find((entry) => entry.container.contains(root))!.editor.focus()
  }, FIRST_EDITOR)
  await expect.poll(() => isMonacoEditorFocused(page, FIRST_EDITOR)).toBe(true)
}

describe('Monaco inactive highlights', () => {
  // Whitespace stays hidden while gutter emphasis follows editor focus.
  test('keeps whitespace markers disabled and emphasizes line numbers only while focused', async ({
    testSetup
  }) => {
    /** Sample workspace supplies two editors for a real focus transfer. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptFolders('Development')
    await focusMonacoEditor(mainWindow, FIRST_EDITOR)
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.insertText(MULTILINE_TEXT)
    await mainWindow.keyboard.press('Control+A')

    /** Monaco renders selected spaces as SVG circles in its whitespace overlay. */
    const spaces = mainWindow.locator(`${FIRST_EDITOR} .view-overlays svg circle`)
    /** The selected document ends on line two, whose gutter number remains active. */
    const activeLineNumber = mainWindow.locator(`${FIRST_EDITOR} .active-line-number`)
    /** An ordinary gutter number supplies the current theme's unfocused foreground. */
    const normalLineNumber = mainWindow.locator(
      `${FIRST_EDITOR} .line-numbers:not(.active-line-number)`
    )
    await expect(normalLineNumber).toHaveText('1')
    await expect(activeLineNumber).toHaveText('2')
    /** Theme color comparison avoids hardcoding the Monaco palette in this test. */
    const normalColor = await normalLineNumber.evaluate((element) => getComputedStyle(element).color)
    await expect(spaces).toHaveCount(0)
    await expect(activeLineNumber).not.toHaveCSS('color', normalColor)

    await focusMonacoEditor(mainWindow, SECOND_EDITOR)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FIRST_EDITOR)).toBe(false)
    await expect(spaces).toHaveCount(0)
    await expect(activeLineNumber).toHaveCSS('color', normalColor)
    expect(await getSelectedText(mainWindow)).toBe(MULTILINE_TEXT)

    await refocusFirstEditor(mainWindow)
    await expect(spaces).toHaveCount(0)
    await expect(activeLineNumber).not.toHaveCSS('color', normalColor)
    await mainWindow.locator(`${FIRST_EDITOR} ${PROMPT_TITLE_SELECTOR}`).click()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FIRST_EDITOR)).toBe(false)
    await expect(spaces).toHaveCount(0)
    await expect(activeLineNumber).toHaveCSS('color', normalColor)
    expect(await getSelectedText(mainWindow)).toBe(MULTILINE_TEXT)
  })

  // Preserve selections while hiding both their fill and matching occurrences on blur.
  test('hides selections and matching text when another editor or title receives focus', async ({
    testSetup
  }) => {
    /** Sample workspace provides two simultaneously visible prompt editors. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptFolders('Development')
    await focusMonacoEditor(mainWindow, FIRST_EDITOR)
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.insertText(MULTILINE_TEXT)
    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.keyboard.press('Shift+End')

    /** The selected first line and matching second line exercise distinct Monaco layers. */
    const selection = mainWindow.locator(`${FIRST_EDITOR} .selected-text`)
    /** Matching text is separate from the actual selection and can linger after blur. */
    const matchingText = mainWindow.locator(`${FIRST_EDITOR} .selectionHighlight`)
    await expect(selection).toHaveCount(1)
    await expect(matchingText).toHaveCount(1)
    await expect(selection).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(matchingText).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

    await focusMonacoEditor(mainWindow, SECOND_EDITOR)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FIRST_EDITOR)).toBe(false)
    await expectTransparentHighlights(selection)
    await expectTransparentHighlights(matchingText)
    expect(await getSelectedText(mainWindow)).toBe('repeated phrase')

    await refocusFirstEditor(mainWindow)
    await expect(selection).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(matchingText).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    expect(await getSelectedText(mainWindow)).toBe('repeated phrase')

    await mainWindow.locator(`${FIRST_EDITOR} ${PROMPT_TITLE_SELECTOR}`).click()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FIRST_EDITOR)).toBe(false)
    await expectTransparentHighlights(selection)
    await expectTransparentHighlights(matchingText)
    expect(await getSelectedText(mainWindow)).toBe('repeated phrase')

    await refocusFirstEditor(mainWindow)
    await mainWindow.keyboard.press('Control+A')
    await expect.poll(() => getSelectedText(mainWindow)).toBe(MULTILINE_TEXT)
    await expect(selection.first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await focusMonacoEditor(mainWindow, SECOND_EDITOR)
    await expectTransparentHighlights(selection)
    expect(await getSelectedText(mainWindow)).toBe(MULTILINE_TEXT)
  })

  // Word-occurrence highlighting also runs asynchronously without an explicit selection.
  test('hides word occurrences on blur and restores them on focus', async ({ testSetup }) => {
    /** Sample prompt begins with a word that Monaco highlights on cursor movement. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptFolders('Development')
    await focusMonacoEditor(mainWindow, FIRST_EDITOR)
    await mainWindow.keyboard.press('Control+Home')
    await mainWindow.keyboard.press('ArrowRight')

    /** Native word decorations must first render visibly before testing blur behavior. */
    const occurrences = mainWindow.locator(`${FIRST_EDITOR} ${WORD_HIGHLIGHTS}`)
    await expect(occurrences.first()).toBeVisible()
    await expect(occurrences.first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

    await focusMonacoEditor(mainWindow, SECOND_EDITOR)
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FIRST_EDITOR)).toBe(false)
    await expectTransparentHighlights(occurrences)

    await refocusFirstEditor(mainWindow)
    await expect(occurrences.first()).toBeVisible()
    await expect(occurrences.first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await mainWindow.locator(`${FIRST_EDITOR} ${PROMPT_TITLE_SELECTOR}`).click()
    await expect.poll(() => isMonacoEditorFocused(mainWindow, FIRST_EDITOR)).toBe(false)
    await expectTransparentHighlights(occurrences)
  })
})
