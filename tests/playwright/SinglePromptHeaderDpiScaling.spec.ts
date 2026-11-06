import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { promptEditorSelector } from '../helpers/PromptCollectionSelectors'
import { measureIconTextInk } from '../helpers/IconTextAlignmentHelpers'

/** Isolated workspace containing the prompt opened in the single-prompt screen. */
const WORKSPACE_PATH = '/ws/single-prompt-header-dpi'
/** Flat-topped capitals without descenders, so the title's ink spans exactly cap height to baseline. */
const PROMPT_TITLE = 'TITLE'
/** Body editor of the open prompt, which finishes mounting after the header. */
const SINGLE_PROMPT_BODY = '[data-testid="single-prompt-screen"] .prompt-editor-body-editor-section'

// Each suite launches Chromium at a real Windows display scale, where rounding differs per scale.
for (const scale of [1, 1.25, 1.5]) {
  const { test, describe, expect } = createPlaywrightTestSuite({
    launchOptions: { args: [`--force-device-scale-factor=${scale}`] }
  })

  describe(`Single prompt header at ${scale * 100}% DPI`, () => {
    test('centers the return icon on the path capitals', async ({ testSetup }) => {
      await testSetup.setupFilesystem(createWorkspaceWithCollections(WORKSPACE_PATH, [{
        folderName: 'Content',
        displayName: 'Content',
        prompts: [{ id: 'p0', title: PROMPT_TITLE, promptText: 'Body' }]
      }]))
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      await testHelpers.navigateToPromptCollections('Content')
      await waitForMonacoEditor(mainWindow, promptEditorSelector('p0'))

      await mainWindow.locator(promptEditorSelector('p0')).getByTestId('prompt-open-button').click()
      await waitForMonacoEditor(mainWindow, SINGLE_PROMPT_BODY)
      await expect(mainWindow.getByTestId('prompt-collection-header-prompt')).toHaveText(PROMPT_TITLE)
      await expect(mainWindow.getByTestId('single-prompt-return-button')).toBeVisible()
      // Keep the pointer off the header so no hover surface changes the measured pixels.
      await mainWindow.mouse.move(0, 0)

      const ink = await measureIconTextInk(mainWindow, 'single-prompt-return-button', 'prompt-collection-header-prompt')
      expect(ink.devicePixelRatio).toBe(scale)
      // Both scans must find real ink rather than a blank or misaligned region that matches every row.
      for (const { height } of [ink.text, ink.icon]) {
        expect(height).toBeGreaterThan(5 * scale)
        expect(height).toBeLessThan(ink.scanHeight)
      }
      // Centers fall on half device pixels, so this allows only the 0.5px left by odd/even ink heights.
      // The original box-centered icon sat 1 device pixel high at 125% and 2 at 150%.
      expect(Math.abs(ink.text.center - ink.icon.center)).toBeLessThan(1)
      expect(Math.abs(ink.iconOffsetX)).toBeLessThanOrEqual(1)
    })
  })
}
