type SidebarRegistration = {
  id: number
  desiredWidth: number
  minWidth: number
  maxWidth: number
}

const sidebars = $state<SidebarRegistration[]>([])
let windowWidthPx = $state(window.innerWidth)

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const computeSidebarWidths = (): Array<{ id: number; width: number }> => {
  const cap = windowWidthPx / 2
  const desiredWidths = sidebars.map((sidebar) =>
    clamp(sidebar.desiredWidth, sidebar.minWidth, sidebar.maxWidth)
  )
  const totalDesired = desiredWidths.reduce((sum, width) => sum + width, 0)
  const scale = totalDesired > cap && totalDesired > 0 ? cap / totalDesired : 1
  return sidebars.map((sidebar, index) => ({
    id: sidebar.id,
    width: desiredWidths[index] * scale
  }))
}

window.addEventListener('resize', () => {
  windowWidthPx = window.innerWidth
})

let nextId = 0

export const registerSidebar = (settings: Omit<SidebarRegistration, 'id'>): number => {
  const id = (nextId += 1)
  sidebars.push({ id, ...settings })
  return id
}

export const updateSidebar = (id: number, settings: Omit<SidebarRegistration, 'id'>): void => {
  const sidebar = sidebars.find((item) => item.id === id)
  if (!sidebar) return
  sidebar.desiredWidth = settings.desiredWidth
  sidebar.minWidth = settings.minWidth
  sidebar.maxWidth = settings.maxWidth
}

export const unregisterSidebar = (id: number): void => {
  const index = sidebars.findIndex((item) => item.id === id)
  if (index === -1) return
  sidebars.splice(index, 1)
}

export const getSidebarWidth = (id: number): number | null => {
  return computeSidebarWidths().find((item) => item.id === id)?.width ?? null
}
