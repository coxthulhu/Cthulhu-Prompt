import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import * as path from 'path'
import { getFs } from './fs-provider'
import { getDialogProvider } from './dialog-provider'
import { PromptAPI } from './prompt-api'
import { revisions } from './revisions'
import type {
  CreateWorkspaceRequest as SharedCreateWorkspaceRequest,
  LoadPromptFoldersResult as SharedLoadPromptFoldersResult,
  LoadWorkspaceDataRequest as SharedLoadWorkspaceDataRequest,
  LoadWorkspaceDataResult as SharedLoadWorkspaceDataResult,
  PromptFolder as SharedPromptFolder,
  PromptFolderResult as SharedPromptFolderResult,
  UpdateWorkspaceDataRequest as SharedUpdateWorkspaceDataRequest,
  UpdateWorkspaceDataResult as SharedUpdateWorkspaceDataResult,
  WorkspaceData as SharedWorkspaceData,
  WorkspaceResult as SharedWorkspaceResult
} from '@shared/ipc'
import { createPromptFolderConfig, type WorkspaceInfoFile } from './data/diskTypes'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'

export type WorkspaceResult = SharedWorkspaceResult
export type CreateWorkspaceRequest = SharedCreateWorkspaceRequest
export type PromptFolder = SharedPromptFolder
export type PromptFolderResult = SharedPromptFolderResult
export type LoadPromptFoldersResult = SharedLoadPromptFoldersResult
export type WorkspaceData = SharedWorkspaceData
export type LoadWorkspaceDataRequest = SharedLoadWorkspaceDataRequest
export type LoadWorkspaceDataResult = SharedLoadWorkspaceDataResult
export type UpdateWorkspaceDataRequest = SharedUpdateWorkspaceDataRequest
export type UpdateWorkspaceDataResult = SharedUpdateWorkspaceDataResult

const WORKSPACE_INFO_FILENAME = 'WorkspaceInfo.json'

const readWorkspaceId = (workspacePath: string): string | null => {
  try {
    const fs = getFs()
    const settingsPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
    const content = fs.readFileSync(settingsPath, 'utf8')
    const parsed = JSON.parse(content) as WorkspaceInfoFile
    return typeof parsed?.workspaceId === 'string' ? parsed.workspaceId : null
  } catch {
    return null
  }
}

const buildWorkspaceData = (
  workspaceId: string,
  workspacePath: string,
  folders: PromptFolder[]
): WorkspaceData => ({
  workspaceId,
  workspacePath,
  folders
})

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

    ipcMain.handle(
      'load-workspace-data',
      async (_, request: LoadWorkspaceDataRequest | undefined) => {
        if (!request?.workspacePath) {
          return { success: false, error: 'Invalid request payload' }
        }

        return await this.loadWorkspaceData(request.workspacePath)
      }
    )

    ipcMain.handle(
      'update-workspace-data',
      async (_, request: UpdateWorkspaceDataRequest | undefined) => {
        if (!request?.workspacePath || !request.folders) {
          return { success: false, error: 'Invalid request payload' }
        }

        return await this.updateWorkspaceData(request)
      }
    )
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
      const promptsPath = path.join(workspacePath, 'Prompts')
      const settingsPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)

      const fs = getFs()

      // Create Prompts subfolder
      if (!fs.existsSync(promptsPath)) {
        fs.mkdirSync(promptsPath, { recursive: true })
      }

      // Create WorkspaceInfo.json with a workspace GUID.
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
          { metadata: { schemaVersion: 1 }, prompts: examplePrompts },
          null,
          2
        )
        fs.writeFileSync(path.join(exampleFolderPath, 'Prompts.json'), promptsContent, 'utf8')

        const configContent = JSON.stringify(
          createPromptFolderConfig(
            exampleFolderResult.folder.displayName,
            examplePrompts.length,
            randomUUID()
          ),
          null,
          2
        )
        fs.writeFileSync(path.join(exampleFolderPath, 'PromptFolder.json'), configContent, 'utf8')
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
    const promptsPath = path.join(workspacePath, 'Prompts')
    const settingsPath = path.join(workspacePath, WORKSPACE_INFO_FILENAME)
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

      const { validation, displayName: normalizedDisplayName, folderName } =
        preparePromptFolderName(displayName)

      if (!validation.isValid) {
        return { success: false, error: validation.errorMessage }
      }

      // Create the folder path
      const promptsPath = path.join(workspacePath, 'Prompts')
      const folderPath = path.join(promptsPath, folderName)

      const fs = getFs()

      // Check if folder already exists
      if (fs.existsSync(folderPath)) {
        return { success: false, error: 'A folder with this name already exists' }
      }

      // Create the folder
      fs.mkdirSync(folderPath, { recursive: true })

      // Create the PromptFolder.json file
      const configPath = path.join(folderPath, 'PromptFolder.json')
      const configContent = JSON.stringify(
        createPromptFolderConfig(normalizedDisplayName, 0, randomUUID()),
        null,
        2
      )
      fs.writeFileSync(configPath, configContent, 'utf8')

      // Create the Prompts.json file
      PromptAPI.createInitialPromptsFile(folderPath)

      return {
        success: true,
        folder: {
          folderName,
          displayName: normalizedDisplayName
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
      const promptsPath = path.join(workspacePath, 'Prompts')

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
            const configPath = path.join(entryPath, 'PromptFolder.json')

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

  static async loadWorkspaceData(workspacePath: string): Promise<LoadWorkspaceDataResult> {
    try {
      const promptFolderResult = await this.loadPromptFolders(workspacePath)

      if (!promptFolderResult.success) {
        return {
          success: false,
          error: promptFolderResult.error ?? 'Failed to load prompt folders'
        }
      }

      const workspaceId = readWorkspaceId(workspacePath)

      if (!workspaceId) {
        return { success: false, error: 'Invalid workspace info' }
      }

      const workspace = buildWorkspaceData(
        workspaceId,
        workspacePath,
        promptFolderResult.folders ?? []
      )

      return {
        success: true,
        workspace,
        revision: revisions.workspace.get(workspaceId)
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async updateWorkspaceData(
    request: UpdateWorkspaceDataRequest
  ): Promise<UpdateWorkspaceDataResult> {
    const { workspacePath, folders, revision: requestRevision } = request

    try {
      if (!this.validateWorkspace(workspacePath)) {
        return { success: false, error: 'Invalid workspace path' }
      }

      const workspaceId = readWorkspaceId(workspacePath)

      if (!workspaceId) {
        return { success: false, error: 'Invalid workspace info' }
      }

      const currentRevision = revisions.workspace.get(workspaceId)

      if (requestRevision !== currentRevision) {
        const promptFolderResult = await this.loadPromptFolders(workspacePath)

        if (!promptFolderResult.success) {
          return {
            success: false,
            error: promptFolderResult.error ?? 'Failed to load prompt folders'
          }
        }

        const conflictFolders = promptFolderResult.folders ?? []

        return {
          success: false,
          conflict: true,
          data: buildWorkspaceData(workspaceId, workspacePath, conflictFolders),
          revision: currentRevision
        }
      }

      const desiredFoldersByName = new Map<string, string>()

      for (const folder of folders) {
        const { displayName: normalizedDisplayName, folderName } = preparePromptFolderName(
          folder.displayName
        )
        if (!desiredFoldersByName.has(folderName)) {
          desiredFoldersByName.set(folderName, normalizedDisplayName)
        }
      }

      const fs = getFs()
      const promptsPath = path.join(workspacePath, 'Prompts')
      const entries = fs.readdirSync(promptsPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }

        const entryName = entry.name
        const entryPath = path.join(promptsPath, entryName)

        if (!desiredFoldersByName.has(entryName)) {
          fs.rmSync(entryPath, { recursive: true, force: true })
        }
      }

      for (const [folderName, displayName] of desiredFoldersByName) {
        const folderPath = path.join(promptsPath, folderName)

        if (!fs.existsSync(folderPath)) {
          const createResult = await this.createPromptFolder(workspacePath, displayName)

          if (!createResult.success) {
            return {
              success: false,
              error: createResult.error ?? 'Failed to create prompt folder'
            }
          }

          continue
        }

        const configPath = path.join(folderPath, 'PromptFolder.json')

        try {
          const configContent = fs.readFileSync(configPath, 'utf8')
          const config = JSON.parse(configContent) as Record<string, unknown>

          if (config.foldername !== displayName) {
            const updatedConfig = { ...config, foldername: displayName }
            fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf8')
          }
        } catch {
          // Ignore unreadable configs.
        }
      }

      const nextRevision = revisions.workspace.bump(workspaceId)

      const promptFolderResult = await this.loadPromptFolders(workspacePath)

      if (!promptFolderResult.success) {
        return {
          success: false,
          error: promptFolderResult.error ?? 'Failed to load prompt folders'
        }
      }

      const updatedFolders = promptFolderResult.folders ?? []

      return {
        success: true,
        data: buildWorkspaceData(workspaceId, workspacePath, updatedFolders),
        revision: nextRevision
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }
}
