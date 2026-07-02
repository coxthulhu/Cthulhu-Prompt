import type { Page } from '@playwright/test'

const DEFAULT_WAIT_TIMEOUT = 5000
const DEFAULT_CLICK_POSITION = { x: 40, y: 20 }
const MONACO_ROOT_SELECTOR = '.monaco-editor'
const MONACO_VIEW_LINES_SELECTOR = '.view-lines'
const MONACO_READY_SELECTOR = `${MONACO_ROOT_SELECTOR}:has(${MONACO_VIEW_LINES_SELECTOR})`

export async function waitForMonacoEditor(
  page: Page,
  editorSelector: string,
  timeout: number = DEFAULT_WAIT_TIMEOUT
): Promise<string> {
  const monacoSelector = `${editorSelector} ${MONACO_READY_SELECTOR}`
  await page.waitForSelector(monacoSelector, { state: 'visible', timeout })
  return monacoSelector
}

interface FocusOptions {
  timeout?: number
  clickPosition?: { x: number; y: number }
  ensureInputFocus?: boolean
}

export async function focusMonacoEditor(
  page: Page,
  editorSelector: string,
  options: FocusOptions = {}
): Promise<string> {
  const monacoSelector = await waitForMonacoEditor(page, editorSelector, options.timeout)
  const position = options.clickPosition ?? DEFAULT_CLICK_POSITION

  const viewLines = page.locator(`${monacoSelector} ${MONACO_VIEW_LINES_SELECTOR}`).first()
  await viewLines.waitFor({ state: 'visible', timeout: options.timeout ?? DEFAULT_WAIT_TIMEOUT })
  const box = await viewLines.boundingBox()
  if (!box) {
    throw new Error(`Could not measure Monaco editor view lines for selector: ${editorSelector}`)
  }
  await page.mouse.click(box.x + position.x, box.y + position.y)

  if (options.ensureInputFocus !== false) {
    await page.evaluate((selector) => {
      const row = document.querySelector(selector)
      if (!row) return

      const monacoRoot = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
        (candidate) => candidate.querySelector('.view-lines')
      )
      if (!monacoRoot) return

      const registry = (
        window as unknown as {
          __cthulhuMonacoEditors?: Array<{
            container: HTMLElement | null
            editor: {
              focus: () => void
              hasTextFocus?: () => boolean
            }
          }>
        }
      ).__cthulhuMonacoEditors

      const entry = registry?.find((item) => {
        if (!item?.container) return false
        return (
          item.container === monacoRoot ||
          item.container.contains(monacoRoot) ||
          monacoRoot.contains(item.container)
        )
      })
      entry?.editor.focus()

      const inputArea = monacoRoot.querySelector<HTMLElement>('textarea.inputarea')
      inputArea?.focus({ preventScroll: true })
    }, editorSelector)
  }

  await page.waitForFunction((selector) => {
    const row = document.querySelector(selector)
    if (!row) {
      return false
    }

    const container = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
      (candidate) => candidate.querySelector('.view-lines')
    )
    if (!container) {
      return false
    }

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            focus: () => void
            hasTextFocus?: () => boolean
          }
        }>
      }
    ).__cthulhuMonacoEditors

    const entry = registry?.find((item) => {
      if (!item?.container) return false
      return (
        item.container === container ||
        item.container.contains(container) ||
        container.contains(item.container)
      )
    })
    entry?.editor.focus()

    const active = document.activeElement
    return (
      (!!active && container.contains(active)) ||
      (entry?.editor.hasTextFocus ? entry.editor.hasTextFocus() : false)
    )
  }, editorSelector)

  return monacoSelector
}

interface TypeOptions extends FocusOptions {
  delay?: number
  prefixWithSpace?: boolean
}

export async function typeInMonacoEditor(
  page: Page,
  editorSelector: string,
  text: string,
  options: TypeOptions = {}
): Promise<void> {
  await focusMonacoEditor(page, editorSelector, options)
  const delay = options.delay ?? 50
  const prefix = options.prefixWithSpace ?? true
  const content = prefix ? ` ${text}` : text

  await page.keyboard.type(content, { delay })
}

export async function isMonacoEditorFocused(page: Page, editorSelector: string): Promise<boolean> {
  return await page.evaluate((selector) => {
    const row = document.querySelector(selector)
    if (!row) {
      return false
    }

    const container = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
      (candidate) => candidate.querySelector('.view-lines')
    )
    if (!container) {
      return false
    }

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: { hasTextFocus?: () => boolean }
        }>
      }
    ).__cthulhuMonacoEditors

    const entry = registry?.find((item) => {
      if (!item?.container) return false
      return (
        item.container === container ||
        item.container.contains(container) ||
        container.contains(item.container)
      )
    })

    const active = document.activeElement
    return (
      (!!active && container.contains(active)) ||
      (entry?.editor.hasTextFocus ? entry.editor.hasTextFocus() : false)
    )
  }, editorSelector)
}

export async function getMonacoEditorText(page: Page, editorSelector: string): Promise<string> {
  return await page.evaluate((selector) => {
    const row = document.querySelector(selector)
    if (!row) {
      return ''
    }

    const container = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
      (candidate) => candidate.querySelector('.view-lines')
    )
    const lines = container?.querySelector('.view-lines') as HTMLElement | null
    if (!lines) {
      return ''
    }

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getValue?: () => string
          }
        }>
      }
    ).__cthulhuMonacoEditors

    const entry = registry?.find((item) => {
      if (!item?.container) return false
      return (
        item.container === container ||
        item.container.contains(container) ||
        container.contains(item.container)
      )
    })

    const raw = entry?.editor.getValue?.() ?? lines.innerText ?? ''
    return raw
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, editorSelector)
}

export type MonacoCursorPosition = {
  lineNumber: number
  column: number
}

export async function getMonacoCursorPosition(
  page: Page,
  editorSelector: string
): Promise<MonacoCursorPosition | null> {
  return await page.evaluate((selector) => {
    const row = document.querySelector(selector)
    if (!row) {
      return null
    }

    const monacoNode = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
      (candidate) => candidate.querySelector('.view-lines')
    )
    if (!monacoNode) {
      return null
    }

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getPosition: () => { lineNumber: number; column: number } | null
          }
        }>
      }
    ).__cthulhuMonacoEditors

    if (!registry?.length) return null

    const entry = registry.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })

    if (!entry) return null

    const position = entry.editor.getPosition()
    if (!position) return null

    return {
      lineNumber: position.lineNumber,
      column: position.column
    }
  }, editorSelector)
}

export async function moveMonacoCursorToEnd(page: Page, editorSelector: string): Promise<void> {
  await page.evaluate((selector) => {
    const row = document.querySelector(selector)
    if (!row) return

    const monacoNode = Array.from(row.querySelectorAll<HTMLElement>('.monaco-editor')).find(
      (candidate) => candidate.querySelector('.view-lines')
    )
    if (!monacoNode) return

    const registry = (
      window as unknown as {
        __cthulhuMonacoEditors?: Array<{
          container: HTMLElement | null
          editor: {
            getModel: () => {
              getLineCount: () => number
              getLineMaxColumn: (lineNumber: number) => number
            } | null
            setPosition: (pos: { lineNumber: number; column: number }) => void
          }
        }>
      }
    ).__cthulhuMonacoEditors

    if (!registry?.length) return
    const entry = registry.find((item) => {
      if (!item?.container) return false
      return item.container === monacoNode || item.container.contains(monacoNode)
    })

    if (!entry) return

    const model = entry.editor.getModel()
    if (!model) return
    const lineNumber = model.getLineCount()
    const column = model.getLineMaxColumn(lineNumber)
    entry.editor.setPosition({ lineNumber, column })
  }, editorSelector)
}
