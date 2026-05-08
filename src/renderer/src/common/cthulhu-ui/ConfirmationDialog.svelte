<script lang="ts">
  import { Trash2, X } from 'lucide-svelte'
  import type { ComponentType } from 'svelte'
  import CthulhuDialog from './CthulhuDialog.svelte'

  type ConfirmationDialogVariant = 'destructive'

  type Props = {
    open?: boolean
    title: string
    description: string
    confirmText: string
    icon?: ComponentType
    variant?: ConfirmationDialogVariant
    confirmTestId?: string
    oncancel?: () => void
    onconfirm?: () => void
  }

  let {
    open = $bindable(false),
    title,
    description,
    confirmText,
    icon = Trash2,
    variant = 'destructive',
    confirmTestId,
    oncancel,
    onconfirm
  }: Props = $props()

  // Pair confirmation icon and submit button colors through semantic variants.
  const variantStyles = {
    destructive: {
      iconVariant: 'danger',
      submitVariant: 'danger'
    }
  } as const

  const styles = $derived(variantStyles[variant])
</script>

<CthulhuDialog
  bind:open
  class="w-full max-w-[30rem]"
  headerStyle="section"
  showCloseButton={false}
  {icon}
  iconVariant={styles.iconVariant}
  {title}
  {description}
  submitText={confirmText}
  submitIcon={Trash2}
  cancelIcon={X}
  submitVariant={styles.submitVariant}
  submitTestId={confirmTestId}
  oncancel={oncancel}
  onsubmit={onconfirm}
/>
