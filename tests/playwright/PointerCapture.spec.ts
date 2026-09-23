import { createPlaywrightTestSuite } from '../helpers/PlaywrightTestFramework'
import { expectPointerCapture, interruptPointerDrag, recordPointerId } from '../helpers/PointerCaptureHelpers'
import {
  PROMPT_FOLDER_HOST_SELECTOR,
  promptTreePromptSelector
} from '../helpers/PromptFolderSelectors'
import {
  beginPromptHandleDrag,
  beginPromptTreeRowDrag,
  dragGhostSelector,
  moveActiveDragToTarget
} from '../helpers/PromptDragDropHelpers'
import { readPromptFolderEntryIds } from '../helpers/PromptPersistenceTestHelpers'

/** Electron fixtures and browser assertions for real pointer-capture sessions. */
const { test, describe, expect } = createPlaywrightTestSuite()

describe('Pointer capture', () => {
  for (const pointerType of ['touch', 'pen'] as const) {
    test(`accepts ${pointerType} for sash and virtualized prompt dragging`, async ({ testSetup }) => {
      /** Sample workspace supports both sizing and a prompt drag in the same browser. */
      const { mainWindow, testHelpers } = await testSetup.setupAndStart({
        workspace: { scenario: 'sample' }
      })
      /** Chromium input session generates trusted device events and real pointer capture. */
      const input = await mainWindow.context().newCDPSession(mainWindow)
      /** Sends one phase of a touch or pen gesture at the requested coordinates. */
      const sendPointer = async (phase: 'down' | 'move' | 'up', x: number, y: number): Promise<void> => {
        if (pointerType === 'touch') {
          await input.send('Input.dispatchTouchEvent', {
            type: phase === 'down' ? 'touchStart' : phase === 'move' ? 'touchMove' : 'touchEnd',
            touchPoints: phase === 'up' ? [] : [{ x, y, id: 1 }]
          })
        } else {
          await input.send('Input.dispatchMouseEvent', {
            type: phase === 'down' ? 'mousePressed' : phase === 'move' ? 'mouseMoved' : 'mouseReleased',
            x, y, button: 'left', buttons: phase === 'up' ? 0 : 1,
            pointerType: 'pen', clickCount: phase === 'move' ? 0 : 1
          })
        }
      }
      await testHelpers.clickNavButton('Test Screen')
      /** Accordion sash previously rejected all non-mouse pointers. */
      const sash = mainWindow.getByTestId('test-screen-accordion-sash-active')
      await sash.scrollIntoViewIfNeeded()
      await recordPointerId(sash)
      /** Original sash geometry used to verify real movement. */
      const box = (await sash.boundingBox())!
      /** Horizontal center stays within the sash throughout the gesture. */
      const x = box.x + box.width / 2
      /** Vertical center used as the initial device contact. */
      const y = box.y + box.height / 2
      await sendPointer('down', x, y)
      await sendPointer('move', x, y + 30)
      await expectPointerCapture(sash)
      await expect.poll(async () => Math.abs((await sash.boundingBox())!.y - box.y - 30)).toBeLessThanOrEqual(2)
      await sendPointer('up', x, y + 30)
      await expect(sash).toHaveAttribute('data-dragging', 'false')

      await testHelpers.navigateToPromptFolders('Development')
      /** Source row whose implicit touch capture must transfer to its virtual frame. */
      const row = mainWindow.locator(promptTreePromptSelector('dev-1'))
      /** Stable ancestor receives capture after the four-pixel drag threshold. */
      const frame = mainWindow.getByTestId('prompt-tree-active-virtual-window').locator('..')
      await recordPointerId(frame)
      /** Row geometry used for a trusted device gesture. */
      const rowBox = (await row.boundingBox())!
      /** Source row center. */
      const rowX = rowBox.x + rowBox.width / 2
      /** Source row vertical center. */
      const rowY = rowBox.y + rowBox.height / 2
      await sendPointer('down', rowX, rowY)
      await sendPointer('move', rowX + 10, rowY + 10)
      await sendPointer('move', rowX + 20, rowY + 20)
      await expectPointerCapture(frame)
      await expect(mainWindow.locator(dragGhostSelector)).toBeVisible()
      await sendPointer('up', 1, 1)
      await expect(mainWindow.locator(dragGhostSelector)).toHaveCount(0)
      await input.detach()
    })
  }

  for (const control of ['accordion', 'sidebar', 'scrollbar'] as const) {
    for (const interruption of ['pointercancel', 'lostpointercapture'] as const) {
      test(`${control} stops and clears visuals after ${interruption}`, async ({ testSetup }) => {
        /** Virtual workspace supplies enough content for a draggable scrollbar. */
        const { mainWindow, testHelpers } = await testSetup.setupAndStart({
          workspace: { scenario: 'virtual' }
        })
        if (control === 'accordion') await testHelpers.clickNavButton('Test Screen')
        else await testHelpers.navigateToPromptFolders('Long')

        /** Stable virtual frame containing the editor scrollbar. */
        const frame = mainWindow.locator(PROMPT_FOLDER_HOST_SELECTOR).locator('..')
        if (control === 'scrollbar') await frame.hover()
        /** Actual control that must own capture, including the moving accordion sash. */
        const handle = control === 'accordion'
          ? mainWindow.getByTestId('test-screen-accordion-sash-active')
          : control === 'sidebar'
            ? mainWindow.getByTestId('app-sidebar-resize-handle')
            : frame.locator('.virtual-window-scrollbar-thumb')
        await handle.scrollIntoViewIfNeeded()
        await recordPointerId(handle)
        /** Pointer origin measured before resizing moves the handle. */
        const box = (await handle.boundingBox())!
        /** Horizontal center of the control hitbox. */
        const x = box.x + box.width / 2
        /** Vertical center of the control hitbox. */
        const y = box.y + box.height / 2
        await mainWindow.mouse.move(x, y)
        await mainWindow.mouse.down()
        await mainWindow.mouse.move(x + (control === 'sidebar' ? 40 : 0), y + (control === 'sidebar' ? 0 : 40))
        /** Browser identity proves capture was actually acquired before interruption. */
        const pointerId = await expectPointerCapture(handle)
        if (control === 'accordion') {
          await expect(handle).toHaveAttribute('data-dragging', 'true')
          // Travel beyond the sash's minimum-height limit and across the neighboring header.
          await mainWindow.mouse.move(x, y + 220, { steps: 20 })
          expect(await mainWindow.getByTestId('test-screen-accordion-header-active').evaluate(
            (element) => element.matches(':hover')
          )).toBe(false)
        }
        if (control === 'scrollbar') await expect(handle).toHaveClass(/active/)

        await interruptPointerDrag(mainWindow, handle, pointerId, interruption)
        if (control === 'accordion') await expect(handle).toHaveAttribute('data-dragging', 'false')
        if (control === 'scrollbar') await expect(handle).not.toHaveClass(/active/)
        await expect(mainWindow.locator('body')).not.toHaveCSS('cursor', /resize/)
        expect(await mainWindow.evaluate(() => document.body.style.userSelect)).toBe('')
        expect(await mainWindow.evaluate(() => document.documentElement.style.getPropertyValue('--disable-transitions'))).toBe('')
        /** Completed geometry must remain stationary while the original button stays held. */
        const stoppedBox = (await handle.boundingBox())!
        await mainWindow.mouse.move(x + 90, y + 90)
        /** Geometry after movement that formerly continued the cancelled drag. */
        const afterBox = (await handle.boundingBox())!
        expect(Math.abs(afterBox.x - stoppedBox.x)).toBeLessThanOrEqual(1)
        expect(Math.abs(afterBox.y - stoppedBox.y)).toBeLessThanOrEqual(1)
        await mainWindow.mouse.up()
      })
    }
  }

  for (const source of ['editor', 'tree'] as const) {
    for (const interruption of ['pointercancel', 'lostpointercapture'] as const) {
      test(`${source} prompt cancels a valid drop after ${interruption}`, async ({ testSetup, electronApp }) => {
        /** Sample workspace provides two prompts whose persisted order can be compared. */
        const { mainWindow, testHelpers } = await testSetup.setupAndStart({
          workspace: { scenario: 'sample' }
        })
        await testHelpers.navigateToPromptFolders('Development')
        /** Capture belongs to the source virtual frame, never the recycled row. */
        const frame = mainWindow.locator(source === 'editor'
          ? PROMPT_FOLDER_HOST_SELECTOR
          : '[data-testid="prompt-tree-active-virtual-window"]').locator('..')
        /** Existing persisted ordering must survive browser interruption unchanged. */
        const orderPath = '/ws/sample/Prompts/Development/Active/_FolderInfo/FolderOrder.json'
        /** Persisted order before the drag. */
        const before = await readPromptFolderEntryIds(electronApp, orderPath)
        await recordPointerId(frame)
        if (source === 'editor') await beginPromptHandleDrag(mainWindow, 'dev-1')
        else await beginPromptTreeRowDrag(mainWindow, 'dev-1')
        /** Captured pointer shared by movement and cancellation. */
        const pointerId = await expectPointerCapture(frame)
        await moveActiveDragToTarget(mainWindow, promptTreePromptSelector('dev-2'), 'bottom')
        await expect(mainWindow.locator('[data-drop-indicator-active="true"]')).not.toHaveCount(0)
        await interruptPointerDrag(mainWindow, frame, pointerId, interruption)
        await expect(mainWindow.locator(dragGhostSelector)).toHaveCount(0)
        await expect(mainWindow.locator('[data-drop-indicator-active="true"]')).toHaveCount(0)
        await expect(mainWindow.locator('[data-dragging="true"]')).toHaveCount(0)
        await moveActiveDragToTarget(mainWindow, promptTreePromptSelector('dev-2'), 'bottom')
        await mainWindow.mouse.up()
        await expect(mainWindow.locator('body')).not.toHaveCSS('cursor', 'grabbing')
        expect(await readPromptFolderEntryIds(electronApp, orderPath)).toEqual(before)
      })
    }
  }
})
