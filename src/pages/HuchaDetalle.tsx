import { useState, type ReactNode } from "react"
import { Link, Navigate, useNavigate, useParams } from "react-router-dom"
import { Card, Metric, ProgressBar, Text } from "@tremor/react"
import { AlertCircle, ArrowLeft, Banknote, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
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
import { usePresupuesto } from "@/hooks/usePresupuesto"
import { eliminarHucha, eliminarMovimiento, pagarHucha } from "@/lib/api"
import { crearPartida } from "@/lib/api-presupuesto"
import { formatEuro, formatFecha, formatPorcentaje } from "@/lib/format"
import { aportacionDe, planPago, type Aportacion, type PlanPago } from "@/lib/pagos"
import { anioDe, mesActual, nombreMes } from "@/lib/presupuesto"
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
  const mesHoy = mesActual()
  const hucha = useHucha(id)
  const movimientos = useMovimientos(id)
  // Para saber cuánto aporta el presupuesto cada mes a esta hucha.
  const presupuesto = usePresupuesto(anioDe(mesHoy))
  const [editando, setEditando] = useState(false)
  const [borrandoHucha, setBorrandoHucha] = useState(false)
  const [pagando, setPagando] = useState(false)
  const [anadiendoAporte, setAnadiendoAporte] = useState(false)
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
  const esPago = h.finalidad === "pago"
  const pagada = h.pagada_at !== null
  const progreso = progresoHucha(h)
  const sinObjetivo = h.objetivo <= 0
  const falta = Math.max(0, h.objetivo - h.saldo_actual)
  const numMovs = movimientos.datos?.length ?? 0

  const aportacion = presupuesto.datos
    ? aportacionDe(h.id, presupuesto.datos.partidas, presupuesto.datos.pagos, mesHoy)
    : null
  // Sin el presupuesto cargado no se sabe si hay aportación: mejor no opinar.
  const plan = esPago && !pagada && presupuesto.datos ? planPago(h, mesHoy, aportacion) : null

  const anadirAporte = async (cuota: number) => {
    if (!h.fecha_limite) return
    setAnadiendoAporte(true)
    try {
      await crearPartida({
        tipo: "ahorro",
        concepto: h.nombre,
        importe: cuota,
        frecuencia: "mensual",
        mes_inicio: mesHoy,
        mes_fin: h.fecha_limite,
        hucha_id: h.id,
      })
      toast.success(`${formatEuro(cuota)} al mes añadidos a tu presupuesto`)
      await presupuesto.recargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo añadir la aportación.")
    } finally {
      setAnadiendoAporte(false)
    }
  }

  return (
    <div className="space-y-6">
      <VolverAlResumen />

      <Card decoration="top" decorationColor={pagada ? "slate" : estilo.color}>
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
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="font-normal">
                {ETIQUETA_TIPO_HUCHA[h.tipo]}
              </Badge>
              {esPago && !pagada && (
                <Badge className="border-transparent bg-amber-100 font-normal text-amber-800 shadow-none hover:bg-amber-100">
                  Para pagar{h.fecha_limite ? ` · hasta ${nombreMes(h.fecha_limite)}` : ""}
                </Badge>
              )}
              {pagada && (
                <Badge className="border-transparent bg-emerald-100 font-normal text-emerald-800 shadow-none hover:bg-emerald-100">
                  Pagada el {formatFecha(h.pagada_at!)}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {esPago && !pagada && (
              <Button size="sm" onClick={() => setPagando(true)}>
                <Banknote className="h-4 w-4" aria-hidden="true" />
                Pagar
              </Button>
            )}
            {!pagada && (
              <Button variant="outline" size="sm" onClick={() => setEditando(true)} aria-label="Editar hucha">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
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

        {pagada ? (
          <>
            <Text className="mt-5">Objetivo pagado</Text>
            <Metric className="tabular-nums">{formatEuro(h.objetivo)}</Metric>
          </>
        ) : (
          <>
            <Text className="mt-5">{esPago ? "Apartado" : "Saldo actual"}</Text>
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
                    {falta > 0 ? `Faltan ${formatEuro(falta)}` : esPago ? "¡Listo para pagar!" : "¡Objetivo cumplido!"}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </Card>

      {plan && (
        <PanelPlan
          plan={plan}
          aportacion={aportacion}
          fechaLimite={h.fecha_limite}
          anadiendo={anadiendoAporte}
          onAnadir={(cuota) => void anadirAporte(cuota)}
        />
      )}

      <div className={cn("grid gap-6", !pagada && "lg:grid-cols-5")}>
        {!pagada && (
          <div className="lg:col-span-2">
            <MovimientoForm hucha={h} onCreado={refrescar} />
          </div>
        )}

        <section className={cn("space-y-3", !pagada && "lg:col-span-3")} aria-labelledby="titulo-historial">
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
          {pagada && (
            <p className="text-sm text-muted-foreground">
              Hucha cerrada: su historial se conserva, pero ya no admite movimientos.
            </p>
          )}

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
              soloLectura={pagada}
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
        open={pagando}
        onOpenChange={setPagando}
        variante="default"
        titulo={`¿Pagar «${h.nombre}»?`}
        descripcion={
          <>
            {h.saldo_actual > 0 ? (
              <>
                Se registrará la salida de <strong>{formatEuro(h.saldo_actual)}</strong>
                {falta > 0 ? `, aunque aún faltan ${formatEuro(falta)} para el objetivo` : ""}.
              </>
            ) : (
              <>La hucha está vacía: solo se cerrará.</>
            )}{" "}
            Se detendrá su aportación en el presupuesto y la hucha quedará archivada como pagada,
            con su historial.
          </>
        }
        textoConfirmar={h.saldo_actual > 0 ? `Pagar ${formatEuro(h.saldo_actual)}` : "Cerrar como pagada"}
        onConfirmar={async () => {
          await pagarHucha(h.id)
          toast.success(`«${h.nombre}» pagada`)
          await Promise.all([refrescar(), presupuesto.recargar()])
        }}
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
            {pagada && " Si solo quieres que no moleste, no hace falta: las huchas pagadas ya no cuentan en tus totales."}
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

const TONO = {
  bien: "border-emerald-200 bg-emerald-50 text-emerald-900",
  aviso: "border-amber-200 bg-amber-50 text-amber-900",
  mal: "border-rose-200 bg-rose-50 text-rose-900",
  neutro: "border-border bg-muted/50 text-foreground",
}

function Caja({ tono, children }: { tono: keyof typeof TONO; children: ReactNode }) {
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", TONO[tono])}>{children}</div>
}

/** ¿Llegas a tiempo? Lo que dice planPago(), en frases. */
function PanelPlan({
  plan,
  aportacion,
  fechaLimite,
  anadiendo,
  onAnadir,
}: {
  plan: PlanPago
  aportacion: Aportacion | null
  fechaLimite: string | null
  anadiendo: boolean
  onAnadir: (cuota: number) => void
}) {
  const meses = `${plan.mesesRestantes} ${plan.mesesRestantes === 1 ? "mes" : "meses"}`
  const cuota = `${formatEuro(plan.cuotaNecesaria)}/mes`
  const aportas = `${formatEuro(aportacion?.mensual ?? 0)}/mes`

  switch (plan.estado) {
    case "pagada":
      return null
    case "lista":
      return (
        <Caja tono="bien">
          Ya tienes todo el dinero. Cuando lo pagues, pulsa <strong>Pagar</strong> para cerrar la hucha.
        </Caja>
      )
    case "al_dia":
      return (
        <Caja tono="bien">
          Vas al día: apartas {aportas} y necesitas {cuota} durante {meses}.
        </Caja>
      )
    case "retrasada":
      return (
        <Caja tono="aviso">
          Así no llegas: necesitas <strong>{cuota}</strong> durante {meses} y apartas {aportas}.
          Súbelo en{" "}
          <Link to="/presupuesto" className="font-medium underline">
            Presupuesto
          </Link>{" "}
          con «Cambiar importe».
        </Caja>
      )
    case "sin_aportacion":
      return (
        <Caja tono="aviso">
          <div className="space-y-2">
            <p>
              Para llegar a tiempo necesitas apartar <strong>{cuota}</strong> durante {meses}, y tu
              presupuesto no tiene ninguna aportación a esta hucha.
            </p>
            <Button size="sm" onClick={() => onAnadir(plan.cuotaNecesaria)} disabled={anadiendo}>
              {anadiendo ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Añadir {cuota} al presupuesto
            </Button>
          </div>
        </Caja>
      )
    case "vencida":
      return (
        <Caja tono="mal">
          El plazo terminó en {fechaLimite ? nombreMes(fechaLimite) : "—"} y faltan{" "}
          {formatEuro(plan.falta)}. Amplía la fecha en «Editar» o paga con lo que hay.
        </Caja>
      )
    case "sin_limite":
      return (
        <Caja tono="neutro">
          Sin fecha límite. Añádela en «Editar» y te diré cuánto apartar cada mes.
        </Caja>
      )
  }
}
