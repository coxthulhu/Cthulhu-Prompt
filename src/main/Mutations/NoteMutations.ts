import { parseSetAttachedNoteVisibleCommand, planSetAttachedNoteVisible } from '@shared/domain/ui-state/AttachedNoteUiState'
import {
  parseCreateAttachedNoteCommand, parseNoteCommand, parseUpdateNoteCommand, parseSetNoteLocationCommand,
  planCreateAttachedNote, planDeleteNote, planDetachNote, planUpdateNote, planSetNoteLocation
} from '@shared/domain/note/NoteDomainMutations'
import { handleMainDomainMutation } from './DomainMutation'

/** Registers note commands with strict parsing and shared atomic planning. */
export const setupNoteMutationHandlers = (): void => {
  handleMainDomainMutation({ ipc: { channel: 'set-attached-note-visible' }, mutation: { parseCommand: parseSetAttachedNoteVisibleCommand, plan: planSetAttachedNoteVisible } })
  handleMainDomainMutation({ ipc: { channel: 'create-attached-note' }, mutation: { parseCommand: parseCreateAttachedNoteCommand, plan: planCreateAttachedNote } })
  handleMainDomainMutation({ ipc: { channel: 'update-note' }, mutation: { parseCommand: parseUpdateNoteCommand, plan: planUpdateNote } })
  handleMainDomainMutation({ ipc: { channel: 'delete-note' }, mutation: { parseCommand: parseNoteCommand, plan: planDeleteNote } })
  handleMainDomainMutation({ ipc: { channel: 'detach-note' }, mutation: { parseCommand: parseNoteCommand, plan: planDetachNote } })
  handleMainDomainMutation({ ipc: { channel: 'set-note-location' }, mutation: { parseCommand: parseSetNoteLocationCommand, plan: planSetNoteLocation } })
}
