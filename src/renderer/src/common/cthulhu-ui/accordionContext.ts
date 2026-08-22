import { getContext, setContext } from 'svelte'

/** Private context key shared by one accordion and its descendant sections. */
const ACCORDION_CONTEXT = Symbol('cthulhu-ui-accordion')

/** Expansion and persistence controls supplied to descendant accordion sections. */
export type AccordionContext = {
  readonly persistenceId: string
  readonly testId?: string
  registerSection: (sectionId: string) => void
  unregisterSection: (sectionId: string) => void
  isSectionExpanded: (sectionId: string) => boolean
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
