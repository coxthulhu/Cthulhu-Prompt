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
    type FlatIconButtonBaseVariant,
    type FlatIconButtonHoverVariant,
    type FlatIconButtonSize
  } from '@renderer/common/cthulhu-ui/FlatIconButton.svelte'
  import FlatIconTextButton from '@renderer/common/cthulhu-ui/FlatIconTextButton.svelte'
  import FlatInfoRow from '@renderer/common/cthulhu-ui/FlatInfoRow.svelte'
  import FlatLinkButton from '@renderer/common/cthulhu-ui/FlatLinkButton.svelte'
  import FlatMessageRow from '@renderer/common/cthulhu-ui/FlatMessageRow.svelte'
  import FlatLoadingOverlay from '@renderer/common/cthulhu-ui/loading/FlatLoadingOverlay.svelte'
  import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
  import FlatNumericStepperInput from '@renderer/common/cthulhu-ui/FlatNumericStepperInput.svelte'
  import FlatSelectorButtonWithDropdown from '@renderer/common/cthulhu-ui/FlatSelectorButtonWithDropdown.svelte'
  import FlatSettingRow from '@renderer/common/cthulhu-ui/FlatSettingRow.svelte'
  import FlatTextInput from '@renderer/common/cthulhu-ui/FlatTextInput.svelte'
  import FlatTitle from '@renderer/common/cthulhu-ui/FlatTitle.svelte'
  import FlatToggleTextButton from '@renderer/common/cthulhu-ui/FlatToggleTextButton.svelte'
  import FlatValuePill from '@renderer/common/cthulhu-ui/FlatValuePill.svelte'

  const flatCardSurfaceVariants: FlatCardSurfaceVariant[] = ['default', 'overlay']
  const flatIconButtonBaseVariants: FlatIconButtonBaseVariant[] = ['normal', 'dim']
  const flatIconButtonHoverVariants: FlatIconButtonHoverVariant[] = ['neutral', 'accent', 'danger']
  const flatIconButtonSizes: FlatIconButtonSize[] = [
    'default',
    'compact',
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

{#snippet componentLabel(label: string)}
  <span class="component-sample-label">{label}</span>
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
        text="Show FlatLoadingOverlay"
        variant="accent"
        testId="test-screen-show-loading-overlay"
        onclick={showTestLoadingOverlay}
      />
    </header>

    <section class="component-grid">
      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('FlatCardSurface', 'All flat surface variants.')}

            <div class="variant-grid">
              {#each flatCardSurfaceVariants as variant (variant)}
                <div class="sample-card">
                  <FlatCardSurface {variant}>
                    <div class="sample-card-content">
                      <div class="sample-title">FlatCardSurface: {variant}</div>
                      <p>Prompt workspace metadata, compact controls, or nested content.</p>
                    </div>
                  </FlatCardSurface>
                </div>
              {/each}
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div id="flat-action-buttons" class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('Flat action buttons', 'Copy, link, icon text, and icon cell samples.')}

            <div class="component-sample-grid">
              <div class="component-sample">
                {@render componentLabel('FlatCopyButton')}
                <FlatCopyButton
                  text="Copyable prompt text"
                  label="Copy prompt"
                  copiedLabel="Copied prompt"
                  testId="test-screen-flat-copy-button"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatIconTextButton')}
                <div class="variant-controls">
                  <FlatIconTextButton icon={Sparkles} text="Improve" variant="info" />
                  <FlatIconTextButton icon={Archive} text="Archive" />
                </div>
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatLinkButton')}
                <FlatLinkButton href="#flat-action-buttons" text="Anchor link" endIcon={Download} />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatIconCell')}
                <div class="variant-controls">
                  <FlatIconCell icon={Folder} />
                  <FlatIconCell icon={FileText} size="title" />
                </div>
              </div>
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'FlatCard and rows',
              'FlatCard, display row, setting row, and value pill composition.'
            )}

            <FlatCard label="FlatCard: Workspace details">
              <FlatDisplayRow
                icon={FileText}
                label="FlatDisplayRow: Active workspace"
                detail="Prompt library metadata"
              >
                {#snippet trailing()}
                  <FlatValuePill text="FlatValuePill" />
                {/snippet}
              </FlatDisplayRow>

              <FlatSettingRow
                icon={Settings}
                label="FlatSettingRow: Autosave drafts"
                detail="Keep prompt edits available between app launches"
              >
                {#snippet detailExtra()}
                  Control: FlatToggleTextButton
                {/snippet}

                {#snippet control()}
                  <FlatToggleTextButton
                    pressed={togglePressed}
                    onclick={() => {
                      togglePressed = !togglePressed
                    }}
                  />
                {/snippet}
              </FlatSettingRow>
            </FlatCard>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('FlatIconButton', 'Every flat icon-only variant and size.')}

            <div class="button-matrix">
              {#each flatIconButtonBaseVariants as baseVariant (baseVariant)}
                {#each flatIconButtonHoverVariants as hoverVariant (hoverVariant)}
                  <div class="variant-row">
                    <span>FlatIconButton: {baseVariant} / {hoverVariant}</span>
                    <div class="variant-controls icon-only-controls">
                      {#each flatIconButtonSizes as size (size)}
                        <div
                          class="icon-only-sample"
                          data-fill-size={size === 'sidebar-rail'}
                        >
                          <FlatIconButton
                            icon={Settings}
                            label={`${baseVariant} ${hoverVariant} ${size}`}
                            {baseVariant}
                            {hoverVariant}
                            {size}
                            title={`${baseVariant} ${hoverVariant} ${size}`}
                          />
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              {/each}
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('FlatDropdownPopupSimple', 'Solid icon menu popup.')}

            <div class="stack">
              <div class="button-matrix">
                <div class="variant-row">
                  <span>FlatDropdownPopupSimple: folders</span>
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
                  </div>
                </div>

                <div class="variant-row">
                  <span>FlatDropdownPopupSimple: prompts</span>
                  <div class="variant-controls">
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
                </div>
              </div>

              <div class="component-sample">
                {@render componentLabel('FlatInfoRow')}
                <FlatInfoRow text={`Last dropdown action: ${lastDropdownAction}`} />
              </div>
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'FlatSelectorButtonWithDropdown',
              'Prompt-folder selector dropdown with a fixed footer action.'
            )}

            <div class="stack">
              <div class="component-sample">
                {@render componentLabel('FlatSelectorButtonWithDropdown')}
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
              </div>

              <div class="component-sample">
                {@render componentLabel('FlatInfoRow')}
                <FlatInfoRow text={`Selected detailed item: ${selectedDetailedDropdownItem.label}`} />
              </div>
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('Inputs', 'Text, folder, stepper, and toggle controls.')}

            <div class="form-grid">
              <div class="component-sample">
                {@render componentLabel('FlatTextInput')}
                <FlatTextInput
                  bind:value={workspaceNameValue}
                  aria-label="Workspace name sample"
                  placeholder="Workspace name"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatTextInput: readonlyDisplay')}
                <FlatTextInput
                  bind:value={readonlyPathValue}
                  readonlyDisplay
                  aria-label="Readonly workspace path sample"
                />
              </div>
              <div class="component-sample validation-sample">
                {@render componentLabel('FlatFloatingValidationMessage')}
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
              <div class="component-sample">
                {@render componentLabel('FlatFolderInput')}
                <FlatFolderInput
                  bind:value={folderInputValue}
                  buttonText="Browse workspace"
                  ariaLabel="Browse workspace sample"
                  disabled
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatNumericStepperInput')}
                <FlatNumericStepperInput
                  bind:value={fontSizeStepperValue}
                  min={8}
                  max={32}
                  helperText="px"
                  aria-label="Font size stepper input"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatNumericStepperInput')}
                <FlatNumericStepperInput
                  bind:value={minLinesStepperValue}
                  min={8}
                  max={24}
                  helperText="lines"
                  aria-label="Minimum lines stepper input"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatToggleTextButton')}
                <FlatToggleTextButton
                  pressed={togglePressed}
                  onclick={() => {
                    togglePressed = !togglePressed
                  }}
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatToggleTextButton: disabled')}
                <FlatToggleTextButton pressed={false} disabled />
              </div>
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('Message Rows', 'Inline guidance, warnings, and validation errors.')}

            <div class="stack">
              <div class="component-sample">
                {@render componentLabel('FlatInfoRow')}
                <FlatInfoRow
                  text="Use this row for short informational guidance that helps explain the surrounding control or section."
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatMessageRow: warning')}
                <FlatMessageRow text="Review this value before saving." variant="warning" />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatMessageRow: danger')}
                <FlatMessageRow text="Prompt folder name is required." variant="danger" />
              </div>
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('FlatTitle', 'Page, small, card, and dialog title variants.')}

            <div class="stack">
              <FlatTitle title="FlatTitle: Page title" />
              <FlatTitle title="FlatTitle: Small title" variant="small" />
              <FlatTitle title="FlatTitle: Card title" variant="card" />
              <FlatTitle title="FlatTitle: Dialog title" variant="dialog" />
            </div>
          </div>
        </FlatCardSurface>
      </div>

      <div class="component-section">
        <FlatCardSurface>
          <div class="component-section-content">
            {@render componentTitle('Dialogs', 'Flat error and confirmation dialogs.')}

            <div class="component-sample-grid">
              <div class="component-sample">
                {@render componentLabel('FlatErrorDialog')}
                <FlatButton
                  icon={AlertCircle}
                  text="Open FlatErrorDialog"
                  variant="accent"
                  onclick={() => {
                    flatErrorDialogOpen = true
                  }}
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('FlatConfirmationDialog')}
                <FlatButton
                  icon={Trash2}
                  text="Open FlatConfirmationDialog"
                  onclick={() => {
                    flatConfirmationDialogOpen = true
                  }}
                />
              </div>
            </div>
          </div>
        </FlatCardSurface>
      </div>
    </section>
  </div>

  {#if testLoadingOverlay.isVisible()}
    <FlatLoadingOverlay
      testId="test-screen-loading-overlay"
      fadeMs={TEST_LOADING_OVERLAY_FADE_MS}
      isFading={testLoadingOverlay.isFading()}
      message="FlatLoadingOverlay"
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
    color: var(--ui-flat-normal-text);
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
    border-bottom: 1px solid var(--ui-flat-neutral-muted-border);
    display: flex;
    gap: 16px;
    justify-content: space-between;
    padding-bottom: 16px;
  }

  .component-grid {
    align-items: start;
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .component-section,
  .sample-card {
    min-width: 0;
  }

  .test-screen-title-block,
  .component-title-block,
  .component-sample {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .component-section-content,
  .sample-card-content {
    box-sizing: border-box;
    display: grid;
    gap: 12px;
    min-width: 0;
    padding: 16px;
  }

  .component-title-description {
    color: var(--ui-flat-muted-text);
    font-size: 14px;
    line-height: 1.4;
    margin: 0;
    min-width: 0;
  }

  .component-sample-label {
    color: var(--ui-flat-muted-text);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.3;
  }

  .variant-grid,
  .component-sample-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(192px, 1fr));
  }

  .sample-title,
  .variant-row > span {
    color: var(--ui-flat-normal-text);
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
    border: 1px solid var(--ui-flat-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    display: grid;
    gap: 12px;
    grid-template-columns: 192px minmax(0, 1fr);
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

  .form-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .validation-sample {
    min-width: 0;
    padding-bottom: 34px;
  }

  @media (max-width: 1400px) {
    .component-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 900px) {
    .component-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .test-screen-header,
    .variant-row {
      grid-template-columns: 1fr;
    }

    .test-screen-header {
      flex-direction: column;
    }
  }
</style>
