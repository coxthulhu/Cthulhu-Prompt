import { createTestRequestId } from './PlaywrightTestFramework'

type PersistedPromptLookup = {
  workspacePath: string
  folderName: string
  promptId: string
  promptTitle: string
}

const MAX_PROMPT_FILENAME_TITLE_LENGTH = 64
const DEFAULT_PROMPT_FILENAME_TITLE = 'Prompt'
// eslint-disable-next-line no-control-regex
const ILLEGAL_WINDOWS_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g

const sanitizePromptTitleForFilename = (title: string): string => {
  const noIllegalChars = title.trim().replace(ILLEGAL_WINDOWS_FILENAME_CHARS, '')
  const noTrailingDotsOrSpaces = noIllegalChars.replace(/[. ]+$/g, '').trim()
  const normalizedTitle = noTrailingDotsOrSpaces || DEFAULT_PROMPT_FILENAME_TITLE
  return normalizedTitle.slice(0, MAX_PROMPT_FILENAME_TITLE_LENGTH)
}

const resolvePromptStem = (title: string, promptId: string): string => {
  const idPrefix = promptId.slice(0, 8)
  const titlePrefix = sanitizePromptTitleForFilename(title)
  return `${titlePrefix}-${idPrefix}`
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

export async function readPersistedPromptTextByIdLegacy(
  electronApp: any,
  lookup: PersistedPromptLookup
): Promise<string> {
  const folderPath = `${lookup.workspacePath}/Prompts/${lookup.folderName}`
  const legacyPromptsPath = `${folderPath}/Prompts.json`
  const legacyFileContent = await readTextFile(electronApp, legacyPromptsPath)
  const legacyPrompts = JSON.parse(legacyFileContent) as {
    prompts: Array<{ id: string; promptText: string }>
  }
  const prompt = legacyPrompts.prompts.find((item) => item.id === lookup.promptId)
  return prompt?.promptText ?? ''
}

export async function readPersistedPromptTextByIdUpdated(
  electronApp: any,
  lookup: PersistedPromptLookup
): Promise<string> {
  const folderPath = `${lookup.workspacePath}/Prompts/${lookup.folderName}`
  // Placeholder for the updated layout branch until tests are hard-switched.
  const promptStem = resolvePromptStem(lookup.promptTitle, lookup.promptId)
  return await readTextFile(electronApp, `${folderPath}/${promptStem}.md`)
}

export async function readPersistedPromptTextById(
  electronApp: any,
  lookup: PersistedPromptLookup
): Promise<string> {
  // Hardcoded for now. Switch call sites to readPersistedPromptTextByIdUpdated when ready.
  return await readPersistedPromptTextByIdLegacy(electronApp, lookup)
}
