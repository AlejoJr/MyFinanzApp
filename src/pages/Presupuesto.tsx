import { useMemo, useState, type ReactNode } from "react"
import { AlertCircle, CalendarRange, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { ConfirmarDialog } from "@/components/ConfirmarDialog"
import { Cargando } from "@/components/layout/Cargando"
import { CambiarImporteDialog } from "@/components/presupuesto/CambiarImporteDialog"
import { NavegadorMes } from "@/components/presupuesto/NavegadorMes"
import { PartidaFormDialog } from "@/components/presupuesto/PartidaFormDialog"
import { VistaAnio } from "@/components/presupuesto/VistaAnio"
import { VistaMes } from "@/components/presupuesto/VistaMes"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useHuchas } from "@/hooks/useHuchas"
import { usePresupuesto } from "@/hooks/usePresupuesto"
import { desmarcar, eliminarPartida, marcarHecho } from "@/lib/api-presupuesto"
import { formatEuro } from "@/lib/format"
import { anioDe, mesActual, nombreMes, resumenMes, type LineaMes, type Mes } from "@/lib/presupuesto"
import { cn } from "@/lib/utils"
import type { Partida, TipoPartida } from "@/types/domain"

type Vista = "mes" | "anio"

export default function Presupuesto() {
  const [vista, setVista] = useState<Vista>("mes")
  const [mes, setMes] = useState<Mes>(() => mesActual())
  const anio = anioDe(mes)
  const presupuesto = usePresupuesto(anio)
  const huchas = useHuchas()
  const listaHuchas = huchas.datos ?? []

  // Cada diálogo guarda su partida aparte del "abierto" para que el contenido
  // no desaparezca durante la animación de cierre.
  const [form, setForm] = useState<{ abierto: boolean; partida?: Partida; tipo: TipoPartida }>({
    abierto: false,
    tipo: "gasto",
  })
  const [cambio, setCambio] = useState<{ abierto: boolean; partida: Partida | null }>({
    abierto: false,
    partida: null,
  })
  const [borrado, setBorrado] = useState<{ abierto: boolean; partida: Partida | null }>({
    abierto: false,
    partida: null,
  })
  const [marcandoId, setMarcandoId] = useState<string | null>(null)

  // Al cambiar de año, hasta que llega la respuesta los pagos cargados son
  // de otro año: mejor un spinner que casillas desmarcadas por error.
  const datos = presupuesto.datos?.anio === anio ? presupuesto.datos : undefined
  const resumen = useMemo(
    () => (datos ? resumenMes(datos.partidas, datos.pagos, mes) : null),
    [datos, mes],
  )

  const abrirNueva = (tipo: TipoPartida) => setForm({ abierto: true, partida: undefined, tipo })
  const abrirEditar = (partida: Partida) => setForm({ abierto: true, partida, tipo: partida.tipo })

  const alternar = async ({ partida, pago }: LineaMes) => {
    const hucha = listaHuchas.find((h) => h.id === partida.hucha_id)
    setMarcandoId(partida.id)
    try {
      if (pago) {
        await desmarcar(pago.id)
        if (pago.movimiento_id && hucha) {
          toast.success(`Se ha deshecho el ingreso de ${formatEuro(partida.importe)} en ${hucha.nombre}`)
        }
      } else {
        await marcarHecho(partida.id, mes)
        if (hucha) toast.success(`${formatEuro(partida.importe)} ingresados en ${hucha.nombre}`)
      }
      await presupuesto.recargar()
      // Una aportación a hucha cambia su saldo.
      if (hucha) void huchas.recargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el cambio.")
    } finally {
      setMarcandoId(null)
    }
  }

  let contenido: ReactNode
  if (!datos && presupuesto.error) {
    contenido = (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>No se pudo cargar el presupuesto</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{presupuesto.error}</p>
          <Button variant="outline" size="sm" onClick={() => void presupuesto.recargar()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  } else if (!datos || !resumen) {
    contenido = <Cargando className="min-h-[40vh]" texto="Cargando el presupuesto…" />
  } else if (datos.partidas.length === 0) {
    contenido = (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-background px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CalendarRange className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Tu presupuesto está vacío</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Empieza por lo que entra cada mes (tu sueldo) y después añade tus gastos fijos y lo que
            apartas para ahorrar.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => abrirNueva("ingreso")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Añadir sueldo
          </Button>
          <Button variant="outline" onClick={() => abrirNueva("gasto")}>
            Añadir gasto
          </Button>
          <Button variant="outline" onClick={() => abrirNueva("ahorro")}>
            Añadir ahorro
          </Button>
        </div>
      </div>
    )
  } else if (vista === "mes") {
    contenido = (
      <VistaMes
        resumen={resumen}
        huchas={listaHuchas}
        puedeMarcar={mes <= mesActual()}
        marcandoId={marcandoId}
        onMarcar={(linea) => void alternar(linea)}
        onAnadir={abrirNueva}
        onEditar={abrirEditar}
        onCambiarImporte={(partida) => setCambio({ abierto: true, partida })}
        onEliminar={(partida) => setBorrado({ abierto: true, partida })}
      />
    )
  } else {
    contenido = (
      <VistaAnio
        partidas={datos.partidas}
        pagos={datos.pagos}
        anio={anio}
        onIrAMes={(m) => {
          setMes(m)
          setVista("mes")
        }}
      />
    )
  }

  const p = borrado.partida

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Presupuesto</h2>
          <p className="text-sm text-muted-foreground">
            Lo que entra, lo que sale y lo que ahorras cada mes.
          </p>
        </div>
        <Button onClick={() => abrirNueva("gasto")}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva partida
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista" className="inline-flex rounded-lg border bg-background p-1">
          {(["mes", "anio"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                vista === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "mes" ? "Mes" : "Año"}
            </button>
          ))}
        </div>
        <NavegadorMes mes={mes} onChange={setMes} porAnio={vista === "anio"} />
      </div>

      {datos && presupuesto.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>No se pudieron actualizar los datos: {presupuesto.error}</AlertDescription>
        </Alert>
      )}

      {contenido}

      <PartidaFormDialog
        open={form.abierto}
        onOpenChange={(abierto) => setForm((f) => ({ ...f, abierto }))}
        partida={form.partida}
        huchas={listaHuchas}
        mesPorDefecto={mes}
        tipoPorDefecto={form.tipo}
        onGuardada={() => void presupuesto.recargar()}
      />

      <CambiarImporteDialog
        open={cambio.abierto}
        onOpenChange={(abierto) => setCambio((c) => ({ ...c, abierto }))}
        partida={cambio.partida}
        mesPorDefecto={mes}
        onHecho={() => void presupuesto.recargar()}
      />

      <ConfirmarDialog
        open={borrado.abierto}
        onOpenChange={(abierto) => setBorrado((b) => ({ ...b, abierto }))}
        titulo="¿Eliminar esta partida?"
        descripcion={
          p && (
            <>
              Se borrará <strong>{p.concepto}</strong> ({formatEuro(p.importe)}) desde{" "}
              {nombreMes(p.mes_inicio)}
              {p.mes_fin ? ` hasta ${nombreMes(p.mes_fin)}` : " en adelante"}
              {p.hucha_id ? ", y se desharán las aportaciones que ya ingresó en su hucha" : ""}. No
              se puede deshacer.
            </>
          )
        }
        textoConfirmar="Eliminar partida"
        onConfirmar={async () => {
          if (!p) return
          await eliminarPartida(p.id)
          toast.success("Partida eliminada")
          await presupuesto.recargar()
          if (p.hucha_id) void huchas.recargar()
        }}
      />
    </div>
  )
}
