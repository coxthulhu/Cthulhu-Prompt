import { randomUUID } from 'crypto'
import * as path from 'path'
import matter from 'gray-matter'
import { isWorkspaceRootPath, workspaceRootPathErrorMessage } from '@shared/workspacePath'
import { compactGuid } from '@shared/compactGuid'
import { getCurrentIsoSecondTimestamp } from '@shared/isoTimestamp'
import { PROMPT_STATUS_FOLDERS, PromptStatus } from '@shared/Prompt'
import { buildPromptStem, sanitizePromptTitleForFilename } from '@shared/promptFilename'
import { preparePromptFolderName } from '@shared/promptFolderName'
import { folderEntryRef, promptEntryRef, promptTemplateEntryRef } from '@shared/OrderContainer'
import { getFs } from '../fs-provider'
import {
  serializePromptMarkdown,
  serializePromptTemplateMarkdown
} from '../Persistence/PromptFrontmatter'
import example1PromptSource from '../BundledPrompts/Example1.md?raw'
import example2PromptSource from '../BundledPrompts/Example2.md?raw'
import exampleTemplateSource from '../BundledPrompts/ExampleTemplate.md?raw'
import {
  PROMPTS_DIRECTORY_NAME,
  TEMPLATES_DIRECTORY_NAME,
  PROMPT_FOLDER_INFO_DIRECTORY_NAME,
  PROMPT_FOLDER_INFO_FILENAME,
  PROMPT_MARKDOWN_FILENAME_SUFFIX,
  PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX,
  WORKSPACE_INFO_FILENAME_SUFFIX,
  resolveActivePromptFolderName,
  resolveCategoriesDirectoryPath,
  resolveCategoryPathFromStem,
  resolvePromptStatusFolderName,
  resolvePromptFolderCategoryOrderPath,
  resolvePromptFolderPath,
  resolveWorkspaceFolderOrderPath
} from '../Persistence/PromptPersistencePaths'

const EXAMPLE_FOLDER_NAME = 'MyPrompts'
const EXAMPLE_FOLDER_DISPLAY_NAME = 'My Prompts'
// Ordered categories created with the bundled example prompts.
const BUNDLED_PROMPT_CATEGORY_DISPLAY_NAMES = [
  'New Features',
  'Improvements',
  'Bug Fixes'
] as const
// Ordered bundled prompt sources used when initializing a workspace with examples.
const BUNDLED_PROMPT_SOURCES = [example1PromptSource, example2PromptSource]
// Ordered bundled template sources used when initializing a workspace with examples.
const BUNDLED_TEMPLATE_SOURCES = [exampleTemplateSource]
// Default on-disk directory name for the template folder created with each workspace.
const DEFAULT_TEMPLATE_FOLDER_NAME = 'MyTemplates'
// Default display name for the template folder created with each workspace.
const DEFAULT_TEMPLATE_FOLDER_DISPLAY_NAME = 'My Templates'

type CreateWorkspaceResult = { success: true } | { success: false; error: string }

const resolveWorkspaceInfoPath = (workspacePath: string, workspaceName: string): string => {
  const preparedWorkspaceName = preparePromptFolderName(workspaceName)
  const workspaceRootPath = workspacePath.replace(/[\\/]+$/, '')
  return `${workspaceRootPath}\\${preparedWorkspaceName.folderName}${WORKSPACE_INFO_FILENAME_SUFFIX}`
}

const writeWorkspaceInfoFile = (workspacePath: string, workspaceName: string): void => {
  const fs = getFs()
  const workspaceInfoPath = resolveWorkspaceInfoPath(workspacePath, workspaceName)
  const content = JSON.stringify({ workspaceId: compactGuid(randomUUID()), workspaceName }, null, 2)
  fs.writeFileSync(workspaceInfoPath, content, 'utf8')
}

const writeWorkspaceFolderOrderFile = (
  workspacePath: string,
  folderIds: string[]
): void => {
  const fs = getFs()
  const orderPath = resolveWorkspaceFolderOrderPath(workspacePath)
  fs.writeFileSync(
    orderPath,
    JSON.stringify({ entries: folderIds.map(folderEntryRef) }, null, 2),
    'utf8'
  )
}

const getDuplicateTitleStems = (prompts: Array<{ title: string }>): Set<string> => {
  const titleStemCounts = new Map<string, number>()

  for (const prompt of prompts) {
    const titleStem = sanitizePromptTitleForFilename(prompt.title).toLowerCase()
    titleStemCounts.set(titleStem, (titleStemCounts.get(titleStem) ?? 0) + 1)
  }

  return new Set(
    [...titleStemCounts.entries()].filter(([, count]) => count > 1).map(([titleStem]) => titleStem)
  )
}

const writeMyPromptsFolder = (workspacePath: string, includeExamplePrompts: boolean): string => {
  const fs = getFs()
  const exampleFolderPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME, EXAMPLE_FOLDER_NAME)
  // Canonical directory that owns active prompts and root ordering.
  const activeFolderPath = resolvePromptFolderPath(
    workspacePath,
    resolveActivePromptFolderName(EXAMPLE_FOLDER_NAME, 'prompt'),
    'prompt'
  )
  /** Canonical flat directories owned by automatically ordered final statuses. */
  const finalStatusFolderPaths = PROMPT_STATUS_FOLDERS.filter(
    (statusFolder) => statusFolder.ordering === 'finalizedAt'
  ).map((statusFolder) =>
    resolvePromptFolderPath(
      workspacePath,
      resolvePromptStatusFolderName(EXAMPLE_FOLDER_NAME, statusFolder.id),
      'prompt'
    )
  )
  const folderInfoPath = path.join(
    exampleFolderPath,
    PROMPT_FOLDER_INFO_DIRECTORY_NAME,
    PROMPT_FOLDER_INFO_FILENAME
  )
  const now = getCurrentIsoSecondTimestamp()
  const promptFolderId = compactGuid(randomUUID())
  const exampleCategories = includeExamplePrompts
    ? BUNDLED_PROMPT_CATEGORY_DISPLAY_NAMES.map((displayName) => ({
        id: compactGuid(randomUUID()),
        displayName,
        description: null
      }))
    : []
  const categoryIdByDisplayName = new Map(
    exampleCategories.map((category) => [category.displayName, category.id])
  )
  const examplePrompts = includeExamplePrompts
    ? BUNDLED_PROMPT_SOURCES.map((source) => {
        // Parsed bundled document that supplies the prompt's title and body.
        const bundledPrompt = matter(source, {})
        const categoryId = categoryIdByDisplayName.get(bundledPrompt.data.category)
        if (!categoryId) {
          throw new Error(`Unknown bundled prompt category: ${bundledPrompt.data.category}`)
        }

        return {
          id: compactGuid(randomUUID()),
          title: bundledPrompt.data.title as string,
          fallbackTitle: '',
          createdAt: now,
          modifiedAt: now,
          status: PromptStatus.Todo,
          category: categoryId,
          promptText: bundledPrompt.content.replace(/\r?\n$/, '')
        }
      })
    : []
  const duplicateTitleStems = getDuplicateTitleStems(examplePrompts)

  fs.mkdirSync(path.join(exampleFolderPath, PROMPT_FOLDER_INFO_DIRECTORY_NAME), { recursive: true })
  fs.mkdirSync(path.join(activeFolderPath, PROMPT_FOLDER_INFO_DIRECTORY_NAME), { recursive: true })
  for (const finalStatusFolderPath of finalStatusFolderPaths) {
    fs.mkdirSync(finalStatusFolderPath, { recursive: true })
  }
  fs.mkdirSync(resolveCategoriesDirectoryPath(workspacePath, EXAMPLE_FOLDER_NAME, 'prompt'), {
    recursive: true
  })

  for (const category of exampleCategories) {
    const categoryStem = buildPromptStem(category.displayName, category.id, false)
    fs.writeFileSync(
      resolveCategoryPathFromStem(
        workspacePath,
        EXAMPLE_FOLDER_NAME,
        'prompt',
        categoryStem
      ),
      JSON.stringify(category, null, 2),
      'utf8'
    )
  }

  for (const prompt of examplePrompts) {
    const titleStem = sanitizePromptTitleForFilename(prompt.title).toLowerCase()
    const promptStem = buildPromptStem(prompt.title, prompt.id, duplicateTitleStems.has(titleStem))
    const markdownPath = path.join(
      activeFolderPath,
      `${promptStem}${PROMPT_MARKDOWN_FILENAME_SUFFIX}`
    )

    fs.writeFileSync(markdownPath, serializePromptMarkdown(prompt), 'utf8')
  }

  fs.writeFileSync(
    folderInfoPath,
    JSON.stringify(
      {
        displayName: EXAMPLE_FOLDER_DISPLAY_NAME,
        folderId: promptFolderId,
        kind: 'prompt'
      },
      null,
      2
    ),
    'utf8'
  )
  // Side effect: initialize the bundled category order and assign each example prompt.
  fs.writeFileSync(
    resolvePromptFolderCategoryOrderPath(workspacePath, EXAMPLE_FOLDER_NAME, 'prompt'),
    JSON.stringify(
      {
        categories: [
          { categoryId: null, entries: [] },
          ...exampleCategories.map((category) => ({
            categoryId: category.id,
            entries: examplePrompts
              .filter((prompt) => prompt.category === category.id)
              .map((prompt) => promptEntryRef(prompt.id))
          }))
        ]
      },
      null,
      2
    ),
    'utf8'
  )
  return promptFolderId
}

/** Creates the default template folder and returns its persisted folder ID. */
const writeMyTemplatesFolder = (
  workspacePath: string,
  includeExampleTemplates: boolean
): string => {
  // Filesystem used to persist the default template folder.
  const fs = getFs()
  // Root path for the default template folder.
  const templateFolderPath = path.join(
    workspacePath,
    TEMPLATES_DIRECTORY_NAME,
    DEFAULT_TEMPLATE_FOLDER_NAME
  )
  // Unique identity persisted for this newly created template folder.
  const templateFolderId = compactGuid(randomUUID())
  const now = getCurrentIsoSecondTimestamp()
  const templates = includeExampleTemplates
    ? BUNDLED_TEMPLATE_SOURCES.map((source) => {
        const bundledTemplate = matter(source, {})

        return {
          id: compactGuid(randomUUID()),
          title: bundledTemplate.data.title as string,
          fallbackTitle: '',
          createdAt: now,
          modifiedAt: now,
          templateText: bundledTemplate.content.replace(/\r?\n$/, '')
        }
      })
    : []

  fs.mkdirSync(path.join(templateFolderPath, PROMPT_FOLDER_INFO_DIRECTORY_NAME), {
    recursive: true
  })
  fs.mkdirSync(
    resolveCategoriesDirectoryPath(workspacePath, DEFAULT_TEMPLATE_FOLDER_NAME, 'template'),
    { recursive: true }
  )
  fs.writeFileSync(
    path.join(
      templateFolderPath,
      PROMPT_FOLDER_INFO_DIRECTORY_NAME,
      PROMPT_FOLDER_INFO_FILENAME
    ),
    JSON.stringify(
      {
        displayName: DEFAULT_TEMPLATE_FOLDER_DISPLAY_NAME,
        folderId: templateFolderId,
        kind: 'template'
      },
      null,
      2
    ),
    'utf8'
  )

  for (const template of templates) {
    const templateStem = buildPromptStem(template.title, template.id, false)
    fs.writeFileSync(
      path.join(
        templateFolderPath,
        `${templateStem}${PROMPT_TEMPLATE_MARKDOWN_FILENAME_SUFFIX}`
      ),
      serializePromptTemplateMarkdown(template),
      'utf8'
    )
  }

  // Side effect: initialize template category-view ordering at the template root.
  fs.writeFileSync(
    resolvePromptFolderCategoryOrderPath(
      workspacePath,
      DEFAULT_TEMPLATE_FOLDER_NAME,
      'template'
    ),
    JSON.stringify(
      {
        categories: [
          {
            categoryId: null,
            entries: templates.map((template) => promptTemplateEntryRef(template.id))
          }
        ]
      },
      null,
      2
    ),
    'utf8'
  )

  return templateFolderId
}

const validateNewWorkspacePath = (workspacePath: string): CreateWorkspaceResult | null => {
  if (isWorkspaceRootPath(workspacePath)) {
    return { success: false, error: workspaceRootPathErrorMessage }
  }

  const fs = getFs()
  const promptsPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME)
  const templatesPath = path.join(workspacePath, TEMPLATES_DIRECTORY_NAME)
  const hasWorkspaceInfoFile =
    fs.existsSync(workspacePath) &&
    fs
      .readdirSync(workspacePath)
      .some((entryName) => entryName.toLowerCase().endsWith(WORKSPACE_INFO_FILENAME_SUFFIX))

  if (hasWorkspaceInfoFile || fs.existsSync(promptsPath) || fs.existsSync(templatesPath)) {
    return { success: false, error: 'Workspace already exists' }
  }

  return null
}

export const createWorkspace = async (
  workspacePath: string,
  workspaceName: string,
  includeExamplePrompts: boolean
): Promise<CreateWorkspaceResult> => {
  try {
    // Special-case command path: this is an imperative workspace bootstrap,
    // not a normal  revision mutation workflow.
    const validationResult = validateNewWorkspacePath(workspacePath)
    if (validationResult) {
      return validationResult
    }

    const fs = getFs()
    const promptsPath = path.join(workspacePath, PROMPTS_DIRECTORY_NAME)
    const templatesPath = path.join(workspacePath, TEMPLATES_DIRECTORY_NAME)
    // Ordered root folder IDs persisted for both prompt and template folders.
    const rootFolderIds: string[] = []

    fs.mkdirSync(promptsPath, { recursive: true })
    fs.mkdirSync(templatesPath, { recursive: true })
    writeWorkspaceInfoFile(workspacePath, workspaceName)

    rootFolderIds.push(
      writeMyPromptsFolder(workspacePath, includeExamplePrompts),
      writeMyTemplatesFolder(workspacePath, includeExamplePrompts)
    )
    writeWorkspaceFolderOrderFile(workspacePath, rootFolderIds)

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
