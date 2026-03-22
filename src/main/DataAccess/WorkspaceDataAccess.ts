import { randomUUID } from 'crypto'
import * as path from 'path'
import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'
import { compactGuid } from '@shared/compactGuid'
import { getFs } from '../fs-provider'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPT_METADATA_SUFFIX = '.prompt.json'
const PROMPT_MARKDOWN_SUFFIX = '.md'
const EXAMPLE_FOLDER_NAME = 'MyPrompts'
const EXAMPLE_FOLDER_DISPLAY_NAME = 'My Prompts'
const MAX_PROMPT_FILENAME_TITLE_LENGTH = 64
const DEFAULT_PROMPT_FILENAME_TITLE = 'Prompt'
// eslint-disable-next-line no-control-regex
const ILLEGAL_WINDOWS_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g

type CreateWorkspaceResult = { success: true } | { success: false; error: string }

const writeWorkspaceInfoFile = (workspacePath: string): void => {
  const fs = getFs()
  const workspaceInfoPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
  const content = JSON.stringify({ workspaceId: compactGuid(randomUUID()) }, null, 2)
  fs.writeFileSync(workspaceInfoPath, content, 'utf8')
}

const sanitizePromptTitleForFilename = (title: string): string => {
  const noIllegalChars = title.trim().replace(ILLEGAL_WINDOWS_FILENAME_CHARS, '')
  const noTrailingDotsOrSpaces = noIllegalChars.replace(/[. ]+$/g, '').trim()
  const normalizedTitle = noTrailingDotsOrSpaces || DEFAULT_PROMPT_FILENAME_TITLE
  return normalizedTitle.slice(0, MAX_PROMPT_FILENAME_TITLE_LENGTH)
}

const resolvePromptStem = (title: string, promptId: string, usedStems: Set<string>): string => {
  const idPrefix = promptId.slice(0, 8)
  const baseStem = `${sanitizePromptTitleForFilename(title)}-${idPrefix}`

  if (!usedStems.has(baseStem)) {
    usedStems.add(baseStem)
    return baseStem
  }

  let suffix = 2
  while (usedStems.has(`${baseStem}-${suffix}`)) {
    suffix += 1
  }

  const nextStem = `${baseStem}-${suffix}`
  usedStems.add(nextStem)
  return nextStem
}

const writeExamplePrompts = (workspacePath: string): void => {
  const fs = getFs()
  const exampleFolderPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, EXAMPLE_FOLDER_NAME)
  const configPath = path.join(exampleFolderPath, PROMPT_FOLDER_CONFIG_FILENAME)
  const now = new Date().toISOString()
  const examplePrompts = [
    {
      id: compactGuid(randomUUID()),
      title: 'Example: Add a Feature',
      creationDate: now,
      lastModifiedDate: now,
      promptText: 'Placeholder prompt text.',
      promptFolderCount: 1
    },
    {
      id: compactGuid(randomUUID()),
      title: 'Example: Fix a Bug',
      creationDate: now,
      lastModifiedDate: now,
      promptText: 'Placeholder prompt text.',
      promptFolderCount: 2
    }
  ]
  const usedStems = new Set<string>()
  const promptIds: string[] = []

  fs.mkdirSync(exampleFolderPath, { recursive: true })

  for (const prompt of examplePrompts) {
    const promptStem = resolvePromptStem(prompt.title, prompt.id, usedStems)
    const metadataPath = path.join(exampleFolderPath, `${promptStem}${PROMPT_METADATA_SUFFIX}`)
    const markdownPath = path.join(exampleFolderPath, `${promptStem}${PROMPT_MARKDOWN_SUFFIX}`)

    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          id: prompt.id,
          title: prompt.title,
          creationDate: prompt.creationDate,
          lastModifiedDate: prompt.lastModifiedDate,
          promptFolderCount: prompt.promptFolderCount
        },
        null,
        2
      ),
      'utf8'
    )
    fs.writeFileSync(markdownPath, prompt.promptText, 'utf8')
    promptIds.push(prompt.id)
  }

  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        foldername: EXAMPLE_FOLDER_DISPLAY_NAME,
        promptFolderId: compactGuid(randomUUID()),
        promptCount: examplePrompts.length,
        folderDescription: '',
        promptIds
      },
      null,
      2
    ),
    'utf8'
  )
}

const validateNewWorkspacePath = (workspacePath: string): CreateWorkspaceResult | null => {
  if (isWorkspaceRootPath(workspacePath)) {
    return { success: false, error: workspaceRootPathErrorMessage }
  }

  const fs = getFs()
  const workspaceInfoPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
  const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME)

  if (fs.existsSync(workspaceInfoPath) || fs.existsSync(promptsPath)) {
    return { success: false, error: 'Workspace already exists' }
  }

  return null
}

export const createWorkspace = async (
  workspacePath: string,
  includeExamplePrompts: boolean
): Promise<CreateWorkspaceResult> => {
  try {
    // Special-case command path: this is an imperative workspace bootstrap,
    // not a normal  revision mutation workflow.
    const validationResult = validateNewWorkspacePath(workspacePath)
    if (validationResult) {
      return validationResult
    }

    const fs = getFs()
    const promptsPath = path.join(workspacePath, PROMPTS_FOLDER_NAME)

    fs.mkdirSync(promptsPath, { recursive: true })
    writeWorkspaceInfoFile(workspacePath)

    if (includeExamplePrompts) {
      writeExamplePrompts(workspacePath)
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
