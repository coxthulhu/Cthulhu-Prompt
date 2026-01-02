// Minimal class merge helpers used by shadcn-svelte components.
export type WithElementRef<T> = T & { ref?: any }

export type WithoutChildrenOrChild<_T = any> = any

export function cn(...inputs: any[]): string {
  return inputs.filter(Boolean).join(' ')
}
