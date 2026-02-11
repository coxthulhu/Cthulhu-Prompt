type LoadSuccess<TData extends object> = TData & {
  success: true
}

type LoadFailure = {
  success: false
  error: string
}

type LoadResult<TData extends object> = LoadSuccess<TData> | LoadFailure

export const runLoad = async <TData extends object>(
  load: () => Promise<LoadResult<TData>>
): Promise<LoadSuccess<TData>> => {
  const result = await load()

  if (!result.success) {
    throw new Error(result.error)
  }

  return result
}
