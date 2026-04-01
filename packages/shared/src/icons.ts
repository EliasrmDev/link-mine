/**
 * Canonical list of bookmark icons shared between the web app and extension.
 * Both must use this same list so the icon filter shows exactly what users can assign.
 */

export const PRESET_ICONS = [
  '🔖', '📌', '⭐', '🔥', '📚', '💡',
  '🎯', '🛠️', '📝', '🔗', '🎨', '🔬',
] as const

export type PresetIcon = (typeof PRESET_ICONS)[number]
