<script lang="ts">
  import type { ComponentType } from 'svelte'
  import type { ButtonAppearance } from '@renderer/common/cthulhu-ui/buttons/Button.svelte'
  import { mergeClasses } from '@renderer/common/cthulhu-ui/mergeClasses'
  import '@renderer/common/cthulhu-ui/buttons/button.css'

  export type LinkButtonVariant = 'neutral' | 'accent'

  type Props = {
    href: string
    text: string
    icon?: ComponentType
    endIcon?: ComponentType
    variant?: LinkButtonVariant
    appearance?: ButtonAppearance
    /** Removes navigation and tab access while preserving link semantics. */
    disabled?: boolean
    class?: string
    /** Optional icon utilities composed with the shared button glyph class. */
    iconClass?: string
    target?: string
    rel?: string
    testId?: string
  }

  let {
    href,
    text,
    icon: Icon,
    endIcon: EndIcon,
    variant = 'neutral',
    appearance = 'filled',
    disabled = false,
    class: className,
    iconClass,
    target,
    rel,
    testId
  }: Props = $props()
</script>

<a
  class={mergeClasses('cthulhuUiButtonBase cthulhuUiButtonSurface cthulhuUiButtonAction text-sm leading-5 cthulhuUiLinkButton', className)}
  data-variant={variant}
  data-appearance={appearance}
  data-testid={testId}
  href={disabled ? undefined : href}
  role={disabled ? 'link' : undefined}
  aria-disabled={disabled || undefined}
  tabindex={disabled ? -1 : undefined}
  {target}
  {rel}
>
  {#if Icon}
    <Icon class={mergeClasses('cthulhuUiButtonIcon', iconClass)} size={16} aria-hidden="true" />
  {/if}
  <span class="cthulhuUiButtonLabel">{text}</span>
  {#if EndIcon}
    <EndIcon class={mergeClasses('cthulhuUiButtonIcon', iconClass)} size={16} aria-hidden="true" />
  {/if}
</a>

<style>
  .cthulhuUiLinkButton {
    text-decoration: none;
  }
</style>
