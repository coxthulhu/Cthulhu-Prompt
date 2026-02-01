// Types that map directly to JSON files on disk.

// WorkspaceInfo.json
export type WorkspaceInfoFile = {
  workspaceId: string
}

// SystemSettings.json
export type SystemSettingsFile = {
  promptFontSize: number
  promptEditorMinLines: number
}

// PromptFolder.json
export type PromptFolderConfigFile = {
  foldername: string
  promptFolderId: string
  promptCount: number
  folderDescription: string
}

export const createPromptFolderConfig = (
  foldername: string,
  promptCount: number,
  promptFolderId: string,
  folderDescription: string = ''
): PromptFolderConfigFile => {
  return { foldername, promptFolderId, promptCount, folderDescription }
}

// Prompts.json
export type PromptFromFile = {
  id: string
  title: string
  creationDate: string
  lastModifiedDate: string
  promptText: string
  promptFolderCount: number
}

export interface PromptsFileMetadata {
  schemaVersion: number
}

export interface PromptsFile {
  metadata: PromptsFileMetadata
  prompts: PromptFromFile[]
}
