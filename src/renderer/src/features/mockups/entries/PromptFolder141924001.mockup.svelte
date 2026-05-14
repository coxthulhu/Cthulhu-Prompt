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

  const navItems = [
    {
      label: 'Home',
      icon: Home,
      active: false
    },
    {
      label: 'Settings',
      icon: Settings,
      active: false
    }
  ]

  const folders = [
    {
      name: 'Coding Assistants',
      count: 6,
      active: true,
      expanded: true,
      prompts: [
        {
          title: 'Refactor Plan',
          active: false
        },
        {
          title: 'Bug Reproduction',
          active: true
        },
        {
          title: 'Code Review Checklist',
          active: false
        }
      ]
    },
    {
      name: 'Release Notes',
      count: 4,
      active: false,
      expanded: true,
      prompts: [
        {
          title: 'Patch Summary',
          active: false
        },
        {
          title: 'Customer Update',
          active: false
        }
      ]
    },
    {
      name: 'Research',
      count: 9,
      active: false,
      expanded: false,
      prompts: []
    },
    {
      name: 'Workspace Automation',
      count: 5,
      active: false,
      expanded: true,
      prompts: [
        {
          title: 'Terminal Task Brief',
          active: false
        },
        {
          title: 'Test Failure Triage',
          active: false
        }
      ]
    }
  ]
</script>

<div
  style="display: flex; width: 100%; height: 100vh; min-height: 0; overflow: hidden; color: var(--ui-normal-text);"
>
  <aside
    style="display: flex; width: 304px; height: 100%; min-height: 0; flex-shrink: 0; flex-direction: column; border-right: 1px solid var(--ui-neutral-muted-border); background: linear-gradient(180deg, oklch(0.18 0.012 260 / 96%) 0%, oklch(0.135 0.014 250 / 96%) 58%, oklch(0.105 0.018 235 / 96%) 100%); box-shadow: inset -1px 0 0 oklch(1 0 0 / 4%), 8px 0 24px oklch(0 0 0 / 18%);"
  >
    <div style="padding: 10px 12px 0;">
      <div
        style="display: flex; align-items: center; gap: 10px; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-card); background: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); padding: 9px; box-shadow: var(--cthulhu-ui-shadow-surface-highlight);"
      >
        <div
          style="display: flex; width: 38px; height: 38px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid var(--ui-neutral-normal-border); border-radius: var(--cthulhu-ui-radius-control); background-color: var(--ui-neutral-normal-surface);"
        >
          <img
            src={appIcon}
            alt="Cthulhu Prompt icon"
            draggable="false"
            style="width: 30px; height: 30px; object-fit: contain;"
          />
        </div>
        <div style="min-width: 0; flex: 1;">
          <h1
            style="margin: 0; overflow: hidden; color: var(--ui-normal-text); font-size: 14px; font-weight: 650; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap;"
          >
            Cthulhu Prompt
          </h1>
          <p
            title="C:\Source\PromptApps\Workspace"
            style="margin: 3px 0 0; overflow: hidden; color: var(--ui-muted-text); font-size: 12px; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap;"
          >
            C:\Source\PromptApps\Workspace
          </p>
        </div>
      </div>
    </div>

    <div style="padding: 12px 12px 0;">
      <nav
        aria-label="Main"
        style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; border-bottom: 1px solid var(--ui-neutral-muted-border); padding-bottom: 12px;"
      >
        {#each navItems as item (item.label)}
          {@const Icon = item.icon}
          <button
            type="button"
            aria-current={item.active ? 'page' : undefined}
            style={`display: inline-flex; height: 36px; min-width: 0; cursor: pointer; align-items: center; justify-content: center; gap: 8px; border: 1px solid ${item.active ? 'var(--ui-neutral-emphasis-border)' : 'var(--ui-neutral-muted-border)'}; border-radius: var(--cthulhu-ui-radius-control); background: ${item.active ? 'var(--ui-neutral-emphasis-surface)' : 'var(--ui-neutral-muted-surface)'}; box-shadow: var(--cthulhu-ui-shadow-surface-highlight); color: ${item.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; font-size: 13px; font-weight: 600;`}
          >
            <Icon style="width: 16px; height: 16px; flex-shrink: 0;" />
            <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              {item.label}
            </span>
          </button>
        {/each}
      </nav>
    </div>

    <div style="display: flex; min-height: 0; flex: 1; flex-direction: column; padding: 12px 8px 0 12px;">
      <div style="padding: 0 4px 8px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div style="min-width: 0;">
            <p
              style="margin: 0; color: var(--ui-secondary-text); font-size: 11px; font-weight: 700; letter-spacing: 0.14em; line-height: 1.2; text-transform: uppercase;"
            >
              Prompts
            </p>
            <p style="margin: 3px 0 0; color: var(--ui-muted-text); font-size: 12px; line-height: 1.2;">
              4 folders
            </p>
          </div>
          <div style="display: inline-flex; align-items: center; gap: 2px;">
            <button
              type="button"
              aria-label="Search Prompts"
              title="Search Prompts"
              style="display: inline-flex; width: 28px; height: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);"
            >
              <Search style="width: 15px; height: 15px;" />
            </button>
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
              style="display: inline-flex; width: 28px; height: 28px; cursor: pointer; align-items: center; justify-content: center; border: 1px solid var(--ui-accent-normal-border); border-radius: var(--cthulhu-ui-radius-icon-button); background: var(--ui-accent-normal-surface); box-shadow: var(--cthulhu-ui-shadow-surface-highlight); color: var(--ui-accent-normal-text);"
            >
              <Plus style="width: 15px; height: 15px;" />
            </button>
          </div>
        </div>
      </div>

      <div style="min-height: 0; flex: 1; overflow: hidden; padding-right: 4px;">
        <div style="display: flex; flex-direction: column; gap: 3px;">
          {#each folders as folder (folder.name)}
            <div>
              <div
                style={`display: flex; height: 36px; align-items: center; gap: 6px; border: 1px solid ${folder.active ? 'var(--ui-info-normal-border)' : 'transparent'}; border-radius: var(--cthulhu-ui-radius-control); background: ${folder.active ? 'linear-gradient(180deg, var(--ui-info-normal-surface), var(--ui-neutral-normal-surface))' : 'transparent'}; box-shadow: ${folder.active ? 'inset 0 1px 0 oklch(1 0 0 / 10%), 0 4px 12px oklch(0 0 0 / 12%)' : 'none'}; color: ${folder.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'};`}
              >
                <button
                  type="button"
                  aria-label={`${folder.expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
                  aria-expanded={folder.expanded}
                  style="display: flex; min-width: 0; flex: 1; cursor: pointer; align-items: center; gap: 8px; border: 0; background: transparent; padding: 0 6px 0 8px; color: inherit; text-align: left;"
                >
                  <span
                    style="display: inline-flex; width: 20px; height: 20px; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 6px; color: var(--ui-secondary-text);"
                  >
                    {#if folder.expanded}
                      <ChevronDown style="width: 16px; height: 16px;" />
                    {:else}
                      <ChevronRight style="width: 16px; height: 16px;" />
                    {/if}
                  </span>
                  <Folder style="width: 16px; height: 16px; flex-shrink: 0; color: inherit;" />
                  <span
                    style="min-width: 0; flex: 1; overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap;"
                  >
                    {folder.name}
                  </span>
                </button>
                <span
                  style={`display: inline-flex; height: 21px; min-width: 26px; flex-shrink: 0; align-items: center; justify-content: center; border: 1px solid ${folder.active ? 'var(--ui-info-normal-border)' : 'var(--ui-neutral-muted-border)'}; border-radius: 6px; background: ${folder.active ? 'var(--ui-neutral-normal-surface)' : 'var(--ui-neutral-muted-surface)'}; padding: 0 7px; color: ${folder.active ? 'var(--ui-normal-text)' : 'var(--ui-secondary-text)'}; font-size: 11px; font-weight: 700; line-height: 1;`}
                >
                  {folder.count}
                </span>
                <button
                  type="button"
                  aria-label={`Open ${folder.name}`}
                  title={`Open ${folder.name}`}
                  style="display: inline-flex; width: 26px; height: 26px; flex-shrink: 0; cursor: pointer; align-items: center; justify-content: center; border: 0; border-radius: var(--cthulhu-ui-radius-icon-button); background: transparent; color: var(--ui-secondary-text);"
                >
                  <ArrowRight style="width: 15px; height: 15px;" />
                </button>
              </div>

              {#if folder.expanded}
                <div style="display: flex; flex-direction: column; gap: 2px; padding: 3px 0 5px 31px;">
                  <button
                    type="button"
                    aria-current={folder.active && !folder.prompts.some((prompt) => prompt.active)
                      ? 'page'
                      : undefined}
                    style="display: flex; height: 30px; width: 100%; min-width: 0; cursor: pointer; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: var(--cthulhu-ui-radius-control); background: transparent; padding: 0 8px; color: var(--ui-hoverable-text); text-align: left;"
                  >
                    <Settings style="width: 14px; height: 14px; flex-shrink: 0;" />
                    <span
                      style="min-width: 0; overflow: hidden; font-size: 13px; line-height: 1; text-overflow: ellipsis; white-space: nowrap;"
                    >
                      Folder Settings
                    </span>
                  </button>
                  {#each folder.prompts as prompt (prompt.title)}
                    <button
                      type="button"
                      aria-current={prompt.active ? 'page' : undefined}
                      style={`display: flex; height: 30px; width: 100%; min-width: 0; cursor: pointer; align-items: center; gap: 8px; border: 1px solid ${prompt.active ? 'var(--ui-neutral-emphasis-border)' : 'transparent'}; border-radius: var(--cthulhu-ui-radius-control); background: ${prompt.active ? 'var(--ui-neutral-emphasis-surface)' : 'transparent'}; box-shadow: ${prompt.active ? 'var(--cthulhu-ui-shadow-surface-highlight-active)' : 'none'}; padding: 0 8px; color: ${prompt.active ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; text-align: left;`}
                    >
                      <FileText style="width: 14px; height: 14px; flex-shrink: 0;" />
                      <span
                        style="min-width: 0; overflow: hidden; font-size: 13px; line-height: 1; text-overflow: ellipsis; white-space: nowrap;"
                      >
                        {prompt.title}
                      </span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </div>
  </aside>

  <main style="display: flex; min-width: 0; min-height: 0; flex: 1; flex-direction: column;">
    <div
      style="display: flex; height: 36px; flex-shrink: 0; align-items: center; border-bottom: 1px solid var(--ui-neutral-muted-border); background-color: oklch(0.12 0.006 270 / 76%); padding: 0 24px;"
    >
      <div
        style="display: flex; min-width: 0; align-items: center; color: var(--ui-muted-text); font-size: 13px; font-weight: 500;"
      >
        <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          Coding Assistants
        </span>
        <span style="padding: 0 10px; color: var(--ui-neutral-focus-border);">/</span>
        <span style="color: var(--ui-hoverable-text); white-space: nowrap;">Bug Reproduction</span>
      </div>
    </div>

    <div style="min-height: 0; flex: 1; overflow: hidden; padding: 22px 24px;">
      <section
        style="max-width: 860px; border: 1px solid var(--ui-card-normal-border); border-radius: var(--cthulhu-ui-radius-card); background-image: linear-gradient(180deg, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); box-shadow: var(--cthulhu-ui-shadow-card);"
      >
        <div style="border-bottom: 1px solid var(--ui-neutral-muted-border); padding: 16px 18px;">
          <h2 style="margin: 0; color: var(--ui-normal-text); font-size: 18px; font-weight: 650;">
            Bug Reproduction
          </h2>
          <p style="margin: 7px 0 0; color: var(--ui-muted-text); font-size: 13px; line-height: 1.45;">
            Capture the exact behavior, expected result, and steps needed to reproduce the issue.
          </p>
        </div>
        <div style="display: grid; gap: 12px; padding: 16px 18px;">
          <div
            style="min-height: 92px; border: 1px solid var(--ui-card-nested-border); border-radius: var(--cthulhu-ui-radius-control); background-color: var(--ui-card-nested-surface); box-shadow: var(--cthulhu-ui-shadow-subcard); padding: 13px; color: var(--ui-secondary-text); font-size: 13px; line-height: 1.55;"
          >
            Summarize the bug in one sentence, then list the environment, reproduction steps, actual
            result, expected result, and any logs or screenshots that narrow the failure.
          </div>
          <div
            style="height: 44px; border: 1px solid var(--ui-neutral-muted-border); border-radius: var(--cthulhu-ui-radius-control); background-color: var(--ui-neutral-muted-surface);"
          ></div>
        </div>
      </section>
    </div>
  </main>
</div>
