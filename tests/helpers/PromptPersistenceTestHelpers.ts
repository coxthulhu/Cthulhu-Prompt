import type { EventEmitter } from 'node:events'
import { expect, type ElectronApplication } from '@playwright/test'
import { createTestRequestId } from './TestRequestId'
import { findCollection, readRecord } from './WorkspaceDatabaseHelpers'
import type { PromptStatusFolderId } from '@shared/domain/prompt/Prompt'
import { getPromptDisplayTitle } from '@shared/domain/prompt/promptFallbackTitle'

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

/** Checks the stored title and status membership for one prompt in a collection. */
export async function containsPrompt(
  app: ElectronApplication, collectionName: string, promptId: string, title: string
): Promise<boolean> {
  /** Test selections identify a collection and optionally a non-active status section. */
  const [folder, status = 'Active'] = collectionName.split('/')
  /** Read the collection membership independently of the prompt title. */
  const collection = await findCollection(app, folder)
  /** The status registry defines how each section stores its members. */
  const section = collection?.statusFolders[status.toLowerCase() as PromptStatusFolderId]
  /** A moved or deleted prompt must disappear from its old section. */
  const member = section?.ordering === 'category'
    ? section.categoryOrder.categories.some((group) => group.entries.some((entry) => entry.kind === 'prompt' && entry.id === promptId))
    : section?.promptIds.includes(promptId)
  /** An untitled prompt uses its persisted fallback title. */
  const prompt = await readRecord(app, 'prompt', promptId)
  return Boolean(member && prompt && getPromptDisplayTitle(prompt) === title)
}

/** Reads all active category groups from a saved collection. */
export const readPromptCollectionEntries = async (app: ElectronApplication, folder: string) =>
  (await findCollection(app, folder))!.statusFolders.active.categoryOrder.categories.flatMap((group) => group.entries)

/** Projects persisted category entries to their ordered IDs. */
export const readPromptCollectionEntryIds = async (
  electronApp: ElectronApplication,
  folder: string
): Promise<string[]> =>
  (await readPromptCollectionEntries(electronApp, folder)).map((entry) => entry.id)

/** Polls the existing persisted-collection ordering assertion. */
export const expectPersistedCollectionPromptIds = async (
  electronApp: ElectronApplication,
  folder: string,
  expectedPromptIds: string[]
): Promise<void> => {
  await expect
    .poll(async () => await readPromptCollectionEntryIds(electronApp, folder))
    .toEqual(expectedPromptIds)
}
