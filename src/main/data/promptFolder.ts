import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import * as path from 'path'
import { getFs } from '../fs-provider'
import { revisions } from '../revisions'
import type {
  UpdatedCreatePromptFolderRequest,
  UpdatedCreatePromptFolderResult,
  UpdatedLoadPromptFolderByIdRequest,
  UpdatedLoadPromptFolderByIdResult,
  UpdatedLoadPromptFolderInitialRequest,
  UpdatedLoadPromptFolderInitialResult,
  UpdatedPromptData,
  UpdatedPromptFolderData,
  UpdatedWorkspaceData
} from '@shared/ipc/updatedTypes'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { createPromptFolderConfig } from './diskTypes'
import type { PromptFolderConfigFile, PromptFromFile } from './diskTypes'
import { getPromptFolderLocation, getWorkspacePath, registerPromptFolder } from './registry'
import { buildResponseData } from './updatedResponse'
import { runExclusiveUpdatedWorkspaceOperation } from './updatedFileOperations'
import { runUpdatedMutation } from './updatedMutations'
import {
  readPromptFolderConfig,
  readPromptFolderIds,
  readPromptFolderPrompts
} from './updatedWorkspaceReads'

const readPromptFolderData = (
  workspacePath: string,
  folderName: string,
  promptIds?: string[]
): UpdatedPromptFolderData => {
  const configPath = path.join(workspacePath, 'Prompts', folderName, 'PromptFolder.json')
  const parsed = readPromptFolderConfig(configPath)
  const resolvedPromptIds =
    promptIds ?? readPromptFolderPrompts(workspacePath, folderName).map((prompt) => prompt.id)

  return {
    folderName,
    displayName: parsed.foldername,
    promptCount: parsed.promptCount,
    promptIds: resolvedPromptIds,
    folderDescription: parsed.folderDescription
  }
}

export const buildPromptFolderData = (
  folderName: string,
  config: PromptFolderConfigFile,
  promptIds: string[]
): UpdatedPromptFolderData => ({
  folderName,
  displayName: config.foldername,
  promptCount: config.promptCount,
  promptIds,
  folderDescription: config.folderDescription
})

const toUpdatedPromptData = (prompt: PromptFromFile): UpdatedPromptData => {
  const { id: _id, ...data } = prompt
  return data
}

export const setupUpdatedPromptFolderHandlers = (): void => {
  ipcMain.handle(
    'updated-load-prompt-folder-by-id',
    async (
      _,
      request: UpdatedLoadPromptFolderByIdRequest
    ): Promise<UpdatedLoadPromptFolderByIdResult> => {
      const location = getPromptFolderLocation(request.id)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const data = readPromptFolderData(location.workspacePath, location.folderName)

        return {
          success: true,
          ...buildResponseData(request.id, data, revisions.promptFolder)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'updated-load-prompt-folder-initial',
    async (
      _,
      request: UpdatedLoadPromptFolderInitialRequest
    ): Promise<UpdatedLoadPromptFolderInitialResult> => {
      const location = getPromptFolderLocation(request.id)

      if (!location) {
        return { success: false, error: 'Prompt folder not registered' }
      }

      try {
        const prompts = readPromptFolderPrompts(location.workspacePath, location.folderName)
        const data = readPromptFolderData(
          location.workspacePath,
          location.folderName,
          prompts.map((prompt) => prompt.id)
        )

        return {
          success: true,
          promptFolder: buildResponseData(request.id, data, revisions.promptFolder),
          prompts: prompts.map((prompt) =>
            buildResponseData(prompt.id, toUpdatedPromptData(prompt), revisions.prompt)
          )
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'updated-create-prompt-folder',
    async (
      _,
      request: UpdatedCreatePromptFolderRequest
    ): Promise<UpdatedCreatePromptFolderResult> => {
      return await runUpdatedMutation(request, async (respond, mutationRequest) => {
        const { data, expectedRevision } = mutationRequest.payload
        const workspacePath = getWorkspacePath(data.workspaceId)

        if (!workspacePath) {
          return respond.error('Workspace not registered')
        }

        const { validation, displayName, folderName } = preparePromptFolderName(data.displayName)

        if (!validation.isValid) {
          return respond.error(validation.errorMessage ?? 'Invalid prompt folder name')
        }

        try {
          return await runExclusiveUpdatedWorkspaceOperation(workspacePath, async () => {
            const currentRevision = revisions.workspace.get(data.workspaceId)

            if (expectedRevision !== currentRevision) {
              const promptFolderIds = readPromptFolderIds(workspacePath)
              const workspace: UpdatedWorkspaceData = {
                workspacePath,
                promptFolderIds
              }

              return respond.conflict({
                workspace: buildResponseData(data.workspaceId, workspace, revisions.workspace)
              })
            }

            const fs = getFs()
            const promptsPath = path.join(workspacePath, 'Prompts')

            if (!fs.existsSync(promptsPath)) {
              return respond.error('Invalid workspace path')
            }

            const folderPath = path.join(promptsPath, folderName)

            if (fs.existsSync(folderPath)) {
              return respond.error('A folder with this name already exists')
            }

            fs.mkdirSync(folderPath, { recursive: true })

            const promptFolderId = randomUUID()
            const configPath = path.join(folderPath, 'PromptFolder.json')
            const configContent = JSON.stringify(
              createPromptFolderConfig(displayName, 0, promptFolderId),
              null,
              2
            )
            fs.writeFileSync(configPath, configContent, 'utf8')

            const promptsPathFile = path.join(folderPath, 'Prompts.json')
            const promptsContent = JSON.stringify(
              { metadata: { schemaVersion: 1 }, prompts: [] },
              null,
              2
            )
            fs.writeFileSync(promptsPathFile, promptsContent, 'utf8')

            registerPromptFolder(promptFolderId, workspacePath, folderName)
            revisions.promptFolder.setClientTempId(promptFolderId, data.clientTempId)

            const promptFolderData: UpdatedPromptFolderData = {
              folderName,
              displayName,
              promptCount: 0,
              promptIds: [],
              folderDescription: ''
            }

            const promptFolderResponse = buildResponseData(
              promptFolderId,
              promptFolderData,
              revisions.promptFolder
            )

            const promptFolderIds = readPromptFolderIds(workspacePath)
            const workspace: UpdatedWorkspaceData = {
              workspacePath,
              promptFolderIds
            }

            revisions.workspace.bump(data.workspaceId)

            return respond.success({
              workspace: buildResponseData(data.workspaceId, workspace, revisions.workspace),
              promptFolder: promptFolderResponse
            })
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return respond.error(message)
        }
      })
    }
  )

}
