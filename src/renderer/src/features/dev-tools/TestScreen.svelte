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
  import CardSurface, {
    type CardSurfaceVariant
  } from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import DropdownPopupSimple, {
    type DropdownPopupItem
  } from '@renderer/common/cthulhu-ui/DropdownPopupSimple.svelte'
  import type { DropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/DropdownPopupDetailed.svelte'
  import ConfirmationDialog from '@renderer/common/cthulhu-ui/ConfirmationDialog.svelte'
  import Card from '@renderer/common/cthulhu-ui/Card.svelte'
  import CopyButton from '@renderer/common/cthulhu-ui/CopyButton.svelte'
  import DisplayRow from '@renderer/common/cthulhu-ui/DisplayRow.svelte'
  import ErrorDialog from '@renderer/common/cthulhu-ui/ErrorDialog.svelte'
  import Button from '@renderer/common/cthulhu-ui/Button.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/FloatingValidationMessage.svelte'
  import FolderInput from '@renderer/common/cthulhu-ui/FolderInput.svelte'
  import IconCell from '@renderer/common/cthulhu-ui/IconCell.svelte'
  import IconButton, {
    type IconButtonBaseVariant,
    type IconButtonHoverVariant,
    type IconButtonSize
  } from '@renderer/common/cthulhu-ui/IconButton.svelte'
  import IconButtonWithMoreOptions from '@renderer/common/cthulhu-ui/IconButtonWithMoreOptions.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import InfoRow from '@renderer/common/cthulhu-ui/InfoRow.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/LinkButton.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/MessageRow.svelte'
  import LoadingOverlay from '@renderer/common/cthulhu-ui/loading/LoadingOverlay.svelte'
  import { createLoadingOverlayState } from '@renderer/common/cthulhu-ui/loading/loadingOverlayState.svelte.ts'
  import NumericStepperInput from '@renderer/common/cthulhu-ui/NumericStepperInput.svelte'
  import SelectorButtonWithDropdown from '@renderer/common/cthulhu-ui/SelectorButtonWithDropdown.svelte'
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
  import ValuePill from '@renderer/common/cthulhu-ui/ValuePill.svelte'
  import PromptDropTarget from '@renderer/features/drag-drop/PromptDropTarget.svelte'
  import {
    draggable,
    type DraggableOptions,
    type DroppableOptions,
    type DroppableState
  } from '@renderer/features/drag-drop/dragDrop.svelte.ts'

  const CardSurfaceVariants: CardSurfaceVariant[] = ['default', 'overlay']
  const IconButtonBaseVariants: IconButtonBaseVariant[] = ['normal', 'dim', 'muted']
  const IconButtonHoverVariants: IconButtonHoverVariant[] = [
    'neutral',
    'accent',
    'success',
    'danger',
    'glyph'
  ]
  const IconButtonSizes: IconButtonSize[] = ['default', 'compact', 'tiny', 'sidebar-rail']
  const folderDropdownItems: DropdownPopupItem[] = [
    { id: 'open', label: 'Open', icon: Folder, variant: 'accent' },
    { id: 'pin', label: 'Pin to sidebar', icon: Pin },
    { id: 'export', label: 'Export folder', icon: Download },
    { id: 'archive', label: 'Archive folder', icon: Archive },
    { id: 'delete', label: 'Delete folder', icon: Trash2, variant: 'danger' }
  ]
  const promptDropdownItems: DropdownPopupItem[] = [
    { id: 'improve', label: 'Improve wording', icon: Sparkles, variant: 'accent' },
    { id: 'copy', label: 'Copy prompt', icon: ClipboardList },
    { id: 'duplicate', label: 'Duplicate', icon: Copy },
    { id: 'rename', label: 'Rename', icon: Pencil },
    { id: 'delete', label: 'Delete prompt', icon: Trash2, variant: 'danger' }
  ]
  const detailedDropdownItems: DropdownPopupDetailedItem[] = [
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
  const detailedDropdownFooterItem: DropdownPopupDetailedItem = {
    id: 'add-folder',
    label: 'Add Prompt Folder',
    detail: 'Create a new prompt folder',
    icon: Plus
  }
  const iconButtonMoreOptionsItems: DropdownPopupDetailedItem[] = [
    {
      id: 'copy-markdown',
      label: 'Copy as Markdown',
      detail: 'Include title and prompt body',
      icon: ClipboardList
    },
    {
      id: 'duplicate-prompt',
      label: 'Duplicate Prompt',
      detail: 'Create a copy in this folder',
      icon: Copy
    },
    {
      id: 'archive-prompt',
      label: 'Archive Prompt',
      detail: 'Move out of active prompt lists',
      icon: Archive
    }
  ]
  const errorDialogText = 'Invalid workspace path\nC:\\Source\\PromptApps\\MissingWorkspace'
  const TEST_LOADING_OVERLAY_VISIBLE_MS = 5000
  const TEST_LOADING_OVERLAY_FADE_MS = 125
  const DRAG_DROP_REGRESSION_TYPE = 'test-dropdown-unregister-drag'

  let fontSizeStepperValue = $state('14')
  let minLinesStepperValue = $state('8')
  let workspaceNameValue = $state('Engineering Prompts')
  let readonlyPathValue = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let folderInputValue = $state('')
  let togglePressed = $state(true)
  let ErrorDialogOpen = $state(false)
  let ConfirmationDialogOpen = $state(false)
  let lastDropdownAction = $state('No dropdown item selected')
  let selectedDetailedDropdownItem = $state(detailedDropdownItems[0]!)
  let testLoadingOverlayActive = $state(false)
  let testLoadingOverlayTimeoutId: number | null = null
  // Reactive harness state reproduces dropdown teardown while the completed target stays mounted.
  let showDragDropRegressionDropdown = $state(true)
  let dragDropRegressionDropState = $state<DroppableState>({ isOver: false, edge: null })

  const dragDropRegressionDraggableOptions: DraggableOptions<string, string> = {
    dragType: DRAG_DROP_REGRESSION_TYPE,
    payload: 'source',
    onDragFinish: () => {
      showDragDropRegressionDropdown = false
    }
  }
  const getDragDropRegressionDroppableOptions = (): DroppableOptions<string, string> => ({
    dragType: DRAG_DROP_REGRESSION_TYPE,
    payload: 'target',
    state: dragDropRegressionDropState
  })

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
    <Title {title} variant="small" />
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
        <Title title="Cthulhu UI Test Screen" />
        <p class="component-title-description">
          Renderer component gallery for the shared Cthulhu UI surface.
        </p>
      </div>

      <Button
        icon={Loader}
        text="Show LoadingOverlay"
        variant="accent"
        testId="test-screen-show-loading-overlay"
        onclick={showTestLoadingOverlay}
      />
    </header>

    <section class="drag-drop-regression-harness" data-testid="drag-drop-regression-harness">
      <button
        use:draggable={dragDropRegressionDraggableOptions}
        type="button"
        class="drag-drop-regression-source"
        data-testid="drag-drop-regression-source"
      >
        Drag source
      </button>

      {#if showDragDropRegressionDropdown}
        <DropdownPopupSimple label="Drag regression dropdown" items={promptDropdownItems}>
          {#snippet trigger(dropdown)}
            <IconButton
              icon={MoreHorizontal}
              label="Drag regression dropdown"
              ariaHaspopup={dropdown.ariaHaspopup}
              ariaExpanded={dropdown.ariaExpanded}
              buttonAction={dropdown.triggerAction}
              onclick={dropdown.toggle}
              testId="drag-drop-regression-dropdown"
            />
          {/snippet}
        </DropdownPopupSimple>
      {/if}

      <PromptDropTarget getOptions={getDragDropRegressionDroppableOptions}>
        {#snippet children({ isOver })}
          <div
            class="drag-drop-regression-target"
            data-testid="drag-drop-regression-target"
            data-drop-over={isOver ? 'true' : 'false'}
          >
            Drop target
          </div>
        {/snippet}
      </PromptDropTarget>
    </section>

    <section class="component-grid">
      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle('CardSurface', 'All surface variants.')}

            <div class="variant-grid">
              {#each CardSurfaceVariants as variant (variant)}
                <div class="sample-card">
                  <CardSurface {variant}>
                    <div class="sample-card-content">
                      <div class="sample-title">CardSurface: {variant}</div>
                      <p>Prompt workspace metadata, compact controls, or nested content.</p>
                    </div>
                  </CardSurface>
                </div>
              {/each}
            </div>
          </div>
        </CardSurface>
      </div>

      <div id="action-buttons" class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'Action buttons',
              'Copy, link, icon text, and icon cell samples.'
            )}

            <div class="component-sample-grid">
              <div class="component-sample">
                {@render componentLabel('CopyButton')}
                <CopyButton
                  text="Copyable prompt text"
                  label="Copy prompt"
                  copiedLabel="Copied prompt"
                  testId="test-screen-copy-button"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('Button appearances')}
                <div class="variant-controls">
                  <Button icon={Plus} text="Filled" variant="accent" />
                  <Button icon={Archive} text="Outline" appearance="outline" />
                </div>
              </div>
              <div class="component-sample">
                {@render componentLabel('IconTextButton')}
                <div class="variant-controls">
                  <IconTextButton icon={Sparkles} text="Improve" />
                  <IconTextButton icon={Archive} text="Archive" />
                </div>
              </div>
              <div class="component-sample">
                {@render componentLabel('IconButtonWithMoreOptions')}
                <div class="variant-controls icon-only-controls">
                  <IconButtonWithMoreOptions
                    icon={Copy}
                    label="Copy prompt"
                    title="Copy prompt"
                    hoverVariant="accent"
                    moreOptions={iconButtonMoreOptionsItems}
                    menuTestId="icon-button-more-options-menu"
                    moreOptionsTestId="icon-button-more-options-chevron"
                    onclick={() => {
                      lastDropdownAction = 'Copy prompt'
                    }}
                    onselect={(item) => {
                      lastDropdownAction = item.label
                    }}
                  />
                </div>
              </div>
              <div class="component-sample">
                {@render componentLabel('LinkButton')}
                <LinkButton href="#action-buttons" text="Anchor link" endIcon={Download} />
              </div>
              <div class="component-sample">
                {@render componentLabel('IconCell')}
                <div class="variant-controls">
                  <IconCell icon={Folder} />
                  <IconCell icon={FileText} size="title" />
                </div>
              </div>
            </div>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'Card and rows',
              'Card, display row, setting row, and value pill composition.'
            )}

            <Card label="Card: Workspace details">
              <DisplayRow
                icon={FileText}
                label="DisplayRow: Active workspace"
                detail="Prompt library metadata"
              >
                {#snippet trailing()}
                  <ValuePill text="ValuePill" />
                {/snippet}
              </DisplayRow>

              <SettingRow
                icon={Settings}
                label="SettingRow: Autosave drafts"
                detail="Keep prompt edits available between app launches"
              >
                {#snippet detailExtra()}
                  Control: ToggleTextButton
                {/snippet}

                {#snippet control()}
                  <ToggleTextButton
                    pressed={togglePressed}
                    onclick={() => {
                      togglePressed = !togglePressed
                    }}
                  />
                {/snippet}
              </SettingRow>
            </Card>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle('DropdownPopupSimple', 'Solid icon menu popup.')}

            <div class="stack">
              <div class="button-matrix">
                <div class="variant-row">
                  <span>DropdownPopupSimple: folders</span>
                  <div class="variant-controls">
                    <DropdownPopupSimple
                      label="Folder options"
                      items={folderDropdownItems}
                      testId="folder-dropdown-menu"
                      onselect={(item) => {
                        lastDropdownAction = item.label
                      }}
                    >
                      {#snippet trigger(dropdown)}
                        <IconButton
                          icon={MoreHorizontal}
                          label="Folder options"
                          active={dropdown.open}
                          ariaHaspopup={dropdown.ariaHaspopup}
                          ariaExpanded={dropdown.ariaExpanded}
                          buttonAction={dropdown.triggerAction}
                          onclick={dropdown.toggle}
                        />
                      {/snippet}
                    </DropdownPopupSimple>
                  </div>
                </div>

                <div class="variant-row">
                  <span>DropdownPopupSimple: prompts</span>
                  <div class="variant-controls">
                    <DropdownPopupSimple
                      label="Prompt actions"
                      items={promptDropdownItems}
                      testId="prompt-dropdown-menu"
                      onselect={(item) => {
                        lastDropdownAction = item.label
                      }}
                    >
                      {#snippet trigger(dropdown)}
                        <IconButton
                          icon={MoreHorizontal}
                          label="Prompt actions"
                          ariaHaspopup={dropdown.ariaHaspopup}
                          ariaExpanded={dropdown.ariaExpanded}
                          buttonAction={dropdown.triggerAction}
                          onclick={dropdown.toggle}
                        />
                      {/snippet}
                    </DropdownPopupSimple>
                  </div>
                </div>
              </div>

              <div class="component-sample">
                {@render componentLabel('InfoRow')}
                <InfoRow text={`Last dropdown action: ${lastDropdownAction}`} />
              </div>
            </div>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'SelectorButtonWithDropdown',
              'Prompt-folder selector dropdown with a fixed footer action.'
            )}

            <div class="stack">
              <div class="component-sample">
                {@render componentLabel('SelectorButtonWithDropdown')}
                <SelectorButtonWithDropdown
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
                {@render componentLabel('InfoRow')}
                <InfoRow text={`Selected detailed item: ${selectedDetailedDropdownItem.label}`} />
              </div>
            </div>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle('Inputs', 'Text, folder, stepper, and toggle controls.')}

            <div class="form-grid">
              <div class="component-sample">
                {@render componentLabel('TextInput')}
                <TextInput
                  bind:value={workspaceNameValue}
                  aria-label="Workspace name sample"
                  placeholder="Workspace name"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('TextInput: readonlyDisplay')}
                <TextInput
                  bind:value={readonlyPathValue}
                  readonlyDisplay
                  aria-label="Readonly workspace path sample"
                />
              </div>
              <div class="component-sample validation-sample">
                {@render componentLabel('FloatingValidationMessage')}
                <FloatingValidationMessage
                  message="Workspace name is required."
                  textTestId="test-screen-floating-validation"
                >
                  <TextInput
                    value=""
                    aria-label="Invalid workspace name sample"
                    aria-invalid="true"
                    placeholder="Invalid value"
                  />
                </FloatingValidationMessage>
              </div>
              <div class="component-sample">
                {@render componentLabel('FolderInput')}
                <FolderInput
                  bind:value={folderInputValue}
                  buttonText="Browse workspace"
                  ariaLabel="Browse workspace sample"
                  disabled
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('NumericStepperInput')}
                <NumericStepperInput
                  bind:value={fontSizeStepperValue}
                  min={8}
                  max={32}
                  helperText="px"
                  aria-label="Font size stepper input"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('NumericStepperInput')}
                <NumericStepperInput
                  bind:value={minLinesStepperValue}
                  min={8}
                  max={24}
                  helperText="lines"
                  aria-label="Minimum lines stepper input"
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('ToggleTextButton')}
                <ToggleTextButton
                  pressed={togglePressed}
                  onclick={() => {
                    togglePressed = !togglePressed
                  }}
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('ToggleTextButton: disabled')}
                <ToggleTextButton pressed={false} disabled />
              </div>
            </div>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'Message Rows',
              'Inline guidance, warnings, and validation errors.'
            )}

            <div class="stack">
              <div class="component-sample">
                {@render componentLabel('InfoRow')}
                <InfoRow
                  text="Use this row for short informational guidance that helps explain the surrounding control or section."
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('MessageRow: warning')}
                <MessageRow text="Review this value before saving." variant="warning" />
              </div>
              <div class="component-sample">
                {@render componentLabel('MessageRow: danger')}
                <MessageRow text="Prompt folder name is required." variant="danger" />
              </div>
            </div>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle('Title', 'Page, small, card, and dialog title variants.')}

            <div class="stack">
              <Title title="Title: Page title" />
              <Title title="Title: Small title" variant="small" />
              <Title title="Title: Card title" variant="card" />
              <Title title="Title: Dialog title" variant="dialog" />
            </div>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle('Dialogs', 'Error and confirmation dialogs.')}

            <div class="component-sample-grid">
              <div class="component-sample">
                {@render componentLabel('ErrorDialog')}
                <Button
                  icon={AlertCircle}
                  text="Open ErrorDialog"
                  variant="accent"
                  onclick={() => {
                    ErrorDialogOpen = true
                  }}
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('ConfirmationDialog')}
                <Button
                  icon={Trash2}
                  text="Open ConfirmationDialog"
                  onclick={() => {
                    ConfirmationDialogOpen = true
                  }}
                />
              </div>
            </div>
          </div>
        </CardSurface>
      </div>

      <div class="component-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle('IconButton', 'Every icon-only variant and size.')}

            <div class="button-matrix">
              {#each IconButtonBaseVariants as baseVariant (baseVariant)}
                {#each IconButtonHoverVariants as hoverVariant (hoverVariant)}
                  <div class="variant-row">
                    <span>IconButton: {baseVariant} / {hoverVariant}</span>
                    <div class="variant-controls icon-only-controls">
                      {#each IconButtonSizes as size (size)}
                        <div class="icon-only-sample" data-fill-size={size === 'sidebar-rail'}>
                          <IconButton
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
        </CardSurface>
      </div>
    </section>
  </div>

  {#if testLoadingOverlay.isVisible()}
    <LoadingOverlay
      testId="test-screen-loading-overlay"
      fadeMs={TEST_LOADING_OVERLAY_FADE_MS}
      isFading={testLoadingOverlay.isFading()}
      message="LoadingOverlay"
    />
  {/if}
</div>

<ErrorDialog
  bind:open={ErrorDialogOpen}
  title="Workspace error"
  description="The selected folder did not load."
  errorText={errorDialogText}
/>

<ConfirmationDialog
  bind:open={ConfirmationDialogOpen}
  title="Delete Prompt"
  description="Are you sure you want to delete this prompt?"
  confirmText="Delete"
  onconfirm={() => {
    ConfirmationDialogOpen = false
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
    color: var(--ui-muted-text);
    font-size: 14px;
    line-height: 1.4;
    margin: 0;
    min-width: 0;
  }

  .component-sample-label {
    color: var(--ui-muted-text);
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

  .drag-drop-regression-harness {
    align-items: center;
    display: flex;
    gap: 12px;
  }

  .drag-drop-regression-source,
  .drag-drop-regression-target {
    align-items: center;
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    display: flex;
    height: 40px;
    justify-content: center;
    min-width: 140px;
    padding: 0 12px;
  }

  .variant-row {
    align-items: center;
    border: 1px solid var(--ui-neutral-muted-border);
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
