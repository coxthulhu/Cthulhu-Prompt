import { createTestRequestId } from './PlaywrightTestFramework'
import { buildPromptStem } from '@shared/promptFilename'

type PersistedPromptLookup = {
  workspacePath: string
  folderName: string
  promptId: string
  promptTitle: string
}

type PersistedPromptFilePaths = {
  markdownPath: string
  metadataPath: string
}

const readTextFile = async (electronApp: any, filePath: string): Promise<string> => {
  const requestId = createTestRequestId('read')

  return await electronApp.evaluate(
    async ({ app }, payload) => {
      const { targetPath, requestId } = payload
      return await new Promise<string>((resolve) => {
        app.once(`test-read-file-ready:${requestId}`, (result: { content: string }) => {
          resolve(result.content)
        })
        app.emit('test-read-file', { filePath: targetPath, requestId })
      })
    },
    { targetPath: filePath, requestId }
  )
}

const checkFileExists = async (electronApp: any, filePath: string): Promise<boolean> => {
  return await electronApp.evaluate(async ({ app }, targetPath) => {
    app.emit('test-check-file-exists', targetPath)
    return Boolean((global as any).testFileExistsResult)
  }, filePath)
}

export const resolvePersistedPromptFilePathsByTitle = (
  lookup: PersistedPromptLookup
): PersistedPromptFilePaths => {
  const folderPath = `${lookup.workspacePath}/Prompts/${lookup.folderName}`
  const promptStem = buildPromptStem(lookup.promptTitle, lookup.promptId)
  return {
    markdownPath: `${folderPath}/${promptStem}.md`,
    metadataPath: `${folderPath}/${promptStem}.prompt.json`
  }
}

export async function readPersistedPromptTextById(
  electronApp: any,
  lookup: PersistedPromptLookup
): Promise<string> {
  const paths = resolvePersistedPromptFilePathsByTitle(lookup)
  return await readTextFile(electronApp, paths.markdownPath)
}

export async function checkPersistedPromptFilesExistByTitle(
  electronApp: any,
  lookup: PersistedPromptLookup
): Promise<{ markdownExists: boolean; metadataExists: boolean }> {
  const paths = resolvePersistedPromptFilePathsByTitle(lookup)
  const [markdownExists, metadataExists] = await Promise.all([
    checkFileExists(electronApp, paths.markdownPath),
    checkFileExists(electronApp, paths.metadataPath)
  ])

  return {
    markdownExists,
    metadataExists
  }
}
