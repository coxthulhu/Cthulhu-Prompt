import type { EventEmitter } from 'node:events'
import { expect, type ElectronApplication } from '@playwright/test'
import { createTestRequestId } from './TestRequestId'
import { buildPromptStem } from '@shared/domain/prompt/promptFilename'

type PersistedPromptLookup = {
  workspacePath: string
  folderName: string
  promptId: string
  promptTitle: string
  needsFilenameIdSuffix?: boolean
}

type PersistedPromptFilePaths = {
  markdownPath: string
}

export const readTextFile = async (electronApp: ElectronApplication, filePath: string): Promise<string> => {
  const requestId = createTestRequestId('read')

  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { targetPath, requestId } = payload
      return await new Promise<string>((resolve) => {
        (app as EventEmitter).once(`test-read-file-ready:${requestId}`, (result: { content: string }) => {
          resolve(result.content)
        })
        app.emit('test-read-file', { filePath: targetPath, requestId })
      })
    },
    { targetPath: filePath, requestId }
  )
}

export const checkFileExists = async (electronApp: ElectronApplication, filePath: string): Promise<boolean> => {
  return await electronApp.evaluate(async ({ app }, targetPath) => {
    app.emit('test-check-file-exists', targetPath)
    return Boolean((global as any).testFileExistsResult)
  }, filePath)
}

export const resolvePersistedPromptFilePathsByTitle = (
  lookup: PersistedPromptLookup
): PersistedPromptFilePaths => {
  // Logical folder segments used to insert the canonical Active directory when needed.
  const [rootFolderName, ...folderSegments] = lookup.folderName.split('/')
  // Explicit status paths remain direct while logical active paths are nested beneath Active.
  const persistedFolderSegments =
    folderSegments[0] === 'Active' ||
    folderSegments[0] === 'Completed' ||
    folderSegments[0] === 'Archived'
      ? [rootFolderName, ...folderSegments]
      : [rootFolderName, 'Active', ...folderSegments]
  const folderPath = `${lookup.workspacePath}/Prompts/${persistedFolderSegments.join('/')}`
  const promptStem = buildPromptStem(
    lookup.promptTitle,
    lookup.promptId,
    lookup.needsFilenameIdSuffix ?? false
  )
  return {
    markdownPath: `${folderPath}/${promptStem}.prompt.md`
  }
}

export async function readPersistedPromptTextById(
  electronApp: ElectronApplication,
  lookup: PersistedPromptLookup
): Promise<string> {
  const paths = resolvePersistedPromptFilePathsByTitle(lookup)
  return await readTextFile(electronApp, paths.markdownPath)
}

export async function checkPersistedPromptFilesExistByTitle(
  electronApp: ElectronApplication,
  lookup: PersistedPromptLookup
): Promise<{ markdownExists: boolean }> {
  const paths = resolvePersistedPromptFilePathsByTitle(lookup)
  const markdownExists = await checkFileExists(electronApp, paths.markdownPath)

  return {
    markdownExists
  }
}

/** Reads persisted entries across the root’s category groups. */
export const readPromptFolderEntries = async (
  electronApp: ElectronApplication,
  folderOrderPath: string
): Promise<Array<{ kind: 'prompt' | 'folder'; id: string }>> => {
  /** Raw ordering file read through the existing Electron test event. */
  const fileContents = await readTextFile(electronApp, folderOrderPath)
  /** Current root ordering groups active content beneath category ownership. */
  const order = JSON.parse(fileContents) as {
    categories: Array<{
      entries: Array<{ kind: 'prompt' | 'folder'; id: string }>
    }>
  }
  return order.categories.flatMap((category) => category.entries)
}

/** Projects persisted category entries to their ordered IDs. */
export const readPromptFolderEntryIds = async (
  electronApp: ElectronApplication,
  folderOrderPath: string
): Promise<string[]> =>
  (await readPromptFolderEntries(electronApp, folderOrderPath)).map((entry) => entry.id)

/** Polls the existing persisted-folder ordering assertion. */
export const expectPersistedFolderPromptIds = async (
  electronApp: ElectronApplication,
  folderOrderPath: string,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect
    .poll(async () => await readPromptFolderEntryIds(electronApp, folderOrderPath))
    .toEqual(expectedPromptIds)
}
