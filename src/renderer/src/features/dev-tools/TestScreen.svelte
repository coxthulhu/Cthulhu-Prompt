<script lang="ts">
  import {
    AlertCircle,
    Archive,
    Bell,
    Check,
    CircleGauge,
    ClipboardList,
    Copy,
    Download,
    FileText,
    Folder,
    FolderOpen,
    Home,
    Info,
    Minus,
    MoreHorizontal,
    Pencil,
    Pin,
    Plus,
    Save,
    Settings,
    ShieldAlert,
    Sparkles,
    Trash2,
    X
  } from 'lucide-svelte'
  import AccentIconTile, {
    type AccentIconTileVariant
  } from '@renderer/common/cthulhu-ui/AccentIconTile.svelte'
  import CardSurface, {
    type CardSurfaceVariant
  } from '@renderer/common/cthulhu-ui/CardSurface.svelte'
  import CheckboxInput from '@renderer/common/cthulhu-ui/CheckboxInput.svelte'
  import CthulhuDialog from '@renderer/common/cthulhu-ui/CthulhuDialog.svelte'
  import FlatDropdownPopupSimple, {
    type FlatDropdownPopupItem
  } from '@renderer/common/cthulhu-ui/FlatDropdownPopupSimple.svelte'
  import type { FlatDropdownPopupDetailedItem } from '@renderer/common/cthulhu-ui/FlatDropdownPopupDetailed.svelte'
  import ErrorDialog from '@renderer/common/cthulhu-ui/ErrorDialog.svelte'
  import FileInput from '@renderer/common/cthulhu-ui/FileInput.svelte'
  import FlatFloatingValidationMessage from '@renderer/common/cthulhu-ui/FlatFloatingValidationMessage.svelte'
  import IconDescriptionButton, {
    type IconDescriptionButtonVariant
  } from '@renderer/common/cthulhu-ui/IconDescriptionButton.svelte'
  import IconOnlyButton from '@renderer/common/cthulhu-ui/IconOnlyButton.svelte'
  import IconPillButton from '@renderer/common/cthulhu-ui/IconPillButton.svelte'
  import IconPillSurface from '@renderer/common/cthulhu-ui/IconPillSurface.svelte'
  import IconTextButton from '@renderer/common/cthulhu-ui/IconTextButton.svelte'
  import InfoRow from '@renderer/common/cthulhu-ui/InfoRow.svelte'
  import LabeledDisplayField from '@renderer/common/cthulhu-ui/LabeledDisplayField.svelte'
  import LogDetails from '@renderer/common/cthulhu-ui/LogDetails.svelte'
  import MessageRow from '@renderer/common/cthulhu-ui/MessageRow.svelte'
  import NumericInput from '@renderer/common/cthulhu-ui/NumericInput.svelte'
  import FlatNumericStepperInput from '@renderer/common/cthulhu-ui/FlatNumericStepperInput.svelte'
  import NumericStatCard from '@renderer/common/cthulhu-ui/NumericStatCard.svelte'
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
  const iconDescriptionButtonVariants: IconDescriptionButtonVariant[] = [
    'neutral',
    'accent',
    'danger'
  ]
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

  let checked = $state(true)
  let unchecked = $state(false)
  let standardText = $state('Renderer prompt collection')
  let invalidText = $state('')
  let readonlyPath = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let folderPath = $state('C:\\Source\\PromptApps\\CthulhuPromptPublic')
  let numericValue = $state('14')
  let invalidNumericValue = $state('abc')
  let fontSizeStepperValue = $state('14')
  let minLinesStepperValue = $state('8')
  let togglePressed = $state(true)
  let accentDialogOpen = $state(false)
  let dangerDialogOpen = $state(false)
  let errorDialogOpen = $state(false)
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
          title="IconDescriptionButton"
          description="Action cards with descriptive copy."
          size="small"
        />

        <div class="stack">
          {#each iconDescriptionButtonVariants as variant (variant)}
            <IconDescriptionButton
              icon={variant === 'danger' ? ShieldAlert : FolderOpen}
              text={variant}
              description="Select a workspace action with supporting context."
              {variant}
            />
          {/each}
          <IconDescriptionButton
            icon={FolderOpen}
            text="disabled"
            description="Disabled action state."
            state="disabled"
          />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="IconPillButton" description="Compact pill action states." size="small" />

        <div class="variant-controls">
          <IconPillButton icon={Plus} text="enabled" />
          <IconPillButton icon={X} text="disabled" disabled />
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
          description="Text, numeric, file, checkbox, and toggle controls."
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
          <FileInput bind:value={folderPath} aria-label="File input" buttonText="Browse" />
          <CheckboxInput bind:checked label="Checked checkbox" />
          <CheckboxInput bind:checked={unchecked} label="Unchecked checkbox" />
          <CheckboxInput checked label="Disabled checkbox" disabled />
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
          <MessageRow text="Review this value before saving." variant="warning" />
          <MessageRow text="Prompt folder name is required." variant="danger" />
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
        <TitleBlock
          title="Display Components"
          description="Read-only fields and stat cards."
          size="small"
        />

        <div class="display-grid">
          <IconPillSurface label="Workspace" icon={FolderOpen}>
            <div class="display-value">CthulhuPromptPublic</div>
          </IconPillSurface>
          <IconPillSurface label="No icon">
            <div class="display-value">Inline metadata surface</div>
          </IconPillSurface>
          <LabeledDisplayField
            label="Path"
            text="C:\\Source\\PromptApps\\CthulhuPromptPublic"
            icon={FileText}
            valueTitle="C:\Source\PromptApps\CthulhuPromptPublic"
          />
          <NumericStatCard label="Prompts" text="128" icon={ClipboardList} />
          <NumericStatCard label="Folders" text="12" icon={CircleGauge} />
        </div>
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock title="LogDetails" description="Technical details block." size="small" />

        <LogDetails title="Autosave" text={logDetailsText} />
      </CardSurface>

      <CardSurface variant="panel" class="component-section">
        <TitleBlock
          title="Dialogs"
          description="Dialog icon and submit variants plus error dialog."
          size="small"
        />

        <div class="variant-controls">
          <IconTextButton
            icon={Bell}
            text="Accent dialog"
            variant="accent"
            onclick={() => {
              accentDialogOpen = true
            }}
          />
          <IconTextButton
            icon={ShieldAlert}
            text="Danger dialog"
            onclick={() => {
              dangerDialogOpen = true
            }}
          />
          <IconTextButton
            icon={AlertCircle}
            text="Error dialog"
            onclick={() => {
              errorDialogOpen = true
            }}
          />
        </div>
      </CardSurface>
    </section>
  </div>
</div>

<CthulhuDialog
  bind:open={accentDialogOpen}
  title="Accent dialog"
  description="Dialog with accent icon and accent submit button."
  icon={Sparkles}
  iconVariant="accent"
  submitText="Save"
  submitVariant="accent"
  submitIcon={Save}
  onsubmit={() => {
    accentDialogOpen = false
  }}
/>

<CthulhuDialog
  bind:open={dangerDialogOpen}
  title="Danger dialog"
  description="Dialog with danger icon and danger submit button."
  icon={ShieldAlert}
  iconVariant="danger"
  submitText="Acknowledge"
  submitVariant="danger"
  onsubmit={() => {
    dangerDialogOpen = false
  }}
>
  <MessageRow text="This dialog demonstrates the danger icon treatment." variant="warning" />
</CthulhuDialog>

<ErrorDialog
  bind:open={errorDialogOpen}
  title="Workspace error"
  description="The selected folder did not load."
  errorText={errorDialogText}
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
  .variant-row > span,
  .display-value {
    color: var(--ui-normal-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.3;
  }

  .tile-matrix,
  .button-matrix,
  .stack,
  .display-grid,
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

  .form-grid,
  .display-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .display-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
