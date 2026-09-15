import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { COLORES_ETIQUETA, NOMBRE_COLOR, type ColorEtiqueta } from "@/types/domain"
import { PUNTO_COLOR } from "./colores"

/** Selector de las 8 colores disponibles para una categoría o un banco. */
export function SelectorColor({
  value,
  onChange,
  disabled,
}: {
  value: ColorEtiqueta
  onChange: (color: ColorEtiqueta) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLORES_ETIQUETA.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={NOMBRE_COLOR[c]}
          onClick={() => onChange(c)}
          disabled={disabled}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-shadow disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            PUNTO_COLOR[c],
            value === c ? "ring-2 ring-foreground ring-offset-2" : "hover:ring-2 hover:ring-muted-foreground/40",
          )}
        >
          {value === c && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}
