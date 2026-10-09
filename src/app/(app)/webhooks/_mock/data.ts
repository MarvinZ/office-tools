// Despite the folder name, these are real shared constants (not fake data) —
// see CLAUDE.md's note on this naming convention across modules.

export const VERIFICATION_STATUS_CONFIG = {
  valid: { color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "bg-emerald-500" },
  invalid: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", dot: "bg-red-500" },
} as const;
