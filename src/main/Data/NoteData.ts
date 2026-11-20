import { contentPersistence } from '../Persistence/sqlite/WorkspaceDatabase'
import { createRevisionData } from './RevisionDataFactory'

/** Committed note records use the same atomic revision lifecycle as other Markdown. */
export const noteData = createRevisionData({
  persistence: contentPersistence('note'),
  emitCommittedRevisionChanged: () => { /* Mutation responses carry note revisions. */ }
})
