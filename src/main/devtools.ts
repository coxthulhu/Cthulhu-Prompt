import { session } from 'electron'

// Install React DevTools extension in development
export async function loadDevtools(): Promise<void> {
  // Dynamically import to avoid bundling in production
  const mod: any = await import('electron-devtools-installer')
  const installExtension: (id: any) => Promise<string> =
    typeof mod === 'function'
      ? mod
      : typeof mod?.default === 'function'
        ? mod.default
        : typeof mod?.default?.default === 'function'
          ? mod.default.default
          : (mod?.default ?? mod)

  const REACT_DEVELOPER_TOOLS = mod?.REACT_DEVELOPER_TOOLS ?? mod?.default?.REACT_DEVELOPER_TOOLS

  try {
    if (REACT_DEVELOPER_TOOLS) {
      await installExtension(REACT_DEVELOPER_TOOLS)
    } else {
      console.warn('React DevTools constant not found in electron-devtools-installer export')
    }
  } catch (err) {
    // Swallow installer errors in dev; they can be flaky across envs
    console.error('Failed to install React DevTools:', err)
  }

  // Reload any installed extensions to ensure their workers initialize
  try {
    const ses: any = session.defaultSession
    const extApi: any = ses?.extensions ?? ses

    const allExtsRaw = extApi?.getAllExtensions?.()
    const allExts =
      allExtsRaw && typeof allExtsRaw.then === 'function' ? await allExtsRaw : allExtsRaw

    let list: any[] = []
    if (Array.isArray(allExts)) list = allExts
    else if (allExts && typeof allExts.values === 'function') list = Array.from(allExts.values())
    else if (allExts && typeof allExts === 'object') list = Object.values(allExts)

    for (const ext of list) {
      const p = ext?.path
      if (!p) continue
      try {
        const res = extApi?.loadExtension?.(p)
        if (res && typeof res.then === 'function') await res
      } catch {
        // Ignore individual extension reload failures; continue with others
      }
    }
  } catch {
    // Ignore if extensions API shape differs on this Electron version
  }
}
