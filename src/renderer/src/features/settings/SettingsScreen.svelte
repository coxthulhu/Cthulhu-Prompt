<script lang="ts">
  import PageHeader from '@renderer/common/cthulhu-ui/layout/PageHeader.svelte'
  import Button from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import Card from '@renderer/common/cthulhu-ui/layout/Card.svelte'
  import DisplayRow from '@renderer/common/cthulhu-ui/layout/DisplayRow.svelte'
  import LinkButton from '@renderer/common/cthulhu-ui/buttons/LinkButton.svelte'
  import Separator from '@renderer/common/cthulhu-ui/layout/Separator.svelte'
  import ControlRow from '@renderer/common/cthulhu-ui/forms/ControlRow.svelte'
  import ValuePill from '@renderer/common/cthulhu-ui/layout/ValuePill.svelte'
  import FloatingValidationMessage from '@renderer/common/cthulhu-ui/forms/FloatingValidationMessage.svelte'
  import NumericStepperInput from '@renderer/common/cthulhu-ui/forms/NumericStepperInput.svelte'
  import ToggleButton from '@renderer/common/cthulhu-ui/buttons/ToggleButton.svelte'
  import SimpleSelectorButton from '@renderer/common/cthulhu-ui/selectors/SimpleSelectorButton.svelte'
  import { ExternalLink, Info, RefreshCcw, Settings, TextCursorInput, Type } from 'lucide-svelte'
  import {
    flushSystemSettingsAutosaves,
    getSystemSettingsAutosaveState,
    selectSystemSettingsClientStateRecord,
    useSystemSettingsClientStateQuery
  } from '@renderer/data/UiState/autosave/SystemSettingsAutosave.svelte.ts'
  import { runIpcBestEffort } from '@renderer/data/IpcFramework/IpcInvoke'
  import {
    setSystemSettingsClientStateFontSizeInput,
    setSystemSettingsClientStatePromptEditorMaxLinesInput,
    setSystemSettingsClientStateAttachedNoteMaxLinesInput,
    setSystemSettingsClientStatePromptEditorMinLinesInput,
    setSystemSettingsClientStateShowLineNumbers,
    setSystemSettingsClientStateNewPromptFocus,
    setSystemSettingsClientStateAutomaticUpdates
  } from '@renderer/data/UiState/client-state/SystemSettingsClientStateMutations.svelte.ts'
  import {
    getSystemSettingsValidation,
    formatPromptEditorMaxLinesInput,
    formatPromptEditorMinLinesInput,
    formatPromptFontSizeInput
  } from '@renderer/data/UiState/client-state/SystemSettingsFormat'
  import BottomSpacer from '@renderer/features/prompt-editor/BottomSpacer.svelte'
  import { tick } from 'svelte'
  import { userPersistenceCollection } from '@renderer/data/Collections/UserPersistenceCollection'
  import { setSettingsScrollTopWithAutosave } from '@renderer/data/UiState/autosave/UserPersistenceAutosave.svelte.ts'
  import { USER_PERSISTENCE_ID } from '@shared/domain/user-persistence/UserPersistence'
  import { PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX } from '@renderer/features/prompt-collections/promptCollectionScrollOffsets'
  import { settingsNavigation, settingsScrollRequests, settingsTreeSections } from './settingsNavigation.svelte.ts'
  import { getRuntimeConfig } from '@renderer/app/runtimeConfig'
  import {
    DEFAULT_SYSTEM_SETTINGS,
    MIN_ATTACHED_NOTE_MAX_LINES,
    MAX_ATTACHED_NOTE_MAX_LINES,
    MAX_PROMPT_EDITOR_MAX_LINES,
    MAX_PROMPT_EDITOR_MIN_LINES,
    MAX_PROMPT_FONT_SIZE,
    MIN_PROMPT_EDITOR_MAX_LINES,
    MIN_PROMPT_EDITOR_MIN_LINES,
    MIN_PROMPT_FONT_SIZE,
    type NewPromptFocus
  } from '@shared/domain/settings/SystemSettings'

  const systemSettingsClientStateQuery = useSystemSettingsClientStateQuery()
  const systemSettingsClientState = $derived(
    selectSystemSettingsClientStateRecord(systemSettingsClientStateQuery.data)
  )
  const autosaveState = getSystemSettingsAutosaveState()
  const isUpdating = $derived(autosaveState.saving)
  const defaultFontSize = DEFAULT_SYSTEM_SETTINGS.promptFontSize
  const defaultFontSizeInput = formatPromptFontSizeInput(defaultFontSize)
  const defaultMinLines = DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines
  const defaultMinLinesInput = formatPromptEditorMinLinesInput(defaultMinLines)
  const defaultMaxLines = DEFAULT_SYSTEM_SETTINGS.promptEditorMaxLines
  const defaultMaxLinesInput = formatPromptEditorMaxLinesInput(defaultMaxLines)
  const defaultShowLineNumbers = DEFAULT_SYSTEM_SETTINGS.showLineNumbers
  /** Available initial focus targets for newly created prompts and templates. */
  const newPromptFocusItems = [
    {
      id: 'title',
      label: 'Title',
      detail: 'Start by naming your prompt',
      icon: TextCursorInput,
      testId: 'new-prompt-focus-option-title'
    },
    {
      id: 'editor',
      label: 'Editor',
      detail: 'Start by writing your prompt',
      icon: Type,
      testId: 'new-prompt-focus-option-editor'
    }
  ]
  /** Dropdown label reflecting the current settings form choice. */
  const selectedNewPromptFocusItem = $derived(
    newPromptFocusItems.find((item) => item.id === systemSettingsClientState.newPromptFocus)!
  )
  /** Reset is available only when the choice differs from the default and saving has settled. */
  const isNewPromptFocusResetDisabled = $derived(
    isUpdating || systemSettingsClientState.newPromptFocus === DEFAULT_SYSTEM_SETTINGS.newPromptFocus
  )
  const githubIssuesUrl = 'https://github.com/coxthulhu/Cthulhu-Prompt/issues'
  const appVersionLabel = `v${getRuntimeConfig().appVersion}`

  let settingsScrollContainerElement: HTMLElement | null = $state(null)
  let settingsScrollContainerHeightPx = $state(0)
  /** Whether the persisted scroll offset has been applied after the bottom spacer was sized. */
  let isScrollRestored = $state(false)
  /** Offset most recently applied by this screen, so its scroll event does not count as a user scroll. */
  let programmaticScrollTopPx: number | null = null
  /** Top padding for rows too tall to center, matching the prompt screen's center placement. */
  const TALL_ROW_TOP_PADDING_PX = 100

  /** Applies a clamped scroll offset that keeps the current tree highlight. */
  const applyScrollTop = (scrollContainerElement: HTMLElement, scrollTopPx: number): void => {
    const maxScrollTopPx = scrollContainerElement.scrollHeight - scrollContainerElement.clientHeight
    const nextScrollTopPx = Math.round(Math.max(0, Math.min(scrollTopPx, maxScrollTopPx)))
    if (Math.abs(scrollContainerElement.scrollTop - nextScrollTopPx) < 1) return
    programmaticScrollTopPx = nextScrollTopPx
    scrollContainerElement.scrollTop = nextScrollTopPx
  }

  /** Centers a setting or places a section near the top. */
  const scrollToTreeRow = (scrollContainerElement: HTMLElement, rowId: string): void => {
    const section = settingsTreeSections.find((candidate) => candidate.id === rowId)
    const targetTestId =
      section?.targetTestId ??
      settingsTreeSections.flatMap((candidate) => candidate.rows).find((row) => row.id === rowId)!
        .targetTestId
    const targetRect = scrollContainerElement
      .querySelector(`[data-testid="${targetTestId}"]`)!
      .getBoundingClientRect()
    /** Target's top within the scrolled content. */
    const targetTopPx =
      targetRect.top -
      scrollContainerElement.getBoundingClientRect().top +
      scrollContainerElement.scrollTop
    const viewportHeightPx = scrollContainerElement.clientHeight

    applyScrollTop(
      scrollContainerElement,
      section
        ? targetTopPx - PROMPT_COLLECTION_CATEGORY_TOP_OFFSET_PX
        : targetRect.height + TALL_ROW_TOP_PADDING_PX > viewportHeightPx
          ? targetTopPx - TALL_ROW_TOP_PADDING_PX
          : targetTopPx + targetRect.height / 2 - viewportHeightPx / 2
    )
  }

  /** Persists the offset and clears the tree highlight when the user scrolls. */
  const handleScroll = (event: Event): void => {
    const scrollTopPx = (event.currentTarget as HTMLElement).scrollTop
    if (programmaticScrollTopPx === null || Math.abs(scrollTopPx - programmaticScrollTopPx) >= 1) {
      settingsNavigation.selectedRowId = null
    }
    programmaticScrollTopPx = null
    if (isScrollRestored) setSettingsScrollTopWithAutosave(scrollTopPx)
  }

  // Save immediately when an input loses focus to avoid delayed autosaves.
  const handleInputBlur = () => {
    void runIpcBestEffort(flushSystemSettingsAutosaves)
  }

  const resetSettingToDefault = async (
    defaultValue: string,
    setFormDataValue: (value: string) => void
  ): Promise<void> => {
    await runIpcBestEffort(async () => {
      setFormDataValue(defaultValue)
      await flushSystemSettingsAutosaves()
    })
  }

  const handleFontSizeReset = async () => {
    await resetSettingToDefault(defaultFontSizeInput, setSystemSettingsClientStateFontSizeInput)
  }

  const handleMinLinesReset = async () => {
    await resetSettingToDefault(
      defaultMinLinesInput,
      setSystemSettingsClientStatePromptEditorMinLinesInput
    )
  }

  const handleMaxLinesReset = async () => {
    await resetSettingToDefault(
      defaultMaxLinesInput,
      setSystemSettingsClientStatePromptEditorMaxLinesInput
    )
  }

  const updateShowLineNumbers = async (value: boolean) => {
    await runIpcBestEffort(async () => {
      setSystemSettingsClientStateShowLineNumbers(value)
      await flushSystemSettingsAutosaves()
    })
  }

  const handleShowLineNumbersToggle = async () => {
    await updateShowLineNumbers(!systemSettingsClientState.showLineNumbers)
  }

  const handleShowLineNumbersReset = async () => {
    await updateShowLineNumbers(defaultShowLineNumbers)
  }

  /** Saves a creation focus selection immediately, including resetting it to the default. */
  const updateNewPromptFocus = async (value: NewPromptFocus): Promise<void> => {
    await runIpcBestEffort(async () => {
      setSystemSettingsClientStateNewPromptFocus(value)
      await flushSystemSettingsAutosaves()
    })
  }

  /** Saves the automatic-update toggle or its default immediately. */
  const updateAutomaticUpdates = async (value: boolean): Promise<void> => {
    await runIpcBestEffort(async () => {
      setSystemSettingsClientStateAutomaticUpdates(value)
      await flushSystemSettingsAutosaves()
    })
  }

  const validation = $derived(getSystemSettingsValidation(systemSettingsClientState))
  const displayFontSizeError = $derived(validation.fontSizeError)
  const displayMinLinesError = $derived(validation.minLinesError)
  const displayMaxLinesError = $derived(validation.maxLinesError)
  const isFontSizeResetDisabled = $derived(
    isUpdating || systemSettingsClientState.promptFontSizeInput === defaultFontSizeInput
  )
  const isMinLinesResetDisabled = $derived(
    isUpdating || systemSettingsClientState.promptEditorMinLinesInput === defaultMinLinesInput
  )
  const isMaxLinesResetDisabled = $derived(
    isUpdating || systemSettingsClientState.promptEditorMaxLinesInput === defaultMaxLinesInput
  )
  const isShowLineNumbersResetDisabled = $derived(
    isUpdating || systemSettingsClientState.showLineNumbers === defaultShowLineNumbers
  )

  // Side effect: flush unsaved system settings when leaving the settings screen.
  $effect(() => {
    return () => {
      void runIpcBestEffort(flushSystemSettingsAutosaves)
    }
  })

  // Side effect: keep the dynamic bottom spacer sized to the settings scroll viewport.
  $effect(() => {
    const scrollContainerElement = settingsScrollContainerElement
    if (!scrollContainerElement) {
      return
    }

    const updateScrollContainerHeight = () => {
      settingsScrollContainerHeightPx = scrollContainerElement.getBoundingClientRect().height
    }

    updateScrollContainerHeight()

    // Side effect: restore the persisted offset once the bottom spacer reflects the measured height.
    void tick().then(() => {
      if (isScrollRestored) return
      settingsNavigation.selectedRowId = null
      applyScrollTop(
        scrollContainerElement,
        userPersistenceCollection.get(USER_PERSISTENCE_ID)!.settingsScrollTopPx
      )
      isScrollRestored = true
    })

    const resizeObserver = new ResizeObserver(() => {
      updateScrollContainerHeight()
    })

    resizeObserver.observe(scrollContainerElement)

    return () => {
      resizeObserver.disconnect()
    }
  })

  // Side effect: perform settings tree scroll requests once the persisted offset is restored.
  $effect(() => {
    const request = settingsScrollRequests.pending
    const scrollContainerElement = settingsScrollContainerElement
    if (!request || !scrollContainerElement || !isScrollRestored) return

    settingsScrollRequests.consume(request, ({ rowId }) => {
      scrollToTreeRow(scrollContainerElement, rowId)
    })
  })
</script>

<section
  bind:this={settingsScrollContainerElement}
  class="flex min-h-0 flex-1 justify-center overflow-y-auto px-6 py-6"
  data-testid="settings-screen"
  onscroll={handleScroll}
>
  <div class="flex w-full max-w-4xl flex-col gap-4 self-start">
    <PageHeader
      icon={Settings}
      title="System Settings"
      subtitle="System-wide settings stored locally on your machine."
      titleTestId="settings-screen-title"
      subtitleTestId="settings-screen-subtitle"
      class="mb-5"
    />

    <Card
      data-testid="settings-section-editor-layout"
      label="Editor & Layout"
      icon={Type}
      subtitle="Configure prompt editor text, sizing, line numbers, and initial focus."
    >
      <div class="flex flex-col">
        <ControlRow
          testId="editor-layout-font-size-row"
          label="Font Size"
          detail="Sets the base font size used inside the prompt editor."
        >
          {#snippet control()}
            <FloatingValidationMessage message={displayFontSizeError} textTestId="font-size-error">
              <NumericStepperInput
                data-testid="font-size-input"
                value={systemSettingsClientState.promptFontSizeInput}
                min={MIN_PROMPT_FONT_SIZE}
                max={MAX_PROMPT_FONT_SIZE}
                helperText="px"
                aria-label="Font size"
                aria-invalid={displayFontSizeError ? 'true' : undefined}
                decreaseLabel="Decrease font size"
                increaseLabel="Increase font size"
                onvaluechange={setSystemSettingsClientStateFontSizeInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleFontSizeReset}
              disabled={isFontSizeResetDisabled}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-new-prompt-focus-row"
          label="New Prompt Focus"
          detail="Choose which field receives focus when creating a prompt or prompt template."
        >
          {#snippet control()}
            <SimpleSelectorButton
              class="settingsNewPromptFocusSelector"
              label="New prompt focus"
              items={newPromptFocusItems}
              selectedItem={selectedNewPromptFocusItem}
              showIcon
              menuWidth="260px"
              testId="new-prompt-focus-selector"
              disabled={isUpdating}
              onselect={(item) => updateNewPromptFocus(item.id as NewPromptFocus)}
            />
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={() => updateNewPromptFocus(DEFAULT_SYSTEM_SETTINGS.newPromptFocus)}
              disabled={isNewPromptFocusResetDisabled}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-min-lines-row"
          label="Minimum Line Count"
          detail="Sets the minimum number of visible lines in prompt editors."
        >
          {#snippet control()}
            <FloatingValidationMessage message={displayMinLinesError} textTestId="min-lines-error">
              <NumericStepperInput
                data-testid="min-lines-input"
                value={systemSettingsClientState.promptEditorMinLinesInput}
                min={MIN_PROMPT_EDITOR_MIN_LINES}
                max={MAX_PROMPT_EDITOR_MIN_LINES}
                helperText="lines"
                aria-label="Minimum line count"
                aria-invalid={displayMinLinesError ? 'true' : undefined}
                decreaseLabel="Decrease minimum line count"
                increaseLabel="Increase minimum line count"
                onvaluechange={setSystemSettingsClientStatePromptEditorMinLinesInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleMinLinesReset}
              disabled={isMinLinesResetDisabled}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-max-lines-row"
          label="Maximum Line Count"
          detail="Shared maximum visible lines for a prompt or template and its attached note. Must exceed the note maximum by at least 5."
        >
          {#snippet control()}
            <FloatingValidationMessage message={displayMaxLinesError} textTestId="max-lines-error">
              <NumericStepperInput
                data-testid="max-lines-input"
                value={systemSettingsClientState.promptEditorMaxLinesInput}
                min={MIN_PROMPT_EDITOR_MAX_LINES}
                max={MAX_PROMPT_EDITOR_MAX_LINES}
                helperText="lines"
                aria-label="Maximum line count"
                aria-invalid={displayMaxLinesError ? 'true' : undefined}
                decreaseLabel="Decrease maximum line count"
                increaseLabel="Increase maximum line count"
                onvaluechange={setSystemSettingsClientStatePromptEditorMaxLinesInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleMaxLinesReset}
              disabled={isMaxLinesResetDisabled}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-note-max-lines-row"
          label="Attached Note Maximum Lines"
          detail="Maximum visible note lines before scrolling. These lines share the editor maximum above."
        >
          {#snippet control()}
            <FloatingValidationMessage message={validation.noteMaxLinesError} textTestId="note-max-lines-error">
              <NumericStepperInput
                data-testid="note-max-lines-input"
                value={systemSettingsClientState.attachedNoteMaxLinesInput}
                min={MIN_ATTACHED_NOTE_MAX_LINES}
                max={MAX_ATTACHED_NOTE_MAX_LINES}
                helperText="lines"
                aria-label="Attached note maximum lines"
                aria-invalid={validation.noteMaxLinesError ? 'true' : undefined}
                decreaseLabel="Decrease attached note maximum lines"
                increaseLabel="Increase attached note maximum lines"
                onvaluechange={setSystemSettingsClientStateAttachedNoteMaxLinesInput}
                onblur={handleInputBlur}
              />
            </FloatingValidationMessage>
          {/snippet}
          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={() => resetSettingToDefault(String(DEFAULT_SYSTEM_SETTINGS.attachedNoteMaxLines), setSystemSettingsClientStateAttachedNoteMaxLinesInput)}
              disabled={isUpdating || systemSettingsClientState.attachedNoteMaxLinesInput === String(DEFAULT_SYSTEM_SETTINGS.attachedNoteMaxLines)}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <ControlRow
          testId="editor-layout-line-numbers-row"
          label="Show Line Numbers"
          detail="Display line numbers beside prompt text for easier review."
        >
          {#snippet control()}
            <ToggleButton
              testId="show-line-numbers-toggle"
              pressed={systemSettingsClientState.showLineNumbers}
              onclick={handleShowLineNumbersToggle}
              disabled={isUpdating}
            />
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={handleShowLineNumbersReset}
              disabled={isShowLineNumbersResetDisabled}
            />
          {/snippet}
        </ControlRow>
      </div>
    </Card>

    <Card
      data-testid="settings-section-about"
      label="About"
      icon={Info}
      subtitle="View application information and get support."
    >
      <div class="flex flex-col">
        <DisplayRow
          testId="about-issue-display-row"
          label="Report an Issue"
          detail="Report bugs, request improvements, or check whether a problem is already tracked."
        >
          {#snippet trailing()}
            <LinkButton
              href={githubIssuesUrl}
              text="Open Github Issues"
              icon={ExternalLink}
              variant="accent"
              testId="about-github-issues-link"
              target="_blank"
              rel="noreferrer"
            />
          {/snippet}
        </DisplayRow>

        <Separator />

        <!-- Persist automatic update discovery alongside the other system settings. -->
        <ControlRow
          testId="about-automatic-updates-row"
          label="Automatic Updates"
          detail="Automatically check for and download updates."
        >
          {#snippet control()}
            <ToggleButton
              testId="automatic-updates-toggle"
              pressed={systemSettingsClientState.automaticUpdates}
              onclick={() => updateAutomaticUpdates(!systemSettingsClientState.automaticUpdates)}
              disabled={isUpdating}
            />
          {/snippet}

          {#snippet actions()}
            <Button
              icon={RefreshCcw}
              text="Reset"
              appearance="outline"
              onclick={() => updateAutomaticUpdates(DEFAULT_SYSTEM_SETTINGS.automaticUpdates)}
              disabled={isUpdating || systemSettingsClientState.automaticUpdates === DEFAULT_SYSTEM_SETTINGS.automaticUpdates}
            />
          {/snippet}
        </ControlRow>

        <Separator />

        <DisplayRow
          testId="about-version-display-row"
          label="Current Version"
          detail="The version currently installed on this device."
        >
          {#snippet trailing()}
            <ValuePill text={appVersionLabel} testId="about-version-display-value" />
          {/snippet}
        </DisplayRow>
      </div>
    </Card>

    <BottomSpacer scrollContainerHeightPx={settingsScrollContainerHeightPx} />
  </div>
</section>

<style>
  /* Match this settings selector to its Reset button without resizing other selectors. */
  section :global(.settingsNewPromptFocusSelector) {
    height: 40px;
  }
</style>
