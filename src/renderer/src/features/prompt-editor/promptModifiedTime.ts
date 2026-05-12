const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_DAYS = 7
const MONTH_DAYS = 30
const YEAR_DAYS = 365

const fullModifiedTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium'
})

export const formatPromptModifiedRelative = (modifiedAt: string, nowMs: number): string => {
  const elapsedDays = Math.floor(Math.max(0, nowMs - new Date(modifiedAt).getTime()) / DAY_MS)

  if (elapsedDays < 1) return 'today'
  if (elapsedDays === 1) return 'yesterday'
  if (elapsedDays < WEEK_DAYS) return `${elapsedDays} days ago`

  const elapsedWeeks = Math.floor(elapsedDays / WEEK_DAYS)
  if (elapsedWeeks === 1) return 'last week'
  if (elapsedDays < MONTH_DAYS) return `${elapsedWeeks} weeks ago`

  const elapsedMonths = Math.floor(elapsedDays / MONTH_DAYS)
  if (elapsedMonths === 1) return 'last month'
  if (elapsedDays < YEAR_DAYS) return `${elapsedMonths} months ago`

  const elapsedYears = Math.floor(elapsedDays / YEAR_DAYS)
  if (elapsedYears === 1) return 'last year'
  return `${elapsedYears} years ago`
}

export const formatPromptModifiedFull = (modifiedAt: string): string => {
  return fullModifiedTimeFormatter.format(new Date(modifiedAt))
}
