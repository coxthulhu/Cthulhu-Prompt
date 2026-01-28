import { ipcMain } from 'electron'
import * as path from 'path'
import { randomUUID } from 'crypto'
import { getFs } from './fs-provider'
import { WorkspaceManager } from './workspace'
import { FileOperationQueue } from './file-operation-queue'
import type {
  LoadPromptsResult as SharedLoadPromptsResult,
  Prompt as SharedPrompt,
  PromptResult as SharedPromptResult,
  WorkspaceResult as SharedWorkspaceResult
} from '@shared/ipc'
import { createPromptFolderConfig, type PromptFolderConfig } from '@shared/promptFolderConfig'

export type Prompt = SharedPrompt
export type PromptResult = SharedPromptResult
export type LoadPromptsResult = SharedLoadPromptsResult
export type WorkspaceResult = SharedWorkspaceResult

// In-memory revisions for upcoming revisioned prompt stores.
const promptFolderRevisions = new Map<string, number>()
const promptRevisions = new Map<string, number>()

const getPromptFolderRevisionKey = (workspacePath: string, folderName: string): string => {
  return path.join(workspacePath, 'Prompts', folderName)
}

const getPromptRevisionKey = (
  workspacePath: string,
  folderName: string,
  promptId: string
): string => {
  return `${getPromptFolderRevisionKey(workspacePath, folderName)}::${promptId}`
}

const bumpRevision = (revisions: Map<string, number>, key: string): void => {
  const nextRevision = (revisions.get(key) ?? 0) + 1
  revisions.set(key, nextRevision)
}

export interface PromptsFileMetadata {
  schemaVersion: number
}

export interface PromptsFile {
  metadata: PromptsFileMetadata
  prompts: Prompt[]
}

export interface CreatePromptRequest {
  workspacePath: string
  folderName: string
  title: string
  promptText: string
  previousPromptId?: string | null
}

export interface UpdatePromptRequest {
  workspacePath: string
  folderName: string
  id: string
  title: string
  promptText: string
}

export interface DeletePromptRequest {
  workspacePath: string
  folderName: string
  id: string
}

export interface ReorderPromptRequest {
  workspacePath: string
  folderName: string
  promptId: string
  previousPromptId: string | null
}

export interface LoadPromptsRequest {
  workspacePath: string
  folderName: string
}

export interface UpdatePromptFolderDescriptionRequest {
  workspacePath: string
  folderName: string
  folderDescription: string
}

export class PromptAPI {
  private static readonly fileQueue = new FileOperationQueue()

  private static runExclusiveFileOperation<T>(
    filePath: string,
    task: () => Promise<T>
  ): Promise<T> {
    return this.fileQueue.run(filePath, task)
  }

  static setupIpcHandlers(): void {
    ipcMain.handle('create-prompt', async (_, request: CreatePromptRequest) => {
      return await this.createPrompt(request)
    })

    ipcMain.handle('update-prompt', async (_, request: UpdatePromptRequest) => {
      return await this.updatePrompt(request)
    })

    ipcMain.handle('delete-prompt', async (_, request: DeletePromptRequest) => {
      return await this.deletePrompt(request)
    })

    ipcMain.handle('reorder-prompt', async (_, request: ReorderPromptRequest) => {
      return await this.reorderPrompt(request)
    })

    ipcMain.handle('load-prompts', async (_, request: LoadPromptsRequest) => {
      return await this.loadPrompts(request)
    })

    ipcMain.handle(
      'update-prompt-folder-description',
      async (_, request: UpdatePromptFolderDescriptionRequest) => {
        return await this.updatePromptFolderDescription(request)
      }
    )
  }

  private static getPromptsFilePath(workspacePath: string, folderName: string): string {
    return path.join(workspacePath, 'Prompts', folderName, 'Prompts.json')
  }

  private static getPromptFolderConfigPath(workspacePath: string, folderName: string): string {
    return path.join(workspacePath, 'Prompts', folderName, 'PromptFolder.json')
  }

  private static async readPromptsFile(filePath: string): Promise<PromptsFile> {
    const fs = getFs()
    if (!fs.existsSync(filePath)) {
      const emptyFile: PromptsFile = {
        metadata: { schemaVersion: 1 },
        prompts: []
      }
      fs.writeFileSync(filePath, JSON.stringify(emptyFile, null, 2), 'utf8')
      return emptyFile
    }

    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content) as PromptsFile
  }

  private static async writePromptsFile(filePath: string, data: PromptsFile): Promise<void> {
    const fs = getFs()
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  private static readPromptFolderConfig(
    filePath: string,
    fallbackName: string
  ): PromptFolderConfig {
    const fs = getFs()
    if (!fs.existsSync(filePath)) {
      const config = createPromptFolderConfig(fallbackName, 0, randomUUID())
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8')
      return config
    }

    const content = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(content) as PromptFolderConfig
  }

  private static writePromptFolderConfig(filePath: string, data: PromptFolderConfig): void {
    const fs = getFs()
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
  }

  static async createPrompt(request: CreatePromptRequest): Promise<PromptResult> {
    if (!WorkspaceManager.validateWorkspace(request.workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const filePath = this.getPromptsFilePath(request.workspacePath, request.folderName)
    const configPath = this.getPromptFolderConfigPath(request.workspacePath, request.folderName)

    try {
      return await this.runExclusiveFileOperation(filePath, async () => {
        const promptsFile = await this.readPromptsFile(filePath)
        const folderConfig = this.readPromptFolderConfig(configPath, request.folderName)
        const nextPromptCount = folderConfig.promptCount + 1

        const now = new Date().toISOString()
        const newPrompt: Prompt = {
          id: randomUUID(),
          title: request.title,
          creationDate: now,
          lastModifiedDate: now,
          promptText: request.promptText,
          promptFolderCount: nextPromptCount
        }

        let insertIndex = promptsFile.prompts.length

        if (request.previousPromptId !== undefined) {
          if (request.previousPromptId === null) {
            insertIndex = 0
          } else {
            const previousIndex = promptsFile.prompts.findIndex(
              (prompt) => prompt.id === request.previousPromptId
            )
            if (previousIndex === -1) {
              return { success: false, error: 'Previous prompt not found' }
            }
            insertIndex = previousIndex + 1
          }
        }

        promptsFile.prompts.splice(insertIndex, 0, newPrompt)
        await this.writePromptsFile(filePath, promptsFile)
        folderConfig.promptCount = nextPromptCount
        this.writePromptFolderConfig(configPath, folderConfig)
        bumpRevision(
          promptRevisions,
          getPromptRevisionKey(request.workspacePath, request.folderName, newPrompt.id)
        )
        bumpRevision(
          promptFolderRevisions,
          getPromptFolderRevisionKey(request.workspacePath, request.folderName)
        )

        return { success: true, prompt: newPrompt }
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async updatePrompt(request: UpdatePromptRequest): Promise<PromptResult> {
    if (!WorkspaceManager.validateWorkspace(request.workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const filePath = this.getPromptsFilePath(request.workspacePath, request.folderName)

    try {
      return await this.runExclusiveFileOperation(filePath, async () => {
        const promptsFile = await this.readPromptsFile(filePath)

        const promptIndex = promptsFile.prompts.findIndex((p) => p.id === request.id)
        if (promptIndex === -1) {
          return { success: false, error: 'Prompt not found' }
        }

        const updatedPrompt: Prompt = {
          ...promptsFile.prompts[promptIndex],
          title: request.title,
          promptText: request.promptText,
          lastModifiedDate: new Date().toISOString()
        }

        promptsFile.prompts[promptIndex] = updatedPrompt
        await this.writePromptsFile(filePath, promptsFile)
        bumpRevision(
          promptRevisions,
          getPromptRevisionKey(request.workspacePath, request.folderName, request.id)
        )

        return { success: true, prompt: updatedPrompt }
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async deletePrompt(request: DeletePromptRequest): Promise<WorkspaceResult> {
    if (!WorkspaceManager.validateWorkspace(request.workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const filePath = this.getPromptsFilePath(request.workspacePath, request.folderName)

    try {
      return await this.runExclusiveFileOperation(filePath, async () => {
        const promptsFile = await this.readPromptsFile(filePath)

        const promptIndex = promptsFile.prompts.findIndex((p) => p.id === request.id)
        if (promptIndex === -1) {
          return { success: false, error: 'Prompt not found' }
        }

        promptsFile.prompts.splice(promptIndex, 1)
        await this.writePromptsFile(filePath, promptsFile)
        promptRevisions.delete(
          getPromptRevisionKey(request.workspacePath, request.folderName, request.id)
        )
        bumpRevision(
          promptFolderRevisions,
          getPromptFolderRevisionKey(request.workspacePath, request.folderName)
        )

        return { success: true }
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async reorderPrompt(request: ReorderPromptRequest): Promise<WorkspaceResult> {
    if (!WorkspaceManager.validateWorkspace(request.workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const filePath = this.getPromptsFilePath(request.workspacePath, request.folderName)

    try {
      return await this.runExclusiveFileOperation(filePath, async () => {
        const promptsFile = await this.readPromptsFile(filePath)

        const promptIndex = promptsFile.prompts.findIndex((p) => p.id === request.promptId)
        if (promptIndex === -1) {
          return { success: false, error: 'Prompt not found' }
        }

        const [prompt] = promptsFile.prompts.splice(promptIndex, 1)
        let insertIndex = 0

        if (request.previousPromptId != null) {
          const previousIndex = promptsFile.prompts.findIndex(
            (p) => p.id === request.previousPromptId
          )
          if (previousIndex === -1) {
            return { success: false, error: 'Previous prompt not found' }
          }
          insertIndex = previousIndex + 1
        }

        promptsFile.prompts.splice(insertIndex, 0, prompt)
        await this.writePromptsFile(filePath, promptsFile)
        bumpRevision(
          promptFolderRevisions,
          getPromptFolderRevisionKey(request.workspacePath, request.folderName)
        )

        return { success: true }
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async loadPrompts(request: LoadPromptsRequest): Promise<LoadPromptsResult> {
    if (!WorkspaceManager.validateWorkspace(request.workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const filePath = this.getPromptsFilePath(request.workspacePath, request.folderName)
    const configPath = this.getPromptFolderConfigPath(request.workspacePath, request.folderName)

    try {
      return await this.runExclusiveFileOperation(filePath, async () => {
        const promptsFile = await this.readPromptsFile(filePath)
        const folderConfig = this.readPromptFolderConfig(configPath, request.folderName)
        let maxExistingCount = 0

        for (const prompt of promptsFile.prompts) {
          if (typeof prompt.promptFolderCount === 'number' && prompt.promptFolderCount > 0) {
            maxExistingCount = Math.max(maxExistingCount, prompt.promptFolderCount)
          }
        }

        let nextCount = Math.max(folderConfig.promptCount, maxExistingCount)
        let didUpdatePrompts = false
        const nextPrompts = promptsFile.prompts.map((prompt) => {
          if (typeof prompt.promptFolderCount === 'number' && prompt.promptFolderCount > 0) {
            return prompt
          }

          nextCount += 1
          didUpdatePrompts = true
          return { ...prompt, promptFolderCount: nextCount }
        })

        const nextPromptCount = Math.max(folderConfig.promptCount, nextCount)
        if (didUpdatePrompts) {
          promptsFile.prompts = nextPrompts
          await this.writePromptsFile(filePath, promptsFile)
        }

        if (nextPromptCount !== folderConfig.promptCount) {
          folderConfig.promptCount = nextPromptCount
          this.writePromptFolderConfig(configPath, folderConfig)
        }

        return {
          success: true,
          prompts: didUpdatePrompts ? nextPrompts : promptsFile.prompts,
          folderDescription: folderConfig.folderDescription
        }
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static async updatePromptFolderDescription(
    request: UpdatePromptFolderDescriptionRequest
  ): Promise<WorkspaceResult> {
    if (!WorkspaceManager.validateWorkspace(request.workspacePath)) {
      return { success: false, error: 'Invalid workspace path' }
    }

    const configPath = this.getPromptFolderConfigPath(request.workspacePath, request.folderName)

    try {
      return await this.runExclusiveFileOperation(configPath, async () => {
        const folderConfig = this.readPromptFolderConfig(configPath, request.folderName)
        folderConfig.folderDescription = request.folderDescription
        this.writePromptFolderConfig(configPath, folderConfig)
        bumpRevision(
          promptFolderRevisions,
          getPromptFolderRevisionKey(request.workspacePath, request.folderName)
        )
        return { success: true }
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  static createInitialPromptsFile(folderPath: string): void {
    const fs = getFs()
    const promptsFilePath = path.join(folderPath, 'Prompts.json')
    const promptsFile: PromptsFile = {
      metadata: { schemaVersion: 1 },
      prompts: []
    }
    const promptsContent = JSON.stringify(promptsFile, null, 2)
    fs.writeFileSync(promptsFilePath, promptsContent, 'utf8')
  }
}
