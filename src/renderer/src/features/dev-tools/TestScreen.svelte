<script lang="ts">
  import {
    AlertCircle,
    Archive,
    Check,
    ClipboardList,
    Copy,
    Download,
    FileText,
    Folder,
    Home,
    Info,
    Minus,
    MoreHorizontal,
    Pencil,
    Pin,
    Plus,
    Settings,
    Sparkles,
    Trash2
  } from 'lucide-svelte'
  import AccentIconTile, {
    type AccentIconTileVariant
  } from '@renderer/common/cthulhu-ui/AccentIconTile.svelte'
  import CardSurface, {
    type CardSurfaceVariant
  } from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import FlatDropdownPopupSimple, {
    type FlatDropdownPopupItem
  } from '@renderer/common/cthulhu-ui/FlatDropdownPopupSimple.svelte'
  import type { FlatDropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/FlatDropdownPopupDetailed.svelte'
  import FlatConfirmationDialog from '@renderer/common/cthulhu-ui/FlatConfirmationDialog.svelte'
  import FlatErrorDialog from '@renderer/common/cthulhu-ui/FlatErrorDialog.svelte'
  import FlatFloatingValidationMessage from '@renderer/common/cthulhu-ui/FlatFloatingValidationMessage.svelte'
  import FlatMessageRow from '@renderer/common/cthulhu-ui/FlatMessageRow.svelte'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import InfoRow from '@renderer/common/cthulhu-ui/InfoRow.svelte'
  import LogDetails from '@renderer/common/cthulhu-ui/LogDetails.svelte'
  import NumericInput from '@renderer/common/cthulhu-ui/NumericInput.svelte'
  import FlatNumericStepperInput from '@renderer/common/cthulhu-ui/FlatNumericStepperInput.svelte'
  import SectionHeader from '@renderer/common/cthulhu-ui/SectionHeader.svelte'
  import FlatSelectorButton from '@renderer/common/cthulhu-ui/FlatSelectorButton.svelte'
  import FlatSelectorButtonWithDropdown from '@renderer/common/cthulhu-ui/FlatSelectorButtonWithDropdown.svelte'
  import StatusBadge, {
    type StatusBadgeVariant
  } from '@renderer/common/cthulhu-ui/StatusBadge.svelte'
  import TextInput from '@renderer/common/cthulhu-ui/TextInput.svelte'
  import TitleBlock from '@renderer/common/cthulhu-ui/TitleBlock.svelte'
  import FlatToggleTextButton from '@renderer/common/cthulhu-ui/FlatToggleTextButton.svelte'
  import type { CthulhuSize } from '@renderer/common/cthulhu-ui/types'

  type IconOnlyButtonSize = 'default' | 'compact' | 'rail' | 'rail-fill' | 'tree-action'
  type IconOnlyButtonVariant = 'outline' | 'transparent' | 'dim-border' | 'accent' | 'danger'
  type IconTextButtonState = 'active' | 'enabled' | 'disabled'
  type IconTextButtonVariant = 'neutral' | 'accent' | 'nav'

  const accentIconTileVariants: AccentIconTileVariant[] = [
    'neutral',
    'accent',
    'accent-blue',
    'accent-green',
    'danger'
  ]
  const accentIconTileSizes: CthulhuSize[] = ['small', 'medium', 'large']
  const cardSurfaceVariants: CardSurfaceVariant[] = ['panel', 'panel-flat', 'solid', 'inset']
  const iconOnlyButtonVariants: IconOnlyButtonVariant[] = [
    'outline',
    'transparent',
    'dim-border',
    'accent',
    'danger'
  ]
  const iconOnlyButtonSizes: IconOnlyButtonSize[] = [
    'default',
    'compact',
    'rail',
    'rail-fill',
    'tree-action'
  ]
  const iconTextButtonVariants: IconTextButtonVariant[] = ['neutral', 'accent', 'nav']
  const iconTextButtonStates: IconTextButtonState[] = ['enabled', 'active', 'disabled']
  const statusBadgeVariants: StatusBadgeVariant[] = ['success', 'accent']
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
  const titleBlockIconVariants: AccentIconTileVariant[] = [
    'neutral',
    'accent',
    'accent-blue',
    'accent-green',
    'danger'
  ]
  const logDetailsText = 'Queued revision sync\nworkspaceId: demo-workspace\nstatus: ready'
  const errorDialogText = 'Invalid workspace path\nC:\\Source\\PromptApps\\MissingWorkspace'

  let standardText = $state('Renderer prompt collection')
  let invalidText = $state('')
  let readonlyPath = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let numericValue = $state('14')
  let invalidNumericValue = $state('abc')
  let fontSizeStepperValue = $state('14')
  let minLinesStepperValue = $state('8')
  let togglePressed = $state(true)
  let flatErrorDialogOpen = $state(false)
  let flatConfirmationDialogOpen = $state(false)
  let lastDropdownAction = $state('No dropdown item selected')
  let selectedDetailedDropdownItem = $state(detailedDropdownItems[0]!)
</script>

<div class="test-screen-shell" data-testid="test-screen">
  <div class="test-screen-content">
    <header class="test-screen-header">
      <TitleBlock
        title="Cthulhu UI Test Screen"
        description="Renderer component gallery for the shared Cthulhu UI surface."
        icon={Sparkles}
        size="large"
      />

      <StatusBadge icon={Check} text="Dev screen restored" variant="success" />
    </header>

    <section class="component-grid">
      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="CardSurface" description="All surface variants." size="small" />

        <div class="variant-grid">
          {#each cardSurfaceVariants as variant (variant)}
            <CardSurface {variant} class="sample-card">
              <div class="sample-title">{variant}</div>
              <p>Prompt workspace metadata, compact controls, or nested content.</p>
            </CardSurface>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="AccentIconTile"
          description="Every tile variant and size."
          size="small"
        />

        <div class="tile-matrix">
          {#each accentIconTileVariants as variant (variant)}
            <div class="variant-row">
              <span>{variant}</span>
              <div class="variant-controls">
                {#each accentIconTileSizes as size (size)}
                  <AccentIconTile icon={Sparkles} {variant} {size} />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section component-section-wide">
        <TitleBlock
          title="IconTextButton"
          description="Neutral, accent, and nav states."
          size="small"
        />

        <div class="button-matrix">
          {#each iconTextButtonVariants as variant (variant)}
            <div class="variant-row">
              <span>{variant}</span>
              <div class="variant-controls">
                {#each iconTextButtonStates as state (state)}
                  <IconTextButton icon={Home} text={state} {variant} {state} />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section component-section-wide">
        <TitleBlock
          title="IconOnlyButton"
          description="Every icon-only variant and size."
          size="small"
        />

        <div class="button-matrix">
          {#each iconOnlyButtonVariants as variant (variant)}
            <div class="variant-row">
              <span>{variant}</span>
              <div class="variant-controls icon-only-controls">
                {#each iconOnlyButtonSizes as size (size)}
                  <div class="icon-only-sample" data-fill-size={size === 'rail-fill'}>
                    <IconOnlyButton
                      icon={variant === 'danger' ? Trash2 : Settings}
                      label={`${variant} ${size}`}
                      {variant}
                      {size}
                      title={`${variant} ${size}`}
                    />
                  </div>
                {/each}
                <IconOnlyButton icon={Minus} label={`${variant} disabled`} {variant} disabled />
              </div>
            </div>
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="FlatDropdownPopupSimple"
          description="Solid icon menu popup."
          size="small"
        />

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
                <IconOnlyButton
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
                <IconTextButton
                  icon={MoreHorizontal}
                  text="Prompt actions"
                  ariaHaspopup={dropdown.ariaHaspopup}
                  ariaExpanded={dropdown.ariaExpanded}
                  buttonAction={dropdown.triggerAction}
                  onclick={dropdown.toggle}
                />
              {/snippet}
            </FlatDropdownPopupSimple>
          </div>

          <InfoRow text={`Last dropdown action: ${lastDropdownAction}`} />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="FlatDropdownPopupDetailed"
          description="FlatSelectorButton rows with a fixed footer action."
          size="small"
        />

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

          <InfoRow text={`Selected detailed item: ${selectedDetailedDropdownItem.label}`} />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="FlatSelectorButton"
          description="Sidebar-style trigger button."
          size="small"
        />

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
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="Inputs"
          description="Text, numeric, and toggle controls."
          size="small"
        />

        <div class="form-grid">
          <TextInput bind:value={standardText} aria-label="Standard text input" />
          <TextInput
            bind:value={invalidText}
            aria-label="Invalid text input"
            aria-invalid="true"
            placeholder="Invalid text"
          />
          <TextInput
            bind:value={readonlyPath}
            aria-label="Readonly display input"
            readonlyDisplay
          />
          <NumericInput bind:value={numericValue} aria-label="Numeric input" />
          <NumericInput
            bind:value={invalidNumericValue}
            aria-label="Invalid numeric input"
            aria-invalid="true"
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
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="Message Rows"
          description="Inline guidance, warnings, and validation errors."
          size="small"
        />

        <div class="stack">
          <InfoRow
            text="Use this row for short informational guidance that helps explain the surrounding control or section."
          />
          <FlatMessageRow text="Review this value before saving." variant="warning" />
          <FlatMessageRow text="Prompt folder name is required." variant="danger" />
          <FlatFloatingValidationMessage message="Prompt folder name is required.">
            <TextInput
              value=""
              placeholder="Floating validation anchor"
              aria-label="Validation field"
            />
          </FlatFloatingValidationMessage>
          <FlatFloatingValidationMessage message="Review this value before saving." variant="warning">
            <TextInput value="Draft value" aria-label="Warning validation field" />
          </FlatFloatingValidationMessage>
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="SectionHeader"
          description="Section titles with optional line variants."
          size="small"
        />

        <div class="stack">
          <SectionHeader
            title="Plain Section"
            description="Default section header without a leading line."
            icon={Sparkles}
          />
          <SectionHeader
            title="Accent Line"
            description="Section header with the leading accent line enabled."
            icon={Sparkles}
            showAccentLine
          />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="StatusBadge" description="Current badge variants." size="small" />

        <div class="variant-controls">
          {#each statusBadgeVariants as variant (variant)}
            <StatusBadge icon={variant === 'success' ? Check : Sparkles} text={variant} {variant} />
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="TitleBlock" description="Sizes and icon treatments." size="small" />

        <div class="stack">
          <TitleBlock title="Small title" size="small" />
          <TitleBlock
            title="Large title"
            description="Large title with default icon variant."
            icon={Info}
            size="large"
          />
          {#each titleBlockIconVariants as iconVariant (iconVariant)}
            <TitleBlock
              title={iconVariant}
              description="Icon variant sample."
              icon={iconVariant === 'danger' ? AlertCircle : Sparkles}
              {iconVariant}
              size="large"
            />
          {/each}
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="LogDetails" description="Technical details block." size="small" />

        <LogDetails title="Autosave" text={logDetailsText} />
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="Dialogs"
          description="Flat error and confirmation dialogs."
          size="small"
        />

        <div class="variant-controls">
          <IconTextButton
            icon={AlertCircle}
            text="Flat error"
            variant="accent"
            onclick={() => {
              flatErrorDialogOpen = true
            }}
          />
          <IconTextButton
            icon={Trash2}
            text="Flat confirm"
            onclick={() => {
              flatConfirmationDialogOpen = true
            }}
          />
        </div>
      </CardSurface>
    </section>
  </div>
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

  .variant-grid {
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

  .tile-matrix,
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

  .form-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
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
