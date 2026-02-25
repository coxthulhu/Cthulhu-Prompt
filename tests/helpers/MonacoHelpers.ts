import type { Page } from '@playwright/test'

const DEFAULT_WAIT_TIMEOUT = 5000
const DEFAULT_CLICK_POSITION = { x: 40, y: 20 }

export async function waitForMonacoEditor(
  page: Page,
  editorSelector: string,
  timeout: number = DEFAULT_WAIT_TIMEOUT
): Promise<string> {
  const monacoSelector = `${editorSelector} .monaco-editor`
  await page.waitForSelector(monacoSelector, { state: 'visible', timeout })
  await page.waitForSelector(`${monacoSelector} textarea.inputarea`, {
    state: 'attached',
    timeout
  })
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

  await page.locator(monacoSelector).click({ position })

  if (options.ensureInputFocus !== false) {
    await page.locator(`${monacoSelector} textarea.inputarea`).click({ force: true })
  }

  await page.waitForFunction((selector) => {
    const container = document.querySelector(selector)
    const active = document.activeElement
    return !!container && !!active && container.contains(active)
  }, monacoSelector)

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
  const monacoSelector = `${editorSelector} .monaco-editor`
  return await page.evaluate((selector) => {
    const container = document.querySelector(selector) as HTMLElement | null
    if (!container) {
      return false
    }

    const active = document.activeElement
    return !!active && container.contains(active)
  }, monacoSelector)
}

export async function getMonacoEditorText(page: Page, editorSelector: string): Promise<string> {
  const monacoSelector = `${editorSelector} .monaco-editor`
  return await page.evaluate((selector) => {
    const container = document.querySelector(selector)
    const lines = container?.querySelector('.view-lines') as HTMLElement | null
    if (!lines) {
      return ''
    }

    const raw = lines.innerText || ''
    return raw
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }, monacoSelector)
}

export type MonacoCursorPosition = {
  lineNumber: number
  column: number
}

export async function getMonacoCursorPosition(
  page: Page,
  editorSelector: string
): Promise<MonacoCursorPosition | null> {
  const monacoSelector = `${editorSelector} .monaco-editor`
  return await page.evaluate((selector) => {
    const monacoNode = document.querySelector(selector)
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
  }, monacoSelector)
}

export async function moveMonacoCursorToEnd(page: Page, editorSelector: string): Promise<void> {
  const monacoSelector = `${editorSelector} .monaco-editor`
  await page.evaluate((selector) => {
    const monacoNode = document.querySelector(selector)
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
  }, monacoSelector)
}
