export type TanstackRevisionEnvelope<TKey extends string | number, TData> = {
  id: TKey
  revision: number
  data: TData
}
