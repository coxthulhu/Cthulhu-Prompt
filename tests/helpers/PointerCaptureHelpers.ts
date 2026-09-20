import { expect, type Locator, type Page } from '@playwright/test'

/** Records the browser-assigned pointer ID without assuming a particular input device. */
export const recordPointerId = async (owner: Locator): Promise<void> => {
  await owner.evaluate((element) => {
    element.addEventListener('pointerdown', (event) => {
      element.setAttribute('data-test-pointer-id', String((event as PointerEvent).pointerId))
    }, { once: true, capture: true })
  })
}

/** Reads the recorded pointer ID and verifies that the expected element owns capture. */
export const expectPointerCapture = async (owner: Locator): Promise<number> => {
  /** Browser-assigned identity recorded at pointer-down. */
  const pointerId = Number(await owner.getAttribute('data-test-pointer-id'))
  await expect.poll(() => owner.evaluate(
    (element, id) => element.hasPointerCapture(id), pointerId
  )).toBe(true)
  return pointerId
}

/** Simulates browser cancellation or genuinely releases an active browser capture. */
export const interruptPointerDrag = async (
  page: Page,
  owner: Locator,
  pointerId: number,
  interruption: 'pointercancel' | 'lostpointercapture'
): Promise<void> => {
  await owner.evaluate((element, { id, kind }) => {
    if (kind === 'pointercancel') {
      element.dispatchEvent(new PointerEvent('pointercancel', { pointerId: id, bubbles: true }))
    } else {
      element.releasePointerCapture(id)
    }
  }, { id: pointerId, kind: interruption })
  // Flush pending capture loss while the original pointer button remains held.
  await page.mouse.move(1, 1)
  await expect.poll(() => owner.evaluate(
    (element, id) => element.hasPointerCapture(id), pointerId
  )).toBe(false)
}
