import { randomUUID } from 'crypto'
import * as path from 'path'
import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'
import { compactGuid } from '@shared/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { resolveUniquePromptStem } from '@shared/promptFilename'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { PROMPT_FOLDER_SETTINGS_FIELDS } from '@shared/PromptFolder'
import { getFs } from '../fs-provider'
import { serializePromptMarkdown } from '../Persistence/PromptFrontmatter'
import {
  PROMPTS_DIRECTORY_NAME,
  PROMPT_FOLDER_INFO_DIRECTORY_NAME,
  PROMPT_FOLDER_INFO_FILENAME,
  PROMPT_FOLDER_ORDER_FILENAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  WORKSPACE_INFO_FILENAME_SUFFIX,
  resolvePromptFolderSettingsTextPath,
  resolveWorkspacePromptFolderOrderPath
} from '../Persistence/PromptPersistencePaths'

const EXAMPLE_FOLDER_NAME = 'MyPrompts'
const EXAMPLE_FOLDER_DISPLAY_NAME = 'My Prompts'

type CreateWorkspaceResult = { success: true } | { success: false; error: string }

const resolveWorkspaceInfoPath = (workspacePath: string, workspaceName: string): string => {
  const preparedWorkspaceName = preparePromptFolderName(workspaceName)
  const workspaceRootPath = workspacePath.replace(/[\\/]+$/, '')
  return `${workspaceRootPath}\\${preparedWorkspaceName.folderName}${WORKSPACE_INFO_FILENAME_SUFFIX}`
}

const writeWorkspaceInfoFile = (workspacePath: string, workspaceName: string): void => {
  const fs = getFs()
  const workspaceInfoPath = resolveWorkspaceInfoPath(workspacePath, workspaceName)
  const content = JSON.stringify({ workspaceId: compactGuid(randomUUID()), workspaceName }, null, 2)
  fs.writeFileSync(workspaceInfoPath, content, 'utf8')
}

const writeWorkspacePromptFolderOrderFile = (
  workspacePath: string,
  promptFolderIds: string[]
): void => {
  const fs = getFs()
  const orderPath = resolveWorkspacePromptFolderOrderPath(workspacePath)
  fs.writeFileSync(orderPath, JSON.stringify({ promptFolderIds }, null, 2), 'utf8')
}

const resolvePromptStem = (title: string, promptId: string, usedStems: Set<string>): string => {
  const promptStem = resolveUniquePromptStem(title, promptId, (stem) => usedStems.has(stem))
  usedStems.add(promptStem)
  return promptStem
}

const writeMyPromptsFolder = (workspacePath: string, includeExamplePrompts: boolean): string => {
  const fs = getFs()
  const exampleFolderPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME, EXAMPLE_FOLDER_NAME)
  const folderInfoPath = path.join(
    exampleFolderPath,
    PROMPT_FOLDER_INFO_DIRECTORY_NAME,
    PROMPT_FOLDER_INFO_FILENAME
  )
  const orderPath = path.join(exampleFolderPath, PROMPT_FOLDER_ORDER_FILENAME)
  const now = getCurrentIsoSecondTimestamp()
  const promptFolderId = compactGuid(randomUUID())
  const examplePrompts = includeExamplePrompts
    ? [
        {
          id: compactGuid(randomUUID()),
          title: 'Example: Add a Feature',
          fallbackTitle: '',
          createdAt: now,
          modifiedAt: now,
          promptText: 'Placeholder prompt text.'
        },
        {
          id: compactGuid(randomUUID()),
          title: 'Example: Fix a Bug',
          fallbackTitle: '',
          createdAt: now,
          modifiedAt: now,
          promptText: 'Placeholder prompt text.'
        }
      ]
    : []
  const usedStems = new Set<string>()
  const promptIds: string[] = []

  fs.mkdirSync(path.join(exampleFolderPath, PROMPT_FOLDER_INFO_DIRECTORY_NAME), {
    recursive: true
  })

  for (const prompt of examplePrompts) {
    const promptStem = resolvePromptStem(prompt.title, prompt.id, usedStems)
    const markdownPath = path.join(
      exampleFolderPath,
      `${promptStem}${PROMPT_MARKDOWN_FILENAME_SUFFIX}`
    )

    fs.writeFileSync(markdownPath, serializePromptMarkdown(prompt), 'utf8')
    promptIds.push(prompt.id)
  }

  fs.writeFileSync(
    folderInfoPath,
    JSON.stringify(
      {
        displayName: EXAMPLE_FOLDER_DISPLAY_NAME,
        promptFolderId
      },
      null,
      2
    ),
    'utf8'
  )
  fs.writeFileSync(orderPath, JSON.stringify({ promptIds }, null, 2), 'utf8')
  for (const field of PROMPT_FOLDER_SETTINGS_FIELDS) {
    fs.writeFileSync(
      resolvePromptFolderSettingsTextPath(workspacePath, EXAMPLE_FOLDER_NAME, field),
      '',
      'utf8'
    )
  }

  return promptFolderId
}

const validateNewWorkspacePath = (workspacePath: string): CreateWorkspaceResult | null => {
  if (isWorkspaceRootPath(workspacePath)) {
    return { success: false, error: workspaceRootPathErrorMessage }
  }

  const fs = getFs()
  const promptsPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME)
  const hasWorkspaceInfoFile =
    fs.existsSync(workspacePath) &&
    fs
      .readdirSync(workspacePath)
      .some((entryName) => entryName.toLowerCase().endsWith(WORKSPACE_INFO_FILENAME_SUFFIX))

  if (hasWorkspaceInfoFile || fs.existsSync(promptsPath)) {
    return { success: false, error: 'Workspace already exists' }
  }

  return null
}

export const createWorkspace = async (
  workspacePath: string,
  workspaceName: string,
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
    const promptsPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME)
    const promptFolderIds: string[] = []

    fs.mkdirSync(promptsPath, { recursive: true })
    writeWorkspaceInfoFile(workspacePath, workspaceName)

    promptFolderIds.push(writeMyPromptsFolder(workspacePath, includeExamplePrompts))
    writeWorkspacePromptFolderOrderFile(workspacePath, promptFolderIds)

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
