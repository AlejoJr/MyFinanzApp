import type { ColorEtiqueta } from "@/types/domain"

/**
 * Clases completas y literales a propósito (no `bg-${color}-500`): Tailwind
 * solo detecta las clases que aparecen escritas tal cual en el código.
 */
export const PUNTO_COLOR: Record<ColorEtiqueta, string> = {
  slate: "bg-slate-500",
  gray: "bg-gray-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
}

/** Insignia suave (fondo claro + texto oscuro), a juego con PUNTO_COLOR. */
export const CHIP_COLOR: Record<ColorEtiqueta, string> = {
  slate: "bg-slate-100 text-slate-700",
  gray: "bg-gray-100 text-gray-700",
  emerald: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
  violet: "bg-violet-100 text-violet-800",
  cyan: "bg-cyan-100 text-cyan-800",
}
