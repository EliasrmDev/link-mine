/**
 * Suggested tags for quick bookmarking.
 * Users can still enter custom tags freely.
 */

export const PRESET_TAGS = [
  'work',
  'study',
  'tools',
  'design',
  'frontend',
  'backend',
  'ai',
  'reading',
  'docs',
  'inspiration',
] as const

export type PresetTag = (typeof PRESET_TAGS)[number]
