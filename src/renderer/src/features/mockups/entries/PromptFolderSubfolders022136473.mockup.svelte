<script lang="ts">
  import {
    ChevronDown,
    Copy,
    FileText,
    Folder,
    FolderOpen,
    GripVertical,
    Plus,
    Settings,
    Trash2
  } from 'lucide-svelte'

  type Section = {
    title: string
    text: string
    lines: number
    tokens: number
  }

  type Prompt = {
    id: string
    title: string
    folderLabel: string
    lines: number
    tokens: number
    updated: string
    body: string
  }

  type FolderBlock = {
    id: string
    name: string
    path: string
    promptCount: number
    nestedCount: number
    level: number
    accent: 'accent' | 'blue' | 'green'
    sections: Section[]
    prompts: Prompt[]
  }

  type IconComponent = typeof Folder

  const folderBlocks: FolderBlock[] = [
    {
      id: 'workspace',
      name: 'Coding Workflows',
      path: 'Workspace / Coding Workflows',
      promptCount: 3,
      nestedCount: 2,
      level: 0,
      accent: 'accent',
      sections: [
        {
          title: 'Folder Description',
          text: 'Reusable prompts for planning, editing, testing, and shipping code changes in desktop application projects.',
          lines: 2,
          tokens: 21
        },
        {
          title: 'Prompt Folder Prefix',
          text: 'Use the repository conventions. Keep changes scoped. Explain tradeoffs only when they affect implementation decisions.',
          lines: 2,
          tokens: 22
        },
        {
          title: 'Prompt Folder Suffix',
          text: 'Before finishing, summarize changed files and verification steps.',
          lines: 1,
          tokens: 11
        }
      ],
      prompts: [
        {
          id: 'plan',
          title: 'Implementation Plan',
          folderLabel: 'Coding Workflows',
          lines: 7,
          tokens: 136,
          updated: '4m ago',
          body: 'Read the relevant files first. Identify the smallest change that satisfies the behavior. Call out assumptions that affect implementation.'
        }
      ]
    },
    {
      id: 'review-fixes',
      name: 'Review & Fixes',
      path: 'Coding Workflows / Review & Fixes',
      promptCount: 2,
      nestedCount: 1,
      level: 1,
      accent: 'blue',
      sections: [
        {
          title: 'Folder Description',
          text: 'Prompts for code review, bug investigation, and focused repair work after a failing check or reviewer comment.',
          lines: 2,
          tokens: 23
        },
        {
          title: 'Prompt Folder Prefix',
          text: 'Treat this as a code review pass. Prioritize regressions, missing tests, and incorrect assumptions.',
          lines: 2,
          tokens: 21
        },
        {
          title: 'Prompt Folder Suffix',
          text: 'List findings first, then note any residual risk.',
          lines: 1,
          tokens: 10
        }
      ],
      prompts: [
        {
          id: 'review',
          title: 'Review Current Diff',
          folderLabel: 'Review & Fixes',
          lines: 9,
          tokens: 188,
          updated: '12m ago',
          body: 'Review the staged changes as if they were a pull request. Focus on concrete bugs, unexpected behavior, and places where tests do not cover the change.'
        },
        {
          id: 'repair',
          title: 'Repair Failing Test',
          folderLabel: 'Review & Fixes',
          lines: 6,
          tokens: 122,
          updated: '23m ago',
          body: 'Start from the failure message. Trace the behavior to the responsible code path, then make the narrowest fix that keeps existing intent intact.'
        }
      ]
    },
    {
      id: 'tests',
      name: 'Tests & Verification',
      path: 'Coding Workflows / Review & Fixes / Tests & Verification',
      promptCount: 2,
      nestedCount: 0,
      level: 2,
      accent: 'green',
      sections: [
        {
          title: 'Folder Description',
          text: 'Prompts for focused unit tests, Playwright coverage, and final verification notes.',
          lines: 1,
          tokens: 16
        },
        {
          title: 'Prompt Folder Prefix',
          text: 'Use existing test helpers and selectors. Keep assertions tied to user-visible behavior.',
          lines: 2,
          tokens: 18
        },
        {
          title: 'Prompt Folder Suffix',
          text: 'Report the exact commands that passed or failed.',
          lines: 1,
          tokens: 9
        }
      ],
      prompts: [
        {
          id: 'vitest',
          title: 'Add Unit Coverage',
          folderLabel: 'Tests & Verification',
          lines: 8,
          tokens: 164,
          updated: '38m ago',
          body: 'Add a fast test around the changed behavior. Mock filesystem boundaries when possible and avoid broad fixture setup unless the behavior needs it.'
        },
        {
          id: 'playwright',
          title: 'Verify Prompt Folder Flow',
          folderLabel: 'Tests & Verification',
          lines: 10,
          tokens: 207,
          updated: '1h ago',
          body: 'Exercise the prompt folder screen through the UI. Prefer data-testid selectors and assert the state that matters after navigation.'
        }
      ]
    }
  ]

  let hovered = $state<string | null>(null)

  const accentSurface = (accent: FolderBlock['accent']) => {
    if (accent === 'blue') return 'var(--ui-accent-blue-normal-surface)'
    if (accent === 'green') return 'var(--ui-accent-green-normal-surface)'
    return 'var(--ui-accent-normal-surface)'
  }

  const accentBorder = (accent: FolderBlock['accent']) => {
    if (accent === 'blue') return 'var(--ui-accent-blue-normal-border)'
    if (accent === 'green') return 'var(--ui-accent-green-normal-border)'
    return 'var(--ui-accent-normal-border)'
  }

  const accentGlyph = (accent: FolderBlock['accent']) => {
    if (accent === 'blue') return 'var(--ui-accent-blue-icon-glyph)'
    if (accent === 'green') return 'var(--ui-accent-green-icon-glyph)'
    return 'var(--ui-accent-icon-glyph)'
  }

  const hoverKey = (kind: string, id: string) => `${kind}:${id}`
</script>

<main
  style="display:flex; min-height:0; height:100%; flex:1; flex-direction:column; color:var(--ui-normal-text);"
>
  <div
    style="display:flex; height:36px; flex-shrink:0; align-items:center; border-bottom:1px solid var(--ui-neutral-muted-border); background:#121316; padding:0 24px;"
  >
    <div
      style="display:flex; min-width:0; align-items:center; color:var(--ui-muted-text); font-size:14px; font-weight:500;"
    >
      <button
        type="button"
        style="min-width:0; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; border:0; background:transparent; color:var(--ui-muted-text); font:inherit;"
        onmouseenter={() => (hovered = hoverKey('crumb', 'folder'))}
        onmouseleave={() => (hovered = null)}
      >
        Coding Workflows
      </button>
      <span style="margin:0 4px; padding:0 8px; color:oklch(1 0 0 / 32%);">/</span>
      <button
        type="button"
        style={`cursor:pointer; white-space:nowrap; border:0; background:transparent; color:${hovered === hoverKey('crumb', 'section') ? 'var(--ui-normal-text)' : 'var(--ui-hoverable-text)'}; font:inherit;`}
        onmouseenter={() => (hovered = hoverKey('crumb', 'section'))}
        onmouseleave={() => (hovered = null)}
      >
        Subfolders
      </button>
    </div>
  </div>

  <div style="min-height:0; flex:1; overflow:auto;">
    <div style="box-sizing:border-box; display:grid; gap:18px; min-width:0; padding:24px 24px 80px;">
      {#each folderBlocks as folder (folder.id)}
        {@const indentPx = folder.level * 34}
        <section
          style={`position:relative; display:grid; gap:16px; min-width:0; padding-left:${indentPx}px;`}
        >
          {#if folder.level > 0}
            <div
              aria-hidden="true"
              style={`position:absolute; bottom:10px; left:${indentPx - 20}px; top:0; width:2px; border-radius:999px; background:linear-gradient(to bottom, ${accentBorder(folder.accent)} 0%, var(--ui-neutral-muted-border) 48%, var(--ui-neutral-muted-border) 100%);`}
            ></div>
            <div
              aria-hidden="true"
              style={`position:absolute; left:${indentPx - 20}px; top:23px; height:2px; width:18px; border-radius:999px; background:${accentBorder(folder.accent)};`}
            ></div>
          {/if}

          {@render FolderTitleRow(folder)}
          {@render FolderSettingsCard(folder)}

          <div
            style={`position:relative; display:grid; gap:0; min-width:0; padding-left:${folder.level > 0 ? 22 : 0}px;`}
          >
            {#if folder.level > 0}
              <div
                aria-hidden="true"
                style={`position:absolute; bottom:24px; left:0; top:0; width:2px; border-radius:999px; background:${accentBorder(folder.accent)}; box-shadow:0 0 0 1px oklch(0 0 0 / 12%);`}
              ></div>
            {/if}

            {@render PromptSectionHeader(folder.prompts.length)}
            {@render PromptDivider(`${folder.id}-top`)}

            {#each folder.prompts as prompt, index (prompt.id)}
              {@render PromptEditorCard(prompt, folder, index === folder.prompts.length - 1)}
              {@render PromptDivider(`${folder.id}-${prompt.id}`)}
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>
</main>

{#snippet IconTile(Icon: IconComponent, accent: FolderBlock['accent'] = 'accent', size = 42)}
  <div
    style={`box-sizing:border-box; display:flex; height:${size}px; width:${size}px; flex:0 0 auto; align-items:center; justify-content:center; border-radius:7px; background:${accentSurface(accent)}; color:${accentGlyph(accent)};`}
  >
    <Icon size={size >= 40 ? 20 : 16} strokeWidth={2.4} />
  </div>
{/snippet}

{#snippet IconButton(Icon: IconComponent, label: string, variant: 'accent' | 'danger' | 'neutral', id: string)}
  {@const isHovering = hovered === hoverKey('icon', id)}
  <button
    type="button"
    aria-label={label}
    title={label}
    style={`display:inline-flex; height:30px; width:30px; cursor:pointer; align-items:center; justify-content:center; border-radius:7px; border:1px solid ${variant === 'danger' ? 'var(--ui-danger-normal-border)' : variant === 'accent' ? 'var(--ui-accent-normal-border)' : 'var(--ui-neutral-interactive-muted-border)'}; background:${isHovering ? (variant === 'danger' ? 'var(--ui-danger-hover-surface)' : variant === 'accent' ? 'var(--ui-accent-hover-surface)' : 'var(--ui-neutral-hover-surface)') : variant === 'danger' ? 'var(--ui-danger-normal-surface)' : variant === 'accent' ? 'var(--ui-accent-normal-surface)' : 'var(--ui-neutral-normal-surface)'}; color:${variant === 'danger' ? 'var(--ui-danger-icon-glyph)' : variant === 'accent' ? 'var(--ui-accent-normal-text)' : 'var(--ui-secondary-text)'}; transition:background-color 120ms ease, border-color 120ms ease, color 120ms ease;`}
    onmouseenter={() => (hovered = hoverKey('icon', id))}
    onmouseleave={() => (hovered = null)}
  >
    <Icon size={15} strokeWidth={2.6} />
  </button>
{/snippet}

{#snippet FolderTitleRow(folder: FolderBlock)}
  {@const isHovering = hovered === hoverKey('folder', folder.id)}
  <div
    role="group"
    aria-label={folder.name}
    style={`display:grid; min-width:0; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:12px; border:1px solid ${isHovering ? accentBorder(folder.accent) : 'var(--ui-neutral-muted-border)'}; border-radius:8px; background:${isHovering ? 'var(--ui-neutral-hover-surface)' : 'linear-gradient(to bottom, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end))'}; padding:10px 12px; box-shadow:inset 0 1px 0 var(--ui-card-nested-inset-highlight); transition:background 120ms ease, border-color 120ms ease;`}
    onmouseenter={() => (hovered = hoverKey('folder', folder.id))}
    onmouseleave={() => (hovered = null)}
  >
    {@render IconTile(folder.level === 0 ? FolderOpen : Folder, folder.accent)}
    <div style="display:grid; min-width:0; gap:3px;">
      <div style="display:flex; min-width:0; align-items:center; gap:8px;">
        <h1
          style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-normal-text); font-size:22px; font-weight:760; line-height:28px; margin:0;"
        >
          {folder.name}
        </h1>
        <span
          style={`flex:0 0 auto; border:1px solid ${accentBorder(folder.accent)}; border-radius:999px; background:${accentSurface(folder.accent)}; color:var(--ui-secondary-text); font-size:11px; font-weight:750; line-height:16px; padding:1px 8px;`}
        >
          {folder.promptCount} prompts
        </span>
        {#if folder.nestedCount > 0}
          <span
            style="flex:0 0 auto; border:1px solid var(--ui-neutral-muted-border); border-radius:999px; background:var(--ui-neutral-muted-surface); color:var(--ui-muted-text); font-size:11px; font-weight:750; line-height:16px; padding:1px 8px;"
          >
            {folder.nestedCount} subfolders
          </span>
        {/if}
      </div>
      <p
        style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-muted-text); font-size:12px; font-weight:650; line-height:18px; margin:0;"
      >
        {folder.path}
      </p>
    </div>
    <div style="display:flex; flex:0 0 auto; align-items:center; gap:8px;">
      <button
        type="button"
        style={`display:inline-flex; height:32px; cursor:pointer; align-items:center; gap:7px; border:1px solid ${isHovering ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius:999px; background:${isHovering ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; color:var(--ui-accent-normal-text); font-size:12px; font-weight:750; line-height:16px; padding:0 12px; transition:background-color 120ms ease, border-color 120ms ease;`}
      >
        <Plus size={14} strokeWidth={3} />
        Add prompt
      </button>
      {@render IconButton(Settings, 'Folder settings', 'neutral', `${folder.id}-settings`)}
    </div>
  </div>
{/snippet}

{#snippet FolderSettingsCard(folder: FolderBlock)}
  <div style="display:grid; gap:12px; min-width:0;">
    <div
      style="display:grid; gap:6px; min-width:0; border-left:3px solid var(--ui-accent-normal-border); padding-left:16px;"
    >
      <div style="display:flex; align-items:center; gap:10px; min-width:0;">
        {@render IconTile(Settings, folder.accent, 30)}
        <h2 style="color:var(--ui-normal-text); font-size:20px; font-weight:760; line-height:28px; margin:0;">
          Folder Settings
        </h2>
      </div>
      <p style="color:var(--ui-muted-text); font-size:14px; line-height:20px; margin:0;">
        Settings that only affect prompts in this folder, and are saved to the workspace.
      </p>
    </div>

    <div style="display:grid; gap:10px; min-width:0;">
      {#each folder.sections as section (section.title)}
        {@render SettingsSectionCard(section, folder.name, folder.accent)}
      {/each}
    </div>
  </div>
{/snippet}

{#snippet SettingsSectionCard(section: Section, folderName: string, accent: FolderBlock['accent'])}
  <div
    style="box-sizing:border-box; display:grid; gap:8px; min-width:0; border:1px solid var(--ui-card-normal-border); border-radius:8px; background:linear-gradient(to bottom, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); padding:10px; box-shadow:none;"
  >
    <div
      style="display:grid; min-width:0; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-muted-surface); padding:8px 8px 8px 10px;"
    >
      <div style="display:grid; min-width:0; grid-template-columns:40px minmax(0,1fr); align-items:center; gap:10px;">
        {@render IconTile(Folder, accent, 40)}
        <div style="display:grid; min-width:0; gap:4px;">
          <p style="height:22px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-normal-text); font-size:15px; font-weight:600; line-height:20px; margin:0;">
            {section.title}
          </p>
          <div
            style="display:flex; min-width:0; align-items:center; gap:7px; overflow:hidden; color:var(--ui-muted-text); font-size:11px; font-weight:750; line-height:16px; white-space:nowrap;"
          >
            <span style="display:inline-flex; min-width:0; max-width:220px; align-items:center; gap:5px; overflow:hidden; text-overflow:ellipsis; color:var(--ui-secondary-text); white-space:nowrap;">
              <Folder size={12} strokeWidth={2.4} />
              {folderName}
            </span>
            <span style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"></span>
            <span>{section.lines} {section.lines === 1 ? 'line' : 'lines'}</span>
            <span style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"></span>
            <span>{section.tokens} tokens</span>
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        {@render IconButton(Copy, `Copy ${section.title.toLowerCase()}`, 'accent', `copy-${folderName}-${section.title}`)}
      </div>
    </div>
    <div
      style="min-width:0; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-field-surface); color:var(--ui-secondary-text); font-family:'Cascadia Code', Consolas, monospace; font-size:13px; line-height:20px; padding:12px;"
    >
      {section.text}
    </div>
  </div>
{/snippet}

{#snippet PromptSectionHeader(count: number)}
  <div style="padding:8px 0 4px;">
    <div
      style="display:grid; gap:6px; min-width:0; border-left:3px solid var(--ui-accent-normal-border); padding-left:16px;"
    >
      <div style="display:flex; align-items:center; gap:10px; min-width:0;">
        {@render IconTile(FileText, 'accent', 30)}
        <h2 style="color:var(--ui-normal-text); font-size:20px; font-weight:760; line-height:28px; margin:0;">
          Prompts
        </h2>
        <span
          style="border:1px solid var(--ui-neutral-muted-border); border-radius:999px; background:var(--ui-neutral-muted-surface); color:var(--ui-muted-text); font-size:11px; font-weight:750; line-height:16px; padding:1px 8px;"
        >
          {count}
        </span>
      </div>
      <p style="color:var(--ui-muted-text); font-size:14px; line-height:20px; margin:0;">
        Create, edit, and organize prompts in this folder.
      </p>
    </div>
  </div>
{/snippet}

{#snippet PromptDivider(id: string)}
  {@const isHovering = hovered === hoverKey('divider', id)}
  <div style="display:grid; height:54px; align-items:center;">
    <div
      style="display:grid; min-height:36px; grid-template-columns:minmax(24px,1fr) auto minmax(24px,1fr); align-items:center; gap:10px;"
    >
      <div style={`height:1px; background:${isHovering ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-muted-border)'};`}></div>
      <button
        type="button"
        aria-label="Add prompt"
        style={`display:inline-flex; height:30px; cursor:pointer; align-items:center; justify-content:center; gap:7px; border:1px solid ${isHovering ? 'var(--ui-accent-hover-border)' : 'var(--ui-accent-normal-border)'}; border-radius:999px; background:${isHovering ? 'var(--ui-accent-hover-surface)' : 'var(--ui-accent-normal-surface)'}; color:${isHovering ? 'var(--ui-normal-text)' : 'var(--ui-accent-normal-text)'}; font-size:12px; font-weight:750; line-height:16px; padding:0 12px; transition:background-color 120ms ease, border-color 120ms ease, color 120ms ease; white-space:nowrap;`}
        onmouseenter={() => (hovered = hoverKey('divider', id))}
        onmouseleave={() => (hovered = null)}
      >
        <Plus size={14} strokeWidth={3} />
        <span>Add prompt</span>
      </button>
      <div style={`height:1px; background:${isHovering ? 'var(--ui-accent-hover-border)' : 'var(--ui-neutral-muted-border)'};`}></div>
    </div>
  </div>
{/snippet}

{#snippet PromptEditorCard(prompt: Prompt, folder: FolderBlock, isLast: boolean)}
  {@const isHovering = hovered === hoverKey('prompt', prompt.id)}
  <div style="position:relative; min-width:0;">
    {#if folder.level > 0}
      <div
        aria-hidden="true"
        style={`position:absolute; left:-22px; top:26px; height:2px; width:${isLast ? 18 : 20}px; border-radius:999px; background:${accentBorder(folder.accent)}; pointer-events:none;`}
      ></div>
    {/if}
  <article
    style={`box-sizing:border-box; display:grid; min-width:0; grid-template-columns:28px minmax(0,1fr); gap:10px; border:1px solid ${isHovering ? 'var(--ui-neutral-hover-border)' : 'var(--ui-card-normal-border)'}; border-radius:8px; background:linear-gradient(to bottom, var(--ui-card-normal-surface-gradient-start), var(--ui-card-normal-surface-gradient-end)); padding:10px; transition:border-color 120ms ease, background-color 120ms ease;`}
    onmouseenter={() => (hovered = hoverKey('prompt', prompt.id))}
    onmouseleave={() => (hovered = null)}
  >
    <div style="display:grid; grid-template-rows:30px 1fr 30px 30px; justify-items:center; gap:6px; color:var(--ui-muted-text);">
      <button
        type="button"
        aria-label="Move prompt"
        title="Move prompt"
        style="display:flex; height:30px; width:28px; cursor:grab; align-items:center; justify-content:center; border:1px solid var(--ui-neutral-muted-border); border-radius:7px; background:var(--ui-neutral-muted-surface); color:var(--ui-muted-text);"
      >
        <GripVertical size={16} strokeWidth={2.6} />
      </button>
      <div style="width:1px; min-height:12px; background:var(--ui-neutral-muted-border);"></div>
      <button
        type="button"
        aria-label="Move down"
        title="Move down"
        style="display:flex; height:30px; width:28px; cursor:pointer; align-items:center; justify-content:center; border:1px solid var(--ui-neutral-muted-border); border-radius:7px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text);"
      >
        <ChevronDown size={16} strokeWidth={2.6} />
      </button>
      <button
        type="button"
        aria-label="Move up"
        title="Move up"
        style="display:flex; height:30px; width:28px; cursor:pointer; align-items:center; justify-content:center; border:1px solid var(--ui-neutral-muted-border); border-radius:7px; background:var(--ui-neutral-muted-surface); color:var(--ui-secondary-text); transform:rotate(180deg);"
      >
        <ChevronDown size={16} strokeWidth={2.6} />
      </button>
    </div>

    <div style="display:grid; min-width:0; gap:8px; grid-template-rows:auto auto;">
      <div
        style="display:grid; min-width:0; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:12px; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-muted-surface); padding:8px 8px 8px 10px;"
      >
        <div style="display:grid; min-width:0; grid-template-columns:40px minmax(0,1fr); align-items:center; gap:10px;">
          {@render IconTile(FileText, 'accent', 40)}
          <div style="display:grid; min-width:0; gap:4px;">
            <p style="height:22px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ui-normal-text); font-size:15px; font-weight:600; line-height:20px; margin:0;">
              {prompt.title}
            </p>
            <div
              style="display:flex; min-width:0; align-items:center; gap:7px; overflow:hidden; color:var(--ui-muted-text); font-size:11px; font-weight:750; line-height:16px; white-space:nowrap;"
            >
              <span style="display:inline-flex; min-width:0; max-width:220px; align-items:center; gap:5px; overflow:hidden; text-overflow:ellipsis; color:var(--ui-secondary-text); white-space:nowrap;">
                <Folder size={12} strokeWidth={2.4} />
                {prompt.folderLabel}
              </span>
              <span style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"></span>
              <span>{prompt.lines} lines</span>
              <span style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"></span>
              <span>{prompt.tokens} tokens</span>
              <span style="height:3px; width:3px; flex:0 0 auto; border-radius:999px; background:var(--ui-neutral-emphasis-border);"></span>
              <span title={`Updated ${prompt.updated}`}>Updated {prompt.updated}</span>
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          {@render IconButton(Copy, 'Copy prompt', 'accent', `copy-${prompt.id}`)}
          <div style="height:24px; width:1px; background:var(--ui-neutral-muted-border);"></div>
          {@render IconButton(Trash2, 'Delete prompt', 'danger', `delete-${prompt.id}`)}
        </div>
      </div>

      <div
        style="min-width:0; min-height:88px; border:1px solid var(--ui-card-nested-border); border-radius:7px; background:var(--ui-neutral-field-surface); color:var(--ui-secondary-text); font-family:'Cascadia Code', Consolas, monospace; font-size:13px; line-height:20px; padding:12px;"
      >
        {prompt.body}
      </div>
    </div>
  </article>
  </div>
{/snippet}
