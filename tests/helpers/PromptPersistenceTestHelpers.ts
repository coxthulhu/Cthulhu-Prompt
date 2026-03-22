import { createTestRequestId } from './PlaywrightTestFramework'
import { buildPromptStem } from '@shared/promptFilename'

type PersistedPromptLookup = {
  workspacePath: string
  folderName: string
  promptId: string
  promptTitle: string
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

export async function readPersistedPromptTextById(
  electronApp: any,
  lookup: PersistedPromptLookup
): Promise<string> {
  const folderPath = `${lookup.workspacePath}/Prompts/${lookup.folderName}`
  const promptStem = buildPromptStem(lookup.promptTitle, lookup.promptId)
  return await readTextFile(electronApp, `${folderPath}/${promptStem}.md`)
}
