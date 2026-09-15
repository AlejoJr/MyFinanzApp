import { useState, type FormEvent } from "react"
import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmarDialog } from "@/components/ConfirmarDialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ColorEtiqueta } from "@/types/domain"
import type { DatosEtiqueta } from "@/lib/api-etiquetas"
import { PuntoColor } from "./PuntoColor"
import { SelectorColor } from "./SelectorColor"

interface EtiquetaBase {
  id: string
  nombre: string
  color: ColorEtiqueta
}

interface Props<T extends EtiquetaBase> {
  titulo: string
  descripcion: string
  singular: string // "categoría" | "banco", para los textos generados
  etiquetas: T[]
  cargando: boolean
  error: string | null
  onCrear: (datos: DatosEtiqueta) => Promise<unknown>
  onActualizar: (id: string, datos: DatosEtiqueta) => Promise<unknown>
  onEliminar: (id: string) => Promise<unknown>
}

/** Formulario inline compartido por "nueva" y "editar": nombre + color + guardar/cancelar. */
function Formulario({
  valorInicial,
  onGuardar,
  onCancelar,
  textoGuardar,
}: {
  valorInicial: DatosEtiqueta
  onGuardar: (datos: DatosEtiqueta) => Promise<void>
  onCancelar: () => void
  textoGuardar: string
}) {
  const [nombre, setNombre] = useState(valorInicial.nombre)
  const [color, setColor] = useState<ColorEtiqueta>(valorInicial.color)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) return setError("Ponle un nombre.")
    if (nombreLimpio.length > 40) return setError("El nombre no puede superar los 40 caracteres.")
    setError(null)
    setGuardando(true)
    try {
      await onGuardar({ nombre: nombreLimpio, color })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border bg-muted/30 p-3">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={40}
        placeholder="Nombre"
        disabled={guardando}
        autoFocus
      />
      <SelectorColor value={color} onChange={setColor} disabled={guardando} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={guardando}>
          {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {textoGuardar}
        </Button>
      </div>
    </form>
  )
}

export function EtiquetaSeccion<T extends EtiquetaBase>({
  titulo,
  descripcion,
  singular,
  etiquetas,
  cargando,
  error,
  onCrear,
  onActualizar,
  onEliminar,
}: Props<T>) {
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<T | null>(null)

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : etiquetas.length === 0 && !creando ? (
        <p className="rounded-lg border border-dashed bg-background px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no tienes ninguna {singular}.
        </p>
      ) : (
        <ul className="space-y-2">
          {etiquetas.map((et) =>
            editandoId === et.id ? (
              <li key={et.id}>
                <Formulario
                  valorInicial={{ nombre: et.nombre, color: et.color }}
                  textoGuardar="Guardar cambios"
                  onCancelar={() => setEditandoId(null)}
                  onGuardar={async (datos) => {
                    await onActualizar(et.id, datos)
                    toast.success(`${singular[0]!.toUpperCase()}${singular.slice(1)} actualizada`)
                    setEditandoId(null)
                  }}
                />
              </li>
            ) : (
              <li
                key={et.id}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
              >
                <PuntoColor color={et.color} className="h-3 w-3" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{et.nombre}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setEditandoId(et.id)}
                  aria-label={`Editar ${et.nombre}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setBorrando(et)}
                  aria-label={`Eliminar ${et.nombre}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ),
          )}
        </ul>
      )}

      {creando ? (
        <Formulario
          valorInicial={{ nombre: "", color: "slate" }}
          textoGuardar="Añadir"
          onCancelar={() => setCreando(false)}
          onGuardar={async (datos) => {
            await onCrear(datos)
            toast.success(`${singular[0]!.toUpperCase()}${singular.slice(1)} añadida`)
            setCreando(false)
          }}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setCreando(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva {singular}
        </Button>
      )}

      <ConfirmarDialog
        open={borrando !== null}
        onOpenChange={(abierto) => !abierto && setBorrando(null)}
        titulo={`¿Eliminar «${borrando?.nombre}»?`}
        descripcion={`No se borrará nada que la tenga asignada: se quedará sin ${singular}.`}
        textoConfirmar="Eliminar"
        onConfirmar={async () => {
          if (!borrando) return
          await onEliminar(borrando.id)
          toast.success(`${singular[0]!.toUpperCase()}${singular.slice(1)} eliminada`)
        }}
      />
    </section>
  )
}
