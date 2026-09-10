<script lang="ts">
  import { Check, ChevronDown, ChevronRight, Copy, FileText, Folder, GripVertical, Layers, Pencil, Plus, Search, Settings, Trash2 } from 'lucide-svelte'
  import * as monaco from 'monaco-editor'
  import Dialog from '@renderer/common/cthulhu-ui/Dialog.svelte'
  import Row from '@renderer/common/cthulhu-ui/Row.svelte'
  import SelectorButton from '@renderer/common/cthulhu-ui/SelectorButton.svelte'
  import { hasCategoryDisplayNameConflict, normalizeCategoryDisplayName } from '@shared/Category'

  const categories = [
    { id: 'implementation', displayName: 'Implementation', description: 'Plans and instructions for building product features.', count: 8 },
    { id: 'verification', displayName: 'Verification', description: 'Tests, regression coverage, and quality checks.', count: 4 },
    { id: 'research', displayName: 'Research', description: 'Explore approaches before starting implementation.', count: 6 },
    { id: 'code-review', displayName: 'Code Review', description: 'Review completed work and identify improvements.', count: 3 },
    { id: 'documentation', displayName: 'Documentation', description: 'Keep project documentation clear and current.', count: 5 },
    { id: 'release', displayName: 'Release', description: 'Prepare release notes and delivery checklists.', count: 2 }
  ]
  let categoriesOpen = $state(true)
  let selectedId = $state('implementation')
  let categoryName = $state('Implementation')
  let summary = $state('Plans and instructions for building product features.')
  // Keep the preview's name feedback identical to the live category dialog.
  const nameError = $derived(
    normalizeCategoryDisplayName(categoryName).length === 0
      ? 'Category name is required'
      : hasCategoryDisplayNameConflict(categories, categoryName, selectedId)
        ? 'A category with this name already exists'
        : null
  )
  const fieldStyle = 'box-sizing:border-box;width:100%;height:38px;padding:8px 11px;border:1px solid var(--ui-neutral-normal-border);border-radius:var(--cthulhu-ui-radius-control);background:var(--ui-neutral-field-surface);color:var(--ui-normal-text);'
  const buttonStyle = 'display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;border:1px solid var(--ui-neutral-normal-border);border-radius:var(--cthulhu-ui-radius-control);background:var(--ui-neutral-action-fill);color:var(--ui-normal-text);'
  const description = '# Implementation\n\nPrompts for turning approved requirements into working code.\n\n## What belongs here\n- Repository-grounded implementation plans\n- Feature development and targeted refactors\n- Follow-up work from accepted code reviews\n\n## Working guidelines\nKeep each prompt focused on one reviewable change.\nReference the relevant files and existing application patterns.\nState the expected behavior and a clear validation step.\n\n## Before moving to verification\nConfirm the change is complete and note any remaining questions.'

  const selectCategory = (category: (typeof categories)[number]) => {
    selectedId = category.id
    categoryName = category.displayName
    summary = category.description
  }

  const mountDescription = (node: HTMLElement, title: string) => {
    // Mount a fixed-height Monaco preview; release the editor and model when the dialog closes.
    const typography = window.getComputedStyle(node)
    const model = monaco.editor.createModel(title === 'Implementation' ? description : `# ${title}\n\n${summary}\n\n## Guidelines\nKeep prompts focused and include the context needed to complete the work.`, 'markdown')
    const editor = monaco.editor.create(node, {
      model,
      ariaLabel: 'Category description',
      automaticLayout: true,
      fontSize: parseFloat(typography.fontSize),
      lineHeight: parseFloat(typography.lineHeight),
      minimap: { enabled: false },
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: false,
      overviewRulerBorder: false,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      padding: { top: 10, bottom: 10 },
      scrollbar: { handleMouseWheel: true, alwaysConsumeMouseWheel: false },
      renderLineHighlightOnlyWhenFocus: true
    })
    return { destroy: () => { editor.dispose(); model.dispose() } }
  }
</script>

<main class="text-sm leading-5" style="height:100%; overflow:auto; color:var(--ui-normal-text);">
  <div class="text-xs leading-4" style="height:36px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; border-bottom:1px solid var(--ui-neutral-normal-border); color:var(--ui-secondary-text);">
    <span>Product Work &nbsp; / &nbsp; Active</span><Search size={15} />
  </div>
  <div style="max-width:1260px; margin:0 auto; padding:30px 28px;">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:24px;">
      <div>
        <div class="text-xs leading-4" style="display:flex; gap:7px; align-items:center; color:var(--ui-secondary-text);"><Folder size={14} />Prompt Folder</div>
        <h1 class="text-3xl leading-9" style="display:flex; gap:12px; align-items:center; margin:7px 0 0; font-weight:600;">Product Work<Pencil size={16} /></h1>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button type="button" class="text-sm leading-5" style={buttonStyle} onclick={() => categoriesOpen = true}><Settings size={16} />Manage Categories</button>
        <button type="button" aria-label="Delete prompt folder" style={buttonStyle}><Trash2 size={16} /></button>
      </div>
    </div>
    <div style="display:flex; gap:24px; margin:28px 0; border-bottom:1px solid var(--ui-neutral-normal-border);">
      {#each ['Active', 'Completed', 'Backlog', 'Archived'] as tab, index (tab)}
        <button class="text-base leading-6" type="button" style={`padding:0 2px 13px;border:0;border-bottom:2px solid ${index === 0 ? 'var(--ui-accent-strong-border)' : 'var(--ui-ghost-surface)'};color:${index === 0 ? 'var(--ui-normal-text)' : 'var(--ui-muted-text)'};background:var(--ui-ghost-surface);`}>{tab} <span class="text-xs leading-4">{[12, 8, 4, 2][index]}</span></button>
      {/each}
    </div>
    {#each [{ title: 'Define the next product iteration', text: 'Review the existing workflow and identify the most valuable improvements.\n\nCreate a focused list of requirements with clear acceptance criteria.' }, { title: 'Draft the implementation plan', text: 'Read the relevant files and propose a step-by-step implementation plan.\n\nInclude the expected behavior, affected components, and validation steps.' }] as prompt (prompt.title)}
      <article style="display:flex; margin-bottom:28px; border:1px solid var(--ui-card-normal-border); border-radius:var(--cthulhu-ui-radius-card); overflow:hidden; background:var(--ui-card-normal-surface);">
        <div style="display:flex; justify-content:center; width:28px; padding-top:20px; border-right:1px solid var(--ui-neutral-normal-border); color:var(--ui-muted-icon-glyph);"><GripVertical size={15} /></div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid var(--ui-neutral-normal-border);"><FileText size={19} /><div style="flex:1;"><strong>{prompt.title}</strong><div class="text-xs leading-4" style="margin-top:3px; color:var(--ui-muted-text);">Draft Implementation Plan · Updated today</div></div><span class="text-xs leading-4" style="display:flex; align-items:center; gap:8px;">Todo<ChevronDown size={13} /></span><Copy size={16} /><Trash2 size={16} /></div>
          <pre class="text-base leading-6" style="margin:0; padding:18px 24px; white-space:pre-wrap; background:var(--ui-editor-content-surface);">{prompt.text}</pre>
        </div>
      </article>
    {/each}
    {#each categories.slice(0, 2) as category (category.id)}
      <div style="display:flex; align-items:center; gap:12px; padding:20px; margin:18px 0; border:1px solid var(--ui-card-nested-border); border-radius:var(--cthulhu-ui-radius-card); background:var(--ui-card-nested-surface);"><ChevronRight size={17} /><Folder size={20} /><strong class="text-lg leading-7">{category.displayName}</strong><span class="text-xs leading-4" style="color:var(--ui-muted-text);">{category.count} prompts</span></div>
    {/each}
  </div>
</main>

<Dialog
  bind:open={categoriesOpen}
  icon={Settings}
  title="Manage Categories"
  subtitle="Product Work"
  class="w-[1040px] max-w-[calc(100vw-32px)]"
  submitText="Save Changes"
  cancelText="Close"
  submitIcon={Check}
  submitDisabled={nameError !== null}
  cancelFirst
  closeOnOutsideClick={false}
>
  
    <div class="text-sm leading-5" style="display:grid; grid-template-columns:232px minmax(0,1fr); height:min(570px,calc(100vh - 212px)); min-height:240px;">
      <aside aria-label="Categories" style="display:flex; flex-direction:column; min-height:0; border-right:1px solid var(--ui-neutral-normal-border); padding:20px 14px 20px 0;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0 10px 16px;">
          <strong class="text-xs leading-4" style="letter-spacing:0.08em; text-transform:uppercase; color:var(--ui-secondary-text);">Categories</strong>
          <span class="text-xs leading-4" style="padding:2px 7px; border-radius:5px; background:var(--ui-neutral-normal-surface); color:var(--ui-secondary-text);">6</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:2px; overflow:auto; flex:1;">
          {#each categories as category (category.id)}
            <SelectorButton
              icon={Folder}
              iconClass="text-[var(--ui-secondary-icon-glyph)]"
              text={category.displayName}
              detail={`${category.count} prompts`}
              showChevron={false}
              selected={selectedId === category.id}
              rowState={selectedId === category.id ? 'active' : 'idle'}
              selectionVariant="accent"
              ariaPressed={selectedId === category.id}
              class="manage-categories-list-item"
              onclick={() => selectCategory(category)}
            >
              {#snippet trailingAccessory()}
                {#if selectedId === category.id}
                  <ChevronRight
                    size={14}
                    class="text-[var(--ui-secondary-icon-glyph)]"
                    aria-hidden="true"
                  />
                {/if}
              {/snippet}
            </SelectorButton>
          {/each}
        </div>
        <button type="button" class="text-sm leading-5" style={`${buttonStyle}margin-top:16px;width:100%;`}><Plus size={16} />New Category</button>
      </aside>
      <div style="min-width:0; overflow:auto; padding:22px 8px 22px 26px;">
        <Row
          variant="compact-heading"
          icon={Folder}
          label={categories.find((category) => category.id === selectedId)?.displayName ?? ''}
          detail="Category settings"
          class="mb-[22px]"
        />
        <div style="display:grid; gap:17px;">
          <div>
            <label for="category-name-083" class="text-sm leading-5" style="display:block; margin-bottom:7px; font-weight:500;">Category Name <span style="color:var(--ui-muted-text);">*</span></label>
            <input id="category-name-083" class="text-sm leading-5" bind:value={categoryName} aria-invalid={nameError ? 'true' : undefined} aria-describedby="category-name-help-083" style={`${fieldStyle}${nameError ? 'border-color:var(--ui-danger-strong-border);' : ''}`} />
            <p id="category-name-help-083" class="text-xs leading-4" style={`margin:6px 0 0;color:${nameError ? 'var(--ui-danger-icon-glyph)' : 'var(--ui-muted-text)'};`}>{nameError ?? 'Required. Names must be unique in this folder, ignoring case and surrounding spaces.'}</p>
          </div>
          <div>
            <label for="category-summary-083" style="display:block; margin-bottom:7px; font-weight:500;">Short Description</label>
            <input id="category-summary-083" class="text-sm leading-5" bind:value={summary} style={fieldStyle} />
            <p class="text-xs leading-4" style="margin:6px 0 0; color:var(--ui-muted-text);">A brief summary to help you recognize this category.</p>
          </div>
          <div>
            <div id="category-description-label-083" style="margin-bottom:7px; font-weight:500;">Full Description</div>
            <div style="overflow:hidden; border:1px solid var(--ui-neutral-normal-border); border-radius:var(--cthulhu-ui-radius-control); background:var(--ui-editor-content-surface);">
              {#key selectedId}
                <div class="text-sm leading-6" style="height:194px; width:100%;" use:mountDescription={categories.find((category) => category.id === selectedId)?.displayName ?? 'Implementation'}></div>
              {/key}
            </div>
            <p class="text-xs leading-4" style="margin:6px 0 0; color:var(--ui-muted-text);">Describe what belongs here and how to use these prompts. For informational use only.</p>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; padding-top:17px; border-top:1px solid var(--ui-neutral-normal-border);">
            <div><label for="category-template-083" style="display:flex; align-items:center; gap:6px; margin-bottom:7px; font-weight:500;"><Layers size={14} />Default Template</label><select id="category-template-083" class="text-sm leading-5" style={fieldStyle}><option>Draft Implementation Plan</option><option>No template</option></select><p class="text-xs leading-4" style="margin:6px 0 0; color:var(--ui-muted-text);">Preselect a template for new prompts.</p></div>
            <div><label for="category-status-083" style="display:block; margin-bottom:7px; font-weight:500;">Default Status</label><select id="category-status-083" class="text-sm leading-5" style={fieldStyle}><option>Todo</option><option>Backlog</option></select><p class="text-xs leading-4" style="margin:6px 0 0; color:var(--ui-muted-text);">Set the starting status for new prompts.</p></div>
          </div>
        </div>
      </div>
    </div>
  
</Dialog>

<style>
  :global(.manage-categories-list-item.cthulhuUiSelectorButton) {
    flex: 0 0 auto;
    height: 58px;
  }
</style>
