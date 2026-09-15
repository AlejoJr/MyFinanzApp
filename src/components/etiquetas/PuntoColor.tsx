import { cn } from "@/lib/utils"
import type { ColorEtiqueta } from "@/types/domain"
import { PUNTO_COLOR } from "./colores"

/** Punto de color sólido: la categoría o el banco, en su forma más compacta. */
export function PuntoColor({ color, className }: { color: ColorEtiqueta; className?: string }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", PUNTO_COLOR[color], className)}
      aria-hidden="true"
    />
  )
}
