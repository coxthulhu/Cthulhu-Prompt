export type RevisionEnvelope<TData> = {
  id: string
  revision: number
  data: TData
}

export type RevisionPayloadEntity<TData> = {
  id: string
  expectedRevision: number
  data: TData
}

/** Identifies one authoritative entity and the revision a mutation expects without resending data. */
export type RevisionPayloadReference = {
  id: string
  expectedRevision: number
}
