<script lang="ts">
  let {
    label,
    children,
    action
  } = $props<{ label: string; children?: () => unknown; action?: () => unknown }>()
</script>

<div class="group/collapsible" data-state="open">
  <div
    data-slot="sidebar-group"
    data-sidebar="group"
    class="relative flex w-full min-w-0 flex-col px-2 pb-2 pt-1"
  >
    <div
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      class="text-sidebar-foreground ring-sidebar-ring flex h-8 shrink-0 items-center justify-between gap-2 rounded-md px-2 text-sm font-normal outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 select-none [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0"
    >
      <span class="min-w-0 truncate">{label}</span>
      {#if action}
        <div class="shrink-0">
          {@render action()}
        </div>
      {/if}
    </div>

    <div data-slot="sidebar-group-content" data-sidebar="group-content" class="w-full text-sm">
      {@render children?.()}
    </div>
  </div>
</div>
