import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import * as path from 'path'
import { getFs } from './fs-provider'
import { getDialogProvider } from './dialog-provider'
import { PromptAPI } from './prompt-api'
import type {
  CreateWorkspaceRequest as SharedCreateWorkspaceRequest,
  LoadPromptFoldersResult as SharedLoadPromptFoldersResult,
  PromptFolder as SharedPromptFolder,
  PromptFolderResult as SharedPromptFolderResult,
  WorkspaceResult as SharedWorkspaceResult
} from '@shared/ipc'
import { createPromptFolderConfig } from '@shared/promptFolderConfig'
import { sanitizePromptFolderName, validatePromptFolderName } from '@shared/promptFolderName'
import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'

export type WorkspaceResult = SharedWorkspaceResult
export type CreateWorkspaceRequest = SharedCreateWorkspaceRequest
export type PromptFolder = SharedPromptFolder
export type PromptFolderResult = SharedPromptFolderResult
export type LoadPromptFoldersResult = SharedLoadPromptFoldersResult

const WORKSPACE_SETTINGS_FILENAME = 'WorkspaceSettings.json'

export class WorkspaceManager {
  static setupIpcHandlers(): void {
    ipcMain.handle('select-workspace-folder', async () => {
      return await this.selectFolder()
    })

    ipcMain.handle('check-folder-exists', async (_, folderPath: string) => {
      return this.checkFolderExists(folderPath)
    })

    ipcMain.handle('create-workspace', async (_, request: CreateWorkspaceRequest | undefined) => {
      if (!request?.workspacePath) {
        return { success: false, error: 'Invalid request payload' }
      }
      return await this.createWorkspace(request.workspacePath, request.includeExamplePrompts)
    })

    ipcMain.handle(
      'create-prompt-folder',
      async (_, request: { workspacePath: string; displayName: string } | undefined) => {
        if (!request?.workspacePath || !request.displayName) {
          return { success: false, error: 'Invalid request payload' }
        }

        return await this.createPromptFolder(request.workspacePath, request.displayName)
      }
    )

    ipcMain.handle('load-prompt-folders', async (_, workspacePath: string) => {
      return await this.loadPromptFolders(workspacePath)
    })
  }
  static async selectFolder(): Promise<{ dialogCancelled: boolean; filePaths: string[] }> {
    const dialogProvider = getDialogProvider()
    return await dialogProvider.selectFolder()
  }

  static checkFolderExists(folderPath: string): boolean {
    try {
      const fs = getFs()
      return fs.existsSync(folderPath)
    } catch {
      return false
    }
  }

  static async createWorkspace(
    workspacePath: string,
    includeExamplePrompts: boolean
  ): Promise<WorkspaceResult> {
    try {
      // Avoid creating workspaces at the drive root.
      if (isWorkspaceRootPath(workspacePath)) {
        return { success: false, error: workspaceRootPathErrorMessage }
      }
      const promptsPath = path.join(workspacePath, 'prompts')
      const settingsPath = path.join(workspacePath, WORKSPACE_SETTINGS_FILENAME)

      const fs = getFs()

      // Create prompts subfolder
      if (!fs.existsSync(promptsPath)) {
        fs.mkdirSync(promptsPath, { recursive: true })
      }

      // Create WorkspaceSettings.json with a workspace GUID.
      if (!fs.existsSync(settingsPath)) {
        const settingsContent = JSON.stringify({ workspaceId: randomUUID() }, null, 2)
        fs.writeFileSync(settingsPath, settingsContent, 'utf8')
      }

      if (includeExamplePrompts) {
        const exampleFolderResult = await this.createPromptFolder(workspacePath, 'My Prompts')

        if (!exampleFolderResult.success || !exampleFolderResult.folder) {
          return {
            success: false,
            error: exampleFolderResult.error ?? 'Failed to create example prompts'
          }
        }

        const exampleFolderPath = path.join(promptsPath, exampleFolderResult.folder.folderName)
        const now = new Date().toISOString()
        const examplePrompts = [
          {
            id: randomUUID(),
            title: 'Example: Add a Feature',
            creationDate: now,
            lastModifiedDate: now,
            promptText: 'Placeholder prompt text.',
            promptFolderCount: 1
          },
          {
            id: randomUUID(),
            title: 'Example: Fix a Bug',
            creationDate: now,
            lastModifiedDate: now,
            promptText: 'Placeholder prompt text.',
            promptFolderCount: 2
          }
        ]

        const promptsContent = JSON.stringify(
          { metadata: { version: 1 }, prompts: examplePrompts },
          null,
          2
        )
        fs.writeFileSync(path.join(exampleFolderPath, 'prompts.json'), promptsContent, 'utf8')

        const configContent = JSON.stringify(
          createPromptFolderConfig(
            exampleFolderResult.folder.displayName,
            examplePrompts.length,
            randomUUID()
          ),
          null,
          2
        )
        fs.writeFileSync(path.join(exampleFolderPath, 'promptfolder.json'), configContent, 'utf8')
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static validateWorkspace(workspacePath: string): boolean {
    if (isWorkspaceRootPath(workspacePath)) {
      return false
    }
    const promptsPath = path.join(workspacePath, 'prompts')
    const settingsPath = path.join(workspacePath, WORKSPACE_SETTINGS_FILENAME)
    return this.checkFolderExists(promptsPath) && this.checkFolderExists(settingsPath)
  }

  static async createPromptFolder(
    workspacePath: string,
    displayName: string
  ): Promise<PromptFolderResult> {
    try {
      // Validate workspace exists
      if (!this.validateWorkspace(workspacePath)) {
        return { success: false, error: 'Invalid workspace path' }
      }

      const validation = validatePromptFolderName(displayName)

      if (!validation.isValid) {
        return { success: false, error: validation.errorMessage }
      }

      // Generate folder name by removing whitespace
      const folderName = sanitizePromptFolderName(displayName)

      // Create the folder path
      const promptsPath = path.join(workspacePath, 'prompts')
      const folderPath = path.join(promptsPath, folderName)

      const fs = getFs()

      // Check if folder already exists
      if (fs.existsSync(folderPath)) {
        return { success: false, error: 'A folder with this name already exists' }
      }

      // Create the folder
      fs.mkdirSync(folderPath, { recursive: true })

      // Create the promptfolder.json file
      const configPath = path.join(folderPath, 'promptfolder.json')
      const configContent = JSON.stringify(
        createPromptFolderConfig(displayName, 0, randomUUID()),
        null,
        2
      )
      fs.writeFileSync(configPath, configContent, 'utf8')

      // Create the prompts.json file
      PromptAPI.createInitialPromptsFile(folderPath)

      return {
        success: true,
        folder: {
          folderName,
          displayName
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async loadPromptFolders(workspacePath: string): Promise<LoadPromptFoldersResult> {
    try {
      // Validate workspace exists
      if (!this.validateWorkspace(workspacePath)) {
        return { success: false, error: 'Invalid workspace path' }
      }

      const fs = getFs()
      const promptsPath = path.join(workspacePath, 'prompts')

      // Check if prompts directory exists
      if (!fs.existsSync(promptsPath)) {
        return { success: true, folders: [] }
      }

      const folders: PromptFolder[] = []
      const entries = fs.readdirSync(promptsPath, 'utf8')

      for (const entryName of entries) {
        const entryPath = path.join(promptsPath, entryName)

        // Check if it's a directory by using stat
        try {
          const stat = fs.statSync(entryPath)
          if (stat.isDirectory()) {
            const configPath = path.join(entryPath, 'promptfolder.json')

            try {
              if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf8')
                const config = JSON.parse(configContent)

                folders.push({
                  folderName: entryName,
                  displayName: config.foldername || entryName
                })
              } else {
                // Folder exists but no config file - use folder name as display name
                folders.push({
                  folderName: entryName,
                  displayName: entryName
                })
              }
            } catch {
              // If we can't read the config, just use the folder name
              folders.push({
                folderName: entryName,
                displayName: entryName
              })
            }
          }
        } catch {
          // Skip entries that can't be stat'd
          continue
        }
      }

      return { success: true, folders }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}
