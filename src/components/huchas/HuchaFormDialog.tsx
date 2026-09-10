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
import { actualizarHucha, crearHucha, crearMovimiento } from "@/lib/api"
import { importeATexto, parseImporte } from "@/lib/formularios"
import { cn } from "@/lib/utils"
import { ETIQUETA_TIPO_HUCHA, TIPOS_HUCHA, type Hucha, type TipoHucha } from "@/types/domain"
import { ESTILO_TIPO } from "./estilos"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, el diálogo edita esa hucha; si no, crea una nueva. */
  hucha?: Hucha
  onGuardada: () => void
}

export function HuchaFormDialog({ open, onOpenChange, hucha, onGuardada }: Props) {
  const editando = Boolean(hucha)
  const [nombre, setNombre] = useState("")
  const [tipo, setTipo] = useState<TipoHucha>("ahorro")
  const [objetivo, setObjetivo] = useState("")
  const [saldoInicial, setSaldoInicial] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Rellena el formulario cada vez que se abre: vacío, o con la hucha a editar.
  useEffect(() => {
    if (!open) return
    setNombre(hucha?.nombre ?? "")
    setTipo(hucha?.tipo ?? "ahorro")
    setObjetivo(hucha && hucha.objetivo > 0 ? importeATexto(hucha.objetivo) : "")
    setSaldoInicial("")
    setError(null)
  }, [open, hucha])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) return setError("Ponle un nombre a la hucha.")
    if (nombreLimpio.length > 80) return setError("El nombre no puede superar los 80 caracteres.")

    const objetivoNum = objetivo.trim() === "" ? 0 : parseImporte(objetivo)
    if (objetivoNum === null) {
      return setError("El objetivo no es un importe válido. Escríbelo así: 5000 o 5000,50.")
    }
    const saldoNum = saldoInicial.trim() === "" ? 0 : parseImporte(saldoInicial)
    if (saldoNum === null) {
      return setError("El saldo inicial no es un importe válido. Escríbelo así: 1200 o 1200,50.")
    }

    setGuardando(true)
    try {
      const datos = { nombre: nombreLimpio, tipo, objetivo: objetivoNum }

      if (hucha) {
        await actualizarHucha(hucha.id, datos)
        toast.success("Hucha actualizada")
      } else {
        const nueva = await crearHucha(datos)
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
          } catch (err) {
            // La hucha ya existe: no la deshacemos, avisamos para meterlo a mano.
            toast.warning("Hucha creada, pero no se pudo registrar el saldo inicial", {
              description: err instanceof Error ? err.message : undefined,
            })
            onGuardada()
            onOpenChange(false)
            return
          }
        }
        toast.success("Hucha creada")
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar hucha" : "Nueva hucha"}</DialogTitle>
          <DialogDescription>
            {editando
              ? "El saldo no se edita aquí: cambia con los ingresos y retiradas."
              : "Define para qué ahorras y cuánto quieres reunir."}
          </DialogDescription>
        </DialogHeader>

        <form id="form-hucha" onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="hucha-nombre">Nombre</Label>
            <Input
              id="hucha-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={80}
              placeholder="Fondo de emergencia"
              disabled={guardando}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hucha-tipo">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as TipoHucha)}
              disabled={guardando}
            >
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
            <Label htmlFor="hucha-objetivo">Objetivo (€)</Label>
            <Input
              id="hucha-objetivo"
              inputMode="decimal"
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              placeholder="5000"
              disabled={guardando}
              aria-describedby="ayuda-objetivo"
            />
            <p id="ayuda-objetivo" className="text-xs text-muted-foreground">
              Déjalo vacío si no tiene una cifra concreta.
            </p>
          </div>

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
                Lo que ya tienes ahorrado. Se registrará como primer ingreso.
              </p>
            </div>
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
