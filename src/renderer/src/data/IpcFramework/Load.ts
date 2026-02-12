import type { IpcResult, IpcSuccess } from '@shared/IpcResult'

export const runLoad = async <TData extends object>(
  load: () => Promise<IpcResult<TData>>
): Promise<IpcSuccess<TData>> => {
  const result = await load()

  if (!result.success) {
    throw new Error(result.error)
  }

  return result
}
