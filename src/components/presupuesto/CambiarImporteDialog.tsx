import { useEffect, useState, type FormEvent } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cambiarImporteDesde } from "@/lib/api-presupuesto"
import { formatEuro } from "@/lib/format"
import { parseImporte } from "@/lib/formularios"
import { nombreMes, sumarMeses, type Mes } from "@/lib/presupuesto"
import type { Partida } from "@/types/domain"
import { CampoMes } from "./CampoMes"

/**
 * Internet pasa de 72 € a 34 € desde febrero: los meses anteriores se
 * quedan como estaban. La base de datos cierra la partida y abre otra.
 */
export function CambiarImporteDialog({
  open,
  onOpenChange,
  partida,
  mesPorDefecto,
  onHecho,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  partida: Partida | null
  mesPorDefecto: Mes
  onHecho: () => void
}) {
  const [importe, setImporte] = useState("")
  const [desde, setDesde] = useState<Mes>(mesPorDefecto)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!open || !partida) return
    setImporte("")
    setDesde(mesPorDefecto > partida.mes_inicio ? mesPorDefecto : partida.mes_inicio)
    setError(null)
  }, [open, partida, mesPorDefecto])

  if (!partida) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const valor = parseImporte(importe)
    if (valor === null || valor <= 0) return setError("Introduce un importe mayor que cero.")
    if (partida.mes_fin && desde > partida.mes_fin) {
      return setError(`La partida termina en ${nombreMes(partida.mes_fin)}: elige un mes anterior.`)
    }

    setGuardando(true)
    try {
      await cambiarImporteDesde(partida.id, desde, valor)
      toast.success(`${partida.concepto}: ${formatEuro(valor)} desde ${nombreMes(desde)}`)
      onHecho()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el importe.")
    } finally {
      setGuardando(false)
    }
  }

  const valor = parseImporte(importe)
  const cambiaDesdeElPrincipio = desde <= partida.mes_inicio

  return (
    <Dialog open={open} onOpenChange={(abierto) => !guardando && onOpenChange(abierto)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar importe · {partida.concepto}</DialogTitle>
          <DialogDescription>
            Ahora son {formatEuro(partida.importe)}. Los meses anteriores al cambio no se tocan.
          </DialogDescription>
        </DialogHeader>

        <form id="form-cambiar-importe" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="nuevo-importe">Nuevo importe (€)</Label>
            <Input
              id="nuevo-importe"
              inputMode="decimal"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              placeholder="0,00"
              disabled={guardando}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cambio-desde">A partir de</Label>
            <CampoMes id="cambio-desde" value={desde} onChange={setDesde} disabled={guardando} />
            {partida.frecuencia === "anual" && (
              <p className="text-xs text-muted-foreground">
                Es anual: el cambio empezará en el siguiente pago a partir de ese mes.
              </p>
            )}
          </div>

          {valor !== null && valor > 0 && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {cambiaDesdeElPrincipio ? (
                <>Se corregirá a {formatEuro(valor)} en todos sus meses.</>
              ) : (
                <>
                  Hasta {nombreMes(sumarMeses(desde, -1))}: {formatEuro(partida.importe)}. Desde{" "}
                  {nombreMes(desde)}: {formatEuro(valor)}.
                </>
              )}
            </p>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-cambiar-importe" disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Cambiar importe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
