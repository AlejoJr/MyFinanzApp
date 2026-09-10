import { useState } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { Card, Metric, ProgressBar, Text } from "@tremor/react"
import { AlertCircle, ArrowLeft, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ConfirmarDialog } from "@/components/ConfirmarDialog"
import { HuchaFormDialog } from "@/components/huchas/HuchaFormDialog"
import { ESTILO_TIPO } from "@/components/huchas/estilos"
import { Cargando } from "@/components/layout/Cargando"
import { MovimientoForm } from "@/components/movimientos/MovimientoForm"
import { MovimientosLista } from "@/components/movimientos/MovimientosLista"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useHucha, useMovimientos } from "@/hooks/useHuchas"
import { eliminarHucha, eliminarMovimiento } from "@/lib/api"
import { formatEuro, formatPorcentaje } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ETIQUETA_TIPO_HUCHA, progresoHucha, type Movimiento } from "@/types/domain"

export default function HuchaDetalle() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/" replace />
  // key={id}: al saltar de una hucha a otra se remonta limpio, sin enseñar
  // un instante los datos de la anterior.
  return <Detalle key={id} id={id} />
}

function VolverAlResumen() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver al resumen
    </Link>
  )
}

function Detalle({ id }: { id: string }) {
  const navigate = useNavigate()
  const hucha = useHucha(id)
  const movimientos = useMovimientos(id)
  const [editando, setEditando] = useState(false)
  const [borrandoHucha, setBorrandoHucha] = useState(false)
  // El movimiento elegido se guarda aparte del "abierto" para que el texto del
  // diálogo no desaparezca durante la animación de cierre.
  const [movABorrar, setMovABorrar] = useState<Movimiento | null>(null)
  const [confirmandoMov, setConfirmandoMov] = useState(false)

  // El saldo lo recalcula Postgres: tras cada cambio se piden de nuevo la
  // hucha (con su saldo nuevo) y el historial.
  const refrescar = async () => {
    await Promise.all([hucha.recargar(), movimientos.recargar()])
  }

  if (!hucha.datos && hucha.cargando) {
    return <Cargando className="min-h-[40vh]" texto="Cargando la hucha…" />
  }

  if (!hucha.datos) {
    return (
      <div className="space-y-4">
        <VolverAlResumen />
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>No se pudo abrir la hucha</AlertTitle>
          <AlertDescription>{hucha.error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const h = hucha.datos
  const estilo = ESTILO_TIPO[h.tipo]
  const Icono = estilo.icono
  const progreso = progresoHucha(h)
  const sinObjetivo = h.objetivo <= 0
  const falta = Math.max(0, h.objetivo - h.saldo_actual)
  const numMovs = movimientos.datos?.length ?? 0

  return (
    <div className="space-y-6">
      <VolverAlResumen />

      <Card decoration="top" decorationColor={estilo.color}>
        <div className="flex flex-wrap items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              estilo.fondo,
              estilo.texto,
            )}
          >
            <Icono className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-tremor-content-strong">{h.nombre}</h2>
            <Badge variant="secondary" className="mt-1 font-normal">
              {ETIQUETA_TIPO_HUCHA[h.tipo]}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditando(true)}
              aria-label="Editar hucha"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setBorrandoHucha(true)}
              aria-label="Eliminar hucha"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Eliminar</span>
            </Button>
          </div>
        </div>

        <Text className="mt-5">Saldo actual</Text>
        <Metric className="tabular-nums">{formatEuro(h.saldo_actual)}</Metric>

        {sinObjetivo ? (
          <Text className="mt-3">Esta hucha no tiene objetivo definido.</Text>
        ) : (
          <>
            <ProgressBar value={progreso} color={estilo.color} className="mt-4" />
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-tremor-default text-tremor-content">
              <span className="tabular-nums">
                {formatPorcentaje(progreso)} de {formatEuro(h.objetivo)}
              </span>
              <span className="tabular-nums">
                {falta > 0 ? `Faltan ${formatEuro(falta)}` : "¡Objetivo cumplido!"}
              </span>
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <MovimientoForm hucha={h} onCreado={refrescar} />
        </div>

        <section className="space-y-3 lg:col-span-3" aria-labelledby="titulo-historial">
          <div className="flex items-baseline justify-between">
            <h3 id="titulo-historial" className="text-base font-semibold">
              Historial
            </h3>
            {numMovs > 0 && (
              <span className="text-sm text-muted-foreground">
                {numMovs} {numMovs === 1 ? "movimiento" : "movimientos"}
              </span>
            )}
          </div>

          {!movimientos.datos && movimientos.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>No se pudo cargar el historial</AlertTitle>
              <AlertDescription>{movimientos.error}</AlertDescription>
            </Alert>
          ) : !movimientos.datos ? (
            <Cargando className="min-h-[20vh]" texto="Cargando movimientos…" />
          ) : (
            <MovimientosLista
              movimientos={movimientos.datos}
              onEliminar={(m) => {
                setMovABorrar(m)
                setConfirmandoMov(true)
              }}
            />
          )}
        </section>
      </div>

      <HuchaFormDialog
        open={editando}
        onOpenChange={setEditando}
        hucha={h}
        onGuardada={() => void hucha.recargar()}
      />

      <ConfirmarDialog
        open={borrandoHucha}
        onOpenChange={setBorrandoHucha}
        titulo="¿Eliminar esta hucha?"
        descripcion={
          <>
            Se borrará <strong>{h.nombre}</strong>
            {numMovs > 0 &&
              ` junto con ${numMovs === 1 ? "su movimiento" : `sus ${numMovs} movimientos`}`}
            . No se puede deshacer.
          </>
        }
        textoConfirmar="Eliminar hucha"
        onConfirmar={async () => {
          await eliminarHucha(h.id)
          toast.success("Hucha eliminada")
          navigate("/", { replace: true })
        }}
      />

      <ConfirmarDialog
        open={confirmandoMov}
        onOpenChange={setConfirmandoMov}
        titulo="¿Eliminar este movimiento?"
        descripcion={
          movABorrar && (
            <>
              Se borrará {movABorrar.tipo === "ingreso" ? "el ingreso" : "la retirada"} de{" "}
              <strong>{formatEuro(movABorrar.importe)}</strong> y el saldo se recalculará.
            </>
          )
        }
        textoConfirmar="Eliminar movimiento"
        onConfirmar={async () => {
          if (!movABorrar) return
          await eliminarMovimiento(movABorrar.id)
          toast.success("Movimiento eliminado")
          await refrescar()
        }}
      />
    </div>
  )
}
