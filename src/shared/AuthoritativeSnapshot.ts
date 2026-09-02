import type { DomainEntityMap, DomainEntityType } from './DomainChanges'
import type { IpcResult } from './IpcResult'

/** Authoritative present or deleted snapshot for one registered domain entity type. */
export type AuthoritativeSnapshotFor<TEntityType extends DomainEntityType> =
  | {
      entityType: TEntityType
      id: string
      revision: number
      data: DomainEntityMap[TEntityType]
    }
  | {
      entityType: TEntityType
      id: string
      deleted: true
    }

/** Authoritative snapshot union shared by queries and mutations. */
export type AuthoritativeSnapshot = {
  [TEntityType in DomainEntityType]: AuthoritativeSnapshotFor<TEntityType>
}[DomainEntityType]

/** Generic authoritative snapshot payload shared by query and mutation responses. */
export type AuthoritativeSnapshotPayload = {
  snapshots: AuthoritativeSnapshot[]
}

/** No-payload query result containing authoritative snapshots. */
export type AuthoritativeSnapshotQueryResult = IpcResult<AuthoritativeSnapshotPayload>
