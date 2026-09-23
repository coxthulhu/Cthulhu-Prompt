import type { Page } from '@playwright/test'

/** Measures one rounded DOM dimension using the existing missing-element behavior. */
async function getBoundingClientRectDimension(
  page: Page,
  selector: string,
  dimension: 'height' | 'width'
): Promise<number> {
  /** Measurement returned by the browser callback. */
  const result = await page.evaluate(
    ({ targetSelector, targetDimension }) => {
      /** DOM element addressed by the requested selector. */
      const element = document.querySelector<HTMLElement>(targetSelector)
      if (!element) return null
      /** Browser geometry before the existing pixel rounding. */
      const rect = element.getBoundingClientRect()
      return Math.round(rect[targetDimension])
    },
    { targetSelector: selector, targetDimension: dimension }
  )

  if (result == null) {
    throw new Error(`Failed to read ${dimension} for selector: ${selector}`)
  }

  return result
}

/** Waits for renderer test controls to be registered. */
async function waitForVirtualWindowControls(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.svelteVirtualWindowTestControls))
}

/** Resolves the virtual viewport identity from its DOM test ID. */
async function getVirtualWindowTestId(page: Page, selector: string): Promise<string> {
  /** Identity used to address the viewport through renderer test controls. */
  const testId = await page.evaluate(
    ({ targetSelector }) => {
      /** DOM element addressed by the requested selector. */
      const element = document.querySelector<HTMLElement>(targetSelector)
      return element?.getAttribute('data-testid') ?? null
    },
    { targetSelector: selector }
  )

  if (!testId) {
    throw new Error(`Failed to resolve data-testid for selector: ${selector}`)
  }

  return testId
}

/** Waits until the viewport exposes its scroll offset. */
async function waitForVirtualWindowScrollTopControl(page: Page, testId: string): Promise<void> {
  await page.waitForFunction((targetTestId) => {
    /** Renderer hooks for the currently registered virtual viewports. */
    const controls = window.svelteVirtualWindowTestControls
    if (!controls?.getScrollTop) return false
    return typeof controls.getScrollTop(targetTestId) === 'number'
  }, testId)
}

/** Waits until the viewport exposes its content height. */
async function waitForVirtualWindowScrollHeightControl(page: Page, testId: string): Promise<void> {
  await page.waitForFunction((targetTestId) => {
    /** Renderer hooks for the currently registered virtual viewports. */
    const controls = window.svelteVirtualWindowTestControls
    if (!controls?.getScrollHeight) return false
    return typeof controls.getScrollHeight(targetTestId) === 'number'
  }, testId)
}

/** Reads the row height with the existing rounding. */
export async function getPromptRowHeight(page: Page, selector: string): Promise<number> {
  return getBoundingClientRectDimension(page, selector, 'height')
}

/** Reads the row width with the existing rounding. */
export async function getPromptRowWidth(page: Page, selector: string): Promise<number> {
  return getBoundingClientRectDimension(page, selector, 'width')
}

/** Reads the registered viewport offset with the existing readiness waits. */
export async function getElementScrollTop(page: Page, selector: string): Promise<number> {
  await waitForVirtualWindowControls(page)
  /** Identity used to address the viewport through renderer test controls. */
  const testId = await getVirtualWindowTestId(page, selector)
  await waitForVirtualWindowScrollTopControl(page, testId)
  /** Rounded viewport offset returned by the renderer. */
  const scrollTop = await page.evaluate(
    ({ targetTestId }) => {
      /** Renderer hooks for the currently registered virtual viewports. */
      const controls = window.svelteVirtualWindowTestControls
      /** Raw viewport measurement returned by the renderer hook. */
      const value = controls?.getScrollTop?.(targetTestId)
      if (typeof value === 'number') return Math.round(value)
      return null
    },
    { targetTestId: testId }
  )

  if (scrollTop == null) {
    throw new Error(`Failed to read scrollTop for selector: ${selector}`)
  }

  return scrollTop
}

/** Reads virtual content height after its test hook becomes available. */
export async function getVirtualWindowScrollHeight(page: Page, selector: string): Promise<number> {
  await waitForVirtualWindowControls(page)
  /** Identity used to address the viewport through renderer test controls. */
  const testId = await getVirtualWindowTestId(page, selector)
  await waitForVirtualWindowScrollHeightControl(page, testId)
  /** Rounded virtual content height returned by the renderer. */
  const scrollHeight = await page.evaluate(
    ({ targetTestId }) => {
      /** Renderer hooks for the currently registered virtual viewports. */
      const controls = window.svelteVirtualWindowTestControls
      /** Raw viewport measurement returned by the renderer hook. */
      const value = controls?.getScrollHeight?.(targetTestId)
      if (typeof value === 'number') return Math.round(value)
      return null
    },
    { targetTestId: testId }
  )

  if (scrollHeight == null) {
    throw new Error(`Failed to read scrollHeight for selector: ${selector}`)
  }

  return scrollHeight
}

/** Scrolls to the requested offset through the existing renderer hook. */
export async function scrollVirtualWindowTo(
  page: Page,
  selector: string,
  scrollTopPx: number
): Promise<void> {
  await waitForVirtualWindowControls(page)
  /** Identity used to address the viewport through renderer test controls. */
  const testId = await getVirtualWindowTestId(page, selector)
  await waitForVirtualWindowScrollTopControl(page, testId)

  /** Reports whether the requested renderer scroll operation ran. */
  const didScroll = await page.evaluate(
    ({ targetTestId, targetScrollTopPx }) => {
      /** Renderer hooks for the currently registered virtual viewports. */
      const controls = window.svelteVirtualWindowTestControls
      if (!controls?.scrollTo) return false
      controls.scrollTo(targetTestId, Math.round(targetScrollTopPx))
      return true
    },
    { targetTestId: testId, targetScrollTopPx: scrollTopPx }
  )

  if (!didScroll) {
    throw new Error(`Failed to scroll virtual window for selector: ${selector}`)
  }
}

/** Applies a relative offset through the existing renderer hook. */
export async function scrollVirtualWindowBy(
  page: Page,
  selector: string,
  deltaPx: number
): Promise<void> {
  await waitForVirtualWindowControls(page)
  /** Identity used to address the viewport through renderer test controls. */
  const testId = await getVirtualWindowTestId(page, selector)
  await waitForVirtualWindowScrollTopControl(page, testId)

  /** Reports whether the requested renderer scroll operation ran. */
  const didScroll = await page.evaluate(
    ({ targetTestId, targetDeltaPx }) => {
      /** Renderer hooks for the currently registered virtual viewports. */
      const controls = window.svelteVirtualWindowTestControls
      if (!controls?.getScrollTop || !controls?.scrollTo) return false
      /** Current offset used to calculate a relative scroll. */
      const currentTop = controls.getScrollTop(targetTestId)
      if (typeof currentTop !== 'number') return false
      controls.scrollTo(targetTestId, currentTop + targetDeltaPx)
      return true
    },
    { targetTestId: testId, targetDeltaPx: deltaPx }
  )

  if (!didScroll) {
    throw new Error(`Failed to scroll virtual window for selector: ${selector}`)
  }
}

/** Reveals a mounted target using the existing geometry, attempts, and pacing. */
export async function scrollVirtualElementIntoView(
  page: Page,
  hostSelector: string,
  targetSelector: string,
  paddingPx = 8
): Promise<void> {
  await waitForVirtualWindowControls(page)
  await page.waitForSelector(targetSelector, { state: 'attached' })

  for (let attempt = 0; attempt < 10; attempt += 1) {
    /** Current target visibility and required scroll delta. */
    const measurement = await page.evaluate(
      ({ targetHostSelector, targetElementSelector, targetPaddingPx }) => {
        /** Virtual viewport containing the target. */
        const host = document.querySelector<HTMLElement>(targetHostSelector)
        /** Mounted element being revealed within the viewport. */
        const target = document.querySelector<HTMLElement>(targetElementSelector)
        if (!host || !target) return null

        /** Viewport bounds used to compute the visible band. */
        const hostRect = host.getBoundingClientRect()
        /** Target bounds compared with the visible band. */
        const targetRect = target.getBoundingClientRect()
        /** Upper edge of the padded visible band. */
        const topLimit = hostRect.top + targetPaddingPx
        /** Lower edge of the padded visible band. */
        const bottomLimit = hostRect.bottom - targetPaddingPx
        /** Whether the complete target fits within the padded band. */
        const targetFits = targetRect.height <= bottomLimit - topLimit
        /** Existing visibility rule for fitting and oversized targets. */
        const isVisible = targetFits
          ? targetRect.top >= topLimit && targetRect.bottom <= bottomLimit
          : targetRect.top <= topLimit && targetRect.bottom >= bottomLimit

        if (isVisible) {
          return { deltaPx: 0, isVisible: true }
        }

        /** Scroll adjustment needed to reveal the target. */
        const deltaPx =
          targetRect.top < topLimit ? targetRect.top - topLimit : targetRect.bottom - bottomLimit

        return { deltaPx: Math.round(deltaPx), isVisible: false }
      },
      {
        targetHostSelector: hostSelector,
        targetElementSelector: targetSelector,
        targetPaddingPx: paddingPx
      }
    )

    if (!measurement) {
      throw new Error(`Failed to measure virtual element for selector: ${targetSelector}`)
    }
    if (measurement.isVisible || measurement.deltaPx === 0) {
      return
    }

    await scrollVirtualWindowBy(page, hostSelector, measurement.deltaPx)
    await page.waitForTimeout(20)
  }

  throw new Error(`Failed to scroll virtual element into view: ${targetSelector}`)
}
