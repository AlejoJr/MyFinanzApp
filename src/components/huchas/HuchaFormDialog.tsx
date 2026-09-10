import { useEffect, useState, type FormEvent } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { CampoMes } from "@/components/presupuesto/CampoMes"
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
import { actualizarHucha, crearHucha, crearMovimiento } from "@/lib/api"
import { crearPartida } from "@/lib/api-presupuesto"
import { formatEuro } from "@/lib/format"
import { importeATexto, parseImporte } from "@/lib/formularios"
import { cuotaMensual } from "@/lib/pagos"
import { mesActual, mesesEntre, nombreMes, sumarMeses, type Mes } from "@/lib/presupuesto"
import { cn } from "@/lib/utils"
import {
  ETIQUETA_TIPO_HUCHA,
  TIPOS_HUCHA,
  type FinalidadHucha,
  type Hucha,
  type TipoHucha,
} from "@/types/domain"
import { ESTILO_TIPO } from "./estilos"

const OPCIONES_FINALIDAD: { valor: FinalidadHucha; titulo: string; detalle: string; activo: string }[] = [
  {
    valor: "ahorro",
    titulo: "Ahorro",
    detalle: "Dinero tuyo que se queda",
    activo: "border-emerald-600 bg-emerald-50",
  },
  {
    valor: "pago",
    titulo: "Para pagar",
    detalle: "Apartado para un pago futuro",
    activo: "border-amber-600 bg-amber-50",
  },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, el diálogo edita esa hucha; si no, crea una nueva. */
  hucha?: Hucha
  onGuardada: () => void
}

/** Cuánto hay que apartar al mes desde este mes hasta la fecha límite. */
function calcularAporte(objetivo: number | null, saldoInicial: number | null, limite: Mes) {
  if (objetivo === null || saldoInicial === null) return null
  const meses = mesesEntre(mesActual(), limite) + 1
  const falta = objetivo - saldoInicial
  if (meses <= 0 || falta <= 0) return null
  return { meses, cuota: cuotaMensual(falta, meses) }
}

export function HuchaFormDialog({ open, onOpenChange, hucha, onGuardada }: Props) {
  const editando = Boolean(hucha)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState<TipoHucha>("ahorro")
  const [finalidad, setFinalidad] = useState<FinalidadHucha>("ahorro")
  const [objetivo, setObjetivo] = useState("")
  const [saldoInicial, setSaldoInicial] = useState("")
  const [limite, setLimite] = useState<Mes>(() => sumarMeses(mesActual(), 5))
  const [crearAporte, setCrearAporte] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Rellena el formulario cada vez que se abre: vacío, o con la hucha a editar.
  useEffect(() => {
    if (!open) return
    setNombre(hucha?.nombre ?? "")
    setTipo(hucha?.tipo ?? "ahorro")
    setFinalidad(hucha?.finalidad ?? "ahorro")
    setObjetivo(hucha && hucha.objetivo > 0 ? importeATexto(hucha.objetivo) : "")
    setSaldoInicial("")
    setLimite(hucha?.fecha_limite ?? sumarMeses(mesActual(), 5))
    setCrearAporte(true)
    setError(null)
  }, [open, hucha])

  const esPago = finalidad === "pago"
  const objetivoNum = objetivo.trim() === "" ? 0 : parseImporte(objetivo)
  const saldoNum = saldoInicial.trim() === "" ? 0 : parseImporte(saldoInicial)
  const aporte = !editando && esPago ? calcularAporte(objetivoNum, saldoNum, limite) : null

  const cambiarFinalidad = (valor: FinalidadHucha) => {
    setFinalidad(valor)
    // "Ahorro" como categoría de una hucha para pagar se lee raro: mejor "Otro".
    if (!editando && valor === "pago" && tipo === "ahorro") setTipo("otro")
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) return setError("Ponle un nombre a la hucha.")
    if (nombreLimpio.length > 80) return setError("El nombre no puede superar los 80 caracteres.")
    if (objetivoNum === null) {
      return setError("El importe no es válido. Escríbelo así: 5000 o 5000,50.")
    }
    if (esPago && objetivoNum <= 0) return setError("Indica cuánto tienes que pagar.")
    if (saldoNum === null) {
      return setError("El saldo inicial no es un importe válido. Escríbelo así: 1200 o 1200,50.")
    }
    if (esPago && limite < mesActual() && limite !== hucha?.fecha_limite) {
      return setError("La fecha límite no puede ser un mes pasado.")
    }

    setGuardando(true)
    try {
      const datos = {
        nombre: nombreLimpio,
        tipo,
        finalidad,
        objetivo: objetivoNum,
        fecha_limite: esPago ? limite : null,
      }

      if (hucha) {
        await actualizarHucha(hucha.id, datos)
        toast.success("Hucha actualizada")
      } else {
        const nueva = await crearHucha(datos)
        // Si algo de lo que sigue falla, la hucha ya existe: no se deshace,
        // se avisa para completarlo a mano.
        const pendientes: string[] = []

        // El saldo inicial entra como un ingreso más: saldo_actual solo lo
        // escribe el trigger a partir de los movimientos.
        if (saldoNum > 0) {
          try {
            await crearMovimiento({
              hucha_id: nueva.id,
              tipo: "ingreso",
              importe: saldoNum,
              fecha: new Date().toISOString(),
              nota: "Saldo inicial",
            })
          } catch {
            pendientes.push("el saldo inicial")
          }
        }

        const aporteFinal = crearAporte ? aporte : null
        if (aporteFinal) {
          try {
            await crearPartida({
              tipo: "ahorro",
              concepto: nombreLimpio,
              importe: aporteFinal.cuota,
              frecuencia: "mensual",
              mes_inicio: mesActual(),
              mes_fin: limite,
              hucha_id: nueva.id,
            })
          } catch {
            pendientes.push("la aportación mensual en el presupuesto")
          }
        }

        if (pendientes.length > 0) {
          toast.warning(`Hucha creada, pero no se pudo registrar ${pendientes.join(" ni ")}`, {
            description: "Puedes añadirlo a mano desde la hucha o desde Presupuesto.",
          })
        } else if (aporteFinal) {
          toast.success("Hucha creada", {
            description: `${formatEuro(aporteFinal.cuota)} al mes añadidos a tu presupuesto.`,
          })
        } else {
          toast.success("Hucha creada")
        }
      }

      onGuardada()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la hucha.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !guardando && onOpenChange(abierto)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar hucha" : "Nueva hucha"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "El saldo no se edita aquí: cambia con los ingresos y retiradas."
              : "Para ahorrar, o para reunir el dinero de un pago futuro."}
          </DialogDescription>
        </DialogHeader>

        <form id="form-hucha" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Finalidad de la hucha">
            {OPCIONES_FINALIDAD.map((o) => (
              <button
                key={o.valor}
                type="button"
                role="radio"
                aria-checked={finalidad === o.valor}
                onClick={() => cambiarFinalidad(o.valor)}
                disabled={guardando}
                className={cn(
                  "rounded-md border px-3 py-2 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
                  finalidad === o.valor ? o.activo : "border-input bg-background hover:bg-accent",
                )}
              >
                <span className="block text-sm font-medium">{o.titulo}</span>
                <span className="block text-xs text-muted-foreground">{o.detalle}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hucha-nombre">Nombre</Label>
            <Input
              id="hucha-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder={esPago ? "Pago coche" : "Fondo de emergencia"}
              disabled={guardando}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hucha-tipo">Categoría</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoHucha)} disabled={guardando}>
              <SelectTrigger id="hucha-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_HUCHA.map((t) => {
                  const Icono = ESTILO_TIPO[t].icono
                  return (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-2">
                        <Icono className={cn("h-4 w-4", ESTILO_TIPO[t].texto)} aria-hidden="true" />
                        {ETIQUETA_TIPO_HUCHA[t]}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hucha-objetivo">{esPago ? "Importe a pagar (€)" : "Objetivo (€)"}</Label>
            <Input
              id="hucha-objetivo"
              inputMode="decimal"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder={esPago ? "2500" : "5000"}
              disabled={guardando}
              aria-describedby="ayuda-objetivo"
            />
            <p id="ayuda-objetivo" className="text-xs text-muted-foreground">
              {esPago
                ? "Lo que tendrás que pagar cuando llegue el momento."
                : "Déjalo vacío si no tiene una cifra concreta."}
            </p>
          </div>

          {esPago && (
            <div className="space-y-2">
              <Label htmlFor="hucha-limite">Último mes para reunirlo</Label>
              <CampoMes id="hucha-limite" value={limite} onChange={setLimite} disabled={guardando} />
            </div>
          )}

          {!editando && (
            <div className="space-y-2">
              <Label htmlFor="hucha-saldo">Saldo inicial (€)</Label>
              <Input
                id="hucha-saldo"
                inputMode="decimal"
                value={saldoInicial}
                onChange={(e) => setSaldoInicial(e.target.value)}
                placeholder="0"
                disabled={guardando}
                aria-describedby="ayuda-saldo"
              />
              <p id="ayuda-saldo" className="text-xs text-muted-foreground">
                Lo que ya tienes apartado. Se registrará como primer ingreso.
              </p>
            </div>
          )}

          {!editando && esPago && (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
              <label className="flex items-start gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={crearAporte}
                  onChange={(e) => setCrearAporte(e.target.checked)}
                  disabled={guardando}
                />
                Añadir la aportación mensual a mi presupuesto
              </label>
              <p className="pl-6 text-sm text-muted-foreground">
                {aporte ? (
                  <>
                    <strong className="text-foreground">{formatEuro(aporte.cuota)} al mes</strong> de{" "}
                    {nombreMes(mesActual())} a {nombreMes(limite)} ({aporte.meses}{" "}
                    {aporte.meses === 1 ? "mes" : "meses"}). Cada mes lo marcas como hecho y entra
                    solo en esta hucha.
                  </>
                ) : objetivoNum !== null && saldoNum !== null && objetivoNum > 0 && saldoNum >= objetivoNum ? (
                  "Ya tienes todo el dinero: no hace falta aportación."
                ) : (
                  "Indica el importe y el último mes para calcular la cuota."
                )}
              </p>
            </div>
          )}

          {editando && esPago && (
            <p className="text-xs text-muted-foreground">
              Si cambias el importe o la fecha, la aportación del presupuesto no se ajusta sola:
              cámbiala en Presupuesto con «Cambiar importe». En la hucha verás la cuota que
              necesitas.
            </p>
          )}
        </form>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button type="submit" form="form-hucha" disabled={guardando}>
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {editando ? "Guardar cambios" : "Crear hucha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
