<script lang="ts">
  let { label, children } = $props<{ label: string; children?: () => unknown }>()
</script>

<div class="group/collapsible" data-state="open">
  <div
    data-slot="sidebar-group"
    data-sidebar="group"
    class="relative flex w-full min-w-0 flex-col p-2"
  >
    <div
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      class="text-sidebar-foreground/65 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-sm font-normal outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 select-none [&>svg]:size-4 [&>svg]:shrink-0 group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0"
    >
      {label}
    </div>

    <div data-slot="sidebar-group-content" data-sidebar="group-content" class="w-full text-sm">
      {@render children?.()}
    </div>
  </div>
</div>
