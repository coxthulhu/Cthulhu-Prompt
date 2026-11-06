import type { Page } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { waitForMonacoEditor } from '../helpers/MonacoHelpers'
import { promptEditorSelector } from '../helpers/PromptCollectionSelectors'

/** Isolated workspace containing the prompt opened in the single-prompt screen. */
const WORKSPACE_PATH = '/ws/single-prompt-header-dpi'
/** Flat-topped capitals without descenders, so the title's ink spans exactly cap height to baseline. */
const PROMPT_TITLE = 'TITLE'
/** Body editor of the open prompt, which finishes mounting after the header. */
const SINGLE_PROMPT_BODY = '[data-testid="single-prompt-screen"] .prompt-editor-body-editor-section'

/** Measures, in device pixels, the vertical ink of the header's prompt title and return icon. */
const measureHeaderInk = async (page: Page) => {
  // Element boxes are read before the screenshot whose pixels they are mapped onto.
  const rects = await page.evaluate(() => {
    /** Plain CSS-pixel box that can be passed back into the page. */
    const toBox = (element: Element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect()
      return { left, right, top, bottom }
    }
    const button = document.querySelector('[data-testid="single-prompt-return-button"]')!
    return {
      button: toBox(button),
      icon: toBox(button.querySelector('svg')!),
      title: toBox(document.querySelector('[data-testid="prompt-collection-header-prompt"]')!)
    }
  })
  // The viewport screenshot starts at the page origin, so device-scaled boxes map directly onto its pixels.
  const screenshot = await page.screenshot({ animations: 'disabled', scale: 'device' })

  return page.evaluate(async ({ png, rects }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${png}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)

    /** Device rows spanned by the return button, which hold both inks but not the header border. */
    const top = Math.ceil(rects.button.top * devicePixelRatio)
    const bottom = Math.floor(rects.button.bottom * devicePixelRatio)
    /** Summed RGB of one device pixel. */
    const brightness = (x: number, y: number) => {
      const index = (y * pixels.width + x) * 4
      return pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]
    }
    /** Center and height of the rows whose contrast against the box's empty top row reaches half its peak. */
    const measureInk = (rect: typeof rects.icon) => {
      const left = Math.round(rect.left * devicePixelRatio)
      const right = Math.round(rect.right * devicePixelRatio)
      const background = brightness(left, top)
      const rowInk: number[] = []
      for (let y = top; y < bottom; y++) {
        let ink = 0
        for (let x = left; x < right; x++) ink = Math.max(ink, Math.abs(brightness(x, y) - background))
        rowInk.push(ink)
      }
      const peak = Math.max(...rowInk)
      const first = rowInk.findIndex((ink) => ink >= peak / 2)
      const last = rowInk.findLastIndex((ink) => ink >= peak / 2)
      return { center: top + (first + last + 1) / 2, height: last - first + 1 }
    }

    return {
      devicePixelRatio,
      scanHeight: bottom - top,
      title: measureInk(rects.title),
      icon: measureInk(rects.icon),
      iconOffsetX: (rects.icon.left + rects.icon.right - rects.button.left - rects.button.right) / 2
    }
  }, { png: screenshot.toString('base64'), rects })
}

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

      const ink = await measureHeaderInk(mainWindow)
      expect(ink.devicePixelRatio).toBe(scale)
      // Both scans must find real ink rather than a blank or misaligned region that matches every row.
      for (const { height } of [ink.title, ink.icon]) {
        expect(height).toBeGreaterThan(5 * scale)
        expect(height).toBeLessThan(ink.scanHeight)
      }
      // Centers fall on half device pixels, so this allows only the 0.5px left by odd/even ink heights.
      // The original box-centered icon sat 1 device pixel high at 125% and 2 at 150%.
      expect(Math.abs(ink.title.center - ink.icon.center)).toBeLessThan(1)
      expect(Math.abs(ink.iconOffsetX)).toBeLessThanOrEqual(1)
    })
  })
}
