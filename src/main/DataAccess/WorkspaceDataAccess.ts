import { randomUUID } from 'crypto'
import * as path from 'path'
import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'
import { compactGuid } from '@shared/compactGuid'
import { getFs } from '../fs-provider'

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'
const PROMPTS_FOLDER_NAME = 'Prompts'
const PROMPT_FOLDER_CONFIG_FILENAME = 'PromptFolder.json'
const PROMPTS_FILENAME = 'Prompts.json'
const EXAMPLE_FOLDER_NAME = 'MyPrompts'
const EXAMPLE_FOLDER_DISPLAY_NAME = 'My Prompts'

type CreateWorkspaceResult = { success: true } | { success: false; error: string }

const writeWorkspaceInfoFile = (workspacePath: string): void => {
  const fs = getFs()
  const workspaceInfoPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
  const content = JSON.stringify({ workspaceId: compactGuid(randomUUID()) }, null, 2)
  fs.writeFileSync(workspaceInfoPath, content, 'utf8')
}

const writeExamplePrompts = (workspacePath: string): void => {
  const fs = getFs()
  const exampleFolderPath = path.join(workspacePath, PROMPTS_FOLDER_NAME, EXAMPLE_FOLDER_NAME)
  const configPath = path.join(exampleFolderPath, PROMPT_FOLDER_CONFIG_FILENAME)
  const promptsPath = path.join(exampleFolderPath, PROMPTS_FILENAME)
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

  fs.mkdirSync(exampleFolderPath, { recursive: true })
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        foldername: EXAMPLE_FOLDER_DISPLAY_NAME,
        promptFolderId: compactGuid(randomUUID()),
        promptCount: examplePrompts.length,
        folderDescription: ''
      },
      null,
      2
    ),
    'utf8'
  )
  fs.writeFileSync(
    promptsPath,
    JSON.stringify(
      {
        prompts: examplePrompts
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
