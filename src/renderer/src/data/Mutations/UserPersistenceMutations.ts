import { UPDATE_USER_PERSISTENCE_CHANNEL, USER_PERSISTENCE_ID } from '@shared/UserPersistence'
import { planSetUserPersistenceDomainMutation } from '@shared/UserPersistenceDomainMutations'
import { userPersistenceCollection } from '../Collections/UserPersistenceCollection'
import {
  mutatePacedRendererDomainMutation,
  runImmediateRendererDomainMutation
} from '../IpcFramework/RendererDomainMutation'

export const mutatePacedUserPersistenceAutosaveUpdate = ({
  userPersistence,
  debounceMs,
}: {
  /** Complete desired singleton state after applying one autosave edit. */
  userPersistence: NonNullable<ReturnType<typeof userPersistenceCollection.get>>
  /** Debounce window applied to the singleton update. */
  debounceMs: number
}): void => {
  mutatePacedRendererDomainMutation({
    mutation: { command: userPersistence, plan: planSetUserPersistenceDomainMutation },
    ipc: { channel: UPDATE_USER_PERSISTENCE_CHANNEL },
    renderer: {},
    pacing: {
      target: { entityType: 'userPersistence', id: USER_PERSISTENCE_ID },
      debounceMs
    }
  })
}

export const syncLastWorkspaceInfoPath = async (
  lastWorkspaceInfoPath: string | null
): Promise<void> => {
  /** Current singleton used as the base for the immediate complete replacement. */
  const current = userPersistenceCollection.get(USER_PERSISTENCE_ID)
  if (!current) throw new Error('User persistence not loaded')
  /** Complete desired user persistence with the synchronized workspace path. */
  const command = { ...current, lastWorkspaceInfoPath }
  await runImmediateRendererDomainMutation({
    mutation: { command, plan: planSetUserPersistenceDomainMutation },
    ipc: { channel: UPDATE_USER_PERSISTENCE_CHANNEL },
    renderer: {}
  })
}
