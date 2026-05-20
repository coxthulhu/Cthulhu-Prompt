const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

const createFileTextIcon = (): SVGSVGElement => {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg')
  icon.setAttribute('class', 'sidebarPromptTreeSettingsIcon')
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('fill', 'none')
  icon.setAttribute('stroke', 'currentColor')
  icon.setAttribute('stroke-width', '2')
  icon.setAttribute('stroke-linecap', 'round')
  icon.setAttribute('stroke-linejoin', 'round')

  for (const pathData of [
    'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z',
    'M14 2v5a1 1 0 0 0 1 1h5',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8'
  ]) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path')
    path.setAttribute('d', pathData)
    icon.appendChild(path)
  }

  return icon
}

export const createPromptDragGhostElement = (title: string): HTMLElement => {
  const ghost = document.createElement('div')
  ghost.className = 'promptDragGhost'
  ghost.setAttribute('data-drag-ghost-kind', 'prompt')

  const row = document.createElement('div')
  row.className = 'sidebarPromptTreeSettingsButton promptDragGhostButton'
  row.setAttribute('data-active', 'false')
  row.setAttribute('data-dragging', 'false')

  const label = document.createElement('span')
  label.className = 'sidebarPromptTreeSettingsLabel'
  label.textContent = title

  row.append(createFileTextIcon(), label)
  ghost.appendChild(row)
  return ghost
}
