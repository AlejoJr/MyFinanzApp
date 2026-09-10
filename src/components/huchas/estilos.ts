import { House, PiggyBank, Shield, TrendingUp, Wallet, type LucideIcon } from "lucide-react"
import type { Color } from "@tremor/react"
import type { TipoHucha } from "@/types/domain"

/**
 * Color e icono de cada tipo de hucha.
 * - `color` (Tremor) tiene que estar en TREMOR_PALETTE de tailwind.config.js
 *   o Tailwind purga sus clases y la barra sale sin color.
 * - `fondo` y `texto` van escritas enteras para que Tailwind las detecte.
 */
export const ESTILO_TIPO: Record<
  TipoHucha,
  { icono: LucideIcon; color: Color; fondo: string; texto: string }
> = {
  ahorro: { icono: PiggyBank, color: "emerald", fondo: "bg-emerald-50", texto: "text-emerald-700" },
  inversion: { icono: TrendingUp, color: "blue", fondo: "bg-blue-50", texto: "text-blue-700" },
  hipoteca: { icono: House, color: "amber", fondo: "bg-amber-50", texto: "text-amber-700" },
  seguro: { icono: Shield, color: "violet", fondo: "bg-violet-50", texto: "text-violet-700" },
  otro: { icono: Wallet, color: "slate", fondo: "bg-slate-100", texto: "text-slate-700" },
}

/** Una serie por hucha en los gráficos. Todos están en TREMOR_PALETTE. */
export const PALETA_GRAFICOS: Color[] = [
  "emerald",
  "blue",
  "amber",
  "violet",
  "cyan",
  "rose",
  "slate",
  "gray",
]
