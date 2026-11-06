import type { Page } from '@playwright/test'

/** Measured vertical ink of one element: its center row in the screenshot and its height, both in device pixels. */
type InkMeasurement = { center: number; height: number }

/** Ink of an icon button and the text it sits beside, plus how far the icon sits off the button's horizontal center. */
export type IconTextInk = {
  /** Display scale the window rendered at. */
  devicePixelRatio: number
  /** Device rows scanned, spanning the icon button. */
  scanHeight: number
  /** Ink of the adjacent text, scanned across the button's rows. */
  text: InkMeasurement
  /** Ink of the button's glyph. */
  icon: InkMeasurement
  /** Icon box center minus button box center, in CSS pixels. */
  iconOffsetX: number
}

/** Measures, in device pixels, the vertical ink of an icon button's glyph and of the adjacent text, both scanned across the button's rows. */
export const measureIconTextInk = async (page: Page, buttonTestId: string, textTestId: string): Promise<IconTextInk> => {
  // Element boxes are read before the screenshot whose pixels they are mapped onto.
  const rects = await page.evaluate(({ buttonTestId, textTestId }) => {
    /** Plain CSS-pixel box that can be passed back into the page. */
    const toBox = (element: Element) => {
      const { left, right, top, bottom } = element.getBoundingClientRect()
      return { left, right, top, bottom }
    }
    const button = document.querySelector(`[data-testid="${buttonTestId}"]`)!
    return {
      button: toBox(button),
      icon: toBox(button.querySelector('svg')!),
      text: toBox(document.querySelector(`[data-testid="${textTestId}"]`)!)
    }
  }, { buttonTestId, textTestId })
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

    /** Device rows spanned by the icon button, which hold both inks but not the surrounding borders. */
    const top = Math.ceil(rects.button.top * devicePixelRatio)
    const bottom = Math.floor(rects.button.bottom * devicePixelRatio)
    /** Summed RGB of one device pixel. */
    const brightness = (x: number, y: number) => {
      const index = (y * pixels.width + x) * 4
      return pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]
    }
    /** Center and height of the rows whose contrast against the empty background pixel at the element's left edge on the first scanned row reaches half its peak. */
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
      text: measureInk(rects.text),
      icon: measureInk(rects.icon),
      iconOffsetX: (rects.icon.left + rects.icon.right - rects.button.left - rects.button.right) / 2
    }
  }, { png: screenshot.toString('base64'), rects })
}
