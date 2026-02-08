type TanstackLoadSuccess<TData extends object> = TData & {
  success: true
}

type TanstackLoadFailure = {
  success: false
  error: string
}

type TanstackLoadResult<TData extends object> = TanstackLoadSuccess<TData> | TanstackLoadFailure

export const runTanstackLoad = async <TData extends object>(
  load: () => Promise<TanstackLoadResult<TData>>
): Promise<TanstackLoadSuccess<TData>> => {
  const result = await load()

  if (!result.success) {
    throw new Error(result.error)
  }

  return result
}
