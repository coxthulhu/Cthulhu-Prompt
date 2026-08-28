<script lang="ts">
  import { onDestroy, type ComponentType } from 'svelte'
  import { uiAnimationDurationMs } from '@renderer/common/uiAnimationDurations'
  import {
    AlertCircle,
    Archive,
    Check,
    CircleCheckBig,
    ClipboardList,
    Copy,
    Download,
    FileText,
    Folder,
    ListTodo,
    Loader,
    MoreHorizontal,
    NotebookPen,
    NotepadText,
    Pencil,
    Pin,
    Plus,
    Search,
    Settings,
    Sparkles,
    StickyNote,
    Trash2
  } from 'lucide-svelte'
  import Accordion from '@renderer/common/cthulhu-ui/Accordion.svelte'
  import AccordionSection from '@renderer/common/cthulhu-ui/AccordionSection.svelte'
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
  import DetailedSelectorButton from '@renderer/common/cthulhu-ui/DetailedSelectorButton.svelte'
  import SimpleSelectorButton from '@renderer/common/cthulhu-ui/SimpleSelectorButton.svelte'
  import SettingRow from '@renderer/common/cthulhu-ui/SettingRow.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import Title from '@renderer/common/cthulhu-ui/Title.svelte'
  import ToggleTextButton from '@renderer/common/cthulhu-ui/ToggleTextButton.svelte'
  import ValuePill from '@renderer/common/cthulhu-ui/ValuePill.svelte'

  /** Workspace-scoped persistence key for the Test Screen accordion demo. */
  const TEST_ACCORDION_PERSISTENCE_ID = 'test-screen-prompt-status'
  /** Prompt-like rows owned by the Research accordion section. */
  const researchAccordionItems = [
    'Compare sidebar patterns',
    'Audit interaction requirements',
    'Review persistence'
  ]
  /** Prompt-like rows owned by the Active accordion section. */
  const activeAccordionItems = [
    'Map the current implementation',
    'Draft the implementation plan',
    'Add coverage'
  ]
  /** Prompt-like rows owned by the Completed accordion section. */
  const completedAccordionItems = [
    'Confirm requirements',
    'Review the visual mockup',
    'Choose section heights'
  ]

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
  const categoryIconSizes = [14, 18, 24, 32] as const
  const categoryIconCandidates: {
    name: string
    description: string
    icon: ComponentType
  }[] = [
    {
      name: 'NotepadText',
      description: 'Represents a page of structured or written notes.',
      icon: NotepadText
    },
    {
      name: 'NotebookPen',
      description: 'Emphasizes writing or editing notes in a notebook.',
      icon: NotebookPen
    },
    {
      name: 'StickyNote',
      description: 'Suggests a quick note or short reference attached to an item.',
      icon: StickyNote
    }
  ]
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
  const TEST_LOADING_OVERLAY_FADE_MS = uiAnimationDurationMs.standard

  let fontSizeStepperValue = $state('14')
  let minLinesStepperValue = $state('8')
  let workspaceNameValue = $state('Engineering Prompts')
  let readonlyPathValue = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let folderInputValue = $state('')
  // Interactive gallery state demonstrates the controlled IconTextButton toggle API.
  let iconTextButtonPressed = $state(true)
  let togglePressed = $state(true)
  let ErrorDialogOpen = $state(false)
  let ConfirmationDialogOpen = $state(false)
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

    <section class="component-grid">
      <div class="component-section icon-candidates-section" data-testid="icon-candidates">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'Icon Candidates',
              'Lucide alternatives for notes presentation.'
            )}

            <div class="category-icon-grid">
              {#each categoryIconCandidates as candidate (candidate.name)}
                {@const CandidateIcon = candidate.icon}
                <div class="category-icon-candidate">
                  <div class="category-icon-heading">
                    <CandidateIcon size={20} aria-hidden="true" />
                    <span>{candidate.name}</span>
                  </div>
                  <p>{candidate.description}</p>
                  <div class="category-icon-sizes">
                    {#each categoryIconSizes as size (size)}
                      <div class="category-icon-size-sample">
                        <span class="category-icon-preview">
                          <CandidateIcon {size} aria-hidden="true" />
                        </span>
                        <span>{size}px</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </CardSurface>
      </div>

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
                  <Button
                    icon={Plus}
                    text="Filled"
                    variant="accent"
                    testId="test-screen-accent-button"
                  />
                  <Button icon={Archive} text="Neutral" testId="test-screen-neutral-button" />
                  <Button
                    icon={AlertCircle}
                    text="Danger"
                    variant="danger"
                    testId="test-screen-danger-button"
                  />
                  <Button icon={Archive} text="Outline" appearance="outline" />
                </div>
              </div>
              <div class="component-sample">
                {@render componentLabel('IconTextButton')}
                <div class="variant-controls">
                  <IconTextButton
                    icon={Sparkles}
                    text="Improve"
                    testId="test-screen-neutral-icon-text-button"
                  />
                  <IconTextButton
                    icon={Archive}
                    text="Archive"
                    hoverVariant="accent"
                    testId="test-screen-accent-icon-text-button"
                  />
                  <IconTextButton
                    icon={Plus}
                    pressedIcon={Check}
                    text="Description"
                    pressed={iconTextButtonPressed}
                    testId="test-screen-toggle-icon-text-button"
                    onclick={() => {
                      iconTextButtonPressed = !iconTextButtonPressed
                    }}
                  />
                </div>
              </div>
              <div class="component-sample">
                {@render componentLabel('IconButtonWithMoreOptions')}
                <div class="variant-controls icon-only-controls">
                  <IconButtonWithMoreOptions
                    icon={Copy}
                    label="Copy prompt"
                    title="Copy prompt"
                    mainHoverVariant="accent"
                    moreOptionsHoverVariant="neutral"
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
            {@render componentTitle('Selectors', 'Compact and detailed dropdown selectors.')}

            <div class="stack">
              <div class="component-sample">
                {@render componentLabel('SimpleSelectorButton')}
                <SimpleSelectorButton
                  label="Select prompt folder"
                  items={detailedDropdownItems}
                  selectedItem={selectedDetailedDropdownItem}
                  showIcon
                  onselect={(item) => {
                    selectedDetailedDropdownItem = item
                    lastDropdownAction = item.label
                  }}
                />
              </div>

              <div class="component-sample">
                {@render componentLabel('DetailedSelectorButton')}
                <DetailedSelectorButton
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
                  testId="test-screen-toggle-text-button"
                  onclick={() => {
                    togglePressed = !togglePressed
                  }}
                />
              </div>
              <div class="component-sample">
                {@render componentLabel('ToggleTextButton: disabled')}
                <ToggleTextButton
                  pressed={false}
                  disabled
                  testId="test-screen-disabled-toggle-text-button"
                />
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

      <div class="component-section" data-testid="accordion-demo-section">
        <CardSurface>
          <div class="component-section-content">
            {@render componentTitle(
              'Accordion',
              'Workspace-persisted expansion with resizable proportional sections.'
            )}

            <div class="accordion-demo-shell">
              <Accordion
                persistenceId={TEST_ACCORDION_PERSISTENCE_ID}
                testId="test-screen-accordion"
              >
                <AccordionSection
                  id="research"
                  label="RESEARCH"
                  icon={Search}
                  count={8}
                >
                  <div class="accordion-demo-content">
                    {#each researchAccordionItems as item (item)}
                      <div class="accordion-demo-row">{item}</div>
                    {/each}
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="active"
                  label="ACTIVE"
                  icon={ListTodo}
                  count={20}
                >
                  <div class="accordion-demo-content">
                    {#each activeAccordionItems as item (item)}
                      <div class="accordion-demo-row">{item}</div>
                    {/each}
                  </div>
                </AccordionSection>

                <AccordionSection
                  id="completed"
                  label="COMPLETED"
                  icon={CircleCheckBig}
                  count={5}
                  minimumExpandedContentHeightPx={100}
                >
                  <div class="accordion-demo-content">
                    {#each completedAccordionItems as item (item)}
                      <div class="accordion-demo-row">{item}</div>
                    {/each}
                  </div>
                </AccordionSection>
              </Accordion>
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

  .icon-candidates-section {
    grid-column: 1 / -1;
  }

  .accordion-demo-shell {
    border: 1px solid var(--ui-neutral-muted-border);
    height: 560px;
    min-height: 0;
  }

  .accordion-demo-shell :global(.cthulhuUiAccordion) {
    height: 100%;
  }

  .accordion-demo-content {
    display: grid;
  }

  .accordion-demo-row {
    border-bottom: 1px solid var(--ui-neutral-muted-border);
    color: var(--ui-hoverable-text);
    font-size: 13px;
    line-height: 18px;
    padding: 8px 16px 8px 58px;
  }

  .category-icon-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .category-icon-candidate {
    border: 1px solid var(--ui-neutral-muted-border);
    border-radius: var(--cthulhu-ui-radius-control);
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 12px;
  }

  .category-icon-heading {
    align-items: center;
    color: var(--ui-normal-text);
    display: flex;
    font-size: 14px;
    font-weight: 700;
    gap: 8px;
  }

  .category-icon-candidate p {
    color: var(--ui-muted-text);
    font-size: 13px;
    line-height: 1.4;
    margin: 0;
  }

  .category-icon-sizes {
    align-items: end;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .category-icon-size-sample {
    align-items: center;
    color: var(--ui-muted-text);
    display: grid;
    font-size: 11px;
    gap: 4px;
    justify-items: center;
  }

  .category-icon-preview {
    align-items: center;
    color: var(--ui-hoverable-icon-glyph);
    display: flex;
    height: 36px;
    justify-content: center;
    width: 36px;
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
