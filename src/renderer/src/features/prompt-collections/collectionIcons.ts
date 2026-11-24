import { FileText, Layers, Repeat } from 'lucide-svelte'

/** Collection identity shared by the picker, New Tab, sidebar, and collection header. */
export const collectionIcons = { prompt: FileText, template: Layers, routine: Repeat } as const
