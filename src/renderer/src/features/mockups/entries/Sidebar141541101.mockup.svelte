<script lang="ts">
  import appIcon from '@renderer/assets/cutethulhu.png'
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    Home,
    Plus,
    Search,
    Settings
  } from 'lucide-svelte'

  type PromptItem = {
    title: string
    active?: boolean
  }

  type FolderItem = {
    name: string
    count: number
    expanded: boolean
    active?: boolean
    prompts: PromptItem[]
  }

  const navItems = [
    { label: 'Home', icon: Home, active: false },
    { label: 'Settings', icon: Settings, active: false }
  ]

  const folders: FolderItem[] = [
    {
      name: 'Codex Workflows',
      count: 6,
      expanded: true,
      active: true,
      prompts: [
        { title: 'Repository survey' },
        { title: 'Focused implementation plan', active: true },
        { title: 'Playwright regression pass' },
        { title: 'PR review checklist' }
      ]
    },
    {
      name: 'Svelte Patterns',
      count: 4,
      expanded: true,
      prompts: [
        { title: 'Rune migration notes' },
        { title: 'Snippet component template' },
        { title: 'Virtual row sizing' }
      ]
    },
    {
      name: 'Release Prep',
      count: 3,
      expanded: false,
      prompts: []
    },
    {
      name: 'Local Utilities',
      count: 5,
      expanded: true,
      prompts: [
        { title: 'Windows command runner' },
        { title: 'SQLite inspection' },
        { title: 'Error log triage' }
      ]
    }
  ]
</script>

<div
  style="display: flex; min-height: 720px; width: 100%; min-width: 0; overflow: hidden; color: var(--ui-normal-text); font-family: Aptos, 'Segoe UI Variable', 'Segoe UI', sans-serif;"
>
  <aside
    style="display: flex; width: min(372px, 48vw); min-width: 304px; overflow: hidden; border-right: 1px solid oklch(1 0 0 / 12%); background: linear-gradient(180deg, oklch(0.18 0.017 255.4) 0%, oklch(0.12 0.013 253.2) 58%, oklch(0.102 0.012 252.3) 100%); box-shadow: inset -1px 0 0 oklch(0 0 0 / 24%);"
  >
    <nav
      aria-label="Primary"
      style="display: flex; width: 58px; flex-shrink: 0; flex-direction: column; align-items: center; gap: 10px; border-right: 1px solid oklch(1 0 0 / 8%); background: linear-gradient(180deg, oklch(0.205 0.016 258.8 / 84%), oklch(0.13 0.013 253.2 / 92%)); padding: 10px 8px;"
    >
      <button
        type="button"
        aria-label="Cthulhu Prompt"
        style="display: inline-flex; width: 42px; height: 42px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, var(--ui-accent-normal-surface), oklch(0.676 0.14 221.5 / 16%)); box-shadow: inset 0 1px 0 oklch(1 0 0 / 10%), 0 8px 18px oklch(0 0 0 / 22%);"
      >
        <img
          src={appIcon}
          alt="Cthulhu Prompt icon"
          draggable="false"
          style="width: 30px; height: 30px; object-fit: contain;"
        />
      </button>

      <div style="display: grid; width: 100%; gap: 7px; padding-top: 6px;">
        {#each navItems as item (item.label)}
          {@const Icon = item.icon}
          <button
            type="button"
            aria-label={item.label}
            title={item.label}
            style={`display: inline-flex; width: 42px; height: 42px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid ${item.active ? 'var(--ui-neutral-emphasis-border)' : 'transparent'}; border-radius: var(--cthulhu-ui-radius-control); background: ${item.active ? 'var(--ui-neutral-emphasis-surface)' : 'transparent'}; color: ${item.active ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'}; box-shadow: ${item.active ? 'var(--cthulhu-ui-shadow-surface-highlight-active)' : 'none'};`}
          >
            <Icon style="width: 18px; height: 18px;" />
          </button>
        {/each}
      </div>

      <div style="flex: 1;"></div>

      <button
        type="button"
        aria-label="Search"
        title="Search"
        style="display: inline-flex; width: 42px; height: 42px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-control); background: var(--ui-neutral-muted-surface); color: var(--ui-secondary-text);"
      >
        <Search style="width: 18px; height: 18px;" />
      </button>
    </nav>

    <div style="display: flex; min-width: 0; flex: 1; flex-direction: column;">
      <header
        style="display: grid; gap: 10px; border-bottom: 1px solid oklch(1 0 0 / 8%); padding: 12px 13px 12px 14px;"
      >
        <div
          style="display: grid; min-width: 0; gap: 3px; border: 1px solid oklch(1 0 0 / 10%); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, oklch(1 0 0 / 7%), oklch(1 0 0 / 3%)); padding: 10px 11px; box-shadow: inset 0 1px 0 oklch(1 0 0 / 8%);"
        >
          <div
            style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-normal-text); font-size: 13px; font-weight: 700; line-height: 18px;"
          >
            CthulhuPromptPublic
          </div>
          <div
            title="C:\Source\PromptApps\CthulhuPromptPublic"
            style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ui-muted-text); font-size: 11px; line-height: 16px;"
          >
            C:\Source\PromptApps\CthulhuPromptPublic
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 7px;">
          {#each navItems as item (item.label)}
            {@const Icon = item.icon}
            <button
              type="button"
              style={`display: inline-flex; height: 34px; min-width: 0; cursor: pointer; align-items: center; justify-content: center; gap: 7px; border: 1px solid ${item.active ? 'var(--ui-neutral-emphasis-border)' : 'var(--ui-neutral-muted-border)'}; border-radius: var(--cthulhu-ui-radius-control); background: ${item.active ? 'var(--ui-neutral-emphasis-surface)' : 'oklch(1 0 0 / 4%)'}; color: ${item.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; box-shadow: var(--cthulhu-ui-shadow-surface-highlight); font-size: 12px; font-weight: 650;`}
            >
              <Icon style="width: 15px; height: 15px; flex-shrink: 0;" />
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                >{item.label}</span
              >
            </button>
          {/each}
        </div>
      </header>

      <section
        aria-label="Prompts"
        style="display: flex; min-height: 0; flex: 1; flex-direction: column; padding: 12px 8px 10px 10px;"
      >
        <div
          style="display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 4px 9px 5px;"
        >
          <div style="display: grid; gap: 2px;">
            <div
              style="color: var(--ui-secondary-text); font-size: 11px; font-weight: 760; letter-spacing: 0.18em; line-height: 14px; text-transform: uppercase;"
            >
              Prompts
            </div>
            <div style="color: var(--ui-muted-text); font-size: 12px; line-height: 16px;">
              4 folders
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 2px;">
            <button
              type="button"
              aria-label="Expand All Prompt Folders"
              title="Expand All Prompt Folders"
              style="display: inline-flex; width: 28px; height: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);"
            >
              <ChevronsUpDown style="width: 15px; height: 15px;" />
            </button>
            <button
              type="button"
              aria-label="Collapse All Prompt Folders"
              title="Collapse All Prompt Folders"
              style="display: inline-flex; width: 28px; height: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);"
            >
              <ChevronsDownUp style="width: 15px; height: 15px;" />
            </button>
            <button
              type="button"
              aria-label="Create Prompt Folder"
              title="Create Prompt Folder"
              style="display: inline-flex; width: 30px; height: 30px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: var(--cthulhu-ui-radius-icon-button); background: linear-gradient(180deg, var(--ui-accent-normal-surface), oklch(0.67 0.13 218 / 17%)); color: var(--ui-accent-normal-text); box-shadow: var(--cthulhu-ui-shadow-surface-highlight);"
            >
              <Plus style="width: 16px; height: 16px;" />
            </button>
          </div>
        </div>

        <div
          style="display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 3px; overflow: hidden; border-top: 1px solid oklch(1 0 0 / 6%); padding-top: 8px;"
        >
          {#each folders as folder (folder.name)}
            <div style="display: grid; gap: 2px;">
              <div
                style={`display: flex; height: 36px; align-items: center; gap: 6px; border: 1px solid ${folder.active ? 'oklch(0.724 0.122 206.8 / 56%)' : 'transparent'}; border-radius: var(--cthulhu-ui-radius-control); background: ${folder.active ? 'linear-gradient(90deg, oklch(0.548 0.113 205.3 / 30%), oklch(1 0 0 / 5%) 62%, oklch(1 0 0 / 2%))' : 'transparent'}; box-shadow: ${folder.active ? 'inset 0 1px 0 oklch(1 0 0 / 10%), 0 8px 18px oklch(0 0 0 / 13%)' : 'none'}; color: ${folder.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'};`}
              >
                <button
                  type="button"
                  aria-label={`${folder.expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
                  style="display: inline-flex; width: 28px; height: 100%; flex-shrink: 0; cursor: pointer; align-items: center; justify-content: center; border: 0; background: transparent; color: inherit;"
                >
                  {#if folder.expanded}
                    <ChevronDown style="width: 15px; height: 15px;" />
                  {:else}
                    <ChevronRight style="width: 15px; height: 15px;" />
                  {/if}
                </button>

                <Folder style="width: 16px; height: 16px; flex-shrink: 0;" />

                <button
                  type="button"
                  style="min-width: 0; flex: 1; cursor: pointer; overflow: hidden; border: 0; background: transparent; padding: 0; color: inherit; text-align: left;"
                >
                  <span
                    style="display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 650; line-height: 18px;"
                    >{folder.name}</span
                  >
                </button>

                <span
                  style={`display: inline-flex; height: 20px; min-width: 25px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid ${folder.active ? 'oklch(0.724 0.122 206.8 / 46%)' : 'var(--ui-neutral-muted-border)'}; border-radius: var(--cthulhu-ui-radius-control); background: ${folder.active ? 'oklch(0.724 0.122 206.8 / 14%)' : 'var(--ui-neutral-normal-surface)'}; padding: 0 6px; color: inherit; font-size: 11px; font-weight: 750; line-height: 1;`}
                  >{folder.count}</span
                >

                <button
                  type="button"
                  aria-label={`Open ${folder.name}`}
                  style="display: inline-flex; width: 26px; height: 26px; margin-right: 4px; flex-shrink: 0; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: inherit;"
                >
                  <ArrowRight style="width: 15px; height: 15px;" />
                </button>
              </div>

              {#if folder.expanded}
                <div
                  style="display: grid; gap: 2px; margin-left: 28px; border-left: 1px solid oklch(1 0 0 / 9%); padding-left: 8px;"
                >
                  <button
                    type="button"
                    style="display: flex; height: 29px; width: 100%; min-width: 0; cursor: pointer; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); background: transparent; padding: 0 8px; color: var(--ui-secondary-text); text-align: left;"
                  >
                    <Settings style="width: 14px; height: 14px; flex-shrink: 0;" />
                    <span
                      style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px;"
                      >Folder Settings</span
                    >
                  </button>

                  {#each folder.prompts as prompt (prompt.title)}
                    <button
                      type="button"
                      aria-current={prompt.active ? 'true' : undefined}
                      style={`display: flex; height: 29px; width: 100%; min-width: 0; cursor: pointer; align-items: center; gap: 8px; border: 1px solid ${prompt.active ? 'var(--ui-neutral-emphasis-border)' : 'transparent'}; border-radius: var(--cthulhu-ui-radius-control); background: ${prompt.active ? 'linear-gradient(90deg, var(--ui-neutral-emphasis-surface), oklch(1 0 0 / 5%))' : 'transparent'}; box-shadow: ${prompt.active ? 'var(--cthulhu-ui-shadow-surface-highlight-active)' : 'none'}; padding: 0 8px; color: ${prompt.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; text-align: left;`}
                    >
                      <FileText style="width: 14px; height: 14px; flex-shrink: 0;" />
                      <span
                        style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; line-height: 18px;"
                        >{prompt.title}</span
                      >
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    </div>
  </aside>

  <main style="display: flex; min-width: 0; flex: 1; flex-direction: column;">
    <div
      style="display: flex; height: 36px; flex-shrink: 0; align-items: center; border-bottom: 1px solid oklch(1 0 0 / 8%); background: oklch(0.13 0.008 260 / 74%); padding: 0 24px;"
    >
      <div
        style="display: flex; min-width: 0; align-items: center; color: var(--ui-muted-text); font-size: 13px; font-weight: 560;"
      >
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
          >Codex Workflows</span
        >
        <span style="padding: 0 10px; color: oklch(1 0 0 / 28%);">/</span>
        <span style="color: var(--ui-hoverable-text); white-space: nowrap;"
          >Focused implementation plan</span
        >
      </div>
    </div>

    <div style="display: grid; gap: 16px; padding: 24px; max-width: 860px;">
      <section
        style="display: grid; gap: 8px; border-left: 3px solid var(--ui-accent-normal-border); padding-left: 16px;"
      >
        <h2
          style="margin: 0; color: var(--ui-normal-text); font-size: 24px; font-weight: 760; line-height: 32px;"
        >
          Prompts
        </h2>
        <p style="margin: 0; color: var(--ui-muted-text); font-size: 14px; line-height: 20px;">
          Create, edit, and organize prompts in this folder.
        </p>
      </section>

      <article
        style="min-height: 150px; border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: var(--cthulhu-ui-shadow-card);"
      ></article>
    </div>
  </main>
</div>
