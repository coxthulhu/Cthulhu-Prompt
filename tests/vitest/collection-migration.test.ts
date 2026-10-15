import { vol } from 'memfs'
import { beforeEach, describe, expect, it } from 'vitest'
import { setFs } from '../../src/main/fs-provider'
import { applyWorkspaceMigrations } from '../../src/main/Persistence/workspace/WorkspaceMigrations'
import { readPromptCollections } from '../../src/main/Persistence/workspace/WorkspaceReads'

const workspacePath = '/ws/collection-migration'
const workspaceInfoPath = `${workspacePath}/Migration.cthulhuprompt.json`

/** Historical metadata is explicit so current fixture renames cannot change the source schema. */
const createLegacyWorkspace = (
  kind: 'prompt' | 'template',
  collectionName: string
): Record<string, string | null> => {
  const rootPath = `${workspacePath}/${kind === 'prompt' ? 'Prompts' : 'Templates'}`
  const collectionPath = `${rootPath}/${collectionName}`
  return {
    [`${workspacePath}/Prompts`]: null,
    [`${workspacePath}/Templates`]: null,
    [workspaceInfoPath]: JSON.stringify({
      schemaVersion: 4,
      workspaceId: 'workspace',
      workspaceName: 'Migration'
    }),
    [`${rootPath}/FolderOrder.json`]: JSON.stringify({
      entries: [{ kind: 'folder', id: 'collection' }]
    }),
    [`${collectionPath}/_FolderInfo/FolderInfo.json`]: JSON.stringify({
      folderId: 'collection', displayName: collectionName, kind
    }),
    [`${collectionPath}/_FolderInfo/Description.md`]: 'Keep this description unchanged.\n',
    [`${collectionPath}/Active/_FolderInfo/FolderOrder.json`]: JSON.stringify({
      categories: [{ categoryId: null, entries: [] }]
    }),
    [`${collectionPath}/Archived/_FolderInfo`]: null
  }
}

beforeEach(() => {
  setFs(vol)
})

describe('collection metadata migration', () => {
  for (const kind of ['prompt', 'template'] as const) {
    for (const name of ['Tasks', '_FolderInfo', '_CollectionInfo']) {
      it(`preserves the ${kind} collection directory named ${name}`, () => {
        const rootPath = `${workspacePath}/${kind === 'prompt' ? 'Prompts' : 'Templates'}`
        const collectionPath = `${rootPath}/${name}`
        const legacy = createLegacyWorkspace(kind, name)
        vol.fromJSON(legacy)

        applyWorkspaceMigrations(workspaceInfoPath)

        expect(vol.existsSync(collectionPath)).toBe(true)
        expect(vol.existsSync(`${collectionPath}/_FolderInfo`)).toBe(false)
        expect(vol.existsSync(`${collectionPath}/Archived/_CollectionInfo`)).toBe(true)
        expect(vol.readFileSync(`${collectionPath}/_CollectionInfo/Description.md`, 'utf8'))
          .toBe(legacy[`${collectionPath}/_FolderInfo/Description.md`])
        expect(vol.readFileSync(`${collectionPath}/Active/_CollectionInfo/CategoryOrder.json`, 'utf8'))
          .toBe(legacy[`${collectionPath}/Active/_FolderInfo/FolderOrder.json`])
        expect(vol.existsSync(`${rootPath}/CollectionOrder.json`)).toBe(false)
        expect(readPromptCollections(workspacePath, kind)).toMatchObject([
          { id: 'collection', folderName: name, displayName: name, kind }
        ])
        expect(JSON.parse(vol.readFileSync(workspaceInfoPath, 'utf8') as string).schemaVersion).toBe(6)

        const migrated = vol.toJSON()
        applyWorkspaceMigrations(workspaceInfoPath)
        expect(vol.toJSON()).toEqual(migrated)
      })
    }
  }

  it('leaves metadata-like files outside known collection and status locations untouched', () => {
    const collectionPath = `${workspacePath}/Prompts/Tasks`
    const unrelatedFiles = {
      [`${workspacePath}/Prompts/Notes/Attachments/_FolderInfo/FolderInfo.json`]: '{ user data',
      [`${collectionPath}/Notes/_FolderInfo/FolderOrder.json`]: 'User ordering notes',
      [`${collectionPath}/Active/Attachments/_FolderInfo/FolderInfo.json`]: '{ attachment data',
      [`${collectionPath}/Active/_FolderInfo/FolderInfo.json`]: 'Not a collection identity',
      [`${collectionPath}/_FolderInfo/FolderOrder.json`]: 'Not a status order'
    }
    vol.fromJSON({ ...createLegacyWorkspace('prompt', 'Tasks'), ...unrelatedFiles })

    applyWorkspaceMigrations(workspaceInfoPath)

    for (const [filePath, contents] of Object.entries(unrelatedFiles)) {
      // Files inside owned metadata directories move with the directory but retain their names and bytes.
      const expectedPath = filePath
        .replace('/Tasks/Active/_FolderInfo/', '/Tasks/Active/_CollectionInfo/')
        .replace('/Tasks/_FolderInfo/', '/Tasks/_CollectionInfo/')
      expect(vol.readFileSync(expectedPath, 'utf8')).toBe(contents)
    }
  })
})
