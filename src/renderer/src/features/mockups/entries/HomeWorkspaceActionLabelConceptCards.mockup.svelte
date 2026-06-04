<script lang="ts">
  import {
    Box,
    FolderOpen,
    FolderPlus,
    HardDrive,
    Library,
    MousePointer2,
    X
  } from 'lucide-svelte'
  import CardSurface from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import SelectorButton from '@renderer/common/cthulhu-ui/SelectorButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/Separator.svelte'

  type ConceptVariant = 'tabbed' | 'status' | 'split' | 'question'

  type LabelConcept = {
    id: string
    title: string
    label: string
    description: string
    variant: ConceptVariant
    icon: typeof FolderOpen
  }

  const labelConcepts: LabelConcept[] = [
    {
      id: 'tabbed',
      title: 'Attached Tab',
      label: 'Workspace',
      description: 'Treat the label like a small attached tab instead of a heading above the card.',
      variant: 'tabbed',
      icon: Box
    },
    {
      id: 'status',
      title: 'Status Header',
      label: 'Workspace Folder',
      description: 'Pairs the label with a loaded-folder status line and keeps the actions compact.',
      variant: 'status',
      icon: HardDrive
    },
    {
      id: 'split',
      title: 'Split Label Rail',
      label: 'Prompt Library',
      description: 'Moves the label into a rail so the flat action card reads as a grouped tool.',
      variant: 'split',
      icon: Library
    },
    {
      id: 'question',
      title: 'Question Copy',
      label: 'Where should prompts live?',
      description: 'Uses plain language instead of a noun label for the initial setup moment.',
      variant: 'question',
      icon: MousePointer2
    }
  ]
</script>

<section class="homeWorkspaceLabelConcepts">
  <header class="homeWorkspaceLabelConceptsHeader">
    <h1>Workspace Action Label Concept Cards</h1>
    <p>New flat-card label directions shown in home-page-sized examples.</p>
  </header>

  <div class="homeWorkspaceLabelConceptsGrid">
    {#each labelConcepts as concept (concept.id)}
      <article class="homeWorkspaceLabelConcept" data-variant={concept.variant}>
        <div class="homeWorkspaceLabelConceptTitleRow">
          <span>{concept.title}</span>
          <span>{concept.description}</span>
        </div>

        {#if concept.variant === 'tabbed'}
          <div class="homeWorkspaceLabelConceptTabbed">
            <div class="homeWorkspaceLabelConceptTab">
              <concept.icon class="homeWorkspaceLabelConceptTabIcon" size={18} aria-hidden="true" />
              <span>{concept.label}</span>
            </div>
            {@render WorkspaceActionCard('default')}
          </div>
        {:else if concept.variant === 'status'}
          <CardSurface class="homeWorkspaceLabelConceptStatusShell" variant="flat">
            <div class="homeWorkspaceLabelConceptStatusHeader">
              <div class="homeWorkspaceLabelConceptStatusIcon">
                <concept.icon size={19} aria-hidden="true" />
              </div>
              <div>
                <span>{concept.label}</span>
                <strong>C:\Source\PromptApps\Personal Prompts</strong>
              </div>
            </div>
            <Separator class="homeWorkspaceLabelConceptSeparator" />
            {@render WorkspaceActionList('compact')}
          </CardSurface>
        {:else if concept.variant === 'split'}
          <div class="homeWorkspaceLabelConceptSplit">
            <div class="homeWorkspaceLabelConceptRail">
              <concept.icon size={19} aria-hidden="true" />
              <span>{concept.label}</span>
            </div>
            {@render WorkspaceActionCard('default')}
          </div>
        {:else}
          <div class="homeWorkspaceLabelConceptQuestion">
            <div class="homeWorkspaceLabelConceptQuestionCopy">
              <concept.icon
                class="homeWorkspaceLabelConceptQuestionIcon"
                size={22}
                aria-hidden="true"
              />
              <h2>{concept.label}</h2>
              <p>Choose an existing folder or create a new prompt workspace.</p>
            </div>
            {@render WorkspaceActionCard('primary-create')}
          </div>
        {/if}
      </article>
    {/each}
  </div>
</section>

{#snippet WorkspaceActionCard(mode: 'default' | 'primary-create')}
  <CardSurface class="homeWorkspaceLabelConceptCard" variant="flat">
    {@render WorkspaceActionList(mode)}
  </CardSurface>
{/snippet}

{#snippet WorkspaceActionList(mode: 'default' | 'compact' | 'primary-create')}
  <div class="homeWorkspaceLabelConceptActions" data-mode={mode}>
    <SelectorButton
      icon={mode === 'primary-create' ? FolderPlus : FolderOpen}
      iconClass="translate-y-px"
      text={mode === 'primary-create' ? 'Create Workspace' : 'Open Workspace'}
      detail={
        mode === 'primary-create'
          ? 'Choose a folder to set up a new workspace.'
          : 'Open an existing workspace folder.'
      }
      size="large"
      showChevron={mode === 'compact'}
    />

    <Separator class="homeWorkspaceLabelConceptSeparator" />

    <SelectorButton
      icon={mode === 'primary-create' ? FolderOpen : FolderPlus}
      iconClass="translate-y-px"
      text={mode === 'primary-create' ? 'Open Existing' : 'Create Workspace'}
      detail={
        mode === 'primary-create'
          ? 'Continue from a workspace info file.'
          : 'Choose a folder to set up a new workspace.'
      }
      size="large"
      showChevron={false}
    />

    {#if mode !== 'primary-create'}
      <Separator class="homeWorkspaceLabelConceptSeparator" />

      <SelectorButton
        icon={X}
        iconClass="translate-y-px"
        text="Close Workspace"
        detail="Unload the current workspace folder."
        size="large"
        showChevron={false}
      />
    {/if}
  </div>
{/snippet}

<style>
  .homeWorkspaceLabelConcepts {
    box-sizing: border-box;
    display: grid;
    gap: 24px;
    min-width: 0;
    padding: 6px 0 32px;
    width: 100%;
  }

  .homeWorkspaceLabelConceptsHeader {
    display: grid;
    gap: 8px;
    max-width: 860px;
    min-width: 0;
  }

  .homeWorkspaceLabelConceptsHeader h1 {
    color: var(--ui-normal-text);
    font-size: 28px;
    font-weight: 680;
    letter-spacing: 0;
    line-height: 1.15;
    margin: 0;
  }

  .homeWorkspaceLabelConceptsHeader p {
    color: var(--ui-secondary-text);
    font-size: 15px;
    line-height: 1.45;
    margin: 0;
  }

  .homeWorkspaceLabelConceptsGrid {
    display: grid;
    gap: 22px;
    grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
    min-width: 0;
  }

  .homeWorkspaceLabelConcept {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .homeWorkspaceLabelConceptTitleRow {
    align-items: baseline;
    display: grid;
    gap: 3px;
    min-width: 0;
    padding: 0 8px;
  }

  .homeWorkspaceLabelConceptTitleRow span:first-child {
    color: var(--ui-hoverable-text);
    font-size: 13px;
    font-weight: 700;
  }

  .homeWorkspaceLabelConceptTitleRow span:last-child {
    color: var(--ui-muted-text);
    font-size: 12px;
    line-height: 1.35;
  }

  :global(.homeWorkspaceLabelConceptCard),
  :global(.homeWorkspaceLabelConceptStatusShell) {
    min-width: 0;
    width: 100%;
  }

  .homeWorkspaceLabelConceptActions {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .homeWorkspaceLabelConceptActions[data-mode='compact'] {
    gap: 0;
  }

  :global(.homeWorkspaceLabelConceptSeparator) {
    background-color: var(--ui-card-nested-border);
    margin: 8px 0;
  }

  .homeWorkspaceLabelConceptTabbed {
    display: grid;
    justify-items: start;
    min-width: 0;
  }

  .homeWorkspaceLabelConceptTab {
    align-items: center;
    background: var(--ui-card-normal-surface-gradient-start);
    border-radius: var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card) 0 0;
    color: var(--ui-hoverable-text);
    display: inline-flex;
    font-size: 14px;
    font-weight: 650;
    gap: 8px;
    min-height: 34px;
    padding: 0 12px;
  }

  :global(.homeWorkspaceLabelConceptTabIcon) {
    color: var(--ui-hoverable-icon-glyph);
  }

  .homeWorkspaceLabelConcept[data-variant='tabbed'] :global(.homeWorkspaceLabelConceptCard) {
    border-top-left-radius: 0;
  }

  .homeWorkspaceLabelConceptStatusHeader {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 36px minmax(0, 1fr);
    min-width: 0;
    padding: 6px 8px 2px;
  }

  .homeWorkspaceLabelConceptStatusIcon {
    align-items: center;
    background: var(--ui-neutral-normal-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  .homeWorkspaceLabelConceptStatusHeader div:last-child {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .homeWorkspaceLabelConceptStatusHeader span {
    color: var(--ui-muted-text);
    font-size: 11px;
    font-weight: 760;
    line-height: 1;
    text-transform: uppercase;
  }

  .homeWorkspaceLabelConceptStatusHeader strong {
    color: var(--ui-hoverable-text);
    font-size: 14px;
    font-weight: 620;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .homeWorkspaceLabelConceptSplit {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    min-width: 0;
  }

  .homeWorkspaceLabelConceptRail {
    align-items: center;
    background: var(--ui-neutral-muted-surface);
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-card) 0 0 var(--cthulhu-ui-radius-card);
    color: var(--ui-secondary-text);
    display: grid;
    gap: 8px;
    justify-items: center;
    min-width: 0;
    padding: 14px 10px;
    text-align: center;
  }

  .homeWorkspaceLabelConceptRail span {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.25;
  }

  .homeWorkspaceLabelConcept[data-variant='split'] :global(.homeWorkspaceLabelConceptCard) {
    border-bottom-left-radius: 0;
    border-top-left-radius: 0;
  }

  .homeWorkspaceLabelConceptQuestion {
    display: grid;
    gap: 10px;
    min-width: 0;
  }

  .homeWorkspaceLabelConceptQuestionCopy {
    border-left: 3px solid var(--ui-accent-blue-normal-border);
    display: grid;
    gap: 5px;
    grid-template-columns: 28px minmax(0, 1fr);
    min-width: 0;
    padding-left: 12px;
  }

  :global(.homeWorkspaceLabelConceptQuestionIcon) {
    color: var(--ui-accent-blue-icon-glyph);
    grid-row: 1 / span 2;
    margin-top: 2px;
  }

  .homeWorkspaceLabelConceptQuestionCopy h2 {
    color: var(--ui-normal-text);
    font-size: 20px;
    font-weight: 650;
    letter-spacing: 0;
    line-height: 1.2;
    margin: 0;
  }

  .homeWorkspaceLabelConceptQuestionCopy p {
    color: var(--ui-muted-text);
    font-size: 13px;
    line-height: 1.35;
    margin: 0;
  }

  @media (max-width: 760px) {
    .homeWorkspaceLabelConceptsGrid {
      grid-template-columns: 1fr;
    }

    .homeWorkspaceLabelConceptSplit {
      grid-template-columns: 1fr;
    }

    .homeWorkspaceLabelConceptRail {
      border-radius: var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card) 0 0;
      grid-template-columns: auto minmax(0, max-content);
      justify-content: center;
    }

    .homeWorkspaceLabelConcept[data-variant='split'] :global(.homeWorkspaceLabelConceptCard) {
      border-radius: 0 0 var(--cthulhu-ui-radius-card) var(--cthulhu-ui-radius-card);
    }
  }
</style>
