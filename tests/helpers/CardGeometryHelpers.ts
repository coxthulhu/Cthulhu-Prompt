import type { Page } from '@playwright/test'

/**
 * Real-DOM geometry of an EditorCardSurface, for asserting that the sizing
 * constants in the renderer exactly describe what the browser renders.
 * The card pins its own height to the virtual row height with
 * `overflow: hidden`, so a constants-vs-CSS mismatch never changes any
 * bounding rect — it shows up only as hidden internal overflow (content
 * taller than the card) or slack (content shorter than the card).
 */
export type EditorCardGeometry = {
  /** scrollHeight - clientHeight; > 0 means content is clipped inside the card. */
  hiddenOverflowPx: number
  /** Internal scroll offset; non-zero means the browser scrolled the clipped card. */
  internalScrollTopPx: number
  /** Height of the card's content box (excludes the card border). */
  contentBoxHeightPx: number
  /**
   * Card content-box bottom minus the bottom of the prompt editor body
   * section; ~0 when the prompt editor content exactly fills the card.
   * Null when the card has no prompt editor body section.
   */
  promptBodyFillGapPx: number | null
  /**
   * Card content-box bottom minus the bottom of the prompt editor sidebar
   * rail; ~0 when the rail exactly fills the card. Null without a rail.
   */
  promptSidebarFillGapPx: number | null
  /**
   * Card content-box bottom minus the lowest bottom among the card body's
   * direct children; the natural content slack inside the card.
   */
  bodyChildrenFillGapPx: number | null
}

export type VirtualRowOverflow = {
  /** data-testid of the row's content (or '(unnamed row)') for failure output. */
  rowTestId: string
  /** Pinned wrapper height from the virtualizer. */
  wrapperHeightPx: number
  /**
   * How far the lowest visible descendant's border box extends past the
   * wrapper's bottom edge; > 0 means the row's content does not fit the
   * virtualizer's height for it. Bounding rects ignore CSS clipping, so this
   * detects spill even when an intermediate overflow:hidden box swallows it.
   */
  contentSpillPx: number
}

/**
 * Measures every mounted row wrapper of a SvelteVirtualWindow against the
 * deepest visible descendant rect, independent of row kind.
 */
export const measureVirtualRowOverflows = async (
  page: Page,
  windowTestId: string
): Promise<VirtualRowOverflow[] | null> => {
  return await page.evaluate((testId) => {
    const viewport = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
    if (!viewport) return null
    // Children: height spacer, row wrapper container, overlay container.
    const rowContainer = viewport.children.item(1)
    if (!rowContainer) return null
    return Array.from(rowContainer.children).map((wrapper) => {
      const wrapperRect = (wrapper as HTMLElement).getBoundingClientRect()
      let maxDescendantBottom = wrapperRect.bottom
      for (const descendant of Array.from(wrapper.querySelectorAll<HTMLElement>('*'))) {
        // Monaco is an opaque box: its internals use huge scroll-trick
        // elements, so measure the editor's own rect but not its contents.
        const monacoRoot = descendant.closest('.monaco-editor')
        if (monacoRoot && monacoRoot !== descendant) continue
        if (!descendant.checkVisibility()) continue
        const rect = descendant.getBoundingClientRect()
        if (rect.height === 0 && rect.width === 0) continue
        maxDescendantBottom = Math.max(maxDescendantBottom, rect.bottom)
      }
      return {
        rowTestId:
          wrapper.querySelector<HTMLElement>('[data-testid]')?.dataset.testid ?? '(unnamed row)',
        wrapperHeightPx: wrapperRect.height,
        contentSpillPx: maxDescendantBottom - wrapperRect.bottom
      }
    })
  }, windowTestId)
}

/**
 * Measures the EditorCardSurface at (or inside) rootSelector.
 * Returns null when the selector or its card is not mounted.
 */
export const measureEditorCardGeometry = async (
  page: Page,
  rootSelector: string
): Promise<EditorCardGeometry | null> => {
  return await page.evaluate((selector) => {
    const root = document.querySelector<HTMLElement>(selector)
    if (!root) return null
    const card = root.classList.contains('editor-card-surface')
      ? root
      : root.querySelector<HTMLElement>('.editor-card-surface')
    if (!card) return null

    const cardRect = card.getBoundingClientRect()
    const cardStyle = getComputedStyle(card)
    const contentBoxTop = cardRect.top + parseFloat(cardStyle.borderTopWidth)
    const contentBoxBottom = cardRect.bottom - parseFloat(cardStyle.borderBottomWidth)

    const bottomGapTo = (element: HTMLElement | null): number | null =>
      element ? contentBoxBottom - element.getBoundingClientRect().bottom : null

    const body = card.querySelector<HTMLElement>('.editor-card-body')
    let bodyChildrenFillGapPx: number | null = null
    if (body && body.children.length > 0) {
      const maxChildBottom = Math.max(
        ...Array.from(body.children).map((child) => child.getBoundingClientRect().bottom)
      )
      bodyChildrenFillGapPx = contentBoxBottom - maxChildBottom
    }

    return {
      hiddenOverflowPx: card.scrollHeight - card.clientHeight,
      internalScrollTopPx: card.scrollTop,
      contentBoxHeightPx: contentBoxBottom - contentBoxTop,
      promptBodyFillGapPx: bottomGapTo(
        card.querySelector<HTMLElement>('.prompt-editor-body-editor-section')
      ),
      promptSidebarFillGapPx: bottomGapTo(
        card.querySelector<HTMLElement>('.prompt-editor-sidebar')
      ),
      bodyChildrenFillGapPx
    }
  }, rootSelector)
}
