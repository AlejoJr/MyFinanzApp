import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { anioDe, mesActual, nombreMes, sumarMeses, type Mes } from "@/lib/presupuesto"

/** ◀ septiembre 2026 ▶ (o ◀ 2026 ▶ con `porAnio`), con atajo para volver a hoy. */
export function NavegadorMes({
  mes,
  onChange,
  porAnio = false,
}: {
  mes: Mes
  onChange: (mes: Mes) => void
  porAnio?: boolean
}) {
  const paso = porAnio ? 12 : 1
  const hoy = mesActual()
  const esActual = porAnio ? anioDe(mes) === anioDe(hoy) : mes === hoy

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(sumarMeses(mes, -paso))}
        aria-label={porAnio ? "Año anterior" : "Mes anterior"}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span
        className="min-w-[9.5rem] text-center font-medium capitalize tabular-nums"
        aria-live="polite"
      >
        {porAnio ? anioDe(mes) : nombreMes(mes)}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(sumarMeses(mes, paso))}
        aria-label={porAnio ? "Año siguiente" : "Mes siguiente"}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      {!esActual && (
        <Button variant="ghost" size="sm" onClick={() => onChange(hoy)}>
          Hoy
        </Button>
      )}
    </div>
  )
}
