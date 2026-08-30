import { beforeEach, describe, expect, it } from 'vitest'
import { vol } from 'memfs'
import { PromptStatus, type PromptPersisted } from '@shared/Prompt'
import type { PromptTemplatePersisted } from '@shared/PromptTemplate'
import { setFs } from '../../src/main/fs-provider'
import { readPromptFolderCategoryOrder } from '../../src/main/DataAccess/WorkspaceReads'
import {
  parsePromptMarkdown,
  parsePromptTemplateMarkdown,
  serializePromptTemplateMarkdown,
  serializePromptMarkdown
} from '../../src/main/Persistence/PromptFrontmatter'

/** Workspace root used by FolderOrder repair tests. */
const WORKSPACE_PATH = '/ws/folder-order'
/** Prompt root whose Active hierarchy owns the repaired file. */
const ROOT_FOLDER_NAME = 'Root'
/** Active directory containing every test prompt. */
const ACTIVE_PATH = `${WORKSPACE_PATH}/Prompts/${ROOT_FOLDER_NAME}/Active`
/** Canonical category-order file path under the Active metadata directory. */
const CATEGORY_ORDER_PATH = `${ACTIVE_PATH}/_FolderInfo/FolderOrder.json`
/** Template root containing direct and categorized templates for repair coverage. */
const TEMPLATE_ROOT_PATH = `${WORKSPACE_PATH}/Templates/Templates`
/** Canonical template category-order file stored at the template root. */
const TEMPLATE_CATEGORY_ORDER_PATH = `${TEMPLATE_ROOT_PATH}/_FolderInfo/FolderOrder.json`

/** Creates one serializable active prompt with optional category front matter. */
const createPrompt = (
  id: string,
  title: string,
  category?: string
): PromptPersisted => ({
  id,
  title,
  fallbackTitle: '',
  createdAt: '2026-08-16T00:00:00.000Z',
  modifiedAt: '',
  promptText: `${title} text.`,
  ...(category === undefined ? {} : { category }),
  status: PromptStatus.Todo
})

/** Reads one repaired prompt back from the in-memory filesystem. */
const readPrompt = (filename: string): PromptPersisted =>
  parsePromptMarkdown(vol.readFileSync(`${ACTIVE_PATH}/${filename}`, 'utf8').toString())!

/** Creates one serializable template with optional category front matter. */
const createTemplate = (
  id: string,
  title: string,
  category?: string
): PromptTemplatePersisted => ({
  id,
  title,
  fallbackTitle: '',
  createdAt: '2026-08-16T00:00:00.000Z',
  modifiedAt: '',
  templateText: `${title} text.`,
  ...(category === undefined ? {} : { category })
})

describe('FolderOrder repair', () => {
  beforeEach(() => {
    // Side effect: isolate each repair scenario in a fresh in-memory filesystem.
    vol.reset()
    setFs(vol)
  })

  it('creates a missing file with alphabetized Uncategorized content', () => {
    /** Valid category that remains owned even though the missing file starts content uncategorized. */
    const categoryId = 'category-existing'
    vol.fromJSON({
      [`${WORKSPACE_PATH}/Prompts/${ROOT_FOLDER_NAME}/Categories/Existing.category.json`]:
        JSON.stringify({ id: categoryId, displayName: 'Existing', description: null }),
      [`${ACTIVE_PATH}/Zebra.prompt.md`]: serializePromptMarkdown(
        createPrompt('prompt-zebra', 'Zebra', categoryId)
      ),
      [`${ACTIVE_PATH}/Alpha.prompt.md`]: serializePromptMarkdown(
        createPrompt('prompt-alpha', 'alpha')
      ),
      [`${ACTIVE_PATH}/Beta.prompt.md`]: serializePromptMarkdown(
        createPrompt('prompt-beta', 'Beta', categoryId)
      ),
      [`${WORKSPACE_PATH}/Prompts/${ROOT_FOLDER_NAME}/Completed/Completed.prompt.md`]:
        serializePromptMarkdown({
          ...createPrompt('prompt-completed', 'Completed', categoryId),
          status: PromptStatus.Completed
        })
    })

    expect(readPromptFolderCategoryOrder(WORKSPACE_PATH, ROOT_FOLDER_NAME, 'prompt')).toEqual({
      categories: [
        {
          categoryId: null,
          entries: [
            { kind: 'prompt', id: 'prompt-alpha' },
            { kind: 'prompt', id: 'prompt-beta' },
            { kind: 'prompt', id: 'prompt-zebra' }
          ]
        },
        { categoryId, entries: [] }
      ]
    })
    expect(JSON.parse(vol.readFileSync(CATEGORY_ORDER_PATH, 'utf8').toString())).toEqual({
      categories: [
        {
          categoryId: null,
          entries: [
            { kind: 'prompt', id: 'prompt-alpha' },
            { kind: 'prompt', id: 'prompt-beta' },
            { kind: 'prompt', id: 'prompt-zebra' }
          ]
        },
        { categoryId, entries: [] }
      ]
    })
    expect(readPrompt('Zebra.prompt.md')).not.toHaveProperty('category')
    expect(readPrompt('Beta.prompt.md')).not.toHaveProperty('category')
  })

  it('preserves valid order, inserts new categories at index 1, and makes folder order win front matter', () => {
    /** Existing category retained after newly discovered categories. */
    const retainedCategoryId = 'category-retained'
    /** Newly discovered category inserted immediately after Uncategorized. */
    const newCategoryId = 'category-new'
    vol.fromJSON({
      [`${WORKSPACE_PATH}/Prompts/${ROOT_FOLDER_NAME}/Categories/A New.category.json`]:
        JSON.stringify({ id: newCategoryId, displayName: 'A New', description: null }),
      [`${WORKSPACE_PATH}/Prompts/${ROOT_FOLDER_NAME}/Categories/B Retained.category.json`]:
        JSON.stringify({ id: retainedCategoryId, displayName: 'B Retained', description: null }),
      [`${ACTIVE_PATH}/Assigned.prompt.md`]: serializePromptMarkdown(
        createPrompt('prompt-assigned', 'Assigned')
      ),
      [`${ACTIVE_PATH}/Uncategorized.prompt.md`]: serializePromptMarkdown(
        createPrompt('prompt-uncategorized', 'Uncategorized', retainedCategoryId)
      ),
      [`${ACTIVE_PATH}/Missing.prompt.md`]: serializePromptMarkdown(
        createPrompt('prompt-missing', 'Missing', retainedCategoryId)
      ),
      [CATEGORY_ORDER_PATH]: JSON.stringify({
        categories: [
          {
            categoryId: null,
            entries: [{ kind: 'prompt', id: 'prompt-uncategorized' }]
          },
          {
            categoryId: retainedCategoryId,
            entries: [{ kind: 'prompt', id: 'prompt-assigned' }]
          }
        ]
      })
    })

    expect(readPromptFolderCategoryOrder(WORKSPACE_PATH, ROOT_FOLDER_NAME, 'prompt')).toEqual({
      categories: [
        {
          categoryId: null,
          entries: [
            { kind: 'prompt', id: 'prompt-uncategorized' },
            { kind: 'prompt', id: 'prompt-missing' }
          ]
        },
        { categoryId: newCategoryId, entries: [] },
        {
          categoryId: retainedCategoryId,
          entries: [{ kind: 'prompt', id: 'prompt-assigned' }]
        }
      ]
    })
    expect(readPrompt('Assigned.prompt.md').category).toBe(retainedCategoryId)
    expect(readPrompt('Uncategorized.prompt.md')).not.toHaveProperty('category')
    expect(readPrompt('Missing.prompt.md')).not.toHaveProperty('category')
  })

  it('repairs flat templates, duplicate references, stale entries, and deleted categories', () => {
    /** Valid category retained after repair. */
    const retainedCategoryId = 'template-category-retained'
    /** Deleted category whose surviving template is moved to Uncategorized. */
    const deletedCategoryId = 'template-category-deleted'
    vol.fromJSON({
      [`${TEMPLATE_ROOT_PATH}/Categories/Retained.category.json`]: JSON.stringify({
        id: retainedCategoryId,
        displayName: 'Retained',
        description: null
      }),
      [`${TEMPLATE_ROOT_PATH}/Direct.template.md`]: serializePromptTemplateMarkdown(
        createTemplate('template-direct', 'Direct', retainedCategoryId)
      ),
      [`${TEMPLATE_ROOT_PATH}/Categorized.template.md`]: serializePromptTemplateMarkdown(
        createTemplate('template-categorized', 'Categorized', deletedCategoryId)
      ),
      [TEMPLATE_CATEGORY_ORDER_PATH]: JSON.stringify({
        categories: [
          {
            categoryId: null,
            entries: [
              { kind: 'template', id: 'template-stale' },
              { kind: 'template', id: 'template-direct' }
            ]
          },
          {
            categoryId: retainedCategoryId,
            entries: [{ kind: 'template', id: 'template-direct' }]
          },
          {
            categoryId: deletedCategoryId,
            entries: [{ kind: 'template', id: 'template-categorized' }]
          },
          {
            categoryId: retainedCategoryId,
            entries: [{ kind: 'template', id: 'template-categorized' }]
          }
        ]
      })
    })

    expect(readPromptFolderCategoryOrder(WORKSPACE_PATH, 'Templates', 'template')).toEqual({
      categories: [
        {
          categoryId: null,
          entries: [
            { kind: 'template', id: 'template-direct' },
            { kind: 'template', id: 'template-categorized' }
          ]
        },
        { categoryId: retainedCategoryId, entries: [] }
      ]
    })
    /** Direct template repaired according to its first accepted folder-order reference. */
    const directTemplate = parsePromptTemplateMarkdown(
      vol.readFileSync(`${TEMPLATE_ROOT_PATH}/Direct.template.md`, 'utf8').toString()
    )!
    /** Second template repaired after its deleted category group redirects to Uncategorized. */
    const categorizedTemplate = parsePromptTemplateMarkdown(
      vol.readFileSync(`${TEMPLATE_ROOT_PATH}/Categorized.template.md`, 'utf8').toString()
    )!
    expect(directTemplate).not.toHaveProperty('category')
    expect(categorizedTemplate).not.toHaveProperty('category')
  })
})
