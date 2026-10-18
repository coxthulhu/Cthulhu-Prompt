import { notePersistence } from '../Persistence/NotePersistence'
import { createRevisionData } from './RevisionDataFactory'

/** Committed note records use the same atomic revision lifecycle as other Markdown. */
export const noteData = createRevisionData({
  persistence: notePersistence,
  emitCommittedRevisionChanged: () => { /* Mutation responses carry note revisions. */ }
})
