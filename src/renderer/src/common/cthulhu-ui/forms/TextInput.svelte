<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { WithElementRef } from '@renderer/common/cthulhu-ui/elementRef'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & {
      value?: string
      readonlyDisplay?: boolean
      /** Glyph drawn inside the field's left edge, such as a search icon; the caller's class then sizes the field's wrapper. */
      icon?: ComponentType
    }
  >

  let {
    ref = $bindable(null),
    value = $bindable(''),
    readonlyDisplay = false,
    readonly = false,
    tabindex,
    onpointerdown,
    onfocus,
    icon: Icon,
    class: className,
    ...restProps
  }: Props = $props()

  const inputReadonly = $derived(readonlyDisplay || readonly)
  const inputTabindex = $derived(readonlyDisplay ? -1 : tabindex)

  const handlePointerDown = (event: PointerEvent & { currentTarget: HTMLInputElement }) => {
    if (readonlyDisplay) {
      event.preventDefault()
    }

    onpointerdown?.(event)
  }

  const handleFocus = (event: FocusEvent & { currentTarget: HTMLInputElement }) => {
    if (readonlyDisplay) {
      event.currentTarget.blur()
    }

    onfocus?.(event)
  }
</script>

<!-- Native input shared by the plain field and the field with an icon. -->
{#snippet field(inputClass: Props['class'])}
  <input
    bind:this={ref}
    class={mergeClasses(
      'cthulhuUiTextInput flex h-10 min-w-0 rounded-[var(--cthulhu-ui-radius-control)] border px-3.5 py-1 text-sm font-semibold outline-none transition-[color,box-shadow,background-color,border-color] duration-[var(--ui-animation-duration-standard)] disabled:cursor-not-allowed disabled:opacity-50',
      readonlyDisplay ? 'cursor-default' : null,
      inputClass
    )}
    type="text"
    bind:value
    readonly={inputReadonly}
    tabindex={inputTabindex}
    onpointerdown={handlePointerDown}
    onfocus={handleFocus}
    {...restProps}
  />
{/snippet}

{#if Icon}
  <!-- The 38px left padding starts the text after the 16px icon and an 8px gap; the icon follows the input so it
       paints above it. -->
  <span class={mergeClasses('cthulhuUiTextInputIconField relative flex min-w-0', className)}>
    {@render field('w-full pl-9.5')}
    <Icon class="cthulhuUiTextInputIcon" size={16} aria-hidden="true" />
  </span>
{:else}
  {@render field(className)}
{/if}

<style>
  .cthulhuUiTextInput {
    background-color: var(--ui-neutral-field-surface);
    border-color: var(--ui-neutral-normal-border);
    color: var(--ui-normal-text);
  }

  .cthulhuUiTextInput::placeholder {
    color: var(--ui-muted-text);
  }

  .cthulhuUiTextInput::selection {
    background-color: var(--ui-neutral-selection-surface);
    color: var(--ui-normal-text);
  }

  .cthulhuUiTextInput:focus-visible {
    border-color: var(--ui-neutral-focus-border);
    box-shadow: var(--cthulhu-ui-shadow-focus);
  }

  .cthulhuUiTextInput[aria-invalid='true'] {
    border-color: var(--ui-danger-strong-border);
  }

  .cthulhuUiTextInput[aria-invalid='true']:focus-visible {
    box-shadow: var(--cthulhu-ui-shadow-focus-danger);
  }

  /* The icon sits at the text's usual 14px inset past the 1px border, and brightens while the field has focus. */
  .cthulhuUiTextInputIconField :global(.cthulhuUiTextInputIcon) {
    color: var(--ui-muted-icon-glyph);
    left: 15px;
    pointer-events: none;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    transition: color var(--ui-animation-duration-standard) ease;
  }

  .cthulhuUiTextInputIconField:focus-within :global(.cthulhuUiTextInputIcon) {
    color: var(--ui-hoverable-icon-glyph);
  }
</style>
