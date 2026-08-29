import type { DomainChange } from '@shared/DomainChanges'
import { planCategoryPersistenceChanges } from './CategoryPersistencePlanner'
import { createDomainPersistencePlanningContext } from './DomainPersistencePlanning'
import { planMarkdownContentPersistenceChanges } from './MarkdownContentPersistencePlanner'
import type { PersistenceChange } from './PersistenceTypes'

/** Calculates all domain-target and persistence-only changes for one mutation plan. */
export const planDomainPersistenceChanges = (
  changes: readonly DomainChange[]
): PersistenceChange[] => {
  /** Shared projected state and baseline writes refined by entity-specific planners. */
  const context = createDomainPersistencePlanningContext(changes)
  planMarkdownContentPersistenceChanges(context)
  planCategoryPersistenceChanges(context)
  return [...context.persistenceChanges.values()]
}
