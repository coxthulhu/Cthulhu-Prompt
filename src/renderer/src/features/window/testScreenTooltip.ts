/** Rotating hover messages shown by the title bar's Test Screen button. */
export const TEST_SCREEN_TOOLTIPS = [
  "Made in R'lyeh",
  'The Call of Cthulhu Prompt',
  'Not for developing Eldritch Superintelligence!',
  'The Dead Internet Waits, Dreaming...',
  "Ph'nglui mglw'nafh Cthulhu Prompt R'lyeh wgah'nagl fhtagn",
  'Works in my Dimension',
  'Prompt Your Shoggoth'
] as const

/** Message held before the first hover replaces it. */
export const INITIAL_TEST_SCREEN_TOOLTIP = TEST_SCREEN_TOOLTIPS[0]

/** Picks a random message that differs from the current one. */
export function getNextTestScreenTooltip(
  currentTooltip: string,
  random: () => number = Math.random
): string {
  const currentIndex = TEST_SCREEN_TOOLTIPS.indexOf(
    currentTooltip as (typeof TEST_SCREEN_TOOLTIPS)[number]
  )

  if (currentIndex === -1) {
    return TEST_SCREEN_TOOLTIPS[Math.floor(random() * TEST_SCREEN_TOOLTIPS.length)]
  }

  const nextIndexWithoutCurrent = Math.floor(random() * (TEST_SCREEN_TOOLTIPS.length - 1))
  const nextIndex =
    nextIndexWithoutCurrent >= currentIndex
      ? nextIndexWithoutCurrent + 1
      : nextIndexWithoutCurrent
  return TEST_SCREEN_TOOLTIPS[nextIndex]
}
