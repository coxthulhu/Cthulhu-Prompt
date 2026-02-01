import type { ResponseData } from '@shared/ipc/updatedTypes'

type RevisionMetaStore = {
  get: (id: string) => number
  getClientTempId: (id: string) => string | undefined
}

export const buildResponseData = <T>(
  id: string,
  data: T,
  store: RevisionMetaStore
): ResponseData<T> => {
  const clientTempId = store.getClientTempId(id)
  return {
    id,
    data,
    revision: store.get(id),
    ...(clientTempId !== undefined ? { clientTempId } : {})
  }
}
