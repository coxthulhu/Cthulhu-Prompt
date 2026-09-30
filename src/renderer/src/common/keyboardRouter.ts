/** Visual layers ordered like the screen, modal, and popup surfaces. */
type KeyboardLayer = 'screen' | 'dialog' | 'dropdown'

/** Separates shortcut recognition from execution so covered shortcuts can be consumed. */
type KeyboardBinding = {
  matches: (event: KeyboardEvent) => boolean
  /** Null consumes the matching key without performing an action. */
  run: ((event: KeyboardEvent) => void) | null
}

/** Keyboard ownership registered for the lifetime of an active UI surface. */
type KeyboardScope = {
  layer: KeyboardLayer
  bindings: KeyboardBinding[]
}

/** Layer priority mirrors the shared UI's visual stacking order. */
const layerPriority: Record<KeyboardLayer, number> = { screen: 0, dialog: 1, dropdown: 2 }
/** Imperative listener registrations; these do not drive rendered state. */
const scopes: KeyboardScope[] = []

/** Routes one shortcut, swallowing covered bindings while leaving ordinary DOM input alone. */
const routeKeydown = (event: KeyboardEvent): void => {
  /** Highest visible layer, with the newest registration first within that layer. */
  const activeScope = scopes[0]
  for (const scope of scopes) {
    /** First matching binding can be recognized without invoking its background component. */
    const binding = scope.bindings.find((candidate) => candidate.matches(event))
    if (!binding) continue

    event.preventDefault()
    event.stopImmediatePropagation()
    if (scope === activeScope || activeScope.layer === 'screen') binding.run?.(event)
    return
  }
}

/** Registers a surface and returns cleanup for its closing or unmounting lifecycle. */
export const registerKeyboardScope = (scope: KeyboardScope): (() => void) => {
  if (scopes.length === 0) window.addEventListener('keydown', routeKeydown, true)
  scopes.unshift(scope)
  scopes.sort((left, right) => layerPriority[right.layer] - layerPriority[left.layer])

  return () => {
    scopes.splice(scopes.indexOf(scope), 1)
    if (scopes.length === 0) window.removeEventListener('keydown', routeKeydown, true)
  }
}
