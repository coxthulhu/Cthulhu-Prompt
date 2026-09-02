import type { AuthoritativeSnapshotQueryResult } from '@shared/AuthoritativeSnapshot'
import { ipcInvoke } from './IpcRequestInvoke'
import { runLoad } from './Load'
import { reconcileRendererAuthoritativeSnapshots } from './AuthoritativeSnapshots'

/** Runs one no-payload authoritative query and reconciles its successful snapshots. */
export const runRendererAuthoritativeQuery = async (channel: string): Promise<void> => {
  /** Successful query response produced after standardized IPC failure handling. */
  const result = await runLoad(() => ipcInvoke<AuthoritativeSnapshotQueryResult>(channel))
  reconcileRendererAuthoritativeSnapshots(result.snapshots)
}
