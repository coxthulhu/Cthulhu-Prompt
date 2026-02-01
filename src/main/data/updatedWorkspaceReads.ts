import * as path from 'path'
import { getFs } from '../fs-provider'
import type { PromptFolderConfigFile, PromptFromFile } from './diskTypes'

export const readPromptFolderConfig = (configPath: string): PromptFolderConfigFile => {
  const fs = getFs()
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as PromptFolderConfigFile
}

export const readPromptFolders = (
  workspacePath: string
): Array<{ folderName: string; config: PromptFolderConfigFile }> => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts')

  if (!fs.existsSync(promptsPath)) {
    return []
  }

  const entries = fs.readdirSync(promptsPath, { withFileTypes: true })
  const folders: Array<{ folderName: string; config: PromptFolderConfigFile }> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const folderName = entry.name
    const configPath = path.join(promptsPath, folderName, 'PromptFolder.json')
    const config = readPromptFolderConfig(configPath)
    folders.push({ folderName, config })
  }

  folders.sort((left, right) => left.folderName.localeCompare(right.folderName))

  return folders
}

export const readPromptFolderIds = (workspacePath: string): string[] =>
  readPromptFolders(workspacePath).map((folder) => folder.config.promptFolderId)

export const readPromptFolderPrompts = (
  workspacePath: string,
  folderName: string
): PromptFromFile[] => {
  const fs = getFs()
  const promptsPath = path.join(workspacePath, 'Prompts', folderName, 'Prompts.json')
  const parsed = JSON.parse(fs.readFileSync(promptsPath, 'utf8')) as {
    prompts?: PromptFromFile[]
  }
  return parsed.prompts ?? []
}
