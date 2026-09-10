import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatEuro, formatFecha } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Movimiento } from "@/types/domain"

export function MovimientosLista({
  movimientos,
  onEliminar,
}: {
  movimientos: Movimiento[]
  onEliminar: (movimiento: Movimiento) => void
}) {
  if (movimientos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        Aún no hay movimientos. Registra el primero con el formulario.
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border bg-background">
      {movimientos.map((m) => {
        const ingreso = m.tipo === "ingreso"
        const Icono = ingreso ? ArrowDownLeft : ArrowUpRight
        const descripcion = ingreso ? "ingreso" : "retirada"
        return (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                ingreso ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
              )}
            >
              <Icono className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.nota || (ingreso ? "Ingreso" : "Retirada")}
              </p>
              <p className="text-xs text-muted-foreground">{formatFecha(m.fecha)}</p>
            </div>

            <span
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                ingreso ? "text-emerald-700" : "text-rose-700",
              )}
            >
              {ingreso ? "+" : "−"}
              {formatEuro(m.importe)}
            </span>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onEliminar(m)}
              aria-label={`Eliminar ${descripcion} de ${formatEuro(m.importe)}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
