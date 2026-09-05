import { resolve } from 'node:path'
import { compileModule } from 'svelte/compiler'
// eslint-disable-next-line svelte/no-svelte-internal -- Supply the compiler's client runtime in Node, where SSR would omit effects.
import * as client from 'svelte/internal/client'
import ts from 'typescript'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as rowUtils from '@renderer/features/virtualizer/virtualWindowRowUtils'
import type { VirtualRowState } from '@renderer/features/virtualizer/virtualWindowRows'
import type { createVirtualWindowScrollState } from '@renderer/features/virtualizer/virtualWindowScrollState.svelte.ts'

// The Node test environment normally compiles runes for SSR, which omits the effects under test.
const { readFileSync } = await vi.importActual<typeof import('node:fs')>('node:fs')
const filename = resolve('src/renderer/src/features/virtualizer/virtualWindowScrollState.svelte.ts')
const source = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext }
}).outputText
const compiled = compileModule(source, { filename, generate: 'client', dev: true }).js.code
const executable = ts.transpileModule(compiled, {
  compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS }
}).outputText
const exports: { createVirtualWindowScrollState?: typeof createVirtualWindowScrollState } = {}
// Execute the actual client-compiled module with its real runtime and row utilities.
new Function('require', 'exports', executable)((id: string) => {
  if (id === 'svelte' || id === 'svelte/internal/client') return client
  if (id === './virtualWindowRowUtils') return rowUtils
  throw new Error(`Unexpected scroll-state dependency: ${id}`)
}, exports)
const createScrollState = exports.createVirtualWindowScrollState!

type TestRow = { kind: 'row' }
const buildRows = (leadingGrowth = 0, targetHeight = 80): VirtualRowState<TestRow>[] => {
  let offset = 0
  return [
    ['a', 185.6 + leadingGrowth], ['b', 600], ['c', 100], ['d', 100],
    ['target', targetHeight], ['after', 1200]
  ].map(([id, height], index) => {
    const row = {
      id: String(id), index, offset, height: Number(height),
      offsetDevicePx: offset * 1.25, heightDevicePx: Number(height) * 1.25,
      measuredHeightPx: Number(height), rowData: { kind: 'row' }
    } as VirtualRowState<TestRow>
    offset += Number(height)
    return row
  })
}

const disposers: Array<() => void> = []
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
})

const setup = () => {
  const rows = client.state(buildRows())
  const viewportHeight = client.state(600)
  const onScroll = vi.fn()
  let scroll!: ReturnType<typeof createScrollState<TestRow>>
  // The root owns the scroll effects and is disposed after each regression case.
  disposers.push(client.effect_root(() => {
    scroll = createScrollState<TestRow>({
      getRowStates: () => client.get(rows),
      getTotalHeightPx: () => {
        const lastRow = client.get(rows).at(-1)
        return lastRow ? lastRow.offset + lastRow.height : 0
      },
      getViewportHeight: () => client.get(viewportHeight),
      getOnUserScroll: () => undefined,
      getOnScrollTopChange: () => onScroll,
      getInitialScrollTopPx: () => 0,
      windowBandPaddingPx: 100
    })
  }))
  client.flush()
  return {
    scroll, onScroll,
    setRows: (next: VirtualRowState<TestRow>[]) => client.set(rows, next),
    setViewportHeight: (height: number) => client.set(viewportHeight, height),
    track: () => {
      scroll.scrollToAndTrackRow('target', { type: 'vertical-bias', verticalBiasPx: 300 })
      client.flush()
    }
  }
}

describe('virtual window scroll effects', () => {
  test('settles fractional vertical-bias placement without alternating scroll updates', () => {
    const { scroll, onScroll, track } = setup()
    track()
    expect(scroll.getScrollTopPx()).toBe(725.6)
    expect(scroll.getResolvedScrollTopPx()).toBe(725.6)
    expect(onScroll.mock.calls).toEqual([[725.6]])
  })

  test('uses tracked placement for viewport rows before committing changed measurements', () => {
    const { scroll, onScroll, track, setRows } = setup()
    track()
    setRows(buildRows(40, 1200))
    expect(scroll.getScrollTopPx()).toBe(725.6)
    const resolvedScrollTop = scroll.getResolvedScrollTopPx()
    expect(resolvedScrollTop).toBeCloseTo(1005.6, 10)
    expect(scroll.getResolvedScrollBottomPx()).toBeCloseTo(1605.6, 10)
    expect(scroll.getViewportRows().map((row) => row.id)).toEqual(['d', 'target'])
    client.flush()
    expect(scroll.getScrollTopPx()).toBe(resolvedScrollTop)
    expect(onScroll.mock.calls).toEqual([[725.6], [resolvedScrollTop]])

    scroll.setScrollAnchorMode('top')
    client.flush()
    expect(onScroll).toHaveBeenCalledTimes(2)
    expect(scroll.getResolvedScrollTopPx()).toBe(resolvedScrollTop)
    setRows(buildRows(80, 1200))
    client.flush()
    expect(scroll.getScrollTopPx()).toBeCloseTo(1045.6, 10)
    expect(onScroll).toHaveBeenCalledTimes(3)
  })

  test('recalculates tracked placement when the viewport height changes', () => {
    const { scroll, track, setViewportHeight } = setup()
    track()
    setViewportHeight(400)
    expect(scroll.getResolvedScrollTopPx()).toBe(825.6)
    client.flush()
    expect(scroll.getScrollTopPx()).toBe(825.6)
  })

  test('keeps user scrolling in control when measurements change', () => {
    const { scroll, track, setRows } = setup()
    track()
    scroll.applyUserScrollTop(800)
    client.flush()
    setRows(buildRows(0, 1200))
    client.flush()
    expect(scroll.getScrollTopPx()).toBe(800)
    expect(scroll.getResolvedScrollTopPx()).toBe(800)
  })

  test('clamps tracked placement to the available document height', () => {
    const { scroll, setRows, track } = setup()
    setRows(buildRows().filter((row) => row.id !== 'after'))
    client.flush()
    track()
    expect(scroll.getScrollTopPx()).toBe(465.5999999999999)
    expect(scroll.getResolvedScrollTopPx()).toBe(scroll.getScrollTopPx())
  })
})
