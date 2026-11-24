import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { CDPSession, Locator, Page } from 'playwright'
import { MONACO_PLACEHOLDER_SELECTOR } from '../helpers/PromptCollectionSelectors'

/** Raw frame data from the first input until navigation is ready or the scrolling interval ends. */
type FrameSample = {
  elapsedMs: number
  /** Virtual collection offset in the final sampled frame, measured from the verified top. */
  scrollDistancePx?: number
  frameIntervalsMs: number[]
  longAnimationFrames: Array<{ startTime: number; duration: number; blockingDuration: number }>
}

declare global {
  interface Window {
    /** In-page frame tracker installed by installFrameTracker. */
    performanceTracker: {
      isReady: (selector: string) => boolean
      arm: (label: string, until: string | number) => void
      result: () => Promise<FrameSample>
    }
  }
}

/** Frame statistics shared by navigation and scrolling, with the measurements specific to each. */
export type MeasurementResult = Omit<FrameSample, 'elapsedMs'> & {
  label: string
  readyMs?: number
  scrollDurationMs?: number
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
  transitions: MeasurementResult[]
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

/** Installs one animation-frame loop and long-frame observer for both navigation and scrolling. */
export const installFrameTracker = async (page: Page): Promise<void> => {
  await page.evaluate(({ overlaySelector, placeholderSelector, unbuiltEditorSelector, settleMs }) => {
    /** Frame timestamps including the last frame before the first input. */
    let frameTimes: number[] = []
    /** Long animation frames reported since the last completed transition. */
    let longFrames: FrameSample['longAnimationFrames'] = []
    /** Resolves with the armed measurement even if it finishes before the driver reads it. */
    let result: Promise<FrameSample>
    /** Input and end condition for the current sample. */
    let pending: {
      label: string
      until: string | number
      startTime: number | null
      endTime: number | null
      resolve: (sample: FrameSample) => void
    } | null = null

    /** Copies long-frame entries, including any still queued at the final sample boundary. */
    const collectLongFrames = (entries: PerformanceEntry[]): void => {
      for (const entry of entries) {
        longFrames.push({ startTime: entry.startTime, duration: entry.duration,
          blockingDuration: (entry as PerformanceEntry & { blockingDuration: number }).blockingDuration })
      }
    }
    /** Observer whose buffered records can be drained before resolving a sample. */
    const observer = new PerformanceObserver((list) => collectLongFrames(list.getEntries()))
    observer.observe({ type: 'long-animation-frame' })

    /** Ready once the destination's element is mounted, the loading overlay is gone, and every editor is built. */
    const isReady = (readySelector: string): boolean =>
      document.querySelector(readySelector) !== null &&
      document.querySelector(overlaySelector) === null &&
      document.querySelector(placeholderSelector) === null &&
      document.querySelector(unbuiltEditorSelector) === null

    /** Marks navigation readiness or the end of the timed scroll and collects frame intervals. */
    const onFrame = (time: number): void => {
      frameTimes.push(time)
      if (pending && pending.startTime !== null) {
        /** Navigation includes the existing post-load settle. Scrolling samples only the wheel gesture. */
        const scrolling = typeof pending.until === 'number'
        if (pending.endTime === null && (typeof pending.until === 'number'
          ? time - pending.startTime >= pending.until
          : isReady(pending.until))) {
          pending.endTime = time
          performance.measure(pending.label, { start: pending.startTime, end: time })
        }
        if (pending.endTime !== null && time >= pending.endTime + (scrolling ? 0 : settleMs)) {
          /** Completed sample boundaries in the renderer clock. */
          const { startTime, endTime, resolve } = pending
          pending = null
          /** Snapshot distance and frame intervals at the same cutoff. */
          const scrollDistancePx = scrolling
            ? window.svelteVirtualWindowTestControls!.getScrollTop!('prompt-collection-virtual-window') ?? undefined
            : undefined
          /** Frame intervals through the cutoff, including the frame containing the first input. */
          const frameIntervalsMs = frameTimes.slice(1).map((frameTime, index) => frameTime - frameTimes[index])
          /** Chromium publishes a long-frame entry after its rendering work completes. */
          const finish = (): void => {
            collectLongFrames(observer.takeRecords())
            resolve({
              elapsedMs: endTime - startTime, scrollDistancePx, frameIntervalsMs,
              longAnimationFrames: longFrames.filter((frame) => frame.startTime + frame.duration > startTime && frame.startTime < time)
            })
            longFrames = []
          }
          if (scrolling) requestAnimationFrame(finish)
          else finish()
        }
      }
      requestAnimationFrame(onFrame)
    }
    requestAnimationFrame(onFrame)

    window.performanceTracker = {
      isReady,
      arm(label, until) {
        result = new Promise((resolve) => {
          pending = { label, until, startTime: null, endTime: null, resolve }
        })
        // Keep the frame containing the first input and exclude setup frames.
        addEventListener(typeof until === 'number' ? 'wheel' : 'pointerdown', (event) => {
          pending!.startTime = event.timeStamp
          frameTimes = frameTimes.slice(-1)
        }, { capture: true, once: true, passive: true })
      },
      result: () => result
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

/** Summarizes the same frame statistics for both benchmark scenarios. */
const summarizeFrames = (label: string, { frameIntervalsMs, longAnimationFrames }: FrameSample): MeasurementResult => ({
  label,
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
})

/** Measures from the tab press until the settle after the destination becomes ready. */
export const measureTransition = async (
  page: Page, label: string, readySelector: string, target: Locator
): Promise<MeasurementResult> => {
  await page.evaluate(({ label, readySelector }) => window.performanceTracker.arm(label, readySelector), { label, readySelector })
  await target.click()
  /** Renderer frames and time to readiness for this transition. */
  const sample = await page.evaluate(() => window.performanceTracker.result())
  return { ...summarizeFrames(label, sample), readyMs: round(sample.elapsedMs) }
}

/** Times ten seconds of 120-unit wheel input at the requested cadence over the collection. */
export const measureScrolling = async (
  page: Page, label: string, intervalMs: number
): Promise<MeasurementResult> => {
  /** Time between the first wheel event and the end of the frame sample. */
  const durationMs = 10_000
  await page.evaluate(({ label, durationMs }) => window.performanceTracker.arm(label, durationMs), { label, durationMs })
  // Schedule in the driver so a slow renderer cannot slow down the emulated mouse.
  await Promise.all(Array.from({ length: durationMs / intervalMs }, async (_, index) => {
    await delay(index * intervalMs)
    await page.mouse.wheel(0, 120)
  }))
  /** Frame sample ending on the first animation frame at or beyond ten seconds. */
  const sample = await page.evaluate(() => window.performanceTracker.result())
  return { ...summarizeFrames(label, sample), scrollDurationMs: round(sample.elapsedMs), scrollDistancePx: sample.scrollDistancePx }
}

/** Summary columns, each the median of the measured runs. */
const SUMMARY_COLUMNS: Array<[string, keyof MeasurementResult]> = [
  ['Ready ms', 'readyMs'],
  ['Scroll ms', 'scrollDurationMs'],
  ['Distance px', 'scrollDistancePx'],
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
    /** Only show metrics collected by this scenario. */
    const columns = SUMMARY_COLUMNS.filter(([, key]) => measured[0]?.transitions[0]?.[key] !== undefined)
    /** One row per transition, matched by position across runs. */
    const rows = (measured[0]?.transitions ?? []).map((transition, index) => `| ${transition.label} | ${columns
      .map(([, key]) => percentile(measured.map((run) => run.transitions[index][key] as number), 0.5)).join(' | ')} |`)
    return [`## ${scenario}`, '', `Median of ${measured.length} measured run(s); the profiling run is excluded.`, '',
      `| Sample | ${columns.map(([title]) => title).join(' | ')} |`,
      `| --- | ${columns.map(() => '---:').join(' | ')} |`, ...rows].join('\n')
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
