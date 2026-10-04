import type { EventEmitter } from 'node:events'
import type { ElectronApplication } from 'playwright'
import type { TestUpdateCommand, TestUpdateStats } from '../../src/main/IntegrationTests/TestAppUpdater'

/** Drives only the updater's external boundaries through the existing main-process test transport. */
export const controlUpdater = async (electronApp: ElectronApplication, command: TestUpdateCommand): Promise<TestUpdateStats> =>
  electronApp.evaluate(({ app }, command) => new Promise<TestUpdateStats>((resolve) => {
    ;(app as EventEmitter).once('test-updater-result', resolve)
    app.emit('test-updater', command)
  }), command)
