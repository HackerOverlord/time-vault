/**
 * Vault accent color utilities (Pass 18).
 *
 * The accent palette is intentionally small and uses Tailwind utility classes
 * directly so the purge/safelist step can include them without extra config.
 * Each color maps to a set of classes used for buttons, active indicators, and
 * decorative highlights — never for full UI re-theming.
 */

import type { VaultAccentColor } from "@/lib/types"

export const ACCENT_OPTIONS: { value: VaultAccentColor; label: string; swatch: string }[] = [
  { value: "blue",   label: "Blue",   swatch: "bg-blue-500" },
  { value: "green",  label: "Green",  swatch: "bg-emerald-500" },
  { value: "purple", label: "Purple", swatch: "bg-violet-500" },
  { value: "orange", label: "Orange", swatch: "bg-orange-500" },
  { value: "rose",   label: "Rose",   swatch: "bg-rose-500" },
  { value: "slate",  label: "Slate",  swatch: "bg-slate-400" },
]

/** Tailwind button classes (bg + hover) for a given accent. */
export function accentButton(color: VaultAccentColor | null | undefined): string {
  switch (color) {
    case "green":  return "bg-emerald-600 hover:bg-emerald-700"
    case "purple": return "bg-violet-600 hover:bg-violet-700"
    case "orange": return "bg-orange-600 hover:bg-orange-700"
    case "rose":   return "bg-rose-600 hover:bg-rose-700"
    case "slate":  return "bg-slate-500 hover:bg-slate-600"
    case "blue":
    default:       return "bg-blue-600 hover:bg-blue-700"
  }
}

/** Tailwind ring/border class for the active vault pill indicator. */
export function accentRing(color: VaultAccentColor | null | undefined): string {
  switch (color) {
    case "green":  return "ring-emerald-500"
    case "purple": return "ring-violet-500"
    case "orange": return "ring-orange-500"
    case "rose":   return "ring-rose-500"
    case "slate":  return "ring-slate-400"
    case "blue":
    default:       return "ring-blue-500"
  }
}

/** A 2-letter initials string derived from the vault name. */
export function vaultInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("")
    || name.slice(0, 2).toUpperCase()
}

/** Gradient background for the initials avatar fallback. */
export function accentGradient(color: VaultAccentColor | null | undefined): string {
  switch (color) {
    case "green":  return "from-emerald-600 to-teal-700"
    case "purple": return "from-violet-600 to-purple-700"
    case "orange": return "from-orange-500 to-amber-600"
    case "rose":   return "from-rose-600 to-pink-700"
    case "slate":  return "from-slate-500 to-zinc-600"
    case "blue":
    default:       return "from-blue-600 to-indigo-700"
  }
}
