import type { IFs, Volume } from 'memfs'
import * as nodeFs from 'fs'
import type { PathLike } from 'fs'

interface TanstackUnifiedFs {
  existsSync(path: PathLike): boolean
  readFileSync: typeof nodeFs.readFileSync
  readdirSync: typeof nodeFs.readdirSync
  mkdirSync: typeof nodeFs.mkdirSync
  writeFileSync: typeof nodeFs.writeFileSync
}

type TanstackFsImplementation = typeof nodeFs | IFs | Volume

let current: TanstackFsImplementation = nodeFs

export function setTanstackFs(fsImpl: TanstackFsImplementation): void {
  current = fsImpl
}

function isMemFs(fs: TanstackFsImplementation): fs is IFs | Volume {
  return '__vol' in fs || '_core' in fs || 'Volume' in (fs as any)
}

export function getTanstackFs(): TanstackUnifiedFs {
  const fs = current

  if (isMemFs(fs)) {
    return {
      existsSync: fs.existsSync.bind(fs),
      readFileSync: fs.readFileSync.bind(fs) as typeof nodeFs.readFileSync,
      readdirSync: fs.readdirSync.bind(fs) as typeof nodeFs.readdirSync,
      mkdirSync: fs.mkdirSync.bind(fs) as typeof nodeFs.mkdirSync,
      writeFileSync: fs.writeFileSync.bind(fs) as typeof nodeFs.writeFileSync
    }
  }

  return fs as TanstackUnifiedFs
}
