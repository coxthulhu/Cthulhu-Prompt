import { Volume } from 'memfs'
import * as path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { PersistentLogWriter } from '../../src/main/PersistentLogWriter'
import { getFs, setFs } from '../../src/main/fs-provider'

/** Each test reads and writes application logs entirely in memory. */
const filesystem = new Volume()

// Select a clean volume before constructing the production log writer.
beforeEach(() => {
  filesystem.reset()
  setFs(filesystem)
})

describe('PersistentLogWriter', () => {
  it('writes readable diagnostic context and stack details', () => {
    /** Reads the files written through the selected in-memory provider. */
    const fs = getFs()
    /** In-memory directory created by the writer. */
    const directory = '/logs'
    const writer = new PersistentLogWriter(directory, '1.2.3')

    writer.write({
      level: 'error',
      source: 'renderer-console',
      message: 'TypeError: example failure',
      location: 'file:///renderer/index.js:42',
      stack: 'TypeError: example failure\n    at savePrompt (index.js:42:10)'
    })

    const contents = fs.readFileSync(writer.currentLogPath, 'utf8')
    expect(contents).toContain('ERROR source=renderer-console appVersion=1.2.3')
    expect(contents).toContain('TypeError: example failure')
    expect(contents).toContain('location=file:///renderer/index.js:42')
    expect(contents).toContain('at savePrompt (index.js:42:10)')
  })

  it('retains only the configured number of rotated files', () => {
    /** Lists and reads the retained files through the selected in-memory provider. */
    const fs = getFs()
    /** In-memory directory used to inspect rotated files. */
    const directory = '/logs'
    const writer = new PersistentLogWriter(directory, '1.2.3', {
      maxFileSizeBytes: 180,
      retainedFileCount: 3
    })

    for (let entryIndex = 1; entryIndex <= 6; entryIndex += 1) {
      writer.write({
        level: 'error',
        source: 'rotation-test',
        message: `entry-${entryIndex.toString()} ${'x'.repeat(80)}`
      })
    }

    const logFiles = fs.readdirSync(directory).sort()
    expect(logFiles).toEqual([
      'cthulhu-prompt.1.log',
      'cthulhu-prompt.2.log',
      'cthulhu-prompt.log'
    ])
    expect(fs.readFileSync(writer.currentLogPath, 'utf8')).toContain('entry-6')
    expect(
      logFiles.map((fileName) => fs.readFileSync(path.join(directory, fileName), 'utf8')).join('\n')
    ).not.toContain('entry-1')
  })
})
