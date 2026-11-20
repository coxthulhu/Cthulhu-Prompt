import { getFs } from '../fs-provider'

/** Reads legacy workspace and system settings metadata through the configured filesystem. */
export const readJsonFile = <T = unknown>(filePath: string): T =>
  JSON.parse(getFs().readFileSync(filePath, 'utf8')) as T
