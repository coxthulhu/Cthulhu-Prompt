export type MonacoOverflowHostState = {
  overflowHost: HTMLDivElement | null
  overflowPaddingHost: HTMLDivElement | null
}

export const syncMonacoOverflowHost = ({
  overlayRowElement,
  overflowHost,
  overflowPaddingHost,
  padding
}: {
  overlayRowElement?: HTMLDivElement | null
  overflowHost: HTMLDivElement | null
  overflowPaddingHost: HTMLDivElement | null
  padding: string
}): MonacoOverflowHostState => {
  if (!overlayRowElement) {
    overflowPaddingHost?.remove()
    return { overflowHost: null, overflowPaddingHost: null }
  }

  const paddingHost = overflowPaddingHost ?? document.createElement('div')
  if (!overflowPaddingHost) {
    paddingHost.style.overflow = 'visible'
    paddingHost.style.boxSizing = 'border-box'
    paddingHost.style.pointerEvents = 'none'
  }
  if (paddingHost.style.padding !== padding) {
    paddingHost.style.padding = padding
  }

  const host = overflowHost ?? document.createElement('div')
  if (!overflowHost) {
    host.className = 'monaco-editor no-user-select showUnused showDeprecated vs-dark'
    host.style.position = 'relative'
    host.style.width = '0'
    host.style.height = '0'
    host.style.overflow = 'visible'
    host.style.pointerEvents = 'auto'
  }

  if (host.parentElement !== paddingHost) {
    paddingHost.appendChild(host)
  }

  if (paddingHost.parentElement !== overlayRowElement) {
    overlayRowElement.appendChild(paddingHost)
  }

  return { overflowHost: host, overflowPaddingHost: paddingHost }
}
