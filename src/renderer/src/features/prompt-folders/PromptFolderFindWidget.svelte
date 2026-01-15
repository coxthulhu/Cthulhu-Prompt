<script lang="ts">
  import {
    promptFolderFindState,
    setFindQuery
  } from '@renderer/data/PromptFolderFindDataStore.svelte.ts'

  let {
    matchesLabel,
    hasNoResults,
    onClose,
    onFindNext,
    onFindPrevious,
    inputEl = $bindable(null)
  } = $props<{
    matchesLabel: string
    hasNoResults: boolean
    onClose: () => void
    onFindNext: () => void
    onFindPrevious: () => void
    inputEl?: HTMLTextAreaElement | null
  }>()

  let isInputFocused = $state(false)
  // Derived state: disable navigation buttons when there is no active query.
  const isQueryEmpty = $derived(promptFolderFindState.query.length === 0)

  const handleFindNext = () => {
    if (isQueryEmpty) return
    onFindNext()
  }

  const handleFindPrevious = () => {
    if (isQueryEmpty) return
    onFindPrevious()
  }
</script>

<div class="prompt-find-widget-host">
  <div
    class="prompt-find-widget"
    class:prompt-find-widget--no-results={hasNoResults}
    data-testid="prompt-find-widget"
  >
    <div class="prompt-find-widget__find-part">
      <div class="prompt-find-input">
        <div class="prompt-find-input__scroll" role="presentation">
          <div class="prompt-find-input__box" class:synthetic-focus={isInputFocused}>
            <div class="prompt-find-input__wrapper">
              <textarea
                bind:this={inputEl}
                value={promptFolderFindState.query}
                class="prompt-find-input__field"
                class:empty={!promptFolderFindState.query}
                data-testid="prompt-find-input"
                rows="1"
                wrap="off"
                placeholder="Find"
                aria-label="Find"
                spellcheck="false"
                oninput={(event) => {
                  const target = event.currentTarget as HTMLTextAreaElement
                  setFindQuery(target.value)
                }}
                onkeydown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (event.shiftKey) {
                    handleFindPrevious()
                  } else {
                    handleFindNext()
                  }
                }}
                onfocus={() => {
                  isInputFocused = true
                }}
                onblur={() => {
                  isInputFocused = false
                }}
              ></textarea>
              <div class="prompt-find-input__mirror">{promptFolderFindState.query || ' '}</div>
            </div>
          </div>
        </div>
        <div class="prompt-find-input__controls"></div>
      </div>
      <div class="prompt-find-widget__actions">
        <div class="prompt-find-widget__matches">{matchesLabel}</div>
        <div
          class="prompt-find-widget__button codicon codicon-find-previous-match"
          class:prompt-find-widget__button--disabled={isQueryEmpty}
          data-testid="prompt-find-prev"
          role="button"
          tabindex={isQueryEmpty ? -1 : 0}
          title="Find Previous"
          aria-label="Find Previous"
          aria-disabled={isQueryEmpty}
          onclick={() => {
            handleFindPrevious()
          }}
          onkeydown={(event) => {
            if (isQueryEmpty) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            handleFindPrevious()
          }}
        ></div>
        <div
          class="prompt-find-widget__button codicon codicon-find-next-match"
          class:prompt-find-widget__button--disabled={isQueryEmpty}
          data-testid="prompt-find-next"
          role="button"
          tabindex={isQueryEmpty ? -1 : 0}
          title="Find Next"
          aria-label="Find Next"
          aria-disabled={isQueryEmpty}
          onclick={() => {
            handleFindNext()
          }}
          onkeydown={(event) => {
            if (isQueryEmpty) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            handleFindNext()
          }}
        ></div>
      </div>
    </div>
    <div
      class="prompt-find-widget__button prompt-find-widget__close codicon codicon-widget-close"
      data-testid="prompt-find-close"
      role="button"
      tabindex="0"
      title="Close"
      aria-label="Close"
      onclick={onClose}
      onkeydown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onClose()
      }}
    ></div>
  </div>
</div>

<style>
  .prompt-find-widget-host {
    --prompt-find-widget-background: #202020;
    --prompt-find-widget-border: #454545;
    --prompt-find-widget-foreground: #cccccc;
    --prompt-find-widget-shadow: rgba(0, 0, 0, 0.36);
    --prompt-find-input-background: #313131;
    --prompt-find-input-border: #454545;
    --prompt-find-input-foreground: #cccccc;
    --prompt-find-focus-border: #007fd4;
    --prompt-find-toolbar-hover: #5a5d5e50;
    --prompt-find-error-foreground: #f48771;
    position: fixed;
    top: 0;
    right: 18px;
    width: 400px;
    z-index: 40;
  }

  .prompt-find-widget {
    position: relative;
    width: 400px;
    height: 33px;
    overflow: hidden;
    line-height: 19px;
    padding: 0 4px;
    box-sizing: border-box;
    display: flex;
    align-items: flex-start;
    transition: none;
    transform: translateY(0);
    box-shadow: 0 0 8px 2px var(--prompt-find-widget-shadow);
    color: var(--prompt-find-widget-foreground);
    border-left: 1px solid var(--prompt-find-widget-border);
    border-right: 1px solid var(--prompt-find-widget-border);
    border-bottom: 1px solid var(--prompt-find-widget-border);
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
    background-color: var(--prompt-find-widget-background);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
  }

  .prompt-find-widget__find-part {
    /* No toggle buttons on either side, so keep padding tight. */
    margin: 3px 4px 0 4px;
    font-size: 12px;
    display: flex;
    flex: 1;
  }

  .prompt-find-input {
    display: flex;
    flex: 1;
    vertical-align: middle;
  }

  .prompt-find-input__scroll {
    position: relative;
    overflow: hidden;
    width: 100%;
  }

  .prompt-find-input__box {
    position: relative;
    display: block;
    padding: 0;
    box-sizing: border-box;
    border-radius: 2px;
    min-height: 25px;
    font-size: inherit;
    background-color: var(--prompt-find-input-background);
    color: var(--prompt-find-input-foreground);
    border: 1px solid var(--prompt-find-input-border);
  }

  .prompt-find-input__box.synthetic-focus {
    outline: 1px solid var(--prompt-find-focus-border);
    outline-offset: -1px;
  }

  .prompt-find-input__wrapper {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .prompt-find-input__field,
  .prompt-find-input__mirror {
    padding: 4px 6px;
    padding-top: 2px;
    padding-bottom: 2px;
  }

  .prompt-find-input__field {
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    line-height: inherit;
    border: none;
    font-family: inherit;
    font-size: 13px;
    resize: none;
    color: inherit;
    background-color: transparent;
    min-height: 0;
    outline: none;
    scrollbar-width: none;
  }

  .prompt-find-input__field::-webkit-scrollbar {
    display: none;
  }

  .prompt-find-input__field.empty {
    white-space: nowrap;
  }

  .prompt-find-input__mirror {
    position: absolute;
    display: inline-block;
    width: 100%;
    top: 0;
    left: 0;
    box-sizing: border-box;
    white-space: pre-wrap;
    visibility: hidden;
    word-wrap: break-word;
  }

  .prompt-find-input__controls {
    display: none;
  }

  .prompt-find-widget__actions {
    height: 25px;
    display: flex;
    align-items: center;
  }

  .prompt-find-widget__matches {
    display: flex;
    flex: initial;
    margin: 0 0 0 3px;
    padding: 2px 0 0 2px;
    min-width: 69px;
    height: 25px;
    vertical-align: middle;
    box-sizing: border-box;
    text-align: center;
    line-height: 23px;
  }

  .prompt-find-widget__button {
    width: 16px;
    height: 16px;
    padding: 3px;
    border-radius: 5px;
    display: flex;
    flex: initial;
    margin-left: 3px;
    background-position: center center;
    background-repeat: no-repeat;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    box-sizing: content-box;
  }

  .prompt-find-widget__button:hover {
    background-color: var(--prompt-find-toolbar-hover);
  }

  .prompt-find-widget__button--disabled {
    cursor: default;
    opacity: 0.4;
    pointer-events: none;
  }

  .prompt-find-widget__close {
    margin: 5px 0 0 0;
  }

  .prompt-find-widget--no-results .prompt-find-widget__matches {
    color: var(--prompt-find-error-foreground);
  }
</style>
