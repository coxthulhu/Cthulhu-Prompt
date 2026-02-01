import { describe, expect, it, vi } from 'vitest'

import { createBaseDataStore } from '@renderer/data/updated/UpdatedBaseDataStore.svelte.ts'

type TestData = {
  title: string
  body: string
  serverOnly?: string
}

describe('createBaseDataStore', () => {
  it('preserves fallback merges when rekeying optimistic entries', () => {
    const store = createBaseDataStore<TestData>()
    const clientTempId = store.optimisticInsert(
      { title: 'Draft', body: 'Draft' },
      'client-temp-id'
    )

    const entry = store.getEntry(clientTempId)
    expect(entry).not.toBeNull()
    entry!.draftSnapshot!.body = 'Edited'

    store.mergeAuthoritativeSnapshot(
      'server-id',
      {
        data: { title: 'Server', body: 'Draft', serverOnly: 'from-server' },
        revision: 1
      },
      false,
      clientTempId
    )

    const fallbackEntry = store.getEntry(clientTempId)
    expect(fallbackEntry).not.toBeNull()
    expect(fallbackEntry!.draftSnapshot).toEqual({
      title: 'Server',
      body: 'Edited',
      serverOnly: 'from-server'
    })
    expect(store.getEntry('server-id')).toBeNull()

    const rewriteReferences = vi.fn()
    store.rekeyEntry(clientTempId, 'server-id', rewriteReferences)

    const rekeyedEntry = store.getEntry('server-id')
    expect(rekeyedEntry).not.toBeNull()
    expect(rekeyedEntry!.draftSnapshot).toEqual({
      title: 'Server',
      body: 'Edited',
      serverOnly: 'from-server'
    })
    expect(store.getEntry(clientTempId)).toBeNull()
    expect(rewriteReferences).toHaveBeenCalledWith(clientTempId, 'server-id')
  })
})
