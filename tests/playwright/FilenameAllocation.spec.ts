import type { Page } from '@playwright/test'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { createWorkspaceWithFolders, createWorkspaceWithTemplateFolders, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import { PromptStatus } from '@shared/domain/prompt/Prompt'
import { PromptTemplateStatus } from '@shared/domain/prompt-template/PromptTemplate'

/** Electron integration tests exercise the real allocator and workspace migration. */
const { test, describe, expect } = createPlaywrightTestSuite()
/** Shared fixture root; each test has an isolated Electron filesystem. */
const WORKSPACE_PATH = '/ws/filename-allocation'
/** Explicit workspace identity makes mutation requests independent of fixture hashing. */
const WORKSPACE_ID = 'filename-workspace'
/** Root identity shared by each isolated prompt or template scenario. */
const ROOT_ID = 'filename-root'

/** Invokes production IPC using the same request envelope as renderer mutations. */
const invoke = async (page: Page, channel: string, payload: object) =>
  page.evaluate(async ({ channel, payload }) => window.electron.ipcRenderer.invoke(channel, {
    requestId: `filename-${channel}-${Date.now()}`,
    clientId: window.ipcClientId,
    payload
  }), { channel, payload })

/** Loads current revisions and full metadata after each committed mutation. */
const loadRoot = (page: Page) => invoke(page, 'load-prompt-folder-initial', {
  workspaceId: WORKSPACE_ID, promptFolderId: ROOT_ID
})

describe('Filename allocation', () => {
  for (const kind of ['prompt', 'template'] as const) {
    test(`allocates ${kind} status moves against complete disk filenames and preserves IDs`, async ({ testSetup, electronApp }) => {
      /** IDs deliberately share the entire prefix previously used for filename suffixes. */
      const ids = ['abcdef12-first', 'abcdef12-second', 'abcdef12-third']
      /** Source records have the same title, including a naturally numbered title. */
      const titles = ['New Prompt', 'New Prompt', 'New Prompt 1']
      /** Typed root namespace used by both fixture creation and disk assertions. */
      const namespace = kind === 'prompt' ? 'Prompts' : 'Templates'
      /** Type-specific extension checked in full, including case. */
      const suffix = kind === 'prompt' ? '.prompt.md' : '.template.md'
      /** Final status directory forces every moved record to allocate a new filename. */
      const statusDirectory = kind === 'prompt' ? 'Completed' : 'Archived'
      /** Fixture starts at the latest schema so unrelated uppercase-extension files stay untouched. */
      const filesystem = kind === 'prompt'
        ? createWorkspaceWithFolders(WORKSPACE_PATH, [{ folderName: 'Root', displayName: 'Root', promptFolderId: ROOT_ID,
            prompts: ids.map((id, index) => ({ id, title: titles[index], promptText: `Body ${id}` }))
          }], { settings: { schemaVersion: 4, workspaceId: WORKSPACE_ID } })
        : createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [{ folderName: 'Root', displayName: 'Root', folderId: ROOT_ID,
            templates: ids.map((id, index) => ({ id, title: titles[index], templateText: `Body ${id}` }))
          }])
      filesystem[getWorkspaceInfoPath(WORKSPACE_PATH)] = JSON.stringify({
        schemaVersion: 4, workspaceId: WORKSPACE_ID, workspaceName: 'Filename Allocation'
      })
      /** Destination directory contains unparsed files that must still reserve complete names. */
      const destination = `${WORKSPACE_PATH}/${namespace}/Root/${statusDirectory}`
      filesystem[`${destination}/NEW PROMPT${suffix.toUpperCase()}`] = 'Unrelated base file'
      filesystem[`${destination}/NEW PROMPT 1${suffix.toUpperCase()}`] = 'Unrelated numbered file'
      filesystem[`${destination}/NEW PROMPT 2${suffix.toUpperCase()}/marker.txt`] = 'Directory must survive'
      await testSetup.setupFilesystem(filesystem)
      await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
      /** Real app opens the workspace before mutations use its authoritative graph. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
      await testHelpers.setupWorkspaceViaUI()
      for (const id of ids) {
        /** Fresh revisions ensure each move passes normal concurrency validation. */
        const loaded = await loadRoot(mainWindow)
        /** Current record being moved from Active to its final-status directory. */
        const content = (kind === 'prompt' ? loaded.prompts : loaded.promptTemplates).find((entry: { id: string }) => entry.id === id)
        /** The folder and record are the complete authoritative targets for this status move. */
        const result = await invoke(mainWindow, 'set-prompt-location', {
          command: { kind, sourcePromptFolderId: ROOT_ID, promptId: id,
            location: { promptFolderId: ROOT_ID, categoryId: null, previousEntryId: null,
              status: kind === 'prompt' ? PromptStatus.Completed : PromptTemplateStatus.Archived },
            modifiedAt: '2026-10-08T12:00:00Z' },
          expectations: [
            { entityType: 'promptFolder', id: ROOT_ID, expected: 'revision', revision: loaded.promptFolders[0].revision },
            { entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate', id, expected: 'revision', revision: content.revision }
          ]
        })
        expect(result.success).toBe(true)
      }
      /** Allocations skip uppercase complete-name collisions and retain naturally numbered titles. */
      const stems = ['New Prompt 3', 'New Prompt 4', 'New Prompt 1 1']
      for (const [index, id] of ids.entries()) {
        /** Persisted source proves both full identity and content survived the move. */
        const text = await readTextFile(electronApp, `${destination}/${stems[index]}${suffix}`)
        expect(text).toContain(`id: ${id}`)
        expect(text).toContain(`Body ${id}`)
        expect(text).toContain(`title: ${titles[index]}`)
      }
      expect(await readTextFile(electronApp, `${destination}/NEW PROMPT${suffix.toUpperCase()}`)).toBe('Unrelated base file')
      expect(await readTextFile(electronApp, `${destination}/NEW PROMPT 1${suffix.toUpperCase()}`)).toBe('Unrelated numbered file')
      expect(await readTextFile(electronApp, `${destination}/NEW PROMPT 2${suffix.toUpperCase()}/marker.txt`)).toBe('Directory must survive')
      // Restore one record to prove allocation runs again in the destination directory.
      /** Current final-status record and folder revisions used by restoration. */
      const loaded = await loadRoot(mainWindow)
      /** First moved record whose original Active filename is available again. */
      const content = (kind === 'prompt' ? loaded.prompts : loaded.promptTemplates).find((entry: { id: string }) => entry.id === ids[0])
      /** Restoration crosses the same storage boundary in the opposite direction. */
      const restored = await invoke(mainWindow, 'set-prompt-location', {
        command: { kind, sourcePromptFolderId: ROOT_ID, promptId: ids[0],
          location: { promptFolderId: ROOT_ID, categoryId: null, previousEntryId: null,
            status: kind === 'prompt' ? PromptStatus.Todo : PromptTemplateStatus.Active },
          modifiedAt: '2026-10-08T12:01:00Z' },
        expectations: [
          { entityType: 'promptFolder', id: ROOT_ID, expected: 'revision', revision: loaded.promptFolders[0].revision },
          { entityType: kind === 'prompt' ? 'prompt' : 'promptTemplate', id: ids[0], expected: 'revision', revision: content.revision }
        ]
      })
      expect(restored.success).toBe(true)
      expect(await readTextFile(electronApp, `${WORKSPACE_PATH}/${namespace}/Root/Active/New Prompt${suffix}`)).toContain(`id: ${ids[0]}`)
      expect(await checkFileExists(electronApp, `${destination}/New Prompt 3${suffix}`)).toBe(false)
      expect(await readTextFile(electronApp, `${destination}/New Prompt 4${suffix}`)).toContain(`id: ${ids[1]}`)
    })
  }

  test('reserves category filenames across one batch and does not reuse another category source path', async ({ testSetup, electronApp }) => {
    await testSetup.setupFilesystem(createWorkspaceWithFolders(WORKSPACE_PATH, [{ folderName: 'Root', displayName: 'Root', promptFolderId: ROOT_ID }], {
      settings: { schemaVersion: 4, workspaceId: WORKSPACE_ID }
    }))
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Real category management command writes all retained drafts in one transaction. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    /** Distinct display names collapse onto the same sanitized filename base. */
    const categories = ['Same?', 'same*', 'Same 1'].map((displayName, index) => ({
      id: `abcdef12-category-${index}`, displayName, shortDescription: null, description: `Category ${index}`
    }))
    /** Initial folder revision required when inserting new categories. */
    const loaded = await loadRoot(mainWindow)
    /** Batch response must succeed without collisions among pending writes. */
    const created = await invoke(mainWindow, 'save-categories', {
      command: { workspaceId: WORKSPACE_ID, promptFolderId: ROOT_ID, categories, modifiedAt: '2026-10-08T12:00:00Z' },
      expectations: [
        { entityType: 'promptFolder', id: ROOT_ID, expected: 'revision', revision: loaded.promptFolders[0].revision },
        ...categories.map(({ id }) => ({ entityType: 'category', id, expected: 'absent' }))
      ]
    })
    expect(created.success).toBe(true)
    /** Root category directory uses a separate complete-filename namespace. */
    const directory = `${WORKSPACE_PATH}/Prompts/Root/Categories`
    for (const [index, stem] of ['Same', 'same 1', 'Same 1 1'].entries()) {
      expect(JSON.parse(await readTextFile(electronApp, `${directory}/${stem}.category.json`))).toEqual(categories[index])
    }
    /** Changed names swap sanitized bases; existing paths stay reserved through the commit. */
    const renamed = [
      { ...categories[0], displayName: 'Same 1?' },
      { ...categories[1], displayName: 'Same/' },
      categories[2]
    ]
    /** Current category revisions used by the batch rename. */
    const current = await loadRoot(mainWindow)
    /** Only changed categories participate in this mutation's expected target set. */
    const result = await invoke(mainWindow, 'save-categories', {
      command: { workspaceId: WORKSPACE_ID, promptFolderId: ROOT_ID, categories: renamed, modifiedAt: '2026-10-08T12:01:00Z' },
      expectations: categories.slice(0, 2).map(({ id }) => ({ entityType: 'category', id, expected: 'revision',
        revision: current.categories.find((entry: { id: string }) => entry.id === id).revision }))
    })
    expect(result.success).toBe(true)
    expect(JSON.parse(await readTextFile(electronApp, `${directory}/Same 1 2.category.json`))).toEqual(renamed[0])
    expect(JSON.parse(await readTextFile(electronApp, `${directory}/Same 1.category.json`))).toEqual(renamed[1])
    expect(JSON.parse(await readTextFile(electronApp, `${directory}/Same 1 1.category.json`))).toEqual(renamed[2])
    expect(await checkFileExists(electronApp, `${directory}/Same.category.json`)).toBe(false)
  })

  test('migrates legacy names without changing bytes or modification times and stays stable on reopen', async ({ testSetup, electronApp }) => {
    /** Existing prompt records provide parseable full IDs with deliberately matching short prefixes. */
    const filesystem = createWorkspaceWithFolders(WORKSPACE_PATH, [{ folderName: 'Root', displayName: 'Root', promptFolderId: ROOT_ID,
      prompts: [
        { id: 'abcdef12-first', title: 'New Prompt', promptText: 'First body' },
        { id: 'abcdef12-second', title: 'New Prompt', promptText: 'Second body' },
        { id: 'abcdef12-numbered', title: 'New Prompt 1', promptText: 'Numbered body' }
      ]
    }], { settings: { schemaVersion: 3, workspaceId: WORKSPACE_ID } })
    /** Directory used to replace current fixture names with legacy collision-prone names. */
    const directory = `${WORKSPACE_PATH}/Prompts/Root/Active`
    /** Original sources retained for byte-for-byte assertions after migration. */
    const originals = ['New Prompt', 'New Prompt 1', 'New Prompt 1 1'].map((stem) => filesystem[`${directory}/${stem}.prompt.md`]!)
    for (const stem of ['New Prompt', 'New Prompt 1', 'New Prompt 1 1']) delete filesystem[`${directory}/${stem}.prompt.md`]
    filesystem[`${directory}/a-abcdef12.prompt.md`] = originals[0]
    filesystem[`${directory}/b-abcdef12.prompt.md`] = originals[1]
    filesystem[`${directory}/c-abcdef12.prompt.md`] = originals[2]
    /** Unreferenced nested template and category are included by the recursive migration scan. */
    const orphanDirectory = `${WORKSPACE_PATH}/Templates/Orphan/Nested`
    /** Template bytes include noncanonical spacing that migration must preserve. */
    const template = '---\nid: abcdef12-template\ncreatedAt: "2026-01-01T00:00:00Z"\ntitle: Legacy Template\n---\nKeep template bytes.\n'
    /** Category bytes deliberately use compact JSON to detect reserialization. */
    const category = '{"id":"abcdef12-category","displayName":"Legacy Category","shortDescription":null,"description":"Keep category bytes."}'
    filesystem[`${orphanDirectory}/old.template.md`] = template
    filesystem[`${orphanDirectory}/old.category.json`] = category
    /** Opposite title/path pairs require staging both sources before either destination is written. */
    const alphaTemplate = template.replace('abcdef12-template', 'abcdef12-alpha').replace('Legacy Template', 'Alpha')
    /** Second half of the filename swap must retain its distinct identity and source bytes. */
    const betaTemplate = template.replace('abcdef12-template', 'abcdef12-beta').replace('Legacy Template', 'Beta')
    filesystem[`${orphanDirectory}/Beta.template.md`] = alphaTemplate
    filesystem[`${orphanDirectory}/Alpha.template.md`] = betaTemplate
    /** Fixed historical mtime must remain the prompt's loaded modifiedAt value. */
    const modifiedAt = '2024-03-02T01:02:03.000Z'
    await testSetup.setupFilesystem(filesystem, { fileModifiedTimes: {
      [`${directory}/a-abcdef12.prompt.md`]: modifiedAt,
      [`${directory}/b-abcdef12.prompt.md`]: modifiedAt,
      [`${directory}/c-abcdef12.prompt.md`]: modifiedAt
    } })
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Workspace open runs the migration before loading entity paths. */
    const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await testHelpers.setupWorkspaceViaUI()
    for (const [index, stem] of ['New Prompt', 'New Prompt 1', 'New Prompt 1 1'].entries()) {
      expect(await readTextFile(electronApp, `${directory}/${stem}.prompt.md`)).toBe(originals[index])
    }
    expect(await checkFileExists(electronApp, `${directory}/a-abcdef12.prompt.md`)).toBe(false)
    expect(await readTextFile(electronApp, `${orphanDirectory}/Legacy Template.template.md`)).toBe(template)
    expect(await readTextFile(electronApp, `${orphanDirectory}/Legacy Category.category.json`)).toBe(category)
    expect(await readTextFile(electronApp, `${orphanDirectory}/Alpha.template.md`)).toBe(alphaTemplate)
    expect(await readTextFile(electronApp, `${orphanDirectory}/Beta.template.md`)).toBe(betaTemplate)
    expect(JSON.parse(await readTextFile(electronApp, getWorkspaceInfoPath(WORKSPACE_PATH))).schemaVersion).toBe(4)
    /** Loaded prompt timestamps verify rename-only migration preserved historical mtimes. */
    const loaded = await loadRoot(mainWindow)
    expect(loaded.prompts.map((entry: { data: { modifiedAt: string } }) => entry.data.modifiedAt)).toEqual([modifiedAt, modifiedAt, modifiedAt])
    await testHelpers.clearWorkspaceViaUI()
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    await testHelpers.setupWorkspaceViaUI()
    for (const [index, stem] of ['New Prompt', 'New Prompt 1', 'New Prompt 1 1'].entries()) {
      expect(await readTextFile(electronApp, `${directory}/${stem}.prompt.md`)).toBe(originals[index])
    }
  })

  test('leaves schema three and legacy files intact when migration finds malformed content', async ({ testSetup, electronApp }) => {
    /** Valid record precedes malformed recursive content in the migration scan. */
    const filesystem = createWorkspaceWithFolders(WORKSPACE_PATH, [{
      folderName: 'Root', displayName: 'Root', promptFolderId: ROOT_ID,
      prompts: [{ id: 'abcdef12-valid', title: 'Valid', promptText: 'Preserve valid source' }]
    }], { settings: { schemaVersion: 3, workspaceId: WORKSPACE_ID } })
    /** Legacy path must remain unchanged when validation prevents migration. */
    const legacyPath = `${WORKSPACE_PATH}/Prompts/Root/Active/old-abcdef12.prompt.md`
    /** Original content retained for exact comparison after the failed open. */
    const original = filesystem[`${WORKSPACE_PATH}/Prompts/Root/Active/Valid.prompt.md`]!
    filesystem[legacyPath] = original
    delete filesystem[`${WORKSPACE_PATH}/Prompts/Root/Active/Valid.prompt.md`]
    filesystem[`${WORKSPACE_PATH}/Templates/Orphan/Broken.category.json`] = '{ malformed'
    await testSetup.setupFilesystem(filesystem)
    await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
    /** Workspace error is observed through the normal open dialog. */
    const { mainWindow } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
    await mainWindow.getByTestId('open-workspace-button').click()
    await expect(mainWindow.getByRole('dialog', { name: 'Failed to Open Workspace' })).toBeVisible()
    expect(JSON.parse(await readTextFile(electronApp, getWorkspaceInfoPath(WORKSPACE_PATH))).schemaVersion).toBe(3)
    expect(await readTextFile(electronApp, legacyPath)).toBe(original)
    expect(await checkFileExists(electronApp, `${WORKSPACE_PATH}/Prompts/Root/Active/Valid.prompt.md`)).toBe(false)
  })
})
