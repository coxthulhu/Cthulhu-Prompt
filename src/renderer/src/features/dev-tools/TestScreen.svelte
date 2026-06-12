<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    AlertCircle,
    Archive,
    ClipboardList,
    Copy,
    Download,
    FileText,
    Folder,
    Loader,
    Minus,
    MoreHorizontal,
    Pencil,
    Pin,
    Plus,
    Settings,
    Sparkles,
    Trash2
  } from 'lucide-svelte'
  import FlatCardSurface, {
    type FlatCardSurfaceVariant
  } from '@renderer/common/cthulhu-ui/FlatCardSurface.svelte'
  import FlatDropdownPopupSimple, {
    type FlatDropdownPopupItem
  } from '@renderer/common/cthulhu-ui/FlatDropdownPopupSimple.svelte'
  import type { FlatDropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/FlatDropdownPopupDetailed.svelte'
  import FlatConfirmationDialog from '@renderer/common/cthulhu-ui/FlatConfirmationDialog.svelte'
  import FlatCard from '@renderer/common/cthulhu-ui/FlatCard.svelte'
  import FlatCopyButton from '@renderer/common/cthulhu-ui/FlatCopyButton.svelte'
  import FlatDisplayRow from '@renderer/common/cthulhu-ui/FlatDisplayRow.svelte'
  import FlatErrorDialog from '@renderer/common/cthulhu-ui/FlatErrorDialog.svelte'
  import FlatButton from '@renderer/common/cthulhu-ui/FlatButton.svelte'
  import FlatFloatingValidationMessage from '@renderer/common/cthulhu-ui/FlatFloatingValidationMessage.svelte'
  import FlatFolderInput from '@renderer/common/cthulhu-ui/FlatFolderInput.svelte'
  import FlatIconCell from '@renderer/common/cthulhu-ui/FlatIconCell.svelte'
  import FlatIconButton, {
    type FlatIconButtonSize,
    type FlatIconButtonVariant
  } from '@renderer/common/cthulhu-ui/FlatIconButton.svelte'
  import FlatIconTextButton from '@renderer/common/cthulhu-ui/FlatIconTextButton.svelte'
  import FlatInfoRow from '@renderer/common/cthulhu-ui/FlatInfoRow.svelte'
  import FlatLinkButton from '@renderer/common/cthulhu-ui/FlatLinkButton.svelte'
  import FlatMessageRow from '@renderer/common/cthulhu-ui/FlatMessageRow.svelte'
  import FlatLoadingOverlay from '@renderer/common/cthulhu-ui/loading/FlatLoadingOverlay.svelte'
  import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
  import FlatLogDetails from '@renderer/common/cthulhu-ui/FlatLogDetails.svelte'
  import FlatNumericStepperInput from '@renderer/common/cthulhu-ui/FlatNumericStepperInput.svelte'
  import FlatRow from '@renderer/common/cthulhu-ui/FlatRow.svelte'
  import FlatSelectorButton from '@renderer/common/cthulhu-ui/FlatSelectorButton.svelte'
  import FlatSelectorButtonWithDropdown from '@renderer/common/cthulhu-ui/FlatSelectorButtonWithDropdown.svelte'
  import FlatSettingRow from '@renderer/common/cthulhu-ui/FlatSettingRow.svelte'
  import FlatTextInput from '@renderer/common/cthulhu-ui/FlatTextInput.svelte'
  import FlatTitle from '@renderer/common/cthulhu-ui/FlatTitle.svelte'
  import FlatToggleTextButton from '@renderer/common/cthulhu-ui/FlatToggleTextButton.svelte'
  import FlatValuePill from '@renderer/common/cthulhu-ui/FlatValuePill.svelte'

  const flatCardSurfaceVariants: FlatCardSurfaceVariant[] = ['default', 'overlay']
  const flatIconButtonVariants: FlatIconButtonVariant[] = ['ghost', 'neutral', 'dim-sidebar']
  const flatIconButtonSizes: FlatIconButtonSize[] = [
    'default',
    'compact',
    'rail',
    'rail-fill',
    'sidebar-rail'
  ]
  const folderDropdownItems: FlatDropdownPopupItem[] = [
    { id: 'open', label: 'Open', icon: Folder, variant: 'accent' },
    { id: 'pin', label: 'Pin to sidebar', icon: Pin },
    { id: 'export', label: 'Export folder', icon: Download },
    { id: 'archive', label: 'Archive folder', icon: Archive },
    { id: 'delete', label: 'Delete folder', icon: Trash2, variant: 'danger' }
  ]
  const promptDropdownItems: FlatDropdownPopupItem[] = [
    { id: 'improve', label: 'Improve wording', icon: Sparkles, variant: 'accent' },
    { id: 'copy', label: 'Copy prompt', icon: ClipboardList },
    { id: 'duplicate', label: 'Duplicate', icon: Copy },
    { id: 'rename', label: 'Rename', icon: Pencil },
    { id: 'delete', label: 'Delete prompt', icon: Trash2, variant: 'danger' }
  ]
  const detailedDropdownItems: FlatDropdownPopupDetailedItem[] = [
    {
      id: 'engineering',
      label: 'Engineering Workflows',
      detailParts: ['18 prompts', 'Updated 12m ago'],
      icon: Folder
    },
    {
      id: 'release',
      label: 'Release Notes',
      detailParts: ['9 prompts', 'Updated 1h ago'],
      icon: FileText
    },
    {
      id: 'review',
      label: 'Code Review',
      detailParts: ['14 prompts', 'Updated yesterday'],
      icon: ClipboardList
    }
  ]
  const detailedDropdownFooterItem: FlatDropdownPopupDetailedItem = {
    id: 'add-folder',
    label: 'Add Prompt Folder',
    detail: 'Create a new prompt folder',
    icon: Plus
  }
  const logDetailsText = 'Queued revision sync\nworkspaceId: demo-workspace\nstatus: ready'
  const errorDialogText = 'Invalid workspace path\nC:\\Source\\PromptApps\\MissingWorkspace'
  const TEST_LOADING_OVERLAY_VISIBLE_MS = 5000
  const TEST_LOADING_OVERLAY_FADE_MS = 125

  let fontSizeStepperValue = $state('14')
  let minLinesStepperValue = $state('8')
  let workspaceNameValue = $state('Engineering Prompts')
  let readonlyPathValue = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let folderInputValue = $state('')
  let togglePressed = $state(true)
  let flatErrorDialogOpen = $state(false)
  let flatConfirmationDialogOpen = $state(false)
  let lastDropdownAction = $state('No dropdown item selected')
  let selectedDetailedDropdownItem = $state(detailedDropdownItems[0]!)
  let testLoadingOverlayActive = $state(false)
  let testLoadingOverlayTimeoutId: number | null = null

  const testLoadingOverlay = createLoadingOverlayState({
    fadeMs: TEST_LOADING_OVERLAY_FADE_MS,
    isLoading: () => testLoadingOverlayActive
  })

  const clearTestLoadingOverlayTimeout = (): void => {
    if (testLoadingOverlayTimeoutId !== null) {
      window.clearTimeout(testLoadingOverlayTimeoutId)
      testLoadingOverlayTimeoutId = null
    }
  }

  const showTestLoadingOverlay = (): void => {
    clearTestLoadingOverlayTimeout()
    testLoadingOverlayActive = true
    testLoadingOverlayTimeoutId = window.setTimeout(() => {
      testLoadingOverlayActive = false
      testLoadingOverlayTimeoutId = null
    }, TEST_LOADING_OVERLAY_VISIBLE_MS)
  }

  // Side effect: clear the demo overlay timer when leaving the test screen.
  onDestroy(() => {
    clearTestLoadingOverlayTimeout()
  })
</script>

{#snippet componentTitle(title: string, description?: string)}
  <div class="component-title-block">
    <FlatTitle {title} variant="small" />
    {#if description}
      <p class="component-title-description">{description}</p>
    {/if}
  </div>
{/snippet}

<div class="test-screen-shell" data-testid="test-screen">
  <div class="test-screen-content">
    <header class="test-screen-header">
      <div class="test-screen-title-block">
        <FlatTitle title="Cthulhu UI Test Screen" />
        <p class="component-title-description">
          Renderer component gallery for the shared Cthulhu UI surface.
        </p>
      </div>

      <FlatButton
        icon={Loader}
        text="Show loading overlay"
        variant="accent"
        testId="test-screen-show-loading-overlay"
        onclick={showTestLoadingOverlay}
      />
    </header>

    <section class="component-grid">
      <FlatCardSurface class="component-section">
        {@render componentTitle('FlatCardSurface', 'All flat surface variants.')}

        <div class="variant-grid">
          {#each flatCardSurfaceVariants as variant (variant)}
            <FlatCardSurface {variant} class="sample-card">
              <div class="sample-title">{variant}</div>
              <p>Prompt workspace metadata, compact controls, or nested content.</p>
            </FlatCardSurface>
          {/each}
        </div>
      </FlatCardSurface>

      <FlatCardSurface id="flat-action-buttons" class="component-section">
        {@render componentTitle('Flat action buttons', 'Copy, link, icon text, and icon cell samples.')}

        <div class="variant-controls">
          <FlatCopyButton
            text="Copyable prompt text"
            label="Copy prompt"
            copiedLabel="Copied prompt"
            testId="test-screen-flat-copy-button"
          />
          <FlatIconTextButton icon={Sparkles} text="Improve" variant="info" />
          <FlatIconTextButton icon={Archive} text="Archive" />
          <FlatLinkButton href="#flat-action-buttons" text="Anchor link" endIcon={Download} />
          <FlatIconCell icon={Folder} />
          <FlatIconCell icon={FileText} size="title" />
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section component-section-wide">
        {@render componentTitle('FlatCard and rows', 'Display, setting, and generic row compositions.')}

        <FlatCard label="Workspace details" surfaceClass="flat-card-gallery-surface">
          <FlatDisplayRow
            icon={FileText}
            label="Active workspace"
            detail="Prompt library metadata"
          >
            {#snippet trailing()}
              <FlatValuePill text="Sample" />
            {/snippet}
          </FlatDisplayRow>

          <FlatRow
            icon={ClipboardList}
            label="Prompt inventory"
            detail="42 prompts across 6 folders"
            trailingLayout="grouped"
          >
            {#snippet detailExtra()}
              Last generated prompt was updated during the current gallery session.
            {/snippet}

            {#snippet trailing()}
              <FlatValuePill text="Ready" />
              <FlatCopyButton text="42 prompts across 6 folders" label="Copy summary" />
            {/snippet}
          </FlatRow>

          <FlatSettingRow
            icon={Settings}
            label="Autosave drafts"
            detail="Keep prompt edits available between app launches"
          >
            {#snippet control()}
              <FlatToggleTextButton
                pressed={togglePressed}
                onclick={() => {
                  togglePressed = !togglePressed
                }}
              />
            {/snippet}

            {#snippet actions()}
              <FlatButton icon={Download} text="Export" />
              <FlatLinkButton href="#flat-action-buttons" text="More" variant="accent" />
            {/snippet}
          </FlatSettingRow>
        </FlatCard>
      </FlatCardSurface>

      <FlatCardSurface class="component-section component-section-wide">
        {@render componentTitle('FlatIconButton', 'Every flat icon-only variant and size.')}

        <div class="button-matrix">
          {#each flatIconButtonVariants as variant (variant)}
            <div class="variant-row">
              <span>{variant}</span>
              <div class="variant-controls icon-only-controls">
                {#each flatIconButtonSizes as size (size)}
                  <div
                    class="icon-only-sample"
                    data-fill-size={size === 'rail-fill' || size === 'sidebar-rail'}
                  >
                    <FlatIconButton
                      icon={Settings}
                      label={`${variant} ${size}`}
                      {variant}
                      {size}
                      title={`${variant} ${size}`}
                    />
                  </div>
                {/each}
                <FlatIconButton icon={Minus} label={`${variant} disabled`} {variant} disabled />
              </div>
            </div>
          {/each}
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle('FlatDropdownPopupSimple', 'Solid icon menu popup.')}

        <div class="stack">
          <div class="variant-controls">
            <FlatDropdownPopupSimple
              label="Folder options"
              items={folderDropdownItems}
              testId="folder-dropdown-menu"
              onselect={(item) => {
                lastDropdownAction = item.label
              }}
            >
              {#snippet trigger(dropdown)}
                <FlatIconButton
                  icon={MoreHorizontal}
                  label="Folder options"
                  active={dropdown.open}
                  ariaHaspopup={dropdown.ariaHaspopup}
                  ariaExpanded={dropdown.ariaExpanded}
                  buttonAction={dropdown.triggerAction}
                  onclick={dropdown.toggle}
                />
              {/snippet}
            </FlatDropdownPopupSimple>
            <FlatDropdownPopupSimple
              label="Prompt actions"
              items={promptDropdownItems}
              testId="prompt-dropdown-menu"
              onselect={(item) => {
                lastDropdownAction = item.label
              }}
            >
              {#snippet trigger(dropdown)}
                <FlatIconButton
                  icon={MoreHorizontal}
                  label="Prompt actions"
                  ariaHaspopup={dropdown.ariaHaspopup}
                  ariaExpanded={dropdown.ariaExpanded}
                  buttonAction={dropdown.triggerAction}
                  onclick={dropdown.toggle}
                />
              {/snippet}
            </FlatDropdownPopupSimple>
          </div>

          <FlatInfoRow text={`Last dropdown action: ${lastDropdownAction}`} />
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle(
          'FlatDropdownPopupDetailed',
          'FlatSelectorButton rows with a fixed footer action.'
        )}

        <div class="stack">
          <FlatSelectorButtonWithDropdown
            label="Prompt folder selector"
            items={detailedDropdownItems}
            selectedItem={selectedDetailedDropdownItem}
            footerItem={detailedDropdownFooterItem}
            testId="detailed-dropdown-menu"
            triggerTestId="detailed-dropdown-trigger"
            onselect={(item) => {
              selectedDetailedDropdownItem = item
              lastDropdownAction = item.label
            }}
          />

          <FlatInfoRow text={`Selected detailed item: ${selectedDetailedDropdownItem.label}`} />
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle('FlatSelectorButton', 'Sidebar-style trigger button.')}

        <div class="stack">
          <FlatSelectorButton
            icon={Folder}
            text="Engineering Workflows"
            detailParts={['18 prompts', 'Updated 12m ago']}
          />
          <FlatSelectorButton
            icon={Folder}
            text="Engineering Workflows"
            detailParts={['18 prompts', 'Updated 12m ago']}
            size="large"
          />
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle('Inputs', 'Text, folder, stepper, and toggle controls.')}

        <div class="form-grid">
          <FlatTextInput
            bind:value={workspaceNameValue}
            aria-label="Workspace name sample"
            placeholder="Workspace name"
          />
          <FlatTextInput
            bind:value={readonlyPathValue}
            readonlyDisplay
            aria-label="Readonly workspace path sample"
          />
          <div class="validation-sample">
            <FlatFloatingValidationMessage
              message="Workspace name is required."
              textTestId="test-screen-floating-validation"
            >
              <FlatTextInput
                value=""
                aria-label="Invalid workspace name sample"
                aria-invalid="true"
                placeholder="Invalid value"
              />
            </FlatFloatingValidationMessage>
          </div>
          <FlatFolderInput
            bind:value={folderInputValue}
            buttonText="Browse workspace"
            ariaLabel="Browse workspace sample"
            disabled
          />
          <FlatNumericStepperInput
            bind:value={fontSizeStepperValue}
            min={8}
            max={32}
            helperText="px"
            aria-label="Font size stepper input"
          />
          <FlatNumericStepperInput
            bind:value={minLinesStepperValue}
            min={8}
            max={24}
            helperText="lines"
            aria-label="Minimum lines stepper input"
          />
          <FlatToggleTextButton
            pressed={togglePressed}
            onclick={() => {
              togglePressed = !togglePressed
            }}
          />
          <FlatToggleTextButton pressed={false} disabled />
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle('Message Rows', 'Inline guidance, warnings, and validation errors.')}

        <div class="stack">
          <FlatInfoRow
            text="Use this row for short informational guidance that helps explain the surrounding control or section."
          />
          <FlatMessageRow text="Review this value before saving." variant="warning" />
          <FlatMessageRow text="Prompt folder name is required." variant="danger" />
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle('FlatTitle', 'Page, small, card, and dialog title variants.')}

        <div class="stack">
          <FlatTitle title="Page title" />
          <FlatTitle title="Small title" variant="small" />
          <FlatTitle title="Card title" variant="card" />
          <FlatTitle title="Dialog title" variant="dialog" />
        </div>
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle('FlatLogDetails', 'Technical details block.')}

        <FlatLogDetails title="Autosave" text={logDetailsText} />
      </FlatCardSurface>

      <FlatCardSurface class="component-section">
        {@render componentTitle('Dialogs', 'Flat error and confirmation dialogs.')}

        <div class="variant-controls">
          <FlatButton
            icon={AlertCircle}
            text="Flat error"
            variant="accent"
            onclick={() => {
              flatErrorDialogOpen = true
            }}
          />
          <FlatButton
            icon={Trash2}
            text="Flat confirm"
            onclick={() => {
              flatConfirmationDialogOpen = true
            }}
          />
        </div>
      </FlatCardSurface>
    </section>
  </div>

  {#if testLoadingOverlay.isVisible()}
    <FlatLoadingOverlay
      testId="test-screen-loading-overlay"
      fadeMs={TEST_LOADING_OVERLAY_FADE_MS}
      isFading={testLoadingOverlay.isFading()}
      message="Loading test screen..."
    />
  {/if}
</div>

<FlatErrorDialog
  bind:open={flatErrorDialogOpen}
  title="Workspace error"
  description="The selected folder did not load."
  errorText={errorDialogText}
/>

<FlatConfirmationDialog
  bind:open={flatConfirmationDialogOpen}
  title="Delete Prompt"
  description="Are you sure you want to delete this prompt?"
  confirmText="Delete"
  onconfirm={() => {
    flatConfirmationDialogOpen = false
  }}
/>

<style>
  .test-screen-shell {
    background: var(--background);
    color: var(--ui-normal-text);
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: auto;
    position: relative;
    width: 100%;
  }

  .test-screen-content {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 100%;
    padding: 16px;
    width: 100%;
  }

  .test-screen-header {
    align-items: flex-start;
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    display: flex;
    gap: 16px;
    justify-content: space-between;
    padding-bottom: 16px;
  }

  .component-grid {
    align-items: start;
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(384px, 1fr));
  }

  .test-screen-title-block,
  .component-title-block {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .component-title-description {
    color: var(--ui-muted-text);
    font-size: 14px;
    line-height: 1.4;
    margin: 0;
    min-width: 0;
  }

  .variant-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(192px, 1fr));
  }

  :global(.component-section),
  :global(.sample-card) {
    border: 1px solid var(--ui-flat-card-normal-border);
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    padding: 16px;
  }

  .sample-title,
  .variant-row > span {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.3;
  }

  .button-matrix,
  .stack,
  .form-grid {
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  .variant-row {
    align-items: center;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    display: grid;
    gap: 12px;
    grid-template-columns: 160px minmax(0, 1fr);
    min-width: 0;
    padding: 12px;
  }

  .variant-controls {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    min-width: 0;
  }

  .icon-only-controls {
    align-items: stretch;
  }

  .icon-only-sample {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-height: 36px;
    min-width: 36px;
  }

  .icon-only-sample[data-fill-size='true'] {
    height: 44px;
  }

  :global(.flat-card-gallery-surface) {
    border: 1px solid var(--ui-flat-card-normal-border);
  }

  .form-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .validation-sample {
    min-width: 0;
    padding-bottom: 34px;
  }

  @media (max-width: 768px) {
    .test-screen-header,
    .variant-row {
      grid-template-columns: 1fr;
    }

    .test-screen-header {
      flex-direction: column;
    }

    .component-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
