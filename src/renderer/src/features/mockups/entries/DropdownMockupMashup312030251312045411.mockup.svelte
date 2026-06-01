<script lang="ts">
  import {
    Archive,
    Clipboard,
    ClipboardCopy,
    Copy,
    Download,
    Ellipsis,
    ExternalLink,
    FilePlus2,
    Folder,
    FolderOpen,
    MoreHorizontal,
    MoreVertical,
    Pencil,
    Pin,
    Settings,
    ShieldAlert,
    Sparkles,
    Star,
    Trash2
  } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'

  type SourceId = 'DropdownMockup312030251' | 'DropdownMockup312045411'
  type MenuTone51 = 'standard' | 'compact' | 'elevated'
  type MenuTone411 = 'glass' | 'solid' | 'compact'
  type MenuItemTone = 'normal' | 'accent' | 'danger'

  type SourceButton = {
    id: SourceId
    label: SourceId
  }

  type DropdownItem = {
    id: string
    label: string
    detail?: string
    icon: ComponentType
    tone?: MenuItemTone
    dividerBefore?: boolean
  }

  type Dropdown51 = {
    id: string
    label: string
    title: string
    subtitle: string
    meta: string
    icon: ComponentType
    buttonIcon: ComponentType
    menuTone: MenuTone51
    items: DropdownItem[]
  }

  type Dropdown411 = {
    id: string
    label: string
    title: string
    subtitle: string
    meta: string
    icon: ComponentType
    buttonIcon: ComponentType
    menuTone: MenuTone411
    items: DropdownItem[]
  }

  type OpenMenu = {
    sourceId: SourceId
    menuId: string
    x: number
    y: number
  }

  const sourceButtons: SourceButton[] = [
    { id: 'DropdownMockup312030251', label: 'DropdownMockup312030251' },
    { id: 'DropdownMockup312045411', label: 'DropdownMockup312045411' }
  ]

  const dropdowns51: Dropdown51[] = [
    {
      id: 'folder',
      label: 'Folder actions',
      title: 'Frontend Review Prompts',
      subtitle: '18 prompts',
      meta: 'Updated 11:42 AM',
      icon: Folder,
      buttonIcon: MoreVertical,
      menuTone: 'standard',
      items: [
        { id: 'open', label: 'Open', detail: 'Show prompts', icon: FolderOpen, tone: 'accent' },
        { id: 'rename', label: 'Rename', icon: Pencil },
        { id: 'duplicate', label: 'Duplicate folder', icon: Copy },
        { id: 'copy-path', label: 'Copy workspace path', icon: ClipboardCopy },
        { id: 'delete', label: 'Delete folder', icon: Trash2, tone: 'danger', dividerBefore: true }
      ]
    },
    {
      id: 'prompt',
      label: 'Prompt actions',
      title: 'Refactor plan template',
      subtitle: 'Pinned prompt',
      meta: '2,840 tokens',
      icon: Star,
      buttonIcon: Ellipsis,
      menuTone: 'elevated',
      items: [
        { id: 'open', label: 'Open', detail: 'Edit prompt', icon: ExternalLink, tone: 'accent' },
        { id: 'pin', label: 'Move to top', icon: Pin },
        { id: 'new-from', label: 'Create from this', icon: FilePlus2 },
        { id: 'archive', label: 'Archive prompt', icon: Archive },
        { id: 'purge', label: 'Remove prompt', icon: ShieldAlert, tone: 'danger', dividerBefore: true }
      ]
    },
    {
      id: 'workspace',
      label: 'Workspace tools',
      title: 'Prompt Library',
      subtitle: 'C:\\Source\\PromptApps',
      meta: '44 folders',
      icon: Settings,
      buttonIcon: MoreVertical,
      menuTone: 'compact',
      items: [
        { id: 'open', label: 'Open', icon: FolderOpen, tone: 'accent' },
        { id: 'settings', label: 'Folder settings', icon: Settings },
        { id: 'copy-name', label: 'Copy folder name', icon: ClipboardCopy },
        { id: 'archive', label: 'Archive folder', icon: Archive },
        { id: 'delete', label: 'Delete permanently', icon: Trash2, tone: 'danger', dividerBefore: true }
      ]
    }
  ]

  const dropdowns411: Dropdown411[] = [
    {
      id: 'prompt',
      label: 'Prompt actions',
      title: 'Prompt actions',
      subtitle: 'Open prompt editor',
      meta: 'glass',
      icon: Sparkles,
      buttonIcon: MoreVertical,
      menuTone: 'glass',
      items: [
        { id: 'open', label: 'Open', detail: 'Open prompt editor', icon: ExternalLink, tone: 'accent' },
        { id: 'copy', label: 'Copy prompt', detail: 'Copy merged text', icon: Clipboard },
        { id: 'duplicate', label: 'Duplicate', detail: 'Create editable copy', icon: Copy },
        { id: 'rename', label: 'Rename', icon: Pencil },
        { id: 'delete', label: 'Delete prompt', detail: 'Move to trash', icon: Trash2, tone: 'danger' }
      ]
    },
    {
      id: 'folder',
      label: 'Folder options',
      title: 'Folder options',
      subtitle: 'Show folder contents',
      meta: 'solid',
      icon: Folder,
      buttonIcon: MoreHorizontal,
      menuTone: 'solid',
      items: [
        { id: 'open', label: 'Open', detail: 'Show folder contents', icon: Folder, tone: 'accent' },
        { id: 'pin', label: 'Pin to sidebar', icon: Pin },
        { id: 'export', label: 'Export folder', detail: 'Save prompt bundle', icon: Download },
        { id: 'archive', label: 'Archive folder', icon: Archive },
        { id: 'delete', label: 'Delete folder', icon: Trash2, tone: 'danger' }
      ]
    },
    {
      id: 'selection',
      label: 'Selection',
      title: 'Selection',
      subtitle: 'Selected prompts',
      meta: 'compact',
      icon: Clipboard,
      buttonIcon: MoreHorizontal,
      menuTone: 'compact',
      items: [
        { id: 'open', label: 'Open', icon: ExternalLink, tone: 'accent' },
        { id: 'copy', label: 'Copy all', icon: Clipboard },
        { id: 'improve', label: 'Improve wording', icon: Sparkles },
        { id: 'remove', label: 'Remove selection', icon: Trash2, tone: 'danger' }
      ]
    }
  ]

  let focusedSourceId = $state<SourceId>('DropdownMockup312030251')
  let openMenu = $state<OpenMenu | null>(null)
  let hoveredTriggerId = $state<string | null>(null)
  let hoveredItemId = $state<string | null>(null)

  const activeDropdown51 = $derived.by(() => {
    const currentMenu = openMenu
    if (currentMenu?.sourceId !== 'DropdownMockup312030251') return null
    return dropdowns51.find((dropdown) => dropdown.id === currentMenu.menuId) ?? null
  })

  const activeDropdown411 = $derived.by(() => {
    const currentMenu = openMenu
    if (currentMenu?.sourceId !== 'DropdownMockup312045411') return null
    return dropdowns411.find((dropdown) => dropdown.id === currentMenu.menuId) ?? null
  })

  const getTriggerKey = (sourceId: SourceId, menuId: string) => `${sourceId}:${menuId}`

  const openDropdown = (event: MouseEvent, sourceId: SourceId, menuId: string) => {
    event.stopPropagation()

    openMenu = {
      sourceId,
      menuId,
      x: Math.min(event.clientX + 12, window.innerWidth - 260),
      y: Math.min(event.clientY - 8, window.innerHeight - 340)
    }
    hoveredItemId = null
  }

  const closeDropdown = () => {
    openMenu = null
    hoveredItemId = null
  }

  const sourceButtonStyle = (sourceId: SourceId) => {
    const isFocused = focusedSourceId === sourceId

    return [
      'height: 34px',
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'border-radius: var(--cthulhu-ui-radius-control)',
      `border: 1px solid ${isFocused ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-neutral-interactive-normal-border)'}`,
      `background: ${isFocused ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'}`,
      'color: var(--ui-hoverable-text)',
      'padding: 0 12px',
      'font-size: 12px',
      'font-weight: 650',
      'cursor: pointer',
      'transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease'
    ].join('; ')
  }

  const sourcePanelStyle = (sourceId: SourceId) => {
    const isFocused = focusedSourceId === sourceId

    return [
      'display: grid',
      'gap: 10px',
      'align-content: start',
      'border-radius: var(--cthulhu-ui-radius-card)',
      `border: 1px solid ${isFocused ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-card-normal-border)'}`,
      'background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
      'box-shadow: var(--cthulhu-ui-shadow-card)',
      'padding: 14px'
    ].join('; ')
  }

  const launcherStyle = (sourceId: SourceId, menuId: string) => {
    const triggerKey = getTriggerKey(sourceId, menuId)
    const isHovered = hoveredTriggerId === triggerKey
    const isActive = openMenu?.sourceId === sourceId && openMenu.menuId === menuId

    return [
      'display: grid',
      'grid-template-columns: 38px minmax(0, 1fr) auto',
      'align-items: center',
      'gap: 11px',
      'border-radius: var(--cthulhu-ui-radius-card)',
      `border: 1px solid ${isHovered || isActive ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-card-normal-border)'}`,
      `background: ${isHovered || isActive ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-card-inset-surface)'}`,
      'padding: 12px',
      'color: var(--ui-normal-text)',
      'transition: background-color 120ms ease, border-color 120ms ease'
    ].join('; ')
  }

  const tileStyle = (sourceId: SourceId) => {
    const background =
      sourceId === 'DropdownMockup312030251'
        ? 'var(--ui-accent-blue-normal-surface)'
        : 'var(--ui-accent-green-normal-surface)'
    const color =
      sourceId === 'DropdownMockup312030251'
        ? 'var(--ui-accent-blue-icon-glyph)'
        : 'var(--ui-accent-green-icon-glyph)'

    return [
      'width: 38px',
      'height: 38px',
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'border-radius: var(--cthulhu-ui-radius-control)',
      `background: ${background}`,
      `color: ${color}`
    ].join('; ')
  }

  const triggerButtonStyle = (sourceId: SourceId, menuId: string) => {
    const triggerKey = getTriggerKey(sourceId, menuId)
    const isHovered = hoveredTriggerId === triggerKey
    const isActive = openMenu?.sourceId === sourceId && openMenu.menuId === menuId

    return [
      'height: 34px',
      'min-width: 34px',
      'display: inline-flex',
      'align-items: center',
      'justify-content: center',
      'border-radius: var(--cthulhu-ui-radius-icon-button)',
      `border: 1px solid ${isHovered || isActive ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-neutral-interactive-normal-border)'}`,
      `background: ${isHovered || isActive ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'}`,
      'color: var(--ui-hoverable-text)',
      'cursor: pointer',
      'transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease'
    ].join('; ')
  }

  const menuSurfaceStyle51 = (tone: MenuTone51, x: number, y: number) => {
    const padding = tone === 'compact' ? '6px' : '8px'
    const width = tone === 'compact' ? '210px' : '236px'

    return [
      'position: fixed',
      `left: ${Math.max(16, x)}px`,
      `top: ${Math.max(16, y)}px`,
      `width: ${width}`,
      `padding: ${padding}`,
      'border-radius: var(--cthulhu-ui-radius-card)',
      'border: 1px solid var(--ui-card-normal-border)',
      'background: var(--ui-card-solid-surface)',
      'box-shadow: 0 20px 55px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight)',
      'z-index: 30',
      'pointer-events: auto'
    ].join('; ')
  }

  const menuSurfaceStyle411 = (tone: MenuTone411, x: number, y: number) => {
    const toneStyle =
      tone === 'solid'
        ? 'border-color: var(--ui-neutral-hover-border);'
        : tone === 'compact'
          ? 'border-color: var(--ui-neutral-interactive-normal-border);'
          : 'border-color: var(--ui-card-normal-border); backdrop-filter: blur(18px);'

    return [
      'position: fixed',
      `left: ${Math.max(16, x)}px`,
      `top: ${Math.max(16, y)}px`,
      'z-index: 30',
      'width: 236px',
      'padding: 8px',
      'border: 1px solid',
      'border-radius: 8px',
      'background: var(--ui-card-solid-surface)',
      'color: var(--ui-normal-text)',
      'pointer-events: auto',
      toneStyle
    ].join('; ')
  }

  const menuItemStyle51 = (item: DropdownItem) => {
    const isHovered = hoveredItemId === item.id
    const tone = item.tone ?? 'normal'

    const surface =
      tone === 'danger'
        ? isHovered
          ? 'var(--ui-danger-hover-surface)'
          : 'transparent'
        : tone === 'accent'
          ? isHovered
            ? 'var(--ui-accent-hover-surface)'
            : 'transparent'
          : isHovered
            ? 'var(--ui-neutral-hover-surface)'
            : 'transparent'

    const color =
      tone === 'danger'
        ? 'var(--ui-danger-icon-glyph)'
        : tone === 'accent'
          ? 'var(--ui-accent-normal-text)'
          : 'var(--ui-hoverable-text)'

    return [
      'width: 100%',
      'min-height: 38px',
      'display: grid',
      'grid-template-columns: 20px minmax(0, 1fr)',
      'align-items: center',
      'gap: 10px',
      'border: 1px solid transparent',
      'border-radius: var(--cthulhu-ui-radius-control)',
      `background: ${surface}`,
      `color: ${color}`,
      'padding: 7px 9px',
      'text-align: left',
      'font-size: 13px',
      'font-weight: 500',
      'line-height: 18px',
      'cursor: pointer',
      'transition: background-color 120ms ease, color 120ms ease'
    ].join('; ')
  }

  const menuItemStyle411 = (item: DropdownItem) => {
    const isHovered = hoveredItemId === item.id
    const color =
      item.tone === 'danger'
        ? 'var(--ui-danger-icon-glyph)'
        : item.tone === 'accent'
          ? 'var(--ui-accent-normal-text)'
          : 'var(--ui-hoverable-text)'
    const hoverStyle =
      item.tone === 'danger'
        ? 'background: var(--ui-danger-hover-surface); border-color: var(--ui-danger-hover-border); color: var(--ui-danger-icon-glyph);'
        : item.tone === 'accent'
          ? 'background: var(--ui-accent-hover-surface); border-color: var(--ui-accent-hover-border); color: var(--ui-normal-text);'
          : 'background: var(--ui-neutral-hover-surface); border-color: var(--ui-neutral-hover-border); color: var(--ui-normal-text);'

    return [
      'width: 100%',
      'min-height: 42px',
      'display: grid',
      'grid-template-columns: 18px minmax(0, 1fr)',
      'gap: 10px',
      'align-items: center',
      'border: 1px solid transparent',
      'border-radius: 6px',
      'background: transparent',
      `color: ${color}`,
      'padding: 8px 10px',
      'text-align: left',
      'cursor: pointer',
      'transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease',
      isHovered ? hoverStyle : ''
    ].join('; ')
  }

  const selectMenuItem = (event: MouseEvent) => {
    event.stopPropagation()
    closeDropdown()
  }
</script>

<div
  style="position: relative; width: min(1080px, 100%); min-height: 560px; padding: 4px; color: var(--ui-normal-text); pointer-events: auto;"
>
  <div style="display: grid; gap: 14px;">
    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      {#each sourceButtons as sourceButton (sourceButton.id)}
        <button
          type="button"
          style={sourceButtonStyle(sourceButton.id)}
          onclick={() => (focusedSourceId = sourceButton.id)}
        >
          {sourceButton.label}
        </button>
      {/each}
    </div>

    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">
      <section style={sourcePanelStyle('DropdownMockup312030251')}>
        {#each dropdowns51 as dropdown (dropdown.id)}
          {@const Icon = dropdown.icon}
          {@const ButtonIcon = dropdown.buttonIcon}
          {@const triggerKey = getTriggerKey('DropdownMockup312030251', dropdown.id)}

          <article
            style={launcherStyle('DropdownMockup312030251', dropdown.id)}
            onpointerenter={() => (hoveredTriggerId = triggerKey)}
            onpointerleave={() => (hoveredTriggerId = null)}
          >
            <div style={tileStyle('DropdownMockup312030251')} aria-hidden="true">
              <Icon size={18} strokeWidth={2.3} />
            </div>

            <div style="display: grid; gap: 3px; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <h2 style="margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 20px; font-weight: 650;">
                  {dropdown.title}
                </h2>
                <span style="flex: none; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); padding: 2px 7px; font-size: 11px; line-height: 15px;">
                  {dropdown.menuTone}
                </span>
              </div>
              <p style="margin: 0; overflow: hidden; color: var(--ui-secondary-text); font-size: 12px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap;">
                {dropdown.subtitle} - {dropdown.meta}
              </p>
            </div>

            <button
              type="button"
              aria-label={dropdown.label}
              aria-haspopup="menu"
              aria-expanded={openMenu?.sourceId === 'DropdownMockup312030251' && openMenu.menuId === dropdown.id}
              style={triggerButtonStyle('DropdownMockup312030251', dropdown.id)}
              onclick={(event) => openDropdown(event, 'DropdownMockup312030251', dropdown.id)}
            >
              <ButtonIcon size={17} strokeWidth={2.4} />
            </button>
          </article>
        {/each}
      </section>

      <section style={sourcePanelStyle('DropdownMockup312045411')}>
        {#each dropdowns411 as dropdown (dropdown.id)}
          {@const Icon = dropdown.icon}
          {@const ButtonIcon = dropdown.buttonIcon}
          {@const triggerKey = getTriggerKey('DropdownMockup312045411', dropdown.id)}

          <article
            style={launcherStyle('DropdownMockup312045411', dropdown.id)}
            onpointerenter={() => (hoveredTriggerId = triggerKey)}
            onpointerleave={() => (hoveredTriggerId = null)}
          >
            <div style={tileStyle('DropdownMockup312045411')} aria-hidden="true">
              <Icon size={18} strokeWidth={2.3} />
            </div>

            <div style="display: grid; gap: 3px; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <h2 style="margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; line-height: 20px; font-weight: 650;">
                  {dropdown.title}
                </h2>
                <span style="flex: none; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); padding: 2px 7px; font-size: 11px; line-height: 15px;">
                  {dropdown.menuTone}
                </span>
              </div>
              <p style="margin: 0; overflow: hidden; color: var(--ui-secondary-text); font-size: 12px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap;">
                {dropdown.subtitle} - {dropdown.meta}
              </p>
            </div>

            <button
              type="button"
              aria-label={dropdown.label}
              aria-haspopup="menu"
              aria-expanded={openMenu?.sourceId === 'DropdownMockup312045411' && openMenu.menuId === dropdown.id}
              style={triggerButtonStyle('DropdownMockup312045411', dropdown.id)}
              onclick={(event) => openDropdown(event, 'DropdownMockup312045411', dropdown.id)}
            >
              <ButtonIcon size={17} strokeWidth={2.4} />
            </button>
          </article>
        {/each}
      </section>
    </div>
  </div>

  {#if openMenu}
    <div
      style="position: fixed; inset: 0; z-index: 29; pointer-events: auto;"
      role="presentation"
      onpointerdown={closeDropdown}
    >
      {#if activeDropdown51}
        <div
          role="menu"
          tabindex="0"
          aria-label={activeDropdown51.label}
          style={menuSurfaceStyle51(activeDropdown51.menuTone, openMenu.x, openMenu.y)}
          onpointerdown={(event) => event.stopPropagation()}
        >
          <div style="display: grid; gap: 2px;">
            {#each activeDropdown51.items as item (item.id)}
              {@const ItemIcon = item.icon}

              {#if item.dividerBefore}
                <div style="height: 1px; margin: 6px 4px; background: var(--ui-neutral-muted-border);"></div>
              {/if}

              <button
                type="button"
                role="menuitem"
                style={menuItemStyle51(item)}
                onpointerenter={() => (hoveredItemId = item.id)}
                onpointerleave={() => (hoveredItemId = null)}
                onclick={selectMenuItem}
              >
                <ItemIcon size={16} strokeWidth={2.25} />
                <span style="display: grid; gap: 1px; min-width: 0;">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {item.label}
                  </span>
                  {#if item.detail}
                    <span style="overflow: hidden; color: var(--ui-muted-text); font-size: 11px; font-weight: 450; line-height: 15px; text-overflow: ellipsis; white-space: nowrap;">
                      {item.detail}
                    </span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {:else if activeDropdown411}
        <div
          role="menu"
          tabindex="0"
          aria-label={activeDropdown411.label}
          style={menuSurfaceStyle411(activeDropdown411.menuTone, openMenu.x, openMenu.y)}
          onpointerdown={(event) => event.stopPropagation()}
        >
          <div style="padding: 5px 8px 7px; color: var(--ui-muted-text); font-size: 11px; font-weight: 700; line-height: 1.2; text-transform: uppercase;">
            {activeDropdown411.title}
          </div>

          <div style="display: grid; gap: 2px;">
            {#each activeDropdown411.items as item (item.id)}
              {@const ItemIcon = item.icon}

              <button
                type="button"
                role="menuitem"
                style={menuItemStyle411(item)}
                onpointerenter={() => (hoveredItemId = item.id)}
                onpointerleave={() => (hoveredItemId = null)}
                onclick={selectMenuItem}
              >
                <ItemIcon size={17} aria-hidden="true" />
                <span style="display: grid; min-width: 0; gap: 1px;">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 650; line-height: 1.25;">
                    {item.label}
                  </span>
                  {#if item.detail}
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text); font-size: 11px; line-height: 1.25;">
                      {item.detail}
                    </span>
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
