import { randomUUID } from 'crypto'
import * as path from 'path'
import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'
import { compactGuid } from '@shared/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { resolveUniquePromptStem } from '@shared/promptFilename'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { getFs } from '../fs-provider'
import { serializePromptMarkdown } from '../Persistence/PromptFrontmatter'
import {
  PROMPTS_DIRECTORY_NAME,
  PROMPT_FOLDER_DESCRIPTION_FILENAME,
  PROMPT_FOLDER_INFO_DIRECTORY_NAME,
  PROMPT_FOLDER_INFO_FILENAME,
  PROMPT_FOLDER_ORDER_FILENAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  WORKSPACE_INFO_FILENAME_SUFFIX
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
  const content = JSON.stringify(
    { workspaceId: compactGuid(randomUUID()), workspaceName },
    null,
    2
  )
  fs.writeFileSync(workspaceInfoPath, content, 'utf8')
}

const resolvePromptStem = (title: string, promptId: string, usedStems: Set<string>): string => {
  const promptStem = resolveUniquePromptStem(title, promptId, (stem) => usedStems.has(stem))
  usedStems.add(promptStem)
  return promptStem
}

const writeExamplePrompts = (workspacePath: string): void => {
  const fs = getFs()
  const exampleFolderPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME, EXAMPLE_FOLDER_NAME)
  const folderInfoPath = path.join(
    exampleFolderPath,
    PROMPT_FOLDER_INFO_DIRECTORY_NAME,
    PROMPT_FOLDER_INFO_FILENAME
  )
  const orderPath = path.join(exampleFolderPath, PROMPT_FOLDER_ORDER_FILENAME)
  const descriptionPath = path.join(
    exampleFolderPath,
    PROMPT_FOLDER_INFO_DIRECTORY_NAME,
    PROMPT_FOLDER_DESCRIPTION_FILENAME
  )
  const now = getCurrentIsoSecondTimestamp()
  const examplePrompts = [
    {
      id: compactGuid(randomUUID()),
      title: 'Example: Add a Feature',
      createdAt: now,
      modifiedAt: now,
      promptText: 'Placeholder prompt text.',
      promptFolderCount: 1
    },
    {
      id: compactGuid(randomUUID()),
      title: 'Example: Fix a Bug',
      createdAt: now,
      modifiedAt: now,
      promptText: 'Placeholder prompt text.',
      promptFolderCount: 2
    }
  ]
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
        promptFolderId: compactGuid(randomUUID()),
        promptCount: examplePrompts.length
      },
      null,
      2
    ),
    'utf8'
  )
  fs.writeFileSync(orderPath, JSON.stringify({ promptIds }, null, 2), 'utf8')
  fs.writeFileSync(descriptionPath, '', 'utf8')
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

    fs.mkdirSync(promptsPath, { recursive: true })
    writeWorkspaceInfoFile(workspacePath, workspaceName)

    if (includeExamplePrompts) {
      writeExamplePrompts(workspacePath)
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
