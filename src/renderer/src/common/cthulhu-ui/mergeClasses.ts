import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function collectClasses(input: ClassValue, classes: string[]): void {
  if (!input) {
    return
  }

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'bigint') {
    classes.push(String(input))
    return
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      collectClasses(value, classes)
    }
    return
  }

  if (typeof input === 'object') {
    for (const [className, enabled] of Object.entries(input)) {
      if (enabled) {
        classes.push(className)
      }
    }
  }
}

export function mergeClasses(...inputs: ClassValue[]): string {
  const classes: string[] = []

  for (const input of inputs) {
    collectClasses(input, classes)
  }

  return twMerge(classes.join(' '))
}
