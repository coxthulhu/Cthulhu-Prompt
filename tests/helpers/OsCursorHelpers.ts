import type { ElectronApplication, Page } from 'playwright'

/** Point in the window's content, in CSS pixels. */
export type Point = { x: number; y: number }

/** Simulates the OS cursor, which Playwright cannot move. The main process reads the given point in the window's
    content, or a point above the title bar and outside the window for null, and counts each read; the page's mouse
    also moves to a given point. */
export const moveOsCursor = async (electronApp: ElectronApplication, mainWindow: Page, point: Point | null): Promise<void> => {
  await electronApp.evaluate(({ BrowserWindow, screen }, point) => {
    /** Window content rectangle in screen DIPs, which the simulated point is relative to. */
    const bounds = BrowserWindow.getAllWindows()[0]!.getContentBounds()
    /** Simulated cursor in screen DIPs. */
    const cursor = point ? { x: bounds.x + point.x, y: bounds.y + point.y } : { x: bounds.x + 100, y: bounds.y - 10 }
    screen.getCursorScreenPoint = () => {
      /** Main-process global holding the read count across simulated moves. */
      const counter = globalThis as { cursorReads?: number }
      counter.cursorReads = (counter.cursorReads ?? 0) + 1
      return cursor
    }
  }, point)
  if (point) await mainWindow.mouse.move(point.x, point.y)
}
