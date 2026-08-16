import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import {
  createWorkspaceWithFolders,
  createWorkspaceWithTemplateFolders,
  getWorkspaceInfoPath,
  setupWorkspaceScenario
} from '../fixtures/WorkspaceFixtures'
import { promptEditorSelector } from '../helpers/PromptFolderSelectors'
import { checkFileExists, readTextFile } from '../helpers/PromptPersistenceTestHelpers'
import {
  parsePromptMarkdown,
  serializePromptMarkdown
} from '../../src/main/Persistence/PromptFrontmatter'
import {
  beginPromptFolderHandleDrag,
  beginPromptHandleDrag,
  finishActiveDrag,
  moveActiveDragToTarget,
  promptFolderSelectorDropdownItemSelector,
  promptFolderSelectorTriggerSelector
} from '../helpers/PromptDragDropHelpers'

// The repository Playwright wrapper supplies the configured test primitives.
const { test, describe, expect } = createPlaywrightTestSuite()

// Stable workspace path shared by the category feature scenarios.
const WORKSPACE_PATH = '/ws/prompt-categories'
// Stable category IDs make frontmatter and category file ownership explicit.
const PROMPT_CATEGORY_ID = '11111111111111111111111111111111'
const TEMPLATE_CATEGORY_ID = '22222222222222222222222222222222'
// Stable pre-existing category ID used to verify index-1 insertion.
const EXISTING_CATEGORY_ID = '33333333333333333333333333333333'
// Stable root IDs are used as prompt-folder selector drag targets.
const PROMPT_ROOT_ID = 'prompt-category-root'
const TEMPLATE_ROOT_ID = 'template-category-root'
// Selector toggles the prompt root between active and completed modes.
const TOGGLE_COMPLETED_BUTTON = '[data-testid="toggle-completed-prompts-button"]'

/** Reads the full persisted category order so tests retain ownership information. */
const readCategoryOrder = async (
  electronApp: any,
  orderPath: string
): Promise<{
  categories: Array<{
    categoryId: string | null
    entries: Array<{ kind: 'prompt' | 'template'; id: string }>
  }>
}> => JSON.parse(await readTextFile(electronApp, orderPath))

/** Creates a workspace containing categorized prompts and templates. */
const createCategorizedWorkspace = (): Record<string, string | null> => ({
  ...createWorkspaceWithFolders(WORKSPACE_PATH, [
    {
      folderName: 'Prompts',
      displayName: 'Prompts',
      promptFolderId: PROMPT_ROOT_ID,
      prompts: [
        {
          id: 'categorized-prompt',
          title: 'Categorized Prompt',
          promptText: 'Categorized prompt text.',
          category: PROMPT_CATEGORY_ID
        },
        {
          id: 'uncategorized-prompt',
          title: 'Uncategorized Prompt',
          promptText: 'Uncategorized prompt text.'
        },
        {
          id: 'unknown-category-prompt',
          title: 'Unknown Category Prompt',
          promptText: 'Unknown category prompt text.',
          category: 'ffffffffffffffffffffffffffffffff'
        }
      ]
    }
  ]),
  ...createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [
    {
      folderName: 'Templates',
      displayName: 'Templates',
      folderId: TEMPLATE_ROOT_ID,
      templates: [
        {
          id: 'categorized-template',
          title: 'Categorized Template',
          templateText: 'Categorized template text.',
          category: TEMPLATE_CATEGORY_ID
        }
      ]
    }
  ]),
  [`${WORKSPACE_PATH}/Prompts/Prompts/Categories/Code Review.category.json`]: JSON.stringify(
    { id: PROMPT_CATEGORY_ID, displayName: 'Code Review', description: null },
    null,
    2
  ),
  [`${WORKSPACE_PATH}/Templates/Templates/Categories/Writing.category.json`]: JSON.stringify(
    { id: TEMPLATE_CATEGORY_ID, displayName: 'Writing', description: null },
    null,
    2
  ),
  [`${WORKSPACE_PATH}/Prompts/Prompts/Active/_FolderInfo/FolderOrderV2.json`]: JSON.stringify(
    {
      categories: [
        {
          categoryId: null,
          entries: [
            { kind: 'prompt', id: 'uncategorized-prompt' },
            { kind: 'prompt', id: 'unknown-category-prompt' }
          ]
        },
        {
          categoryId: PROMPT_CATEGORY_ID,
          entries: [{ kind: 'prompt', id: 'categorized-prompt' }]
        }
      ]
    },
    null,
    2
  ),
  [`${WORKSPACE_PATH}/Templates/Templates/_FolderInfo/FolderOrderV2.json`]: JSON.stringify(
    {
      categories: [
        { categoryId: null, entries: [] },
        {
          categoryId: TEMPLATE_CATEGORY_ID,
          entries: [{ kind: 'template', id: 'categorized-template' }]
        }
      ]
    },
    null,
    2
  ),
  [`${WORKSPACE_PATH}/WorkspaceFolderOrder.json`]: JSON.stringify(
    {
      entries: [
        { kind: 'folder', id: PROMPT_ROOT_ID },
        { kind: 'folder', id: TEMPLATE_ROOT_ID }
      ]
    },
    null,
    2
  )
})

/** Starts the app with a caller-provided category workspace. */
const startCategoryWorkspace = async (
  testSetup: any,
  filesystem: Record<string, string | null>,
  fileModifiedTimes?: Record<string, string>
): Promise<{ mainWindow: any; testHelpers: any }> => {
  await testSetup.setupFilesystem(filesystem, { fileModifiedTimes })
  await testSetup.setupFileDialog([getWorkspaceInfoPath(WORKSPACE_PATH)])
  const { mainWindow, testHelpers } = await testSetup.setupAndStart({
    workspace: { scenario: 'none' }
  })
  expect((await testHelpers.setupWorkspaceViaUI()).workspaceReady).toBe(true)
  return { mainWindow, testHelpers }
}

describe('Prompt categories', () => {
  test('omits categories from prompt metadata while V2 repairs category front matter', async ({
    electronApp,
    testSetup
  }) => {
    const { mainWindow, testHelpers } = await startCategoryWorkspace(
      testSetup,
      createCategorizedWorkspace()
    )

    await testHelpers.navigateToPromptFolders('Prompts')
    await expect(mainWindow.locator('.prompt-editor-metadata-category')).toHaveCount(0)
    await mainWindow
      .locator(`${promptEditorSelector('unknown-category-prompt')} [data-testid="prompt-title"]`)
      .fill('Unknown Category Renamed')
    const renamedUnknownCategoryPath =
      `${WORKSPACE_PATH}/Prompts/Prompts/Active/Unknown Category Renamed.prompt.md`
    await expect.poll(() => checkFileExists(electronApp, renamedUnknownCategoryPath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, renamedUnknownCategoryPath)).not.toContain(
      'category:'
    )

    await testHelpers.navigateToPromptFolders('Templates')
    await expect(mainWindow.locator('.prompt-editor-metadata-category')).toHaveCount(0)
  })

  test('removes and restores categorized prompt ordering across completion', async ({
    electronApp,
    testSetup
  }) => {
    /** Category workspace used for the status round trip. */
    const { mainWindow, testHelpers } = await startCategoryWorkspace(
      testSetup,
      createCategorizedWorkspace()
    )
    /** Persisted V2 order whose category group owns the active prompt. */
    const categoryOrderPath =
      `${WORKSPACE_PATH}/Prompts/Prompts/Active/_FolderInfo/FolderOrderV2.json`
    /** Active categorized prompt path before completion. */
    const activePromptPath =
      `${WORKSPACE_PATH}/Prompts/Prompts/Active/Categorized Prompt.prompt.md`
    /** Completed categorized prompt path while it is excluded from V2. */
    const completedPromptPath =
      `${WORKSPACE_PATH}/Prompts/Prompts/Completed/Categorized Prompt.prompt.md`

    await testHelpers.navigateToPromptFolders('Prompts')
    await mainWindow
      .locator(
        `${promptEditorSelector('categorized-prompt')} [data-testid="prompt-complete-button"]`
      )
      .click()
    await expect.poll(() => checkFileExists(electronApp, completedPromptPath)).toBe(true)
    await expect
      .poll(async () => parsePromptMarkdown(await readTextFile(electronApp, completedPromptPath)))
      .toMatchObject({ category: PROMPT_CATEGORY_ID })
    await expect.poll(() => readCategoryOrder(electronApp, categoryOrderPath)).toEqual({
      categories: [
        {
          categoryId: null,
          entries: [
            { kind: 'prompt', id: 'uncategorized-prompt' },
            { kind: 'prompt', id: 'unknown-category-prompt' }
          ]
        },
        { categoryId: PROMPT_CATEGORY_ID, entries: [] }
      ]
    })

    await mainWindow.locator(TOGGLE_COMPLETED_BUTTON).click()
    await mainWindow
      .locator(
        `${promptEditorSelector('categorized-prompt')} [data-testid="prompt-uncomplete-button"]`
      )
      .click()
    await expect.poll(() => checkFileExists(electronApp, activePromptPath)).toBe(true)
    await expect
      .poll(async () => parsePromptMarkdown(await readTextFile(electronApp, activePromptPath)))
      .toMatchObject({ category: PROMPT_CATEGORY_ID })
    await expect.poll(() => readCategoryOrder(electronApp, categoryOrderPath)).toEqual({
      categories: [
        {
          categoryId: null,
          entries: [
            { kind: 'prompt', id: 'uncategorized-prompt' },
            { kind: 'prompt', id: 'unknown-category-prompt' }
          ]
        },
        {
          categoryId: PROMPT_CATEGORY_ID,
          entries: [{ kind: 'prompt', id: 'categorized-prompt' }]
        }
      ]
    })
  })

  test('creates trimmed unique categories and treats them as root content', async ({
    electronApp,
    testSetup
  }) => {
    const filesystem = createWorkspaceWithFolders(WORKSPACE_PATH, [
      {
        folderName: 'Empty',
        displayName: 'Empty',
        promptFolderId: PROMPT_ROOT_ID
      }
    ])
    filesystem[`${WORKSPACE_PATH}/Prompts/Empty/Categories/Existing.category.json`] =
      JSON.stringify(
        { id: EXISTING_CATEGORY_ID, displayName: 'Existing', description: null },
        null,
        2
      )
    filesystem[`${WORKSPACE_PATH}/Prompts/Empty/Active/_FolderInfo/FolderOrderV2.json`] =
      JSON.stringify(
        {
          categories: [
            { categoryId: null, entries: [] },
            { categoryId: EXISTING_CATEGORY_ID, entries: [] }
          ]
        },
        null,
        2
      )
    const { mainWindow, testHelpers } = await startCategoryWorkspace(testSetup, filesystem)
    await testHelpers.navigateToPromptFolders('Empty')

    await mainWindow.locator('[data-testid="prompt-folder-add-category-button"]').click()
    const categoryDialog = mainWindow.locator('[role="dialog"][aria-label="Create Category"]')
    const categoryInput = categoryDialog.locator('[data-testid="create-category-name-input"]')
    await expect(categoryDialog).toBeVisible()
    await categoryInput.fill('   ')
    await expect(categoryDialog.locator('[data-testid="create-category-name-error"]')).toHaveText(
      'Category name is required'
    )
    await expect(categoryDialog.locator('[data-testid="create-category-button"]')).toBeDisabled()
    await categoryInput.fill('  Code Review  ')
    await categoryDialog.locator('[data-testid="create-category-button"]').click()

    const categoryPath = `${WORKSPACE_PATH}/Prompts/Empty/Categories/Code Review.category.json`
    await expect.poll(() => checkFileExists(electronApp, categoryPath)).toBe(true)
    const createdCategory = JSON.parse(await readTextFile(electronApp, categoryPath)) as {
      id: string
      displayName: string
      description: string | null
    }
    expect(createdCategory).toMatchObject({
      displayName: 'Code Review',
      description: null
    })
    expect(createdCategory.id).toMatch(/^[0-9a-f]{32}$/)
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Empty/Active/_FolderInfo/FolderOrderV2.json`
        )
      ).categories.map((category: { categoryId: string | null }) => category.categoryId)
    ).toEqual([null, createdCategory.id, EXISTING_CATEGORY_ID])

    await mainWindow.locator('[data-testid="prompt-folder-add-category-button"]').click()
    await categoryInput.fill('code review')
    await expect(categoryDialog.locator('[data-testid="create-category-name-error"]')).toHaveText(
      'A category with this name already exists'
    )
    await expect(categoryDialog.locator('[data-testid="create-category-button"]')).toBeDisabled()
    await categoryDialog.getByRole('button', { name: 'Cancel' }).click()

    const renameResponse = await mainWindow.evaluate(async (category) => {
      return await (window as any).electron.ipcRenderer.invoke('rename-category', {
        requestId: 'rename-category-test',
        clientId: (window as any).ipcClientId,
        payload: {
          category: { id: category.id, expectedRevision: 1, data: category },
          displayName: 'Review Work'
        }
      })
    }, createdCategory)
    expect(renameResponse).toMatchObject({ success: true })
    const renamedCategoryPath = `${WORKSPACE_PATH}/Prompts/Empty/Categories/Review Work.category.json`
    await expect.poll(() => checkFileExists(electronApp, categoryPath)).toBe(false)
    await expect.poll(() => checkFileExists(electronApp, renamedCategoryPath)).toBe(true)

    const renamedCategory = {
      ...createdCategory,
      displayName: 'Review Work'
    }
    const descriptionResponse = await mainWindow.evaluate(async (category) => {
      return await (window as any).electron.ipcRenderer.invoke('set-category-description', {
        requestId: 'set-category-description-test',
        clientId: (window as any).ipcClientId,
        payload: {
          category: { id: category.id, expectedRevision: 2, data: category },
          description: 'Prompts for reviewing changes.'
        }
      })
    }, renamedCategory)
    expect(descriptionResponse).toMatchObject({ success: true })
    await expect.poll(async () => JSON.parse(await readTextFile(electronApp, renamedCategoryPath)))
      .toMatchObject({
        id: createdCategory.id,
        displayName: 'Review Work',
        description: 'Prompts for reviewing changes.'
      })

    await mainWindow.locator('[data-testid="prompt-folder-delete-button"]').click()
    await expect(
      mainWindow.locator('[role="dialog"][aria-label="Delete Prompt Folder"]')
    ).toBeVisible()
  })

  test('deletes a category and moves its ordered prompts to Uncategorized', async ({
    electronApp,
    testSetup
  }) => {
    /** Category workspace with authoritative prompt and template V2 ownership. */
    const filesystem = createCategorizedWorkspace()
    /** Known initial file timestamp used to verify deletion changes modifiedAt. */
    const initialModifiedAt = '2020-01-01T00:00:00.000Z'
    /** Template path whose separately owned category must remain unchanged. */
    const templatePath =
      `${WORKSPACE_PATH}/Templates/Templates/Categorized Template.template.md`
    /** Prompt path expected to be rewritten during category deletion. */
    const promptPath =
      `${WORKSPACE_PATH}/Prompts/Prompts/Active/Categorized Prompt.prompt.md`
    /** Running category workspace used for direct non-UI IPC coverage. */
    const { mainWindow } = await startCategoryWorkspace(testSetup, filesystem, {
      [promptPath]: initialModifiedAt
    })
    expect(await readTextFile(electronApp, promptPath)).toContain(PROMPT_CATEGORY_ID)
    expect(await readTextFile(electronApp, templatePath)).toContain(TEMPLATE_CATEGORY_ID)

    /** Atomic deletion response returned by the main-process IPC handler. */
    const deleteResponse = await mainWindow.evaluate(
      async ({ categoryId, rootFolderId }) => {
        return await (window as any).electron.ipcRenderer.invoke('delete-category', {
          requestId: 'delete-category-test',
          clientId: (window as any).ipcClientId,
          payload: {
            promptFolder: {
              id: rootFolderId,
              expectedRevision: 0,
              data: {
                id: rootFolderId,
                kind: 'prompt',
                folderName: 'Prompts',
                displayName: 'Prompts',
                entries: [
                  { kind: 'prompt', id: 'categorized-prompt' },
                  { kind: 'prompt', id: 'uncategorized-prompt' },
                  { kind: 'prompt', id: 'unknown-category-prompt' }
                ],
                completedPromptIds: [],
                categoryOrder: {
                  categories: [
                    {
                      categoryId: null,
                      entries: [
                        { kind: 'prompt', id: 'uncategorized-prompt' },
                        { kind: 'prompt', id: 'unknown-category-prompt' }
                      ]
                    },
                    {
                      categoryId,
                      entries: [{ kind: 'prompt', id: 'categorized-prompt' }]
                    }
                  ]
                },
                settings: { folderDescription: null }
              }
            },
            category: {
              id: categoryId,
              expectedRevision: 0,
              data: { id: categoryId, displayName: 'Code Review', description: null }
            }
          }
        })
      },
      { categoryId: PROMPT_CATEGORY_ID, rootFolderId: PROMPT_ROOT_ID }
    )

    expect(deleteResponse).toMatchObject({
      success: true,
      payload: {
        promptFolder: {
          data: {
            categoryOrder: {
              categories: [
                {
                  categoryId: null,
                  entries: [
                    { kind: 'prompt', id: 'uncategorized-prompt' },
                    { kind: 'prompt', id: 'unknown-category-prompt' },
                    { kind: 'prompt', id: 'categorized-prompt' }
                  ]
                }
              ]
            }
          }
        },
        prompts: [{ data: { id: 'categorized-prompt' } }],
        promptTemplates: []
      }
    })
    expect(deleteResponse.payload).not.toHaveProperty('category')
    expect(deleteResponse.payload.prompts[0].data).not.toHaveProperty('category')
    expect(deleteResponse.payload.prompts[0].data.modifiedAt).not.toBe(initialModifiedAt)
    await expect
      .poll(() =>
        checkFileExists(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Prompts/Categories/Code Review.category.json`
        )
      )
      .toBe(false)
    await expect.poll(() => readTextFile(electronApp, promptPath)).not.toContain('category:')
    await expect.poll(() => readTextFile(electronApp, templatePath)).toContain(TEMPLATE_CATEGORY_ID)
    expect(
      JSON.parse(
        await readTextFile(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Prompts/Active/_FolderInfo/FolderOrderV2.json`
        )
      )
    ).toEqual(deleteResponse.payload.promptFolder.data.categoryOrder)
  })

  test('clears prompt and template categories when moving content to another root', async ({
    electronApp,
    testSetup
  }) => {
    const sourceRootId = 'category-source-root'
    const destinationRootId = 'category-destination-root'
    const templateSourceRootId = 'category-template-source-root'
    const templateDestinationRootId = 'category-template-destination-root'
    const filesystem = {
      ...createWorkspaceWithFolders(WORKSPACE_PATH, [
        {
          folderName: 'Source',
          displayName: 'Source',
          promptFolderId: sourceRootId,
          prompts: [
            {
              id: 'moving-category-prompt',
              title: 'Moving Prompt',
              promptText: 'Move this categorized prompt.',
              category: PROMPT_CATEGORY_ID
            }
          ]
        },
        {
          folderName: 'Destination',
          displayName: 'Destination',
          promptFolderId: destinationRootId
        }
      ]),
      ...createWorkspaceWithTemplateFolders(WORKSPACE_PATH, [
        {
          folderName: 'TemplateSource',
          displayName: 'Template Source',
          folderId: templateSourceRootId,
          templates: [
            {
              id: 'moving-category-template',
              title: 'Moving Template',
              templateText: 'Move this categorized template.',
              category: TEMPLATE_CATEGORY_ID
            }
          ]
        },
        {
          folderName: 'TemplateDestination',
          displayName: 'Template Destination',
          folderId: templateDestinationRootId
        }
      ]),
      [`${WORKSPACE_PATH}/WorkspaceFolderOrder.json`]: JSON.stringify(
        {
          entries: [
            { kind: 'folder', id: sourceRootId },
            { kind: 'folder', id: destinationRootId },
            { kind: 'folder', id: templateSourceRootId },
            { kind: 'folder', id: templateDestinationRootId }
          ]
        },
        null,
        2
      )
    }
    filesystem[`${WORKSPACE_PATH}/Prompts/Source/Categories/Code Review.category.json`] =
      JSON.stringify(
        { id: PROMPT_CATEGORY_ID, displayName: 'Code Review', description: null },
        null,
        2
      )
    filesystem[`${WORKSPACE_PATH}/Prompts/Source/Active/_FolderInfo/FolderOrderV2.json`] =
      JSON.stringify(
        {
          categories: [
            { categoryId: null, entries: [] },
            {
              categoryId: PROMPT_CATEGORY_ID,
              entries: [{ kind: 'prompt', id: 'moving-category-prompt' }]
            }
          ]
        },
        null,
        2
      )
    filesystem[
      `${WORKSPACE_PATH}/Templates/TemplateSource/Categories/Writing.category.json`
    ] = JSON.stringify(
      { id: TEMPLATE_CATEGORY_ID, displayName: 'Writing', description: null },
      null,
      2
    )
    filesystem[
      `${WORKSPACE_PATH}/Templates/TemplateSource/_FolderInfo/FolderOrderV2.json`
    ] = JSON.stringify(
      {
        categories: [
          { categoryId: null, entries: [] },
          {
            categoryId: TEMPLATE_CATEGORY_ID,
            entries: [{ kind: 'template', id: 'moving-category-template' }]
          }
        ]
      },
      null,
      2
    )
    const { mainWindow, testHelpers } = await startCategoryWorkspace(testSetup, filesystem)
    await testHelpers.navigateToPromptFolders('Source')

    await beginPromptHandleDrag(mainWindow, 'moving-category-prompt')
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(destinationRootId)
    )
    await finishActiveDrag(mainWindow)

    const movedEditor = mainWindow.locator(promptEditorSelector('moving-category-prompt'))
    await expect(movedEditor.locator('.prompt-editor-metadata-category')).toHaveCount(0)
    const movedPromptPath = `${WORKSPACE_PATH}/Prompts/Destination/Active/Moving Prompt.prompt.md`
    await expect.poll(() => checkFileExists(electronApp, movedPromptPath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, movedPromptPath)).not.toContain('category:')
    await expect
      .poll(() =>
        readCategoryOrder(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Source/Active/_FolderInfo/FolderOrderV2.json`
        )
      )
      .toEqual({
        categories: [
          { categoryId: null, entries: [] },
          { categoryId: PROMPT_CATEGORY_ID, entries: [] }
        ]
      })
    await expect
      .poll(() =>
        readCategoryOrder(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Destination/Active/_FolderInfo/FolderOrderV2.json`
        )
      )
      .toEqual({
        categories: [
          {
            categoryId: null,
            entries: [{ kind: 'prompt', id: 'moving-category-prompt' }]
          }
        ]
      })

    await testHelpers.navigateToPromptFolders('Template Source')
    await beginPromptHandleDrag(mainWindow, 'moving-category-template')
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(templateDestinationRootId)
    )
    await finishActiveDrag(mainWindow)

    const movedTemplate = mainWindow.locator(promptEditorSelector('moving-category-template'))
    await expect(movedTemplate.locator('.prompt-editor-metadata-category')).toHaveCount(0)
    const movedTemplatePath =
      `${WORKSPACE_PATH}/Templates/TemplateDestination/Moving Template.template.md`
    await expect.poll(() => checkFileExists(electronApp, movedTemplatePath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, movedTemplatePath)).not.toContain('category:')
    await expect
      .poll(() =>
        readCategoryOrder(
          electronApp,
          `${WORKSPACE_PATH}/Templates/TemplateSource/_FolderInfo/FolderOrderV2.json`
        )
      )
      .toEqual({
        categories: [
          { categoryId: null, entries: [] },
          { categoryId: TEMPLATE_CATEGORY_ID, entries: [] }
        ]
      })
    await expect
      .poll(() =>
        readCategoryOrder(
          electronApp,
          `${WORKSPACE_PATH}/Templates/TemplateDestination/_FolderInfo/FolderOrderV2.json`
        )
      )
      .toEqual({
        categories: [
          {
            categoryId: null,
            entries: [{ kind: 'template', id: 'moving-category-template' }]
          }
        ]
      })
  })

  test('inherits a root category in a subfolder and clears it on a cross-root subtree move', async ({
    electronApp,
    testSetup
  }) => {
    const sourceRootId = 'nested-category-source-root'
    const destinationRootId = 'nested-category-destination-root'
    const nestedFolderId = '000000000000000000000000c9876c4a'
    const filesystem = createWorkspaceWithFolders(WORKSPACE_PATH, [
      {
        folderName: 'Hierarchy',
        displayName: 'Hierarchy',
        promptFolderId: sourceRootId
      },
      {
        folderName: 'Destination',
        displayName: 'Destination',
        promptFolderId: destinationRootId
      }
    ])
    const hierarchyFixture = setupWorkspaceScenario(WORKSPACE_PATH, 'subfolders-ui')
    for (const [filePath, contents] of Object.entries(hierarchyFixture)) {
      if (filePath.includes(`${WORKSPACE_PATH}/Prompts/Hierarchy/`)) {
        filesystem[filePath] = contents
      }
    }
    filesystem[`${WORKSPACE_PATH}/Prompts/Hierarchy/_FolderInfo/FolderInfo.json`] = JSON.stringify(
      { displayName: 'Hierarchy', folderId: sourceRootId, kind: 'prompt' },
      null,
      2
    )
    filesystem[`${WORKSPACE_PATH}/Prompts/Hierarchy/Categories/Code Review.category.json`] =
      JSON.stringify(
        { id: PROMPT_CATEGORY_ID, displayName: 'Code Review', description: null },
        null,
        2
      )
    const nestedPromptPath =
      `${WORKSPACE_PATH}/Prompts/Hierarchy/Active/Nested/Nested Prompt.prompt.md`
    const nestedPromptData = parsePromptMarkdown(filesystem[nestedPromptPath]!)!
    filesystem[nestedPromptPath] = serializePromptMarkdown({
      ...nestedPromptData,
      category: PROMPT_CATEGORY_ID
    })
    const grandchildPromptPath =
      `${WORKSPACE_PATH}/Prompts/Hierarchy/Active/Nested/Grandchild/Grandchild Prompt.prompt.md`
    const grandchildPromptData = parsePromptMarkdown(filesystem[grandchildPromptPath]!)!
    filesystem[grandchildPromptPath] = serializePromptMarkdown({
      ...grandchildPromptData,
      category: PROMPT_CATEGORY_ID
    })
    filesystem[
      `${WORKSPACE_PATH}/Prompts/Hierarchy/Active/_FolderInfo/FolderOrderV2.json`
    ] = JSON.stringify(
      {
        categories: [
          { categoryId: null, entries: [] },
          {
            categoryId: PROMPT_CATEGORY_ID,
            entries: [
              { kind: 'prompt', id: 'subfolders-ui-nested-prompt' },
              { kind: 'prompt', id: 'subfolders-ui-grandchild-prompt' }
            ]
          }
        ]
      },
      null,
      2
    )

    const { mainWindow, testHelpers } = await startCategoryWorkspace(testSetup, filesystem)
    await testHelpers.navigateToPromptFolders('Hierarchy')
    const nestedPrompt = mainWindow.locator(promptEditorSelector('subfolders-ui-nested-prompt'))
    await expect(nestedPrompt.locator('.prompt-editor-metadata-category')).toHaveCount(0)

    await beginPromptFolderHandleDrag(mainWindow, nestedFolderId)
    await moveActiveDragToTarget(mainWindow, promptFolderSelectorTriggerSelector)
    await moveActiveDragToTarget(
      mainWindow,
      promptFolderSelectorDropdownItemSelector(destinationRootId)
    )
    await finishActiveDrag(mainWindow)

    const movedNestedPromptPath =
      `${WORKSPACE_PATH}/Prompts/Destination/Active/Nested/Nested Prompt.prompt.md`
    const movedGrandchildPromptPath =
      `${WORKSPACE_PATH}/Prompts/Destination/Active/Nested/Grandchild/Grandchild Prompt.prompt.md`
    await expect.poll(() => checkFileExists(electronApp, movedNestedPromptPath)).toBe(true)
    await expect.poll(() => checkFileExists(electronApp, movedGrandchildPromptPath)).toBe(true)
    await expect.poll(() => readTextFile(electronApp, movedNestedPromptPath)).not.toContain(
      'category:'
    )
    await expect.poll(() => readTextFile(electronApp, movedGrandchildPromptPath)).not.toContain(
      'category:'
    )
    await expect(nestedPrompt.locator('.prompt-editor-metadata-category')).toHaveCount(0)
    await expect
      .poll(() =>
        readCategoryOrder(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Hierarchy/Active/_FolderInfo/FolderOrderV2.json`
        )
      )
      .toEqual({
        categories: [
          {
            categoryId: null,
            entries: [
              { kind: 'prompt', id: 'subfolders-ui-root-after' },
              { kind: 'prompt', id: 'subfolders-ui-root-before' }
            ]
          },
          { categoryId: PROMPT_CATEGORY_ID, entries: [] }
        ]
      })
    await expect
      .poll(() =>
        readCategoryOrder(
          electronApp,
          `${WORKSPACE_PATH}/Prompts/Destination/Active/_FolderInfo/FolderOrderV2.json`
        )
      )
      .toEqual({
        categories: [
          {
            categoryId: null,
            entries: [
              { kind: 'prompt', id: 'subfolders-ui-nested-prompt' },
              { kind: 'prompt', id: 'subfolders-ui-grandchild-prompt' }
            ]
          }
        ]
      })
  })
})
