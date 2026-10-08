import * as path from 'path'
import { allocateFilenameStem } from '@shared/domain/prompt/promptFilename'
import { getFs } from '../fs-provider'

/** Directory contents and reservations shared by every write in one transaction. */
export const createFilenameAllocator = () => {
  /** Complete filenames keyed by case-insensitive physical directory. */
  const directories = new Map<string, Set<string>>()
  /** Reads each destination once, retaining all existing entries until the transaction ends. */
  const namesIn = (directory: string): Set<string> => {
    /** Windows directory identity shared by case-only path variants. */
    const key = directory.toLowerCase()
    /** Cached names include allocations that have not reached disk yet. */
    let names = directories.get(key)
    if (!names) {
      names = new Set(
        getFs().existsSync(directory)
          ? getFs().readdirSync(directory).map((name) => name.toLowerCase())
          : []
      )
      directories.set(key, names)
    }
    return names
  }
  return {
    /** Reserves known persisted paths, including files carried by a root-directory rename. */
    reserve: (filePath: string): void => {
      namesIn(path.dirname(filePath)).add(path.basename(filePath).toLowerCase())
    },
    /** Allocates a destination, allowing an entity to retain its own current filename. */
    allocate: (directory: string, title: string, suffix: string, currentFilename?: string): string =>
      allocateFilenameStem(title, suffix, namesIn(directory), currentFilename)
  }
}
