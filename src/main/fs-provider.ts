import type { IFs, Volume } from 'memfs'
import * as nodeFs from 'fs'
import type { PathLike } from 'fs'

// Define a unified interface that matches Node.js fs signature patterns
interface UnifiedFs {
  existsSync(path: PathLike): boolean
  readFileSync: typeof nodeFs.readFileSync
  readdirSync: typeof nodeFs.readdirSync
  statSync: typeof nodeFs.statSync
  mkdirSync: typeof nodeFs.mkdirSync
  writeFileSync: typeof nodeFs.writeFileSync
  // Add other fs methods as needed
}

// Union type that can be either Node.js fs, memfs IFs, or Volume
type FsImplementation = typeof nodeFs | IFs | Volume

let current: FsImplementation = nodeFs

export function setFs(fsImpl: FsImplementation): void {
  current = fsImpl
}

// Type guard to check if we're using memfs (either IFs or Volume)
function isMemFs(fs: FsImplementation): fs is IFs | Volume {
  return '__vol' in fs || '_core' in fs || 'Volume' in (fs as any)
}

// Create a wrapper that provides consistent behavior and typing
export function getFs(): UnifiedFs {
  const fs = current

  if (isMemFs(fs)) {
    // For memfs, create a wrapper that matches Node.js fs types
    return {
      existsSync: fs.existsSync.bind(fs),
      readFileSync: fs.readFileSync.bind(fs) as typeof nodeFs.readFileSync,
      readdirSync: fs.readdirSync.bind(fs) as typeof nodeFs.readdirSync,
      statSync: fs.statSync.bind(fs) as typeof nodeFs.statSync,
      mkdirSync: fs.mkdirSync.bind(fs) as typeof nodeFs.mkdirSync,
      writeFileSync: fs.writeFileSync.bind(fs) as typeof nodeFs.writeFileSync
    }
  }

  // For Node.js fs, return as-is (already properly typed)
  return fs as UnifiedFs
}
