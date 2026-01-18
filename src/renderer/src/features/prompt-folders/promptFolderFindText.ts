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

export const findMatchIndexAtOrAfter = (
  text: string,
  query: string,
  offset: number
): number | null => {
  if (query.length === 0) return null
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  let fromIndex = 0
  let matchIndex = 0

  while (true) {
    const startIndex = normalizedText.indexOf(normalizedQuery, fromIndex)
    if (startIndex < 0) return null
    if (startIndex >= offset) return matchIndex
    fromIndex = startIndex + normalizedQuery.length
    matchIndex += 1
  }
}

export const findMatchIndexBefore = (
  text: string,
  query: string,
  offset: number
): number | null => {
  if (query.length === 0) return null
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  let fromIndex = 0
  let matchIndex = 0
  let lastMatchIndex: number | null = null

  while (true) {
    const startIndex = normalizedText.indexOf(normalizedQuery, fromIndex)
    if (startIndex < 0) break
    if (startIndex >= offset) break
    lastMatchIndex = matchIndex
    fromIndex = startIndex + normalizedQuery.length
    matchIndex += 1
  }

  return lastMatchIndex
}
