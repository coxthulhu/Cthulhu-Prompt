import type { ComponentType } from 'svelte'

export type MockupMeta = {
  id: string
  title: string
  kicker: string
  description: string
  order?: number
}

export type MockupModule = {
  default: ComponentType
  mockupMeta?: Partial<MockupMeta>
}

export type MockupEntry = MockupMeta & {
  path: string
  component: ComponentType
}
