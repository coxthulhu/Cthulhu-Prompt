import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { CDPSession, Locator, Page } from 'playwright'
import { MONACO_PLACEHOLDER_SELECTOR } from '../helpers/PromptCollectionSelectors'

/** Raw frame data the in-page tracker returns for one transition. */
type TrackedTransition = {
  readyMs: number
  frameIntervalsMs: number[]
  longAnimationFrames: Array<{ startTime: number; duration: number; blockingDuration: number }>
}

declare global {
  interface Window {
    /** In-page frame tracker installed by installFrameTracker. */
    performanceTracker: {
      measure: (label: string, readySelector: string) => Promise<TrackedTransition>
    }
  }
}

/** One transition's frame statistics with its raw samples. */
export type TransitionResult = TrackedTransition & {
  label: string
  frameCount: number
  p50FrameMs: number
  p95FrameMs: number
  maxFrameMs: number
  framesOver50Ms: number
  longFrameBlockingMs: number
}

/** One measured or profiling run of a scenario. */
export type RunResult = {
  run: string
  profiled: boolean
  transitions: TransitionResult[]
}

/** Real-display launch: no headless or GPU-disabling flags, and occluded windows keep rendering. */
export const PERFORMANCE_ELECTRON_ARGS = ['./out/main/index.js', '--disable-features=CalculateNativeWinOcclusion']

/** Results folder created by RunPlaywrightPerformance.py for this invocation. */
const outputDir = process.env.PERF_OUTPUT_DIR!

/** Three measured runs, then the DevTools profiling run unless PERF_PROFILE is '0'. */
export const PERFORMANCE_RUNS = [
  ...[1, 2, 3].map((number) => ({ name: `Measured run ${number}`, profiled: false })),
  ...(process.env.PERF_PROFILE === '0' ? [] : [{ name: 'Profiling run', profiled: true }])
]

/** Scenario names requested through PERF_SCENARIOS; empty runs every scenario. */
const selectedScenarios = (process.env.PERF_SCENARIOS ?? '').split(',').filter(Boolean)

/** Whether the runner asked for this scenario. */
export const isScenarioSelected = (scenario: string): boolean =>
  selectedScenarios.length === 0 || selectedScenarios.includes(scenario)

/** DevTools Performance panel categories with JS sampling, without screenshots or advanced paint instrumentation. */
const TRACE_CATEGORIES = [
  'blink.console',
  'blink.user_timing',
  'devtools.timeline',
  'disabled-by-default-devtools.target-rundown',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'disabled-by-default-devtools.timeline.stack',
  'disabled-by-default-devtools.v8-source-rundown',
  'disabled-by-default-devtools.v8-source-rundown-sources',
  'disabled-by-default-v8.compile',
  'disabled-by-default-v8.cpu_profiler',
  'latencyInfo',
  'loading',
  'v8',
  'v8.execute'
]

/** Starts a trace through the page target as the DevTools Performance panel does, so DevTools can identify the main thread. */
export const startTracing = async (page: Page): Promise<CDPSession> => {
  /** Session that owns the trace until it is streamed to disk. */
  const session = await page.context().newCDPSession(page)
  await session.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    traceConfig: { includedCategories: TRACE_CATEGORIES, traceBufferSizeInKb: 512 * 1024 }
  })
  return session
}

/** Stops the trace and streams it beside the results after recording has ended. */
export const stopTracing = async (session: CDPSession, scenario: string): Promise<void> => {
  /** Resolves once Chromium has flushed every process's events. */
  const completed = new Promise<{ stream?: string; dataLossOccurred: boolean }>((resolve) =>
    session.once('Tracing.tracingComplete', resolve))
  await session.send('Tracing.end')
  const { stream, dataLossOccurred } = await completed
  if (dataLossOccurred) throw new Error('The trace buffer filled up, so the profile is missing later transitions')
  /** Trace file loadable in the DevTools Performance panel or Perfetto. */
  const tracePath = path.join(outputDir, `${scenario}.trace.json`)
  for (let chunk = await session.send('IO.read', { handle: stream! }); ; chunk = await session.send('IO.read', { handle: stream! })) {
    // Chunks that split a multi-byte character arrive base64-encoded.
    appendFileSync(tracePath, chunk.base64Encoded ? Buffer.from(chunk.data, 'base64') : chunk.data)
    if (chunk.eof) break
  }
  await session.send('IO.close', { handle: stream! })
}

/** Frames recorded after a destination is ready; baseline runs showed no long frames after ready. */
const SETTLE_MS = 250

/** Installs one requestAnimationFrame loop and a long-animation-frame observer that time each armed transition. */
export const installFrameTracker = async (page: Page): Promise<void> => {
  await page.evaluate(({ overlaySelector, placeholderSelector, unbuiltEditorSelector, settleMs }) => {
    /** Frame start times since the current transition's last pre-click frame. */
    let frameTimes: number[] = []
    /** Long animation frames reported since the last completed transition. */
    let longFrames: TrackedTransition['longAnimationFrames'] = []
    /** Transition awaiting its click, readiness, and settle. */
    let pending: {
      label: string
      readySelector: string
      startTime: number | null
      readyTime: number | null
      resolve: (result: TrackedTransition) => void
    } | null = null

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longFrames.push({ startTime: entry.startTime, duration: entry.duration,
          blockingDuration: (entry as PerformanceEntry & { blockingDuration: number }).blockingDuration })
      }
    }).observe({ type: 'long-animation-frame' })

    // The press that triggers navigation starts the transition, keeping the frame that contains it.
    addEventListener('pointerdown', (event) => {
      if (!pending || pending.startTime !== null) return
      pending.startTime = event.timeStamp
      frameTimes = frameTimes.slice(-1)
    }, { capture: true })

    /** Ready once the destination's element is mounted, the loading overlay is gone, and every editor is built. */
    const isReady = (readySelector: string): boolean =>
      document.querySelector(readySelector) !== null &&
      document.querySelector(overlaySelector) === null &&
      document.querySelector(placeholderSelector) === null &&
      document.querySelector(unbuiltEditorSelector) === null

    /** Records each frame, labels the transition when ready, and resolves it after the settle. */
    const onFrame = (time: number): void => {
      frameTimes.push(time)
      if (pending && pending.startTime !== null) {
        if (pending.readyTime === null && isReady(pending.readySelector)) {
          pending.readyTime = time
          performance.measure(pending.label, { start: pending.startTime, end: time })
        }
        if (pending.readyTime !== null && time >= pending.readyTime + settleMs) {
          const { startTime, readyTime, resolve } = pending
          pending = null
          resolve({
            readyMs: readyTime - startTime,
            frameIntervalsMs: frameTimes.slice(1).map((frameTime, index) => frameTime - frameTimes[index]),
            longAnimationFrames: longFrames.filter((frame) => frame.startTime + frame.duration > startTime && frame.startTime < time)
          })
          longFrames = []
        }
      }
      requestAnimationFrame(onFrame)
    }
    requestAnimationFrame(onFrame)

    window.performanceTracker = {
      measure: (label, readySelector) => new Promise((resolve) => {
        pending = { label, readySelector, startTime: null, readyTime: null, resolve }
      })
    }
  }, {
    overlaySelector: '[data-testid="prompt-collection-loading-overlay"]',
    placeholderSelector: MONACO_PLACEHOLDER_SELECTOR,
    // A hydrated row drops its placeholder before Monaco finishes creating the editor asynchronously.
    unbuiltEditorSelector: '.monaco-editor-section:not(:has(.monaco-editor))',
    settleMs: SETTLE_MS
  })
}

/** Nearest-rank percentile of the values. */
const percentile = (values: number[], fraction: number): number =>
  [...values].sort((left, right) => left - right)[Math.max(0, Math.ceil(fraction * values.length) - 1)] ?? 0

/** Rounds to 0.1 ms to keep the raw results compact. */
const round = (value: number): number => Math.round(value * 10) / 10

/** Clicks the target and returns frame statistics from the press until the settle after the destination is ready. */
export const measureTransition = async (
  page: Page,
  label: string,
  readySelector: string,
  target: Locator
): Promise<TransitionResult> => {
  // The tracker arms synchronously before the click's own page calls run.
  const [{ readyMs, frameIntervalsMs, longAnimationFrames }] = await Promise.all([
    page.evaluate(({ label, readySelector }) => window.performanceTracker.measure(label, readySelector), { label, readySelector }),
    target.click()
  ])
  return {
    label,
    readyMs: round(readyMs),
    frameCount: frameIntervalsMs.length,
    p50FrameMs: round(percentile(frameIntervalsMs, 0.5)),
    p95FrameMs: round(percentile(frameIntervalsMs, 0.95)),
    maxFrameMs: round(Math.max(...frameIntervalsMs)),
    framesOver50Ms: frameIntervalsMs.filter((interval) => interval > 50).length,
    longFrameBlockingMs: round(longAnimationFrames.reduce((total, frame) => total + frame.blockingDuration, 0)),
    frameIntervalsMs: frameIntervalsMs.map(round),
    longAnimationFrames: longAnimationFrames.map((frame) => ({
      startTime: round(frame.startTime), duration: round(frame.duration), blockingDuration: round(frame.blockingDuration)
    }))
  }
}

/** Summary columns, each the median of the measured runs. */
const SUMMARY_COLUMNS: Array<[string, keyof TransitionResult]> = [
  ['Ready ms', 'readyMs'],
  ['Frames', 'frameCount'],
  ['P50 frame ms', 'p50FrameMs'],
  ['P95 frame ms', 'p95FrameMs'],
  ['Max frame ms', 'maxFrameMs'],
  ['Frames >50 ms', 'framesOver50Ms'],
  ['LoAF blocking ms', 'longFrameBlockingMs']
]

/** Formats one median table per scenario, excluding profiling runs. */
const formatSummary = (results: Record<string, RunResult[]>): string => ['# Performance Summary', ...Object.entries(results)
  .map(([scenario, runs]) => {
    /** Runs without profiler overhead. */
    const measured = runs.filter((run) => !run.profiled)
    /** One row per transition, matched by position across runs. */
    const rows = (measured[0]?.transitions ?? []).map((transition, index) => `| ${transition.label} | ${SUMMARY_COLUMNS
      .map(([, key]) => percentile(measured.map((run) => run.transitions[index][key] as number), 0.5)).join(' | ')} |`)
    return [`## ${scenario}`, '', `Median of ${measured.length} measured run(s); the profiling run is excluded.`, '',
      `| Transition | ${SUMMARY_COLUMNS.map(([title]) => title).join(' | ')} |`,
      `| --- | ${SUMMARY_COLUMNS.map(() => '---:').join(' | ')} |`, ...rows].join('\n')
  })].join('\n\n') + '\n'

/** Appends a run to results.json and rewrites summary.md, so completed runs survive a later failure. */
export const saveRun = (scenario: string, run: RunResult): void => {
  /** Raw results for every run in this invocation. */
  const resultsPath = path.join(outputDir, 'results.json')
  const results: Record<string, RunResult[]> = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : {}
  results[scenario] = [...(results[scenario] ?? []), run]
  writeFileSync(resultsPath, JSON.stringify(results))
  writeFileSync(path.join(outputDir, 'summary.md'), formatSummary(results))
}
