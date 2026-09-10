import { useMemo } from "react"
import { Link } from "react-router-dom"
import { AreaChart, Card, Metric, Text, Title } from "@tremor/react"
import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react"
import { Cargando } from "@/components/layout/Cargando"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useHuchas } from "@/hooks/useHuchas"
import { usePresupuesto } from "@/hooks/usePresupuesto"
import { formatEuro } from "@/lib/format"
import { calcularPrevision, type FilaPrevision } from "@/lib/prevision"
import { anioDe, mesActual, nombreMes, type Mes } from "@/lib/presupuesto"
import { cn } from "@/lib/utils"

const HORIZONTES = [3, 6, 9, 12] as const
const TITULO_HORIZONTE: Record<(typeof HORIZONTES)[number], string> = {
  3: "En 3 meses",
  6: "En 6 meses",
  9: "En 9 meses",
  12: "En 1 año",
}
const PUNTOS = [0, ...HORIZONTES] as const

/** "nov 26" para el eje del gráfico. */
const etiquetaCorta = (mes: Mes) => `${nombreMes(mes, "corto")} ${String(anioDe(mes)).slice(2)}`

export default function Prevision() {
  const mesHoy = mesActual()
  const huchas = useHuchas()
  // Solo hacen falta los pagos del mes en curso (para no contar dos veces lo
  // ya aportado), y esos están en el año actual.
  const presupuesto = usePresupuesto(anioDe(mesHoy))

  const prevision = useMemo(
    () =>
      huchas.datos && presupuesto.datos
        ? calcularPrevision(huchas.datos, presupuesto.datos.partidas, presupuesto.datos.pagos, mesHoy)
        : null,
    [huchas.datos, presupuesto.datos, mesHoy],
  )

  const error = huchas.error ?? presupuesto.error
  if (!prevision) {
    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>No se pudo calcular la previsión</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void Promise.all([huchas.recargar(), presupuesto.recargar()])}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )
    }
    return <Cargando className="min-h-[40vh]" texto="Calculando la previsión…" />
  }

  const { meses, ahorro, paraPagar, totalAhorro, totalParaPagar } = prevision
  const hayPagos = paraPagar.length > 0
  const sinAportaciones =
    totalAhorro.every((v) => v === totalAhorro[0]) && totalParaPagar.every((v) => v === totalParaPagar[0])

  const cabecera = (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold tracking-tight">Previsión</h2>
      <p className="text-sm text-muted-foreground">
        Cuánto tendrás si cumples lo que tienes planificado en el presupuesto.
      </p>
    </div>
  )

  if (ahorro.length === 0 && paraPagar.length === 0) {
    return (
      <div className="space-y-6">
        {cabecera}
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-background px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <TrendingUp className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            Aún no hay nada que prever. Crea una hucha desde el{" "}
            <Link to="/" className="font-medium text-primary hover:underline">
              Resumen
            </Link>{" "}
            y añade sus aportaciones en{" "}
            <Link to="/presupuesto" className="font-medium text-primary hover:underline">
              Presupuesto
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  const datosGrafico = meses.map((m, k) => ({
    mes: k === 0 ? "Hoy" : etiquetaCorta(m),
    "Tu ahorro": totalAhorro[k] ?? 0,
    ...(hayPagos ? { "Para pagos": totalParaPagar[k] ?? 0 } : {}),
  }))

  return (
    <div className="space-y-6">
      {cabecera}

      {sinAportaciones && (
        <Alert>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Tu presupuesto no tiene aportaciones de ahorro, así que la previsión no cambia. Añádelas
            en{" "}
            <Link to="/presupuesto" className="font-medium underline">
              Presupuesto
            </Link>{" "}
            o creando una hucha con fecha objetivo.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="col-span-2 p-4 lg:col-span-1" decoration="top" decorationColor="emerald">
          <Text>Hoy</Text>
          <Metric className="text-2xl tabular-nums">{formatEuro(totalAhorro[0] ?? 0)}</Metric>
          <Text className="mt-1">tu ahorro actual</Text>
        </Card>
        {HORIZONTES.map((k) => {
          const diferencia = (totalAhorro[k] ?? 0) - (totalAhorro[0] ?? 0)
          return (
            <Card key={k} className="p-4">
              <Text>{TITULO_HORIZONTE[k]}</Text>
              <Metric className="text-2xl tabular-nums">{formatEuro(totalAhorro[k] ?? 0)}</Metric>
              <Text className="mt-1">
                fin de {nombreMes(meses[k]!, "corto")}
                {diferencia > 0 && <span className="text-emerald-700"> · +{formatEuro(diferencia)}</span>}
              </Text>
            </Card>
          )
        })}
      </div>

      <Card>
        <Title>Cómo crece tu ahorro</Title>
        <AreaChart
          className="mt-4 h-64"
          data={datosGrafico}
          index="mes"
          categories={hayPagos ? ["Tu ahorro", "Para pagos"] : ["Tu ahorro"]}
          colors={hayPagos ? ["emerald", "amber"] : ["emerald"]}
          valueFormatter={formatEuro}
          yAxisWidth={80}
          showAnimation={false}
        />
      </Card>

      <section className="space-y-3" aria-labelledby="titulo-por-hucha">
        <h3 id="titulo-por-hucha" className="text-base font-semibold">
          Por hucha
        </h3>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full min-w-[40rem] border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b bg-muted">
                <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">
                  Hucha
                </th>
                {PUNTOS.map((k) => (
                  <th key={k} scope="col" className="px-3 py-2 text-right font-medium">
                    {k === 0 ? "Hoy" : TITULO_HORIZONTE[k].replace("En ", "")}
                    <span className="block text-xs font-normal capitalize text-muted-foreground">
                      {k === 0 ? "" : etiquetaCorta(meses[k]!)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <Bloque titulo="Tu ahorro" filas={ahorro} total={totalAhorro} meses={meses} />
            {hayPagos && <Bloque titulo="Para pagar" filas={paraPagar} total={totalParaPagar} meses={meses} />}
          </table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Supone que marcas cada mes todas las aportaciones previstas. No incluye rentabilidad,
        intereses ni imprevistos. Las huchas «Para pagar» se vacían al terminar su mes de pago.
      </p>
    </div>
  )
}

function Bloque({
  titulo,
  filas,
  total,
  meses,
}: {
  titulo: string
  filas: FilaPrevision[]
  total: number[]
  meses: Mes[]
}) {
  return (
    <tbody className="border-b">
      <tr>
        <th
          colSpan={PUNTOS.length + 1}
          scope="colgroup"
          className="sticky left-0 bg-background px-3 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {titulo}
        </th>
      </tr>
      {filas.map((f) => (
        <tr key={f.hucha?.id ?? "sin-hucha"} className="hover:bg-muted/30">
          <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal">
            {f.hucha ? (
              <Link to={`/huchas/${f.hucha.id}`} className="block max-w-[12rem] truncate font-medium hover:underline">
                {f.hucha.nombre}
              </Link>
            ) : (
              <span className="block max-w-[12rem] truncate font-medium">Ahorro sin hucha</span>
            )}
            <span className="block text-xs text-muted-foreground">{detalle(f)}</span>
          </th>
          {PUNTOS.map((k) => {
            const objetivo = f.hucha?.objetivo ?? 0
            const saldo = f.saldos[k] ?? 0
            const pagada = f.pagoEn !== null && meses[k]! > f.pagoEn && k > 0
            const cumplido = objetivo > 0 && saldo >= objetivo && !pagada
            return (
              <td
                key={k}
                className={cn(
                  "px-3 py-2 text-right",
                  cumplido && "bg-emerald-50 font-medium text-emerald-800",
                  pagada && "text-muted-foreground",
                )}
              >
                {pagada ? "pagado" : formatEuro(saldo)}
              </td>
            )
          })}
        </tr>
      ))}
      <tr className="bg-muted/40 font-semibold">
        <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left">
          Total
        </th>
        {PUNTOS.map((k) => (
          <td key={k} className="px-3 py-2 text-right">
            {formatEuro(total[k] ?? 0)}
          </td>
        ))}
      </tr>
    </tbody>
  )
}

/** Debajo del nombre: cuándo se alcanza el objetivo o cuándo se paga. */
function detalle(f: FilaPrevision): string {
  if (!f.hucha) return "aportaciones del presupuesto sin hucha"
  if (f.pagoEn) return `se paga en ${nombreMes(f.pagoEn)}`
  if (f.objetivoEn === "ya") return "objetivo cumplido"
  if (f.objetivoEn) return `objetivo en ${nombreMes(f.objetivoEn)}`
  if (f.hucha.objetivo > 0) return `objetivo de ${formatEuro(f.hucha.objetivo)}: más allá de 1 año`
  return "sin objetivo"
}
