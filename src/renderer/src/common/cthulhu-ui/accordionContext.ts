import { getContext, setContext } from 'svelte'

/** Private context key shared by one accordion and its descendant sections. */
const ACCORDION_CONTEXT = Symbol('cthulhu-ui-accordion')

/** Registration metadata supplied by one accordion section to its owning accordion. */
export type AccordionSectionRegistration = {
  id: string
  initialExpandedHeightPx: number
  minimumExpandedHeightPx: number
}

/** Layout, expansion, and persistence controls supplied to descendant accordion sections. */
export type AccordionContext = {
  readonly persistenceId: string
  readonly testId?: string
  registerSection: (section: AccordionSectionRegistration) => void
  unregisterSection: (sectionId: string) => void
  isSectionExpanded: (sectionId: string) => boolean
  getSectionHeightPx: (sectionId: string) => number
  canResizeSection: (sectionId: string) => boolean
  isSectionSashDragging: (sectionId: string) => boolean
  startSectionResize: (sectionId: string, event: PointerEvent) => void
  toggleSection: (sectionId: string) => void
}

/** Provides one accordion's controls to its directly or deeply nested sections. */
export const setAccordionContext = (context: AccordionContext): void => {
  setContext(ACCORDION_CONTEXT, context)
}

/** Returns the nearest owning accordion's controls. */
export const getAccordionContext = (): AccordionContext => {
  return getContext<AccordionContext>(ACCORDION_CONTEXT)
}
