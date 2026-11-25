import type { Locator, Page } from 'playwright'
import { createCollectionViewState } from '@shared/domain/ui-state/TabSession'
import { createDeterministicId } from '../fixtures/FixtureIds'
import { createWorkspaceWithCollections, getWorkspaceInfoPath } from '../fixtures/WorkspaceFixtures'
import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { PROMPT_COLLECTION_HOST_SELECTOR, PROMPT_EDITOR_PREFIX_SELECTOR, promptEditorSelector } from '../helpers/PromptCollectionSelectors'
import { getElementScrollTop } from '../helpers/VirtualWindowHelpers'
import { seedWindowPersistence, seedWorkspaceState } from '../helpers/UserPersistenceHelpers'
import {
  installFrameTracker,
  isScenarioSelected,
  measureScrolling,
  measureTransition,
  PERFORMANCE_ELECTRON_ARGS,
  PERFORMANCE_RUNS,
  saveRun,
  startTracing,
  stopTracing,
  type MeasurementResult
} from './PerformanceHelpers'

const { test, describe, expect } = createPlaywrightTestSuite({ electronArgs: PERFORMANCE_ELECTRON_ARGS })

/** Switches between Home and four large collection tabs, first opening and then returning to each, then switches
    directly between the tabs and opens a collection from a new tab. */
const HOME_COLLECTION_SWITCHING = 'home-collection-switching'
/** Scrolls three freshly opened task collections, each at a different wheel cadence. */
const PROMPT_COLLECTION_SCROLLING = 'prompt-collection-scrolling'
/** One 120-unit wheel event moves the collection 48 px at its current wheel multiplier. */
const SCROLL_VARIANTS = [
  { name: 'Slow', intervalMs: 100 },
  { name: 'Medium', intervalMs: 40 },
  { name: 'Fast', intervalMs: 20 }
]
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
/** A prompt row in the virtual window, shown as a placeholder or an editor. */
const COLLECTION_CONTENT_SELECTOR = `${PROMPT_COLLECTION_HOST_SELECTOR} ${PROMPT_EDITOR_PREFIX_SELECTOR}`
/** Element that marks the New Tab screen as mounted. */
const NEW_TAB_READY_SELECTOR = '[data-testid="new-tab-screen"]'
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

/** Builds the scenario's 1000-prompt collections through the shared legacy fixture pipeline. */
const createWorkspaceFiles = (collections: typeof COLLECTIONS) =>
  createWorkspaceWithCollections(WORKSPACE_PATH, collections.map((collection, collectionIndex) => ({
    folderName: collection.name.replace(' ', ''),
    displayName: collection.name,
    promptCollectionId: collection.id,
    prompts: Array.from({ length: PROMPTS_PER_COLLECTION }, (_, index) => {
      /** Workspace-wide prompt number keeps every prompt's text distinct. */
      const number = collectionIndex * PROMPTS_PER_COLLECTION + index + 1
      return { id: `perf-prompt-${number}`, title: `${AREAS[number % AREAS.length]} prompt ${number}`, promptText: createPromptMarkdown(number) }
    })
  })))

/** Measures each tab's first open and cached return, alternating with Home, then cached returns from one tab to the
    next and opening a collection from a new tab. */
const measureSwitches = async (page: Page, tabs: Locator): Promise<MeasurementResult[]> => {
  /** Ordered samples for the two Home-to-collection cycles, the tab cycle, and the New Tab steps. */
  const transitions: MeasurementResult[] = []
  for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
    for (const [index, collection] of COLLECTIONS.entries()) {
      transitions.push(await measureTransition(page,
        `Cycle ${cycle}: Home → ${collection.name}${cycle === 1 ? ' (first open)' : ''}`,
        COLLECTION_READY_SELECTOR, tabs.nth(index), COLLECTION_CONTENT_SELECTOR))
      transitions.push(await measureTransition(page, `Cycle ${cycle}: ${collection.name} → Home`,
        HOME_READY_SELECTOR, page.getByTestId('nav-button-home')))
    }
  }

  /** Last collection, where the tab cycle starts so every tab is entered from another tab. */
  const lastCollection = COLLECTIONS[COLLECTIONS.length - 1]
  // Unrecorded: Home to the last tab duplicates a Cycle 2 return, but still waits for readiness and the settle.
  await measureTransition(page, `Position: Home → ${lastCollection.name}`, COLLECTION_READY_SELECTOR,
    tabs.nth(COLLECTIONS.length - 1), COLLECTION_CONTENT_SELECTOR)
  /** Collection shown before each tab-to-tab return. */
  let previous = lastCollection.name
  for (const [index, collection] of COLLECTIONS.entries()) {
    transitions.push(await measureTransition(page, `Tab cycle: ${previous} → ${collection.name}`,
      COLLECTION_READY_SELECTOR, tabs.nth(index), COLLECTION_CONTENT_SELECTOR))
    previous = collection.name
  }
  transitions.push(await measureTransition(page, `${previous} → New Tab`, NEW_TAB_READY_SELECTOR,
    page.getByTestId('new-tab-button')))
  // The New Tab screen opens a collection that another tab already shows as an independent view.
  transitions.push(await measureTransition(page, `New Tab → open ${COLLECTIONS[0].name}`, COLLECTION_READY_SELECTOR,
    page.getByTestId(`new-tab-collection-${COLLECTIONS[0].id}`), COLLECTION_CONTENT_SELECTOR))
  return transitions
}

/** Opens one tab per speed and scrolls only after its initial virtual window is fully hydrated. */
const measureScrollVariants = async (page: Page, tabs: Locator): Promise<MeasurementResult[]> => {
  /** One sample per wheel cadence. */
  const samples: MeasurementResult[] = []
  for (const [index, variant] of SCROLL_VARIANTS.entries()) {
    await tabs.nth(index).click()
    /** The expected collection's first Monaco editor disambiguates the tab during a switch. */
    const firstEditor = promptEditorSelector(`perf-prompt-${index * PROMPTS_PER_COLLECTION + 1}`)
    await page.waitForFunction((selector) => window.performanceTracker.isReady(selector), `${firstEditor} .monaco-editor`)
    // The 24 px left gutter stays over the collection as editor rows move past the pointer.
    await page.locator(PROMPT_COLLECTION_HOST_SELECTOR).hover({ position: { x: 12, y: 40 } })
    expect(await getElementScrollTop(page, PROMPT_COLLECTION_HOST_SELECTOR)).toBe(0)
    /** Measured duration and actual distance make delivered scrolling speed visible in the report. */
    const sample = await measureScrolling(page, `${variant.name} (${variant.intervalMs} ms wheel interval)`, variant.intervalMs)
    expect(sample.scrollDistancePx).toBeGreaterThan(0)
    samples.push(sample)
  }
  return samples
}

for (const scenario of [HOME_COLLECTION_SWITCHING, PROMPT_COLLECTION_SCROLLING].filter(isScenarioSelected)) {
  describe(scenario, () => {
    describe.configure({ mode: 'serial' })
    /** Scrolling uses one collection per speed. Switching uses all four tabs. */
    const collections = scenario === PROMPT_COLLECTION_SCROLLING ? COLLECTIONS.slice(0, SCROLL_VARIANTS.length) : COLLECTIONS
    /** Source files shared by this scenario's isolated launches. */
    const workspaceFiles = createWorkspaceFiles(collections)

    for (const run of PERFORMANCE_RUNS) {
      test(run.name, async ({ electronApp, testSetup }) => {
        // The app's own window restoration starts it maximized on the primary monitor.
        const workArea = await electronApp.evaluate(async ({ app, screen }) => {
          await app.whenReady()
          return screen.getPrimaryDisplay().workArea
        })
        await seedWindowPersistence(electronApp, { ...workArea, isMaximized: true, isFullScreen: false })
        // Restored collection tabs stay unloaded on Home until the first click.
        await seedWorkspaceState(electronApp, createDeterministicId(WORKSPACE_PATH), 'tab-session-user', null, {
          selectedTabId: 'home',
          tabs: collections.map((collection) => ({
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
        await expect(tabs).toHaveCount(collections.length)
        await expect(mainWindow.getByTestId('home-screen')).toBeVisible()
        await installFrameTracker(mainWindow)
        /** DevTools trace session, recorded only by the profiling run. */
        const tracing = run.profiled ? await startTracing(mainWindow) : null
        // Let Home and the profiler's startup work settle before the first measured transition.
        await mainWindow.waitForTimeout(1000)

        /** Measurements in display order for this scenario's summary. */
        const transitions = scenario === PROMPT_COLLECTION_SCROLLING
          ? await measureScrollVariants(mainWindow, tabs)
          : await measureSwitches(mainWindow, tabs)
        if (tracing) await stopTracing(tracing, scenario)

        saveRun(scenario, { run: run.name, profiled: run.profiled, transitions })
      })
    }
  })
}
