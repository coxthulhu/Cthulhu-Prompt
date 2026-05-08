// Minimal class helpers used by renderer components.
export type WithElementRef<T> = T & { ref?: any }

export function cn(...inputs: any[]): string {
  return inputs.filter(Boolean).join(' ')
}
