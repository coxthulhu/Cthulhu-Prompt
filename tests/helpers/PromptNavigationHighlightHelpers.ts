import type { Locator } from '@playwright/test'

/** Browser-observed timing and color at the center of the navigation highlight hold. */
export type PromptNavigationHighlightAnimation = {
  /** Total CSS animation duration in milliseconds. */
  durationMs: number
  /** Millisecond positions of the fade-in, hold, and fade-out boundaries. */
  keyframeTimesMs: number[]
  /** Rendered background layer color halfway through the muted violet hold. */
  holdColor: string
  /** Palette-resolved muted violet expected during the hold. */
  accentColor: string
  /** Browser-normalized color authored at the final animation keyframe. */
  finalKeyframeColor: string
  /** Browser-normalized background layer color without the navigation animation. */
  normalColor: string
}

/** Pauses one background layer during its hold and reports its computed animation contract. */
export const readPromptNavigationHighlightAnimation = async (
  indicator: Locator
): Promise<PromptNavigationHighlightAnimation> =>
  await indicator.evaluate((element) => {
    /** Fresh highlighted clone removes dependence on how much of the live 1000ms animation remains. */
    const animationProbe = element.cloneNode(false) as HTMLElement
    element.parentElement?.append(animationProbe)
    /** CSS animation synchronously attached to the fresh navigation-highlight clone. */
    const animation = animationProbe.getAnimations()[0]
    if (!animation) throw new Error('Missing prompt navigation highlight animation')
    /** Keyframe effect exposes the authored duration and phase offsets. */
    const effect = animation.effect as KeyframeEffect
    /** Numeric duration used to convert relative keyframe offsets to milliseconds. */
    const durationMs = Number(effect.getTiming().duration)
    /** Authored keyframes defining the transition, hold, and fade boundaries. */
    const keyframes = effect.getKeyframes()

    animation.pause()
    animation.currentTime = 300

    /** Temporary probe resolves the semantic palette token in Chromium's color format. */
    const accentProbe = document.createElement('span')
    document.body.append(accentProbe)
    /** Constant-color animation normalizes OKLCH through the same engine as the tested keyframes. */
    const accentAnimation = accentProbe.animate(
      [
        { backgroundColor: 'var(--ui-accent-action-hover-fill)' },
        { backgroundColor: 'var(--ui-accent-action-hover-fill)' }
      ],
      { duration: 1_000, fill: 'both' }
    )
    accentAnimation.pause()
    accentAnimation.currentTime = 500
    /** Browser-normalized accent color used for the computed-color comparison. */
    const accentColor = getComputedStyle(accentProbe).backgroundColor
    accentAnimation.cancel()

    /** Final authored background value that should restore the persistent background layer color. */
    const finalBackgroundColor = String(keyframes.at(-1)?.backgroundColor ?? '')
    /** Constant-color animation normalizes the final keyframe value for comparison. */
    const finalColorAnimation = accentProbe.animate(
      [{ backgroundColor: finalBackgroundColor }, { backgroundColor: finalBackgroundColor }],
      { duration: 1_000, fill: 'both' }
    )
    finalColorAnimation.pause()
    finalColorAnimation.currentTime = 500
    /** Browser-normalized final keyframe color. */
    const finalKeyframeColor = getComputedStyle(accentProbe).backgroundColor
    finalColorAnimation.cancel()
    accentProbe.remove()

    /** Unanimated clone resolves the background layer's transparent resting color. */
    const normalProbe = element.cloneNode(false) as HTMLElement
    normalProbe.removeAttribute('data-navigation-highlight')
    normalProbe.removeAttribute('data-navigation-highlight-generation')
    element.parentElement?.append(normalProbe)
    /** Persistent color value resolved from the unanimated background rule. */
    const normalBackgroundColor = getComputedStyle(normalProbe).backgroundColor
    /** Constant-color animation normalizes the persistent color for keyframe comparison. */
    const normalColorAnimation = normalProbe.animate(
      [{ backgroundColor: normalBackgroundColor }, { backgroundColor: normalBackgroundColor }],
      { duration: 1_000, fill: 'both' }
    )
    normalColorAnimation.pause()
    normalColorAnimation.currentTime = 500
    /** Browser-normalized color rendered after the animation completes. */
    const normalColor = getComputedStyle(normalProbe).backgroundColor
    normalColorAnimation.cancel()
    normalProbe.remove()

    /** Complete animation snapshot retained after removing the temporary highlighted clone. */
    const result = {
      durationMs,
      keyframeTimesMs: keyframes.map((keyframe) =>
        Math.round((keyframe.computedOffset ?? 0) * durationMs)
      ),
      holdColor: getComputedStyle(animationProbe).backgroundColor,
      accentColor,
      finalKeyframeColor,
      normalColor
    }
    animationProbe.remove()
    return result
  })
