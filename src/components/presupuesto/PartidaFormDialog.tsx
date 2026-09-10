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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { actualizarPartida, crearPartida } from "@/lib/api-presupuesto"
import { importeATexto, parseImporte } from "@/lib/formularios"
import { sumarMeses, type Mes } from "@/lib/presupuesto"
import { cn } from "@/lib/utils"
import {
  ETIQUETA_FRECUENCIA,
  ETIQUETA_TIPO_PARTIDA,
  FRECUENCIAS,
  TIPOS_PARTIDA,
  type Frecuencia,
  type Hucha,
  type Partida,
  type TipoPartida,
} from "@/types/domain"
import { CampoMes } from "./CampoMes"

const SIN_HUCHA = "ninguna" // Radix Select no admite "" como valor

const COLOR_TIPO: Record<TipoPartida, string> = {
  ingreso: "border-emerald-600 bg-emerald-50 text-emerald-700",
  gasto: "border-rose-600 bg-rose-50 text-rose-700",
  ahorro: "border-blue-600 bg-blue-50 text-blue-700",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, se edita; si no, se crea una partida nueva. */
  partida?: Partida
  huchas: Hucha[]
  mesPorDefecto: Mes
  tipoPorDefecto?: TipoPartida
  onGuardada: () => void
}

export function PartidaFormDialog({
  open,
  onOpenChange,
  partida,
  huchas,
  mesPorDefecto,
  tipoPorDefecto = "gasto",
  onGuardada,
}: Props) {
  const editando = Boolean(partida)
  const [tipo, setTipo] = useState<TipoPartida>(tipoPorDefecto)
  const [concepto, setConcepto] = useState("")
  const [importe, setImporte] = useState("")
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("mensual")
  const [inicio, setInicio] = useState<Mes>(mesPorDefecto)
  const [conFin, setConFin] = useState(false)
  const [fin, setFin] = useState<Mes>(mesPorDefecto)
  const [huchaId, setHuchaId] = useState<string>(SIN_HUCHA)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Rellena el formulario cada vez que se abre: vacío o con la partida a editar.
  useEffect(() => {
    if (!open) return
    setTipo(partida?.tipo ?? tipoPorDefecto)
    setConcepto(partida?.concepto ?? "")
    setImporte(partida ? importeATexto(partida.importe) : "")
    setFrecuencia(partida?.frecuencia ?? "mensual")
    setInicio(partida?.mes_inicio ?? mesPorDefecto)
    setConFin(Boolean(partida?.mes_fin))
    setFin(partida?.mes_fin ?? sumarMeses(partida?.mes_inicio ?? mesPorDefecto, 2))
    setHuchaId(partida?.hucha_id ?? SIN_HUCHA)
    setError(null)
  }, [open, partida, mesPorDefecto, tipoPorDefecto])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const conceptoLimpio = concepto.trim()
    if (!conceptoLimpio) return setError("Ponle un nombre, por ejemplo: Alquiler, Sueldo o Colchón financiero.")
    if (conceptoLimpio.length > 80) return setError("El nombre no puede superar los 80 caracteres.")
    const valor = parseImporte(importe)
    if (valor === null || valor <= 0) return setError("Introduce un importe mayor que cero, por ejemplo 208 o 34,99.")
    const usaFin = frecuencia !== "puntual" && conFin
    if (usaFin && fin < inicio) return setError("El último mes no puede ser anterior al primero.")

    setGuardando(true)
    try {
      const datos = {
        tipo,
        concepto: conceptoLimpio,
        importe: valor,
        frecuencia,
        mes_inicio: inicio,
        mes_fin: usaFin ? fin : null,
        hucha_id: tipo === "ahorro" && huchaId !== SIN_HUCHA ? huchaId : null,
      }
      if (partida) {
        await actualizarPartida(partida.id, datos)
        toast.success("Partida actualizada")
      } else {
        await crearPartida(datos)
        toast.success(`${ETIQUETA_TIPO_PARTIDA[tipo]} añadido al presupuesto`)
      }
      onGuardada()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la partida.")
    } finally {
      setGuardando(false)
    }
  }

  const etiquetaInicio =
    frecuencia === "puntual" ? "Mes" : frecuencia === "anual" ? "Primer pago (mes y año)" : "Desde"

  return (
    <Dialog open={open} onOpenChange={(abierto) => !guardando && onOpenChange(abierto)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar partida" : "Nueva partida"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "Los cambios se aplican a todos sus meses. Para cambiar el importe solo a partir de un mes, usa «Cambiar importe»."
              : "Un ingreso, un gasto fijo o una aportación a tu ahorro."}
          </DialogDescription>
        </DialogHeader>

        <form id="form-partida" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de partida">
            {TIPOS_PARTIDA.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tipo === t}
                onClick={() => setTipo(t)}
                disabled={guardando}
                className={cn(
                  "h-9 rounded-md border text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                  tipo === t ? COLOR_TIPO[t] : "border-input bg-background text-muted-foreground hover:bg-accent",
                )}
              >
                {ETIQUETA_TIPO_PARTIDA[t]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="partida-concepto">Concepto</Label>
              <Input
                id="partida-concepto"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                maxLength={80}
                placeholder={tipo === "ingreso" ? "Sueldo" : tipo === "ahorro" ? "Colchón financiero" : "Alquiler casa"}
                disabled={guardando}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partida-importe">Importe (€)</Label>
              <Input
                id="partida-importe"
                inputMode="decimal"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="0,00"
                disabled={guardando}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partida-frecuencia">Frecuencia</Label>
            <Select value={frecuencia} onValueChange={(v) => setFrecuencia(v as Frecuencia)} disabled={guardando}>
              <SelectTrigger id="partida-frecuencia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FRECUENCIAS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {ETIQUETA_FRECUENCIA[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="partida-inicio">{etiquetaInicio}</Label>
            <CampoMes id="partida-inicio" value={inicio} onChange={setInicio} disabled={guardando} />
          </div>

          {frecuencia !== "puntual" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={conFin}
                  onChange={(e) => setConFin(e.target.checked)}
                  disabled={guardando}
                />
                Tiene un último mes
              </label>
              {conFin ? (
                <CampoMes id="partida-fin" value={fin} onChange={setFin} disabled={guardando} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sin fecha de fin. Márcalo para plazos, p. ej. una tablet de enero a marzo.
                </p>
              )}
            </div>
          )}

          {tipo === "ahorro" && (
            <div className="space-y-2">
              <Label htmlFor="partida-hucha">Hucha</Label>
              <Select value={huchaId} onValueChange={setHuchaId} disabled={guardando}>
                <SelectTrigger id="partida-hucha">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_HUCHA}>Ninguna</SelectItem>
                  {/* Las pagadas no admiten aportaciones; salvo la ya vinculada, para no dejar el campo vacío. */}
                  {huchas
                    .filter((h) => !h.pagada_at || h.id === partida?.hucha_id)
                    .map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.nombre}
                        {h.finalidad === "pago" ? " · para pagar" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Al marcar el mes como hecho, el importe se ingresará solo en esta hucha.
              </p>
            </div>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" form="form-partida" disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {editando ? "Guardar cambios" : "Añadir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
