import { randomBytes } from 'crypto'
import { LoroDoc } from 'loro-crdt'
import { DEFAULT_SYSTEM_SETTINGS } from '@shared/systemSettings'

export class LoroSystemSettingsDoc {
  // Keep the document alive for the app session.
  static doc: LoroDoc | null = null

  static initialize(): void {
    const doc = new LoroDoc()
    doc.setPeerId(randomPeerId())

    const settings = doc.getMap('systemSettings')
    settings.set('promptFontSize', DEFAULT_SYSTEM_SETTINGS.promptFontSize)
    settings.set('promptEditorMinLines', DEFAULT_SYSTEM_SETTINGS.promptEditorMinLines)

    LoroSystemSettingsDoc.doc = doc
  }
}

const randomPeerId = (): bigint => {
  const bytes = randomBytes(8).toString('hex')
  return BigInt(`0x${bytes}`)
}
