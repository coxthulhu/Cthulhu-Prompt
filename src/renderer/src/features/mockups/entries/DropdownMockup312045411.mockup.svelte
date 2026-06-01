<script lang="ts">
  import {
    Archive,
    Clipboard,
    Copy,
    Download,
    ExternalLink,
    FileText,
    Folder,
    MoreHorizontal,
    MoreVertical,
    Pencil,
    Pin,
    Sparkles,
    Trash2
  } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'

  type MenuTone = 'glass' | 'solid' | 'compact'

  type MenuOption = {
    id: string
    label: string
    detail?: string
    icon: ComponentType
    tone?: 'normal' | 'accent' | 'danger'
  }

  type MenuConfig = {
    id: string
    title: string
    tone: MenuTone
    options: MenuOption[]
  }

  type MenuState = {
    config: MenuConfig
    x: number
    y: number
  } | null

  const menuWidth = 236
  const menuMaxHeight = 336
  const triggerButtonBaseStyle =
    'height: 34px; min-width: 34px; padding: 0 9px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: var(--cthulhu-ui-radius-control); border: 1px solid var(--ui-neutral-interactive-normal-border); background: var(--ui-neutral-normal-surface); color: var(--ui-hoverable-text); cursor: pointer; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease;'
  const menuButtonBaseStyle =
    'width: 100%; min-height: 42px; display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: center; border: 1px solid transparent; border-radius: 6px; padding: 8px 10px; text-align: left; cursor: pointer; transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, transform 120ms ease;'

  const menus: MenuConfig[] = [
    {
      id: 'prompt',
      title: 'Prompt actions',
      tone: 'glass',
      options: [
        { id: 'open', label: 'Open', detail: 'Open prompt editor', icon: ExternalLink, tone: 'accent' },
        { id: 'copy', label: 'Copy prompt', detail: 'Copy merged text', icon: Clipboard },
        { id: 'duplicate', label: 'Duplicate', detail: 'Create editable copy', icon: Copy },
        { id: 'rename', label: 'Rename', icon: Pencil },
        { id: 'delete', label: 'Delete prompt', detail: 'Move to trash', icon: Trash2, tone: 'danger' }
      ]
    },
    {
      id: 'folder',
      title: 'Folder options',
      tone: 'solid',
      options: [
        { id: 'open', label: 'Open', detail: 'Show folder contents', icon: Folder, tone: 'accent' },
        { id: 'pin', label: 'Pin to sidebar', icon: Pin },
        { id: 'export', label: 'Export folder', detail: 'Save prompt bundle', icon: Download },
        { id: 'archive', label: 'Archive folder', icon: Archive },
        { id: 'delete', label: 'Delete folder', icon: Trash2, tone: 'danger' }
      ]
    },
    {
      id: 'selection',
      title: 'Selection',
      tone: 'compact',
      options: [
        { id: 'open', label: 'Open', icon: ExternalLink, tone: 'accent' },
        { id: 'copy', label: 'Copy all', icon: Clipboard },
        { id: 'improve', label: 'Improve wording', icon: Sparkles },
        { id: 'remove', label: 'Remove selection', icon: Trash2, tone: 'danger' }
      ]
    }
  ]

  const promptRows = [
    {
      name: 'Refactor checkout flow',
      location: 'Coding / Frontend',
      description: 'Generate a scoped implementation plan with regression risks and test coverage.'
    },
    {
      name: 'Electron IPC review',
      location: 'Security / Desktop',
      description: 'Audit preload channels and flag renderer access that bypasses typed APIs.'
    },
    {
      name: 'Release note polish',
      location: 'Writing / Product',
      description: 'Turn merged PR summaries into concise release notes for a Windows build.'
    }
  ]

  let openMenu: MenuState = $state(null)
  let hoveredTrigger = $state<string | null>(null)
  let hoveredOption = $state<string | null>(null)
  let lastAction = $state('Ready')

  const clampMenuPosition = (event: MouseEvent) => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const preferredX = event.clientX + 12
    const preferredY = event.clientY - 8

    return {
      x: Math.max(12, Math.min(preferredX, viewportWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(preferredY, viewportHeight - menuMaxHeight - 12))
    }
  }

  const openDropdown = (event: MouseEvent, config: MenuConfig) => {
    event.stopPropagation()
    const position = clampMenuPosition(event)
    openMenu = { config, ...position }
    hoveredOption = null
  }

  const closeDropdown = () => {
    openMenu = null
    hoveredOption = null
  }

  const handleWindowClick = () => {
    closeDropdown()
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeDropdown()
    }
  }

  const selectOption = (event: MouseEvent, option: MenuOption) => {
    event.stopPropagation()
    lastAction = option.label
    closeDropdown()
  }

  const triggerStyle = (id: string, active = false) =>
    `${triggerButtonBaseStyle} ${
      hoveredTrigger === id || active
        ? 'background: var(--ui-neutral-hover-surface); border-color: var(--ui-neutral-interactive-hover-border); color: var(--ui-normal-text); box-shadow: 0 8px 24px var(--ui-shadow-raised);'
        : ''
    }`

  const menuSurfaceStyle = (tone: MenuTone) => {
    const toneStyle =
      tone === 'solid'
        ? 'border-color: var(--ui-neutral-hover-border); box-shadow: 0 22px 52px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight);'
        : tone === 'compact'
          ? 'border-color: var(--ui-neutral-interactive-normal-border); box-shadow: 0 18px 38px var(--ui-card-normal-shadow);'
          : 'border-color: var(--ui-card-normal-border); box-shadow: 0 24px 60px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight); backdrop-filter: blur(18px);'

    return `position: fixed; left: ${openMenu?.x ?? 0}px; top: ${openMenu?.y ?? 0}px; z-index: 20; width: ${menuWidth}px; padding: 8px; border: 1px solid; border-radius: 8px; background: var(--ui-card-solid-surface); color: var(--ui-normal-text); pointer-events: auto; ${toneStyle}`
  }

  const optionStyle = (option: MenuOption) => {
    const hovered = hoveredOption === option.id
    const normalColor =
      option.tone === 'danger'
        ? 'var(--ui-danger-icon-glyph)'
        : option.tone === 'accent'
          ? 'var(--ui-accent-normal-text)'
          : 'var(--ui-hoverable-text)'
    const hoverStyle =
      option.tone === 'danger'
        ? 'background: var(--ui-danger-hover-surface); border-color: var(--ui-danger-hover-border); color: var(--ui-danger-icon-glyph);'
        : option.tone === 'accent'
          ? 'background: var(--ui-accent-hover-surface); border-color: var(--ui-accent-hover-border); color: var(--ui-normal-text);'
          : 'background: var(--ui-neutral-hover-surface); border-color: var(--ui-neutral-hover-border); color: var(--ui-normal-text);'

    return `${menuButtonBaseStyle} background: transparent; color: ${normalColor}; ${hovered ? hoverStyle : ''}`
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<main
  style="min-height: 100%; padding: 28px; color: var(--ui-normal-text); font-family: inherit;"
>
  <section
    style="max-width: 980px; display: grid; gap: 18px;"
  >
    <div
      style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;"
    >
      <div style="display: grid; gap: 6px;">
        <h1 style="margin: 0; font-size: 22px; line-height: 1.2; font-weight: 650; letter-spacing: 0;">
          Prompt Library
        </h1>
        <p style="margin: 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.5;">
          {lastAction}
        </p>
      </div>

      <div style="display: flex; gap: 8px; align-items: center;">
        <button
          type="button"
          style={triggerStyle('selection', openMenu?.config.id === 'selection')}
          aria-label="Selection actions"
          aria-haspopup="menu"
          aria-expanded={openMenu?.config.id === 'selection'}
          onmouseenter={() => (hoveredTrigger = 'selection')}
          onmouseleave={() => (hoveredTrigger = null)}
          onclick={(event) => openDropdown(event, menus[2])}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span style="font-size: 13px; font-weight: 600;">Selected prompts</span>
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: 16px;">
      <section
        style="display: grid; gap: 10px;"
        aria-label="Prompts"
      >
        {#each promptRows as prompt, index (prompt.name)}
          <article
            style="display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 13px; border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: var(--cthulhu-ui-shadow-card);"
          >
            <div
              style="height: 36px; width: 36px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid var(--ui-accent-blue-normal-border); background: var(--ui-accent-blue-normal-surface); color: var(--ui-accent-blue-icon-glyph);"
            >
              <FileText size={17} aria-hidden="true" />
            </div>

            <div style="display: grid; min-width: 0; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <h2 style="margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; line-height: 1.25; font-weight: 650; letter-spacing: 0;">
                  {prompt.name}
                </h2>
                <span style="flex: none; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; padding: 2px 7px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); font-size: 11px; line-height: 1.25;">
                  {prompt.location}
                </span>
              </div>
              <p style="margin: 0; color: var(--ui-secondary-text); font-size: 12px; line-height: 1.45;">
                {prompt.description}
              </p>
            </div>

            <button
              type="button"
              style={triggerStyle(`prompt-${index}`, openMenu?.config.id === 'prompt')}
              aria-label={`${prompt.name} actions`}
              aria-haspopup="menu"
              aria-expanded={openMenu?.config.id === 'prompt'}
              onmouseenter={() => (hoveredTrigger = `prompt-${index}`)}
              onmouseleave={() => (hoveredTrigger = null)}
              onclick={(event) => openDropdown(event, menus[0])}
            >
              <MoreVertical size={17} aria-hidden="true" />
            </button>
          </article>
        {/each}
      </section>

      <aside
        style="display: grid; gap: 12px; align-content: start;"
      >
        <section
          style="display: grid; gap: 12px; padding: 14px; border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: var(--ui-card-inset-surface);"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 9px; min-width: 0;">
              <div style="height: 30px; width: 30px; display: inline-flex; align-items: center; justify-content: center; border-radius: 7px; border: 1px solid var(--ui-accent-green-normal-border); background: var(--ui-accent-green-normal-surface); color: var(--ui-accent-green-icon-glyph);">
                <Folder size={16} aria-hidden="true" />
              </div>
              <div style="display: grid; min-width: 0; gap: 2px;">
                <h2 style="margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 1.25; font-weight: 650; letter-spacing: 0;">
                  Coding Templates
                </h2>
                <span style="color: var(--ui-secondary-text); font-size: 12px;">18 prompts</span>
              </div>
            </div>
            <button
              type="button"
              style={triggerStyle('folder', openMenu?.config.id === 'folder')}
              aria-label="Folder options"
              aria-haspopup="menu"
              aria-expanded={openMenu?.config.id === 'folder'}
              onmouseenter={() => (hoveredTrigger = 'folder')}
              onmouseleave={() => (hoveredTrigger = null)}
              onclick={(event) => openDropdown(event, menus[1])}
            >
              <MoreHorizontal size={17} aria-hidden="true" />
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">
            <button
              type="button"
              style={triggerStyle('quick-open')}
              onmouseenter={() => (hoveredTrigger = 'quick-open')}
              onmouseleave={() => (hoveredTrigger = null)}
              onclick={(event) => openDropdown(event, menus[0])}
            >
              Open
            </button>
            <button
              type="button"
              style={triggerStyle('quick-more')}
              onmouseenter={() => (hoveredTrigger = 'quick-more')}
              onmouseleave={() => (hoveredTrigger = null)}
              onclick={(event) => openDropdown(event, menus[2])}
            >
              More
            </button>
          </div>
        </section>

        <section
          style="display: grid; gap: 8px; padding: 12px; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-card); background: var(--ui-neutral-muted-surface);"
        >
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <span style="color: var(--ui-secondary-text); font-size: 12px;">Recent action</span>
            <span style="color: var(--ui-hoverable-text); font-size: 12px; font-weight: 600;">{lastAction}</span>
          </div>
          <button
            type="button"
            style={triggerStyle('standalone')}
            onmouseenter={() => (hoveredTrigger = 'standalone')}
            onmouseleave={() => (hoveredTrigger = null)}
            onclick={(event) => openDropdown(event, menus[1])}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
            <span style="font-size: 13px; font-weight: 600;">Standalone dropdown</span>
          </button>
        </section>
      </aside>
    </div>
  </section>

  {#if openMenu}
    <div
      role="menu"
      aria-label={openMenu.config.title}
      tabindex="-1"
      style={menuSurfaceStyle(openMenu.config.tone)}
    >
      <div style="padding: 5px 8px 7px; color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 1.2; text-transform: uppercase; letter-spacing: 0.04em;">
        {openMenu.config.title}
      </div>

      <div style="display: grid; gap: 2px;">
        {#each openMenu.config.options as option (option.id)}
          {@const OptionIcon = option.icon}
          <button
            type="button"
            role="menuitem"
            style={optionStyle(option)}
            onmouseenter={() => (hoveredOption = option.id)}
            onmouseleave={() => (hoveredOption = null)}
            onclick={(event) => selectOption(event, option)}
          >
            <OptionIcon size={17} aria-hidden="true" />
            <span style="display: grid; min-width: 0; gap: 1px;">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 650; line-height: 1.25;">
                {option.label}
              </span>
              {#if option.detail}
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text); font-size: 11px; line-height: 1.25;">
                  {option.detail}
                </span>
              {/if}
            </span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</main>
