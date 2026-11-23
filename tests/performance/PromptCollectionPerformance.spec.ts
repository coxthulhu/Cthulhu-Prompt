import { createCollectionViewState } from '@shared/domain/ui-state/TabSession'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { PROMPT_COLLECTION_HOST_SELECTOR } from '../helpers/PromptCollectionSelectors'
import { seedWindowPersistence, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import {
  installFrameTracker,
  isScenarioSelected,
  measureTransition,
  PERFORMANCE_ELECTRON_ARGS,
  PERFORMANCE_RUNS,
  saveRun,
  startTracing,
  stopTracing,
  type TransitionResult
} from './PerformanceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite({ electronArgs: PERFORMANCE_ELECTRON_ARGS })

/** Switches between Home and four large collection tabs, first opening and then returning to each. */
const HOME_COLLECTION_SWITCHING = 'home-collection-switching'
/** Legacy fixture path imported into the run's on-disk workspace database. */
const WORKSPACE_PATH = '/ws/performance'
/** Prompts in each collection. */
const PROMPTS_PER_COLLECTION = 1000
/** Collections opened by the four seeded work tabs. */
const COLLECTIONS = [1, 2, 3, 4].map((number) => ({ id: `perf-collection-${number}`, name: `Performance ${number}` }))
/** Home-to-tab cycles; the first measures first opens and the second measures returns. */
const CYCLES = 2
/** Element that marks Home as mounted. */
const HOME_READY_SELECTOR = '[data-testid="home-screen"]'
/** A hydrated editor inside the virtual window, since a returning collection briefly mounts without rows or overlay. */
const COLLECTION_READY_SELECTOR = `${PROMPT_COLLECTION_HOST_SELECTOR} .monaco-editor`
/** Subjects varied per prompt so each Monaco model tokenizes different text. */
const AREAS = ['billing', 'search', 'auth', 'editor', 'sync', 'reports', 'uploads', 'settings']

/** Builds a 25-line Markdown prompt with headings, paragraphs, lists, inline code, a link, a quote, and a code block. */
const createPromptMarkdown = (number: number): string => {
  /** Subject of this prompt. */
  const area = AREAS[number % AREAS.length]
  /** Function name referenced throughout the prompt. */
  const name = `${area}Handler${number}`
  return [
    `# Improve the ${area} workflow (${number})`,
    '',
    `Update \`${name}\` in \`src/${area}/${name}.ts\` so it handles **retries** and *timeouts* correctly.`,
    'The current implementation drops errors silently, which makes debugging slow for the whole team.',
    '',
    '## Context',
    '',
    `- Requests to the ${area} service fail roughly ${(number % 17) + 3}% of the time.`,
    `- Failures are caught in \`handle${number}()\` but never logged.`,
    `- See [the ${area} design notes](https://example.com/docs/${area}/${number}) for background.`,
    '',
    '## Steps',
    '',
    `1. Read \`${name}.ts\` and its existing tests.`,
    '2. Extract the retry logic into a shared `withRetry` helper.',
    `3. Add a test that reproduces the ${area} timeout.`,
    '4. Run `npm run test` and fix any failures.',
    '',
    `> Keep the public API of \`${name}\` unchanged and avoid new dependencies.`,
    '',
    '```ts',
    `export const ${name} = async (input: string): Promise<string> => withRetry(() => send(input))`,
    '```',
    '',
    `Finish by summarizing the changes made for prompt ${number}.`
  ].join('\n')
}

/** Four 1000-prompt collections written through the shared legacy fixture pipeline. */
const workspaceFiles = createWorkspaceWithCollections(WORKSPACE_PATH, COLLECTIONS.map((collection, collectionIndex) => ({
  folderName: collection.name.replace(' ', ''),
  displayName: collection.name,
  promptCollectionId: collection.id,
  prompts: Array.from({ length: PROMPTS_PER_COLLECTION }, (_, index) => {
    /** Workspace-wide prompt number keeps every prompt's text distinct. */
    const number = collectionIndex * PROMPTS_PER_COLLECTION + index + 1
    return { id: `perf-prompt-${number}`, title: `${AREAS[number % AREAS.length]} prompt ${number}`, promptText: createPromptMarkdown(number) }
  })
})))

if (isScenarioSelected(HOME_COLLECTION_SWITCHING)) {
  describe(HOME_COLLECTION_SWITCHING, () => {
    describe.configure({ mode: 'serial' })

    for (const run of PERFORMANCE_RUNS) {
      test(run.name, async ({ electronApp, testSetup }) => {
        // The app's own window restoration starts it maximized on the primary monitor.
        const workArea = await electronApp.evaluate(async ({ app, screen }) => {
          await app.whenReady()
          return screen.getPrimaryDisplay().workArea
        })
        await seedWindowPersistence(electronApp, { ...workArea, isMaximized: true, isFullScreen: false })
        // Four restored collection tabs stay unloaded on Home, so each tab's first click is its first open.
        await seedWorkspaceState(electronApp, createDeterministicId(WORKSPACE_PATH), 'tab-session-user', null, {
          selectedTabId: 'home',
          tabs: COLLECTIONS.map((collection) => ({
            id: `tab-${collection.id}`, collectionId: collection.id, openPromptId: null, lastAccessed: 0, search: '',
            view: createCollectionViewState()
          })),
          lastClosedCollections: {}
        })
        await testSetup.setupFilesystem(workspaceFiles)
        testSetup.selectWorkspaceFixture(getWorkspaceInfoPath(WORKSPACE_PATH))
        const { mainWindow, testHelpers } = await testSetup.setupAndStart({ workspace: { scenario: 'none' } })
        await testHelpers.setupWorkspaceViaUI()

        /** Seeded work tabs in collection order. */
        const tabs = mainWindow.getByTestId('work-tab').getByRole('tab')
        await expect(tabs).toHaveCount(COLLECTIONS.length)
        await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
        await installFrameTracker(mainWindow)
        /** DevTools trace session, recorded only by the profiling run. */
        const tracing = run.profiled ? await startTracing(mainWindow) : null
        // Let Home and the profiler's startup work settle before the first measured transition.
        await mainWindow.waitForTimeout(1000)

        /** Every transition in this run, in order. */
        const transitions: TransitionResult[] = []
        for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
          for (const [index, collection] of COLLECTIONS.entries()) {
            transitions.push(await measureTransition(mainWindow,
              `Cycle ${cycle}: Home → ${collection.name}${cycle === 1 ? ' (first open)' : ''}`,
              COLLECTION_READY_SELECTOR, tabs.nth(index)))
            transitions.push(await measureTransition(mainWindow, `Cycle ${cycle}: ${collection.name} → Home`,
              HOME_READY_SELECTOR, mainWindow.getByTestId('nav-button-home')))
          }
        }
        if (tracing) await stopTracing(tracing, HOME_COLLECTION_SWITCHING)

        saveRun(HOME_COLLECTION_SWITCHING, { run: run.name, profiled: run.profiled, transitions })
      })
    }
  })
}
