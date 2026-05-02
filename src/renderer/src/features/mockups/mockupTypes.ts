import type { ComponentType } from 'svelte'

export type MockupModule = {
  default: ComponentType
}

export type MockupEntry = {
  id: string
  title: string
  path: string
  component: ComponentType
}
