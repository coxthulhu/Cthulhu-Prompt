import { createQuery, skipToken, type QueryKey } from '@tanstack/svelte-query'

import { ipcInvoke } from './ipcInvoke'

type MakeIpcQueryConfig<TQueryFnData, TPayload, TData> = {
  key: QueryKey | ((payload: TPayload) => QueryKey)
  channel: string
  select?: (data: TQueryFnData, payload: TPayload) => TData
}

type PayloadOrSkip<TPayload> = TPayload | typeof skipToken

type HookPayload<TPayload> = TPayload extends void
  ? undefined | void | typeof skipToken
  : PayloadOrSkip<TPayload>

export function makeIpcQuery<TQueryFnData, TPayload = void, TData = TQueryFnData>(
  cfg: MakeIpcQueryConfig<TQueryFnData, TPayload, TData>
) {
  const { key, channel, select } = cfg

  return function useIpcQuery(payload: HookPayload<TPayload>) {
    const shouldSkip = payload === skipToken

    const resolvedKey = shouldSkip
      ? [channel, 'skip']
      : (() => {
          const resolvedPayload = payload as TPayload
          const keyValue =
            typeof key === 'function'
              ? (key as (payload: TPayload) => QueryKey)(resolvedPayload)
              : key
          return Array.isArray(keyValue) ? keyValue : [keyValue]
        })()

    const queryFn = async () => {
      const result = await ipcInvoke<TQueryFnData, TPayload>(channel, payload as TPayload)
      return select ? select(result, payload as TPayload) : (result as unknown as TData)
    }

    return createQuery<TData>(() => ({
      queryKey: resolvedKey,
      queryFn: shouldSkip ? skipToken : queryFn
    }))
  }
}

export function makeIpcQueryVoid<TQueryFnData, TData = TQueryFnData>(
  cfg: MakeIpcQueryConfig<TQueryFnData, void, TData>
) {
  const baseQuery = makeIpcQuery<TQueryFnData, void, TData>(cfg)

  return function useIpcQuery() {
    return baseQuery(undefined)
  }
}
