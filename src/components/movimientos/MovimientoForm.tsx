import { useState, type FormEvent } from "react"
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Loader2, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { crearMovimiento } from "@/lib/api"
import { aInputDate, formatEuro } from "@/lib/format"
import { fechaMovimientoISO, parseImporte } from "@/lib/formularios"
import { cn } from "@/lib/utils"
import type { Hucha, TipoMovimiento } from "@/types/domain"

const OPCIONES: { valor: TipoMovimiento; texto: string; icono: LucideIcon; activo: string }[] = [
  {
    valor: "ingreso",
    texto: "Ingreso",
    icono: ArrowDownLeft,
    activo: "border-emerald-600 bg-emerald-50 text-emerald-700",
  },
  {
    valor: "retirada",
    texto: "Retirada",
    icono: ArrowUpRight,
    activo: "border-rose-600 bg-rose-50 text-rose-700",
  },
]

export function MovimientoForm({
  hucha,
  onCreado,
}: {
  hucha: Hucha
  onCreado: () => Promise<void>
}) {
  const hoy = aInputDate()
  const [tipo, setTipo] = useState<TipoMovimiento>("ingreso")
  const [importe, setImporte] = useState("")
  const [fecha, setFecha] = useState(hoy)
  const [nota, setNota] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const valor = parseImporte(importe)
    if (valor === null || valor <= 0) {
      return setError("Introduce un importe mayor que cero, por ejemplo 50 o 49,99.")
    }
    // Aviso temprano. La regla de verdad la aplica Postgres (0004), porque
    // este saldo puede estar desactualizado si hay otra pestaña abierta.
    if (tipo === "retirada" && valor > hucha.saldo_actual) {
      return setError(
        `No puedes retirar más de lo que hay en la hucha (${formatEuro(hucha.saldo_actual)}).`,
      )
    }
    if (!fecha) return setError("Elige una fecha.")
    if (fecha > hoy) return setError("La fecha no puede ser futura.")
    if (nota.length > 280) return setError("La nota no puede superar los 280 caracteres.")

    setEnviando(true)
    try {
      await crearMovimiento({
        hucha_id: hucha.id,
        tipo,
        importe: valor,
        fecha: fechaMovimientoISO(fecha),
        nota,
      })
      toast.success(
        tipo === "ingreso"
          ? `Ingreso de ${formatEuro(valor)} registrado`
          : `Retirada de ${formatEuro(valor)} registrada`,
      )
      setImporte("")
      setNota("")
      setFecha(hoy)
      await onCreado()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar el movimiento.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Nuevo movimiento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de movimiento">
            {OPCIONES.map(({ valor, texto, icono: Icono, activo }) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={tipo === valor}
                onClick={() => setTipo(valor)}
                disabled={enviando}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                  tipo === valor
                    ? activo
                    : "border-input bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                <Icono className="h-4 w-4" aria-hidden="true" />
                {texto}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mov-importe">Importe (€)</Label>
            <Input
              id="mov-importe"
              inputMode="decimal"
              placeholder="0,00"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              disabled={enviando}
              aria-describedby="ayuda-importe"
            />
            <p id="ayuda-importe" className="text-xs text-muted-foreground">
              Disponible en la hucha: {formatEuro(hucha.saldo_actual)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mov-fecha">Fecha</Label>
            <Input
              id="mov-fecha"
              type="date"
              max={hoy}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              disabled={enviando}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mov-nota">Nota (opcional)</Label>
            <Textarea
              id="mov-nota"
              rows={2}
              maxLength={280}
              placeholder="Ej.: nómina de septiembre"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              disabled={enviando}
            />
          </div>

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {tipo === "ingreso" ? "Registrar ingreso" : "Registrar retirada"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
