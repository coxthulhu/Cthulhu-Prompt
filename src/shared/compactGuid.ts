export const compactGuid = (value: string): string => {
  return value.replace(/-/g, '')
}
