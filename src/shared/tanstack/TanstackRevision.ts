export type TanstackRevisionEnvelope<TData> = {
  id: string
  revision: number
  data: TData
}

export type TanstackRevisionPayloadEntity<TData> = {
  id: string
  expectedRevision: number
  data: TData
}
