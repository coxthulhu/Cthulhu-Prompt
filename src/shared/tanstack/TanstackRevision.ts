export type TanstackRevisionEnvelope<TKey extends string | number, TData> = {
  id: TKey
  revision: number
  data: TData
}

export type TanstackRevisionPayloadEntity<TKey extends string | number, TData> = {
  id: TKey
  expectedRevision: number
  data: TData
}
