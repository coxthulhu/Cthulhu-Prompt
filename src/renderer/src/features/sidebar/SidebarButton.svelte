<script lang="ts">
  import type { ComponentType } from 'svelte'

  // Shared styling for all sidebar buttons to keep visuals consistent across the app
  const baseButtonClass =
    'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 h-8 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:cursor-not-allowed data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0'

  let {
    icon: Icon = null,
    label = '',
    active = false,
    disabled = false,
    testId,
    class: className = '',
    type = 'button',
    ariaDisabled,
    builderProps = {},
    onclick,
    children
  } = $props<{
    icon?: ComponentType | null
    label?: string
    active?: boolean
    disabled?: boolean
    testId?: string
    class?: string
    type?: 'button' | 'submit' | 'reset'
    ariaDisabled?: boolean
    builderProps?: Record<string, unknown>
    onclick?: (event: MouseEvent) => void
    children?: () => unknown
  }>()

  // Derived builder props so handler/class updates stay reactive.
  const normalizedBuilderProps = $derived.by(() =>
    typeof builderProps === 'object' && builderProps !== null ? builderProps : {}
  )
  const builderClass = $derived.by(() => {
    const props = normalizedBuilderProps as Record<string, unknown>
    return (props.class as string) ?? ''
  })
  const builderOnclick = $derived.by(() => {
    const props = normalizedBuilderProps as Record<string, unknown>
    return props.onclick
  })
  const restBuilderProps = $derived.by(() => {
    const props = normalizedBuilderProps as Record<string, unknown>
    const rest = { ...props }
    delete rest.class
    delete rest.onclick
    return rest
  })
  const handleClick = $derived.by(
    () =>
      onclick ??
      (typeof builderOnclick === 'function' ? (builderOnclick as typeof onclick) : undefined)
  )
  const resolvedDisabled = $derived(Boolean(disabled))
  const resolvedAriaDisabled = $derived(ariaDisabled ?? resolvedDisabled)
</script>

<button
  {...restBuilderProps}
  data-testid={testId}
  data-slot="sidebar-menu-button"
  data-sidebar="menu-button"
  data-size="default"
  data-active={active}
  class={[builderClass as string, baseButtonClass, className].filter(Boolean).join(' ')}
  {type}
  aria-disabled={resolvedAriaDisabled}
  disabled={resolvedDisabled}
  onclick={handleClick}
>
  {#if children}
    {@render children()}
  {:else}
    {#if Icon}
      <Icon />
    {/if}
    {#if label}
      <span>{label}</span>
    {/if}
  {/if}
</button>
