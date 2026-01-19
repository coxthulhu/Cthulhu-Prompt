<script lang="ts">
  import { Button } from '@renderer/common/ui/button'
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
  } from './index'
  import { AlertTriangle } from 'lucide-svelte'

  type ErrorDialogProps = {
    open?: boolean
    title?: string
    message: string
    confirmLabel?: string
  }

  let {
    open = $bindable(false),
    title = 'Error',
    message,
    confirmLabel = 'OK'
  }: ErrorDialogProps = $props()
</script>

<Dialog bind:open>
  <DialogContent class="border-destructive/40 shadow-red-500/10" showCloseButton={false}>
    <DialogHeader>
      <div class="flex items-center gap-3">
        <span class="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle class="size-4" />
        </span>
        <DialogTitle class="text-destructive">{title}</DialogTitle>
      </div>
      <DialogDescription class="text-foreground/80">{message}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="destructive" onclick={() => (open = false)}>{confirmLabel}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
