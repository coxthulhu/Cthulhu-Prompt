import { spawnSync } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'
import electron from 'electron'

// SQLite 13 bundles a Node-API binary; rebuilding it unnecessarily requires C++ tools.
// Check the binary in Electron, the runtime that actually opens workspace databases.
const result = spawnSync(
  electron,
  ['-e', `
    const assert = require('node:assert/strict')
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    try {
      db.exec('CREATE TABLE smoke (value TEXT)')
      db.prepare('INSERT INTO smoke VALUES (?)').run('ok')
      assert.equal(db.prepare('SELECT value FROM smoke').get().value, 'ok')
      console.log('SQLite bundled binary verified with Electron ' + process.versions.electron)
    } finally {
      db.close()
    }
  `],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit'
  }
)

if (result.error) throw result.error
process.exit(result.status ?? 1)
