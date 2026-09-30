import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { focusMonacoEditor } from '../helpers/MonacoHelpers'
import {
  promptEditorSelector,
  promptFolderSelectorMenuSelector,
  promptFolderSelectorTriggerSelector
} from '../helpers/PromptFolderSelectors'

/** Real Electron fixtures exercise the shared router through production UI surfaces. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Shared category modal used to reproduce the reported overlap with Find. */
const CATEGORY_DIALOG = '[role="dialog"][aria-label="Manage Categories"]'
/** Monaco host inside category management, separate from the covered prompt editors. */
const CATEGORY_DESCRIPTION = '[data-testid="manage-category-full-description-input"]'

describe('Keyboard routing', () => {
  // Both native fields and Monaco must yield the same dialog-level dismissal behavior.
  for (const focusTarget of ['name', 'description'] as const) {
    test(`dismisses category management before Find with ${focusTarget} focused`, async ({ testSetup }) => {
      /** Sample folder provides stable searchable content and the actual management entry point. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'sample' }
      })
      await testHelpers.navigateToPromptFolders('Development')
      await expect(mainWindow.locator(promptEditorSelector('dev-1'))).toBeVisible()
      /** Find input whose query must survive closing the overlaid dialog. */
      const findInput = mainWindow.getByTestId('prompt-find-input')
      /** Result counter proves the active search survives without restarting or advancing. */
      const matches = mainWindow.locator('[data-testid="prompt-find-widget"] .prompt-find-widget__matches')
      await mainWindow.keyboard.press('Control+F')
      await findInput.fill('code')
      await expect(matches).toHaveText(/\d+ of [1-9]\d*/)
      /** Search position before an unrelated dialog takes keyboard ownership. */
      const originalMatches = await matches.innerText()

      await mainWindow.getByTestId('prompt-folder-manage-categories-button').click()
      /** Foreground modal must receive Escape even when Find has an active result. */
      const dialog = mainWindow.locator(CATEGORY_DIALOG)
      await dialog.getByTestId('manage-categories-new-button').click()
      if (focusTarget === 'description') await focusMonacoEditor(mainWindow, CATEGORY_DESCRIPTION)
      else await expect(dialog.getByTestId('manage-category-name-input')).toBeFocused()
      await expect(dialog.locator(':focus')).toHaveCount(1)
      await mainWindow.keyboard.press('Control+F')
      await expect(dialog.locator(':focus')).toHaveCount(1)
      if (focusTarget === 'name') {
        await expect(dialog.getByTestId('manage-category-name-input')).toBeFocused()
      }
      await expect(findInput).toHaveValue('code')

      await mainWindow.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(findInput).toBeVisible()
      await expect(findInput).toHaveValue('code')
      await expect(matches).toHaveText(originalMatches)
      await mainWindow.keyboard.press('Escape')
      await expect(findInput).toHaveCount(0)

      // Closing and reopening must release the modal registration completely.
      await mainWindow.keyboard.press('Control+F')
      await expect(findInput).toBeFocused()
    })
  }

  test('blocks opening Find behind a dialog or dropdown and preserves local typing', async ({ testSetup }) => {
    /** Shared sample workspace keeps Find available while overlays are exercised. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptFolders('Development')
    /** Absent Find input must stay absent for both overlay kinds. */
    const findInput = mainWindow.getByTestId('prompt-find-input')
    await mainWindow.getByTestId('prompt-folder-manage-categories-button').click()
    /** Category modal containing an ordinary text input. */
    const dialog = mainWindow.locator(CATEGORY_DIALOG)
    await dialog.getByTestId('manage-categories-new-button').click()
    /** Focused field must retain ordinary editing shortcuts while screen shortcuts are blocked. */
    const name = dialog.getByTestId('manage-category-name-input')
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toHaveCount(0)
    await expect(name).toBeFocused()
    await mainWindow.keyboard.type('Draft')
    await mainWindow.keyboard.press('Control+A')
    await mainWindow.keyboard.type('Replacement')
    await expect(name).toHaveValue('Replacement')
    await dialog.getByTestId('manage-categories-close-button').click()

    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    /** Actual root-folder dropdown supplies the higher popup layer. */
    const menu = mainWindow.locator(promptFolderSelectorMenuSelector)
    await expect(menu).toBeVisible()
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toHaveCount(0)
    await expect(menu).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeFocused()
  })

  test('dismisses a dropdown before Find and releases shortcuts when leaving the screen', async ({ testSetup }) => {
    /** Sample folder allows the screen registration to be mounted and unmounted through navigation. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptFolders('Development')
    /** Search remains open behind the root selector until the following Escape. */
    const findInput = mainWindow.getByTestId('prompt-find-input')
    await mainWindow.keyboard.press('Control+F')
    await findInput.fill('code')
    await mainWindow.locator(promptFolderSelectorTriggerSelector).click()
    /** Popup must keep ownership of both Escape and the blocked Find shortcut. */
    const menu = mainWindow.locator(promptFolderSelectorMenuSelector)
    await expect(menu).toBeVisible()
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).not.toBeFocused()
    await expect(menu).toBeVisible()
    await mainWindow.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(findInput).toBeVisible()
    await expect(findInput).toHaveValue('code')
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)

    await testHelpers.navigateToHomeScreen()
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toHaveCount(0)
    await testHelpers.navigateToPromptFolders('Development')
    await mainWindow.keyboard.press('Control+F')
    await expect(findInput).toBeFocused()
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)
  })

  test('consumes Escape while dialog cancellation is disabled during saving', async ({ testSetup }) => {
    /** Paused category persistence keeps the real dialog in its non-dismissible saving state. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({
      workspace: { scenario: 'sample' }
    })
    await testHelpers.navigateToPromptFolders('Development')
    /** Background Find must remain open while the dialog consumes Escape without closing. */
    const findInput = mainWindow.getByTestId('prompt-find-input')
    await mainWindow.keyboard.press('Control+F')
    await findInput.fill('code')
    await mainWindow.getByTestId('prompt-folder-manage-categories-button').click()
    /** Saving modal owns Escape even though its cancellation action cannot run. */
    const dialog = mainWindow.locator(CATEGORY_DIALOG)
    await dialog.getByTestId('manage-categories-new-button').click()
    await dialog.getByTestId('manage-category-name-input').fill('Keyboard Routing')
    await testHelpers.pauseIpcChannel('save-categories')
    try {
      await dialog.getByTestId('manage-categories-save-button').click()
      await expect(dialog.getByTestId('manage-categories-close-button')).toBeDisabled()
      await mainWindow.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await expect(findInput).toBeVisible()
      await expect(findInput).toHaveValue('code')
    } finally {
      await testHelpers.resumeIpcChannel('save-categories')
    }
    await expect(dialog).toHaveCount(0)
    await mainWindow.keyboard.press('Escape')
    await expect(findInput).toHaveCount(0)
  })
})
