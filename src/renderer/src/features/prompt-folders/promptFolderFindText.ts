export type FindMatchRange = {
  start: number
  end: number
}

export const findMatchRange = (
  text: string,
  query: string,
  matchIndex: number
): FindMatchRange | null => {
  if (query.length === 0 || matchIndex < 0) return null
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  let startIndex = -1
  let fromIndex = 0

  for (let i = 0; i <= matchIndex; i += 1) {
    startIndex = normalizedText.indexOf(normalizedQuery, fromIndex)
    if (startIndex < 0) return null
    fromIndex = startIndex + normalizedQuery.length
  }

  return { start: startIndex, end: startIndex + query.length }
}
