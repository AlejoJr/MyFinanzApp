import { useMemo, useState } from "react"
import { Card, DonutChart, Legend, Metric, ProgressBar, Text, Title } from "@tremor/react"
import { AlertCircle, PiggyBank, Plus, RefreshCw } from "lucide-react"
import { HuchaCard } from "@/components/huchas/HuchaCard"
import { HuchaFormDialog } from "@/components/huchas/HuchaFormDialog"
import { PALETA_GRAFICOS } from "@/components/huchas/estilos"
import { Cargando } from "@/components/layout/Cargando"
import { PuntoColor } from "@/components/etiquetas/PuntoColor"
import { PUNTO_COLOR } from "@/components/etiquetas/colores"
import { ResumenMesCard } from "@/components/presupuesto/ResumenMesCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useHuchas } from "@/hooks/useHuchas"
import { useBancos } from "@/hooks/useEtiquetas"
import { saldoPorBanco } from "@/lib/bancos"
import { formatEuro, formatPorcentaje } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Banco, Hucha } from "@/types/domain"

const sumar = (valores: number[]) => valores.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100

function calcularResumen(huchas: Hucha[]) {
  const activas = huchas.filter((h) => !h.pagada_at)
  const deAhorro = activas.filter((h) => h.finalidad === "ahorro")
  // Primero lo que vence antes; las que no tienen fecha, al final.
  const paraPagar = activas
    .filter((h) => h.finalidad === "pago")
    .sort((a, b) => (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999"))
  const pagadas = huchas.filter((h) => h.pagada_at)

  const conObjetivo = deAhorro.filter((h) => h.objetivo > 0)
  const objetivoTotal = sumar(conObjetivo.map((h) => h.objetivo))
  // Cada hucha aporta como mucho su objetivo: que una se pase de su meta no
  // debe tapar que otra va atrasada.
  const hastaObjetivo = sumar(conObjetivo.map((h) => Math.min(h.saldo_actual, h.objetivo)))

  return {
    deAhorro,
    paraPagar,
    pagadas,
    // Tu dinero y el que ya tiene destino, por separado: el del coche no es ahorro.
    tuAhorro: sumar(deAhorro.map((h) => h.saldo_actual)),
    apartado: sumar(paraPagar.map((h) => h.saldo_actual)),
    progresoAhorro: objetivoTotal > 0 ? (hastaObjetivo * 100) / objetivoTotal : null,
    distribucion: deAhorro
      .filter((h) => h.saldo_actual > 0)
      .map((h) => ({ nombre: h.nombre, saldo: h.saldo_actual })),
  }
}

export default function Dashboard() {
  const { datos: huchas, cargando, error, recargar } = useHuchas()
  const bancos = useBancos()
  const listaBancos = bancos.datos ?? []
  const [creando, setCreando] = useState(false)
  const resumen = useMemo(() => calcularResumen(huchas ?? []), [huchas])
  const porBanco = useMemo(() => saldoPorBanco(huchas ?? []), [huchas])

  if (!huchas && cargando) {
    return <Cargando className="min-h-[40vh]" texto="Cargando tus huchas…" />
  }

  if (!huchas) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>No se pudieron cargar tus huchas</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => void recargar()}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const colores = resumen.distribucion.map((_, i) => PALETA_GRAFICOS[i % PALETA_GRAFICOS.length]!)
  const pendientes = resumen.paraPagar.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Resumen</h2>
          <p className="text-sm text-muted-foreground">Tu mes y tus huchas de un vistazo.</p>
        </div>
        <Button onClick={() => setCreando(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva hucha
        </Button>
      </div>

      <ResumenMesCard huchas={huchas} />

      {/* Hay datos pero la última recarga falló: se enseñan los que había. */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>No se pudieron actualizar los datos: {error}</AlertDescription>
        </Alert>
      )}

      {huchas.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-background px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <PiggyBank className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="font-medium">Todavía no tienes ninguna hucha</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Crea una para tu fondo de emergencia o una inversión, o para reunir el dinero de un
              pago futuro, como un regalo o el coche.
            </p>
          </div>
          <Button onClick={() => setCreando(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear mi primera hucha
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card decoration="top" decorationColor="emerald">
              <Text>Tu ahorro</Text>
              <Metric className="tabular-nums">{formatEuro(resumen.tuAhorro)}</Metric>
              <Text className="mt-1">
                en {resumen.deAhorro.length} {resumen.deAhorro.length === 1 ? "hucha" : "huchas"}
              </Text>
            </Card>

            <Card decoration="top" decorationColor="amber">
              <Text>Apartado para pagos</Text>
              <Metric className="tabular-nums">{formatEuro(resumen.apartado)}</Metric>
              <Text className="mt-1">
                {pendientes === 0
                  ? "ningún pago pendiente"
                  : `${pendientes} ${pendientes === 1 ? "pago pendiente" : "pagos pendientes"}`}
              </Text>
            </Card>

            <Card>
              <Text>Progreso de tu ahorro</Text>
              {resumen.progresoAhorro === null ? (
                <>
                  <Metric>—</Metric>
                  <Text className="mt-1">ninguna hucha de ahorro tiene objetivo</Text>
                </>
              ) : (
                <>
                  <Metric className="tabular-nums">{formatPorcentaje(resumen.progresoAhorro)}</Metric>
                  <ProgressBar value={resumen.progresoAhorro} color="emerald" className="mt-3" />
                </>
              )}
            </Card>
          </div>

          {resumen.deAhorro.length > 0 && (
            <SeccionHuchas id="titulo-ahorro" titulo="Tus huchas" huchas={resumen.deAhorro} bancos={listaBancos} />
          )}
          {resumen.paraPagar.length > 0 && (
            <SeccionHuchas id="titulo-pagar" titulo="Para pagar" huchas={resumen.paraPagar} bancos={listaBancos} />
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {resumen.distribucion.length > 1 && (
              <Card>
                <Title>Distribución de tu ahorro</Title>
                <DonutChart
                  className="mt-4 h-48"
                  data={resumen.distribucion}
                  category="saldo"
                  index="nombre"
                  colors={colores}
                  valueFormatter={formatEuro}
                  showAnimation={false}
                />
                <Legend
                  className="mt-4"
                  categories={resumen.distribucion.map((d) => d.nombre)}
                  colors={colores}
                />
              </Card>
            )}

            <PorBancoCard porBanco={porBanco} bancos={listaBancos} />
          </div>

          {resumen.pagadas.length > 0 && (
            <details className="group rounded-lg border bg-background">
              <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                Pagadas ({resumen.pagadas.length})
              </summary>
              <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
                {resumen.pagadas.map((h) => (
                  <HuchaCard key={h.id} hucha={h} />
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <HuchaFormDialog
        open={creando}
        onOpenChange={setCreando}
        bancos={listaBancos}
        onGuardada={() => void recargar()}
      />
    </div>
  )
}

function SeccionHuchas({
  id,
  titulo,
  huchas,
  bancos,
}: {
  id: string
  titulo: string
  huchas: Hucha[]
  bancos: Banco[]
}) {
  return (
    <section className="space-y-3" aria-labelledby={id}>
      <h3 id={id} className="text-base font-semibold">
        {titulo}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {huchas.map((h) => (
          <HuchaCard key={h.id} hucha={h} banco={bancos.find((b) => b.id === h.banco_id)} />
        ))}
      </div>
    </section>
  )
}

/** Dónde está guardado cada euro: saldo activo agrupado por banco. */
function PorBancoCard({
  porBanco,
  bancos,
}: {
  porBanco: ReturnType<typeof saldoPorBanco>
  bancos: Banco[]
}) {
  if (porBanco.every((b) => b.bancoId === null)) return null

  const total = porBanco.reduce((acc, b) => acc + b.total, 0)

  return (
    <Card>
      <Title>Por banco</Title>
      <div className="mt-4 space-y-2.5">
        {porBanco.map((b) => {
          const banco = bancos.find((x) => x.id === b.bancoId)
          const pct = total > 0 ? (b.total * 100) / total : 0
          return (
            <div key={b.bancoId ?? "sin-banco"} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-1.5">
                  <PuntoColor color={banco?.color ?? "gray"} />
                  <span className="truncate">{banco?.nombre ?? "Sin banco"}</span>
                </span>
                <span className="shrink-0 tabular-nums text-tremor-content-strong">{formatEuro(b.total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", banco ? PUNTO_COLOR[banco.color] : "bg-gray-400")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
