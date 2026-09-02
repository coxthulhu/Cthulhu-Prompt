import { ipcMain } from 'electron'
import type { AuthoritativeSnapshotQueryResult } from '@shared/AuthoritativeSnapshot'
import type { DomainTarget } from '@shared/DomainChanges'
import { buildMainAuthoritativeSnapshots } from './AuthoritativeSnapshots'

/** Query-specific loader that prepares authoritative state and selects response targets. */
type MainAuthoritativeQuery = () =>
  | readonly DomainTarget[]
  | Promise<readonly DomainTarget[]>

/** Inputs used to register one no-payload authoritative query handler. */
type MainAuthoritativeQueryOptions = {
  channel: string
  query: MainAuthoritativeQuery
}

/** Registers a no-payload query that returns generic authoritative snapshots. */
export const handleMainAuthoritativeQuery = (
  options: MainAuthoritativeQueryOptions
): void => {
  // Side effect: register the channel once and standardize its success and failure responses.
  ipcMain.handle(options.channel, async (): Promise<AuthoritativeSnapshotQueryResult> => {
    try {
      /** Authoritative targets selected after query-specific state preparation completes. */
      const targets = await options.query()
      return {
        success: true,
        snapshots: buildMainAuthoritativeSnapshots(targets)
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
