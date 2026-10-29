import { vol } from 'memfs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setFs } from '../../src/main/fs-provider'
import { migrateLegacyWorkspaceInfoPath } from '../../src/main/Persistence/PromptPersistencePaths'
import { loadWorkspaceByPath } from '../../src/main/Workspace/WorkspaceLoader'
import {
  createWorkspaceWithTemplateCollections,
  getWorkspaceInfoPath
} from '../fixtures/WorkspaceFixtures'

// This loader test isolates the info-file rename; Playwright covers actual SQLite persistence.
vi.mock('../../src/main/Persistence/sqlite/SqliteDataAccess', () => ({
  SqliteDataAccess: { runTransaction: <T>(commands: () => T): T => commands() }
}))

vi.mock('../../src/main/Persistence/sqlite/WorkspaceStateDataAccess', () => ({
  WorkspaceStateDataAccess: {
    read: vi.fn(() => null),
    write: vi.fn(),
    listEntityIds: vi.fn(() => [])
  }
}))

vi.mock('../../src/main/Persistence/sqlite/WorkspaceUiStateDataAccess', () => ({
  WorkspaceUiStateDataAccess: {
    cleanupWorkspacePromptCollectionUiState: vi.fn()
  }
}))

vi.mock('../../src/main/Persistence/sqlite/MarkdownContentUiStateDataAccess', () => ({
  MarkdownContentUiStateDataAccess: {
    cleanupWorkspaceMarkdownContentUiState: vi.fn(),
    readMarkdownContentUiState: vi.fn(() => null),
    readMarkdownContentUiStates: vi.fn(() => [])
  }
}))

const workspacePath = '/ws/legacy-info'
const currentInfoPath = '/ws/legacy-info/Legacy.cthulhuprompt'
const legacyInfoPath = '/ws/legacy-info/Legacy.cthulhuprompt.json'

beforeEach(() => {
  vol.reset()
  setFs(vol)
})

describe('legacy workspace info rename', () => {
  it('renames a legacy info file to the current suffix', () => {
    vol.fromJSON({ [legacyInfoPath]: '{"current":false}' })

    expect(migrateLegacyWorkspaceInfoPath(legacyInfoPath)).toBe(currentInfoPath)
    expect(vol.existsSync(legacyInfoPath)).toBe(false)
    expect(vol.readFileSync(currentInfoPath, 'utf8')).toBe('{"current":false}')
  })

  it('keeps both files and uses the current one when both exist', () => {
    vol.fromJSON({
      [legacyInfoPath]: '{"current":false}',
      [currentInfoPath]: '{"current":true}'
    })

    expect(migrateLegacyWorkspaceInfoPath(legacyInfoPath)).toBe(currentInfoPath)
    expect(vol.readFileSync(legacyInfoPath, 'utf8')).toBe('{"current":false}')
    expect(vol.readFileSync(currentInfoPath, 'utf8')).toBe('{"current":true}')
  })

  it('resolves an already-renamed legacy path to the current file', () => {
    vol.fromJSON({ [currentInfoPath]: '{"current":true}' })

    expect(migrateLegacyWorkspaceInfoPath(legacyInfoPath)).toBe(currentInfoPath)
    expect(vol.existsSync(legacyInfoPath)).toBe(false)
  })

  it('leaves current paths unchanged', () => {
    vol.fromJSON({ [currentInfoPath]: '{"current":true}' })

    expect(migrateLegacyWorkspaceInfoPath(currentInfoPath)).toBe(currentInfoPath)
    expect(vol.existsSync(currentInfoPath)).toBe(true)
  })

  it('loads a workspace through its legacy info path and reports the renamed path', async () => {
    /** Fixture workspace whose info file is moved back to the legacy suffix. */
    const structure = createWorkspaceWithTemplateCollections(workspacePath, [])
    const fixtureInfoPath = getWorkspaceInfoPath(workspacePath)
    const legacyFixtureInfoPath = `${fixtureInfoPath}.json`
    structure[legacyFixtureInfoPath] = structure[fixtureInfoPath]
    delete structure[fixtureInfoPath]
    vol.fromJSON(structure)

    const result = await loadWorkspaceByPath(legacyFixtureInfoPath)
    if (!result.success) throw new Error(result.error)

    expect(result.workspaceInfoPath).toBe(fixtureInfoPath)
    expect(vol.existsSync(fixtureInfoPath)).toBe(true)
    expect(vol.existsSync(legacyFixtureInfoPath)).toBe(false)
  })
})
