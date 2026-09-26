export const APP_ICON_TOOLTIPS = [
  "Made in R'lyeh",
  'The Call of Cthulhu Prompt',
  'Not for developing Eldritch Superintelligence!',
  'The Dead Internet Waits, Dreaming...',
  "Ph'nglui mglw'nafh Cthulhu Prompt R'lyeh wgah'nagl fhtagn",
  'Works in my Dimension',
  'Prompt Your Shoggoth'
] as const

export const INITIAL_APP_ICON_TOOLTIP = APP_ICON_TOOLTIPS[0]

export function getNextAppIconTooltip(
  currentTooltip: string,
  random: () => number = Math.random
): string {
  const currentIndex = APP_ICON_TOOLTIPS.indexOf(
    currentTooltip as (typeof APP_ICON_TOOLTIPS)[number]
  )

  if (currentIndex === -1) {
    return APP_ICON_TOOLTIPS[Math.floor(random() * APP_ICON_TOOLTIPS.length)]
  }

  const nextIndexWithoutCurrent = Math.floor(random() * (APP_ICON_TOOLTIPS.length - 1))
  const nextIndex =
    nextIndexWithoutCurrent >= currentIndex
      ? nextIndexWithoutCurrent + 1
      : nextIndexWithoutCurrent
  return APP_ICON_TOOLTIPS[nextIndex]
}
