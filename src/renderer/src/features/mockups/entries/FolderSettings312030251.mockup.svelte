<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import {
    Archive,
    ClipboardCopy,
    Copy,
    Ellipsis,
    ExternalLink,
    FilePlus2,
    Folder,
    FolderOpen,
    MoreVertical,
    Pencil,
    Pin,
    Settings,
    ShieldAlert,
    Star,
    Trash2
  } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'

  type TriggerTone = 'neutral' | 'accent' | 'quiet'
  type MenuTone = 'standard' | 'compact' | 'elevated'
  type MenuItemTone = 'normal' | 'accent' | 'danger'

  type Trigger = {
    id: string
    label: string
    title: string
    subtitle: string
    meta: string
    icon: ComponentType
    buttonIcon: ComponentType
    tone: TriggerTone
    menuTone: MenuTone
    items: MenuItem[]
  }

  type MenuItem = {
    id: string
    label: string
    detail?: string
    icon: ComponentType
    tone?: MenuItemTone
    dividerBefore?: boolean
  }

  type ActiveMenu = {
    triggerId: string
    x: number
    y: number
  }

  const triggers: Trigger[] = [
    {
      id: 'folder',
      label: 'Folder actions',
      title: 'Frontend Review Prompts',
      subtitle: '18 prompts',
      meta: 'Updated 11:42 AM',
      icon: Folder,
      buttonIcon: MoreVertical,
      tone: 'neutral',
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
      tone: 'accent',
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
      tone: 'quiet',
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

  let activeMenu = $state<ActiveMenu | null>(null)
  let hoveredTriggerId = $state<string | null>(null)
  let hoveredItemId = $state<string | null>(null)

  const activeTrigger = $derived(
    activeMenu ? triggers.find((trigger) => trigger.id === activeMenu?.triggerId) : null
  )

  const openMenu = (event: MouseEvent, triggerId: string) => {
    event.stopPropagation()

    activeMenu = {
      triggerId,
      x: Math.min(event.clientX + 12, window.innerWidth - 248),
      y: Math.min(event.clientY - 6, window.innerHeight - 280)
    }
  }

  const chooseMenuItem = (event: MouseEvent) => {
    event.stopPropagation()

    activeMenu = null
    hoveredItemId = null
  }

  const closeMenu = () => {
    activeMenu = null
    hoveredItemId = null
  }

  const buttonStyle = (trigger: Trigger) => {
    const isHovered = hoveredTriggerId === trigger.id
    const isActive = activeMenu?.triggerId === trigger.id

    if (trigger.tone === 'accent') {
      return [
        'height: 36px',
        'min-width: 36px',
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'border-radius: var(--cthulhu-ui-radius-icon-button)',
        `border: 1px solid ${isHovered || isActive ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}`,
        `background: ${isHovered || isActive ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}`,
        'color: var(--ui-accent-normal-text)',
        `box-shadow: ${isActive ? 'var(--cthulhu-ui-shadow-focus-accent)' : 'none'}`,
        'cursor: pointer',
        'transition: background-color 120ms ease, border-color 120ms ease, box-shadow 120ms ease'
      ].join('; ')
    }

    if (trigger.tone === 'quiet') {
      return [
        'height: 32px',
        'min-width: 32px',
        'display: inline-flex',
        'align-items: center',
        'justify-content: center',
        'border-radius: var(--cthulhu-ui-radius-icon-button)',
        `border: 1px solid ${isHovered || isActive ? 'var(--ui-neutral-interactive-hover-border)' : 'transparent'}`,
        `background: ${isHovered || isActive ? 'var(--ui-neutral-normal-surface)' : 'transparent'}`,
        'color: var(--ui-hoverable-text)',
        'cursor: pointer',
        'transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease'
      ].join('; ')
    }

    return [
      'height: 36px',
      'min-width: 36px',
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

  const menuStyle = (tone: MenuTone, x: number, y: number) => {
    const padding = tone === 'compact' ? '6px' : '8px'
    const width = tone === 'compact' ? '210px' : '236px'
    const background =
      tone === 'elevated'
        ? 'linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)), var(--ui-card-solid-surface)'
        : 'var(--ui-card-solid-surface)'

    return [
      'position: fixed',
      `left: ${Math.max(16, x)}px`,
      `top: ${Math.max(16, y)}px`,
      `width: ${width}`,
      `padding: ${padding}`,
      'border-radius: var(--cthulhu-ui-radius-card)',
      'border: 1px solid var(--ui-card-normal-border)',
      `background: ${background}`,
      'box-shadow: 0 20px 55px var(--ui-card-normal-shadow), inset 0 1px 0 var(--ui-card-nested-raised-inset-highlight)',
      'z-index: 30',
      'pointer-events: auto'
    ].join('; ')
  }

  const menuItemStyle = (item: MenuItem) => {
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

  const panelStyle = (tone: TriggerTone) => {
    const border =
      tone === 'accent'
        ? 'var(--ui-accent-normal-border)'
        : tone === 'quiet'
          ? 'var(--ui-neutral-muted-border)'
          : 'var(--ui-card-normal-border)'

    return [
      'display: grid',
      'grid-template-columns: 42px minmax(0, 1fr) auto',
      'align-items: center',
      'gap: 12px',
      'padding: 13px',
      'border-radius: var(--cthulhu-ui-radius-card)',
      `border: 1px solid ${border}`,
      'background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))',
      'box-shadow: var(--cthulhu-ui-shadow-card)'
    ].join('; ')
  }

  const tileStyle = (tone: TriggerTone) => {
    const background =
      tone === 'accent'
        ? 'var(--ui-accent-normal-surface)'
        : tone === 'quiet'
          ? 'var(--ui-neutral-emphasis-surface)'
          : 'var(--ui-accent-blue-normal-surface)'

    const color =
      tone === 'accent'
        ? 'var(--ui-accent-icon-glyph)'
        : tone === 'quiet'
          ? 'var(--ui-normal-text)'
          : 'var(--ui-accent-blue-icon-glyph)'

    return [
      'width: 42px',
      'height: 42px',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'border-radius: var(--cthulhu-ui-radius-control)',
      `background: ${background}`,
      `color: ${color}`
    ].join('; ')
  }

  const pillButtonStyle = (trigger: Trigger) => {
    const hoverId = `${trigger.id}-pill`
    const isHovered = hoveredTriggerId === hoverId
    const isActive = activeMenu?.triggerId === trigger.id

    return [
      'height: 34px',
      'display: inline-flex',
      'align-items: center',
      'gap: 8px',
      'border-radius: var(--cthulhu-ui-radius-control)',
      `border: 1px solid ${isHovered || isActive ? 'var(--ui-neutral-interactive-hover-border)' : 'var(--ui-neutral-interactive-normal-border)'}`,
      `background: ${isHovered || isActive ? 'var(--ui-neutral-hover-surface)' : 'var(--ui-neutral-normal-surface)'}`,
      'color: var(--ui-hoverable-text)',
      'padding: 0 11px',
      'font-size: 13px',
      'font-weight: 560',
      'cursor: pointer',
      'transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease'
    ].join('; ')
  }

  const handleDocumentPointerDown = () => closeMenu()
  const handleDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeMenu()
    }
  }

  onMount(() => {
    // Side effect: close the floating menu when focus moves to another control.
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeydown)
  })

  onDestroy(() => {
    // Side effect cleanup: remove global listeners registered for menu dismissal.
    document.removeEventListener('pointerdown', handleDocumentPointerDown)
    document.removeEventListener('keydown', handleDocumentKeydown)
  })
</script>

<div
  style="position: relative; width: min(980px, 100%); min-height: 560px; padding: 4px; color: var(--ui-normal-text); pointer-events: auto;"
>
  <div style="display: grid; gap: 16px;">
    <section
      style="display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr); gap: 16px;"
    >
      <div
        style="border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: var(--cthulhu-ui-shadow-card); padding: 16px;"
      >
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: grid; gap: 4px; min-width: 0;">
            <h2 style="margin: 0; font-size: 18px; line-height: 24px; font-weight: 650;">
              Folder settings
            </h2>
            <p style="margin: 0; color: var(--ui-secondary-text); font-size: 13px; line-height: 19px;">
              Frontend Review Prompts
            </p>
          </div>

          <button
            type="button"
            aria-label="Folder actions"
            aria-haspopup="menu"
            aria-expanded={activeMenu?.triggerId === 'folder'}
            style={buttonStyle(triggers[0])}
            onpointerenter={() => (hoveredTriggerId = 'folder')}
            onpointerleave={() => (hoveredTriggerId = null)}
            onclick={(event) => openMenu(event, 'folder')}
          >
            <MoreVertical size={17} strokeWidth={2.4} />
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 16px;">
          <div style="border: 1px solid var(--ui-card-nested-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-card-inset-surface); padding: 12px;">
            <div style="color: var(--ui-muted-text); font-size: 12px; line-height: 16px;">Prompts</div>
            <div style="margin-top: 4px; font-size: 20px; line-height: 26px; font-weight: 680;">18</div>
          </div>

          <div style="border: 1px solid var(--ui-card-nested-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-card-inset-surface); padding: 12px;">
            <div style="color: var(--ui-muted-text); font-size: 12px; line-height: 16px;">Pinned</div>
            <div style="margin-top: 4px; font-size: 20px; line-height: 26px; font-weight: 680;">4</div>
          </div>

          <div style="border: 1px solid var(--ui-card-nested-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-card-inset-surface); padding: 12px;">
            <div style="color: var(--ui-muted-text); font-size: 12px; line-height: 16px;">Updated</div>
            <div style="margin-top: 4px; font-size: 20px; line-height: 26px; font-weight: 680;">Today</div>
          </div>
        </div>
      </div>

      <aside
        style="border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: var(--ui-card-inset-surface); padding: 14px;"
      >
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div style="color: var(--ui-muted-text); font-size: 12px; line-height: 16px;">Storage</div>
          <div style="color: var(--ui-secondary-text); font-size: 12px; line-height: 16px;">Local</div>
        </div>
        <div style="margin-top: 8px; color: var(--ui-hoverable-text); font-size: 14px; line-height: 20px; font-weight: 550;">
          C:\Source\PromptApps\CthulhuPrompt
        </div>
        <div style="margin-top: 12px; display: grid; gap: 7px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--ui-secondary-text); font-size: 12px; line-height: 16px;">
            <span>Default sorting</span>
            <span>Custom</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--ui-secondary-text); font-size: 12px; line-height: 16px;">
            <span>Autosave</span>
            <span>On</span>
          </div>
        </div>
      </aside>
    </section>

    <section style="display: grid; gap: 10px;">
      {#each triggers as trigger (trigger.id)}
        {@const Icon = trigger.icon}
        {@const ButtonIcon = trigger.buttonIcon}

        <article style={panelStyle(trigger.tone)}>
          <div style={tileStyle(trigger.tone)} aria-hidden="true">
            <Icon size={20} strokeWidth={2.3} />
          </div>

          <div style="display: grid; gap: 3px; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
              <h3 style="margin: 0; overflow: hidden; color: var(--ui-normal-text); font-size: 14px; line-height: 20px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap;">
                {trigger.title}
              </h3>
              <span style="flex: 0 0 auto; border: 1px solid var(--ui-neutral-muted-border); border-radius: 999px; background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text); padding: 2px 7px; font-size: 11px; line-height: 15px;">
                {trigger.meta}
              </span>
            </div>
            <p style="margin: 0; overflow: hidden; color: var(--ui-secondary-text); font-size: 12px; line-height: 17px; text-overflow: ellipsis; white-space: nowrap;">
              {trigger.subtitle}
            </p>
          </div>

          <button
            type="button"
            aria-label={trigger.label}
            aria-haspopup="menu"
            aria-expanded={activeMenu?.triggerId === trigger.id}
            style={buttonStyle(trigger)}
            onpointerenter={() => (hoveredTriggerId = trigger.id)}
            onpointerleave={() => (hoveredTriggerId = null)}
            onclick={(event) => openMenu(event, trigger.id)}
          >
            <ButtonIcon size={17} strokeWidth={2.4} />
          </button>
        </article>
      {/each}
    </section>

    <section
      style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px; border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: var(--ui-neutral-muted-surface); padding: 12px;"
    >
      {#each triggers as trigger (trigger.id)}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={activeMenu?.triggerId === trigger.id}
          style={pillButtonStyle(trigger)}
          onpointerenter={() => (hoveredTriggerId = `${trigger.id}-pill`)}
          onpointerleave={() => (hoveredTriggerId = null)}
          onclick={(event) => openMenu(event, trigger.id)}
        >
          <Ellipsis size={16} strokeWidth={2.4} />
          <span>{trigger.label}</span>
        </button>
      {/each}
    </section>
  </div>

  {#if activeMenu && activeTrigger}
    <div style="position: fixed; inset: 0; z-index: 29; pointer-events: none;">
      <div
        role="menu"
        tabindex="0"
        aria-label={activeTrigger.label}
        style={menuStyle(activeTrigger.menuTone, activeMenu.x, activeMenu.y)}
        onpointerdown={(event) => event.stopPropagation()}
      >
        <div style="display: grid; gap: 2px;">
          {#each activeTrigger.items as item (item.id)}
            {@const ItemIcon = item.icon}

            {#if item.dividerBefore}
              <div style="height: 1px; margin: 6px 4px; background: var(--ui-neutral-muted-border);"></div>
            {/if}

            <button
              type="button"
              role="menuitem"
              style={menuItemStyle(item)}
              onpointerenter={() => (hoveredItemId = item.id)}
              onpointerleave={() => (hoveredItemId = null)}
              onclick={(event) => chooseMenuItem(event)}
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
    </div>
  {/if}
</div>
