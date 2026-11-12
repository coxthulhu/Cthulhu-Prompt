<script lang="ts">
  import type { ComponentType } from 'svelte'
  import appIcon from '@renderer/assets/cutethulhu.png'
  import {
    ArrowLeft,
    Bug,
    FileText,
    Home,
    Layers,
    LayoutGrid,
    PanelsTopLeft,
    Plus,
    Search,
    Settings,
    Settings2,
    Star,
    X
  } from 'lucide-svelte'

  type ScreenTab = {
    id: string
    label: string
    icon: ComponentType
    screenLabel: string
  }

  type WorkTab = {
    id: string
    label: string
    icon: ComponentType
    projectName?: string
  }

  type Collection = {
    name: string
    icon: ComponentType
    detail: string
    favorite?: boolean
  }

  type Project = {
    abbreviation: string
    name: string
    collections: Collection[]
  }

  const screenTabs: ScreenTab[] = [
    { id: 'home', label: 'Home', icon: Home, screenLabel: 'Home Screen' },
    { id: 'settings', label: 'Settings', icon: Settings, screenLabel: 'Settings' },
    { id: 'mockups', label: 'Mockups', icon: PanelsTopLeft, screenLabel: 'Mockups Screen' },
    { id: 'test-screen', label: 'Test Screen', icon: Bug, screenLabel: 'Test Screen' }
  ]

  const workTabs: WorkTab[] = [
    { id: 'ui-polish', label: 'UI Polish', icon: FileText, projectName: 'Cthulhu Prompt' },
    { id: 'bug-fixes', label: 'Bug Fixes', icon: FileText, projectName: 'Cthulhu Prompt' },
    { id: 'api-migration', label: 'API Migration', icon: FileText, projectName: 'Atlas Service' },
    { id: 'code-review', label: 'Code Review', icon: Layers, projectName: 'Cthulhu Prompt' },
    { id: 'new-tab', label: 'New Tab', icon: LayoutGrid }
  ]

  const projects: Project[] = [
    {
      abbreviation: 'CP',
      name: 'Cthulhu Prompt',
      collections: [
        { name: 'UI Polish', icon: FileText, detail: '14 prompts · Today', favorite: true },
        { name: 'Bug Fixes', icon: FileText, detail: '23 prompts · Today', favorite: true },
        { name: 'Release Prep', icon: FileText, detail: '6 prompts · Yesterday' },
        { name: 'Refactors', icon: FileText, detail: '9 prompts · 3 days ago' },
        { name: 'Test Coverage', icon: FileText, detail: '12 prompts · Last week' },
        { name: 'Code Review', icon: Layers, detail: '7 templates · 2 weeks ago' }
      ]
    },
    {
      abbreviation: 'AS',
      name: 'Atlas Service',
      collections: [
        { name: 'API Migration', icon: FileText, detail: '18 prompts · Today', favorite: true },
        { name: 'Auth Hardening', icon: FileText, detail: '11 prompts · 2 days ago' },
        { name: 'Incident Follow-ups', icon: FileText, detail: '4 prompts · Last week' },
        { name: 'Service Templates', icon: Layers, detail: '5 templates · Last month' }
      ]
    },
    {
      abbreviation: 'HM',
      name: 'Harbor Mobile',
      collections: [
        { name: 'Offline Sync', icon: FileText, detail: '12 prompts · Yesterday' },
        { name: 'Onboarding Flow', icon: FileText, detail: '8 prompts · 2 weeks ago' },
        { name: 'Screen Templates', icon: Layers, detail: '3 templates · Last month' }
      ]
    }
  ]

  const windowControls = [
    { label: 'Minimize window', glyph: '' },
    { label: 'Restore window', glyph: '' },
    { label: 'Close window', glyph: '' }
  ]

  /** Tab whose screen placeholder is currently shown. */
  let selectedTabId = $state('new-tab')
  /** Selected collection tab, which adds the collection sidebar. */
  const collectionTab = $derived(
    workTabs.find((tab) => tab.id === selectedTabId && tab.projectName !== undefined)
  )
  /** Selected Home, Settings, or development screen tab. */
  const screenTab = $derived(screenTabs.find((tab) => tab.id === selectedTabId))
  const isNewTab = $derived(selectedTabId === 'new-tab')
  const isSettings = $derived(selectedTabId === 'settings')
</script>

{#snippet selectionIndicator()}
  <span
    aria-hidden="true"
    style="position: absolute; left: 8px; right: 8px; bottom: 0; height: 2px; border-radius: 2px 2px 0 0; background: var(--ui-accent-strong-border);"
  ></span>
{/snippet}

{#snippet placeholderLabel(label: string)}
  <div
    class="text-sm"
    style="display: flex; flex: 1; min-height: 0; align-items: center; justify-content: center; text-align: center; color: var(--ui-muted-text);"
  >
    {label}
  </div>
{/snippet}

{#snippet sidebarSeparator()}
  <div
    aria-hidden="true"
    style="flex: none; height: 1px; background: var(--ui-neutral-muted-border);"
  ></div>
{/snippet}

<div
  style="display: flex; flex-direction: column; height: calc(100% - 12px); min-height: 720px; margin-top: 12px; overflow: hidden; border: 1px solid var(--ui-neutral-hover-border); color: var(--ui-normal-text);"
>
  <header
    style="display: flex; flex: none; align-items: stretch; height: 40px; background: var(--ui-chrome-normal-surface); user-select: none;"
  >
    <img
      src={appIcon}
      alt="Cthulhu Prompt icon"
      draggable="false"
      style="flex: none; align-self: center; width: 16px; height: 16px; margin: 0 8px 0 10px; object-fit: contain;"
    />

    <div role="tablist" aria-label="Screens" style="display: flex; flex: none; align-items: stretch;">
      {#each screenTabs as tab (tab.id)}
        {@const isSelected = selectedTabId === tab.id}
        {@const Icon = tab.icon}
        <button
          type="button"
          role="tab"
          aria-selected={isSelected}
          aria-label={tab.label}
          title={tab.label}
          style="position: relative; display: inline-flex; align-items: center; justify-content: center; width: 36px; cursor: pointer; color: {isSelected
            ? 'var(--ui-normal-text)'
            : 'var(--ui-muted-icon-glyph)'};"
          onclick={() => (selectedTabId = tab.id)}
        >
          <Icon size={18} strokeWidth={1.5} />
          {#if isSelected}
            {@render selectionIndicator()}
          {/if}
        </button>
      {/each}
    </div>

    <div
      aria-hidden="true"
      style="flex: none; align-self: center; width: 1px; height: 20px; margin: 0 6px; background: var(--ui-neutral-hover-border);"
    ></div>

    <div
      role="tablist"
      aria-label="Open tabs"
      style="display: flex; flex: 0 1 auto; min-width: 0; align-items: stretch;"
    >
      {#each workTabs as tab (tab.id)}
        {@const isSelected = selectedTabId === tab.id}
        {@const Icon = tab.icon}
        <div style="position: relative; display: flex; flex: 0 1 184px; min-width: 104px;">
          <button
            type="button"
            role="tab"
            aria-selected={isSelected}
            class="text-sm"
            style="display: flex; flex: 1; min-width: 0; align-items: center; gap: 8px; padding: 0 30px 0 12px; text-align: left; cursor: pointer; color: {isSelected
              ? 'var(--ui-normal-text)'
              : 'var(--ui-secondary-text)'};"
            onclick={() => (selectedTabId = tab.id)}
          >
            <Icon
              size={15}
              strokeWidth={1.5}
              style="flex: none; color: {isSelected
                ? 'var(--ui-hoverable-icon-glyph)'
                : 'var(--ui-muted-icon-glyph)'};"
            />
            <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              {tab.label}
            </span>
          </button>
          {#if isSelected}
            <button
              type="button"
              aria-label={`Close ${tab.label}`}
              title="Close Tab"
              style="position: absolute; top: 10px; right: 7px; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; cursor: pointer; color: var(--ui-secondary-icon-glyph);"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
            {@render selectionIndicator()}
          {/if}
          <span
            aria-hidden="true"
            style="position: absolute; top: 12px; right: 0; bottom: 12px; width: 1px; background: var(--ui-neutral-muted-border);"
          ></span>
        </div>
      {/each}
    </div>

    <button
      type="button"
      aria-label="New Tab"
      title="New Tab"
      style="display: inline-flex; flex: none; align-self: center; align-items: center; justify-content: center; width: 32px; height: 32px; margin-left: 4px; cursor: pointer; color: var(--ui-muted-icon-glyph);"
    >
      <Plus size={18} strokeWidth={1.5} />
    </button>

    <div style="flex: 1 0 16px;"></div>

    <div style="display: flex; flex: none; align-items: stretch;">
      {#each windowControls as control (control.label)}
        <button
          type="button"
          aria-label={control.label}
          title={control.label}
          style="display: inline-flex; align-items: center; justify-content: center; width: 46px;"
        >
          <span
            aria-hidden="true"
            style="font-family: 'Segoe MDL2 Assets', 'Segoe UI Symbol', sans-serif; font-size: 10px; line-height: 10px;"
          >
            {control.glyph}
          </span>
        </button>
      {/each}
    </div>
  </header>

  <div
    style="display: flex; flex: 1; min-height: 0; border-top: 1px solid var(--ui-neutral-hover-border);"
  >
    {#if collectionTab || isSettings}
      <aside
        style="display: flex; flex: none; flex-direction: column; width: 275px; min-height: 0; background: var(--ui-chrome-normal-surface); border-right: 1px solid var(--ui-neutral-hover-border); user-select: none;"
      >
        {#if collectionTab}
          <div style="display: flex; flex: none; flex-direction: column; padding: 6px 4px 10px;">
            <button
              type="button"
              class="text-xs"
              title="Back to New Tab"
              style="display: inline-flex; align-self: flex-start; align-items: center; gap: 6px; height: 28px; padding: 0 6px; cursor: pointer; color: var(--ui-secondary-text);"
            >
              <ArrowLeft
                size={14}
                strokeWidth={1.75}
                style="flex: none; color: var(--ui-secondary-icon-glyph);"
              />
              New Tab
            </button>
            <h2
              class="text-sm"
              style="margin: 4px 6px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--font-weight-semibold); color: var(--ui-normal-text);"
            >
              {collectionTab.label}
            </h2>
            <div
              class="text-xs"
              style="margin: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text);"
            >
              {collectionTab.projectName}
            </div>
          </div>
          {@render sidebarSeparator()}
          <div style="display: flex; flex: none; min-height: 40px;">
            {@render placeholderLabel('Prompt Tree Button Bar')}
          </div>
          {@render sidebarSeparator()}
          {@render placeholderLabel('Prompt Tree')}
        {:else}
          <div style="display: flex; flex: none; align-items: center; min-height: 40px; padding: 0 10px;">
            <h2
              class="text-sm"
              style="font-weight: var(--font-weight-semibold); color: var(--ui-secondary-text);"
            >
              Settings
            </h2>
          </div>
          {@render sidebarSeparator()}
          {@render placeholderLabel('Settings Tree')}
        {/if}
      </aside>
    {/if}

    <main style="display: flex; flex: 1; flex-direction: column; min-width: 0; min-height: 0; overflow-y: auto;">
      {#if isNewTab}
        <div
          style="display: flex; flex-direction: column; gap: 28px; width: 100%; max-width: 1024px; margin: auto; padding: 32px;"
        >
          <div style="display: flex; align-items: center; gap: 8px;">
            <div
              style="display: flex; flex: 1; min-width: 0; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-field-surface);"
            >
              <Search
                size={16}
                strokeWidth={1.5}
                style="flex: none; color: var(--ui-muted-icon-glyph);"
              />
              <input
                type="text"
                class="text-sm"
                placeholder="Search collections"
                aria-label="Search collections"
                style="flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ui-normal-text);"
              />
            </div>
            <button
              type="button"
              class="text-sm"
              style="display: inline-flex; flex: none; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); cursor: pointer; color: var(--ui-hoverable-text);"
            >
              <Plus size={16} strokeWidth={1.5} style="flex: none;" />
              New Project
            </button>
          </div>

          {#each projects as project (project.name)}
            <section style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; min-height: 28px;">
                <span
                  class="text-sm"
                  style="flex: none; font-weight: var(--font-weight-semibold); color: var(--ui-muted-text);"
                >
                  {project.abbreviation}
                </span>
                <h3
                  class="text-sm"
                  style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--font-weight-semibold); color: var(--ui-normal-text);"
                >
                  {project.name}
                </h3>
                <button
                  type="button"
                  aria-label={`${project.name} Project Settings`}
                  title="Project Settings"
                  style="display: inline-flex; flex: none; align-items: center; justify-content: center; width: 24px; height: 24px; cursor: pointer; color: var(--ui-muted-icon-glyph);"
                >
                  <Settings2 size={15} strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  class="text-xs"
                  style="display: inline-flex; flex: none; align-items: center; gap: 4px; height: 28px; margin-left: auto; padding: 0 6px; cursor: pointer; color: var(--ui-secondary-text);"
                >
                  <Plus
                    size={14}
                    strokeWidth={1.75}
                    style="flex: none; color: var(--ui-secondary-icon-glyph);"
                  />
                  New Collection
                </button>
              </div>

              <div
                style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;"
              >
                {#each project.collections as collection (collection.name)}
                  {@const Icon = collection.icon}
                  <button
                    type="button"
                    style="display: flex; align-items: center; gap: 10px; min-width: 0; height: 60px; padding: 0 12px; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-card); background: var(--ui-card-normal-surface); text-align: left; cursor: pointer;"
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      style="flex: none; color: var(--ui-secondary-icon-glyph);"
                    />
                    <span style="display: flex; flex: 1; flex-direction: column; min-width: 0;">
                      <span
                        class="text-sm"
                        style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-normal-text);"
                      >
                        {collection.name}
                      </span>
                      <span
                        class="text-xs"
                        style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text);"
                      >
                        {collection.detail}
                      </span>
                    </span>
                    {#if collection.favorite}
                      <Star
                        size={14}
                        fill="currentColor"
                        style="flex: none; color: var(--ui-favorite-icon-glyph);"
                      />
                    {/if}
                  </button>
                {/each}
              </div>
            </section>
          {/each}
        </div>
      {:else}
        {@render placeholderLabel(collectionTab ? 'Collection Screen' : (screenTab?.screenLabel ?? ''))}
      {/if}
    </main>
  </div>
</div>
