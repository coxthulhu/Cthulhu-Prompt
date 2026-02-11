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
