import { cn } from "@/lib/utils"
import type { ColorEtiqueta } from "@/types/domain"
import { CHIP_COLOR } from "./colores"
import { PuntoColor } from "./PuntoColor"

/** Insignia con punto de color + nombre: para mostrar una categoría o un banco ya asignados. */
export function EtiquetaBadge({
  nombre,
  color,
  className,
}: {
  nombre: string
  color: ColorEtiqueta
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        CHIP_COLOR[color],
        className,
      )}
    >
      <PuntoColor color={color} />
      <span className="truncate">{nombre}</span>
    </span>
  )
}
