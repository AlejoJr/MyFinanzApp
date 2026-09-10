import { useMemo, useState } from "react"
import { Card, DonutChart, Legend, Metric, ProgressBar, Text, Title } from "@tremor/react"
import { AlertCircle, PiggyBank, Plus, RefreshCw } from "lucide-react"
import { HuchaCard } from "@/components/huchas/HuchaCard"
import { HuchaFormDialog } from "@/components/huchas/HuchaFormDialog"
import { PALETA_GRAFICOS } from "@/components/huchas/estilos"
import { Cargando } from "@/components/layout/Cargando"
import { ResumenMesCard } from "@/components/presupuesto/ResumenMesCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useHuchas } from "@/hooks/useHuchas"
import { formatEuro, formatPorcentaje } from "@/lib/format"
import type { Hucha } from "@/types/domain"

function calcularResumen(huchas: Hucha[]) {
  const saldoTotal = huchas.reduce((acc, h) => acc + h.saldo_actual, 0)
  const conObjetivo = huchas.filter((h) => h.objetivo > 0)
  const objetivoTotal = conObjetivo.reduce((acc, h) => acc + h.objetivo, 0)
  // Cada hucha aporta como mucho su objetivo: que una se pase de su meta no
  // debe tapar que otra va atrasada.
  const ahorradoHaciaObjetivo = conObjetivo.reduce(
    (acc, h) => acc + Math.min(h.saldo_actual, h.objetivo),
    0,
  )
  const progresoGlobal = objetivoTotal > 0 ? (ahorradoHaciaObjetivo / objetivoTotal) * 100 : null
  const distribucion = huchas
    .filter((h) => h.saldo_actual > 0)
    .map((h) => ({ nombre: h.nombre, saldo: h.saldo_actual }))
  return { saldoTotal, objetivoTotal, progresoGlobal, distribucion }
}

export default function Dashboard() {
  const { datos: huchas, cargando, error, recargar } = useHuchas()
  const [creando, setCreando] = useState(false)
  const resumen = useMemo(() => calcularResumen(huchas ?? []), [huchas])

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

      <ResumenMesCard />

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
              Crea una para tu fondo de emergencia, una inversión o la entrada de un piso, y ve
              registrando lo que ahorras.
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
              <Text>Saldo total</Text>
              <Metric className="tabular-nums">{formatEuro(resumen.saldoTotal)}</Metric>
              <Text className="mt-1">
                en {huchas.length} {huchas.length === 1 ? "hucha" : "huchas"}
              </Text>
            </Card>

            <Card>
              <Text>Objetivo total</Text>
              <Metric className="tabular-nums">
                {resumen.objetivoTotal > 0 ? formatEuro(resumen.objetivoTotal) : "—"}
              </Metric>
              <Text className="mt-1">suma de las metas definidas</Text>
            </Card>

            <Card>
              <Text>Progreso global</Text>
              {resumen.progresoGlobal === null ? (
                <>
                  <Metric>—</Metric>
                  <Text className="mt-1">ninguna hucha tiene objetivo</Text>
                </>
              ) : (
                <>
                  <Metric className="tabular-nums">
                    {formatPorcentaje(resumen.progresoGlobal)}
                  </Metric>
                  <ProgressBar value={resumen.progresoGlobal} color="emerald" className="mt-3" />
                </>
              )}
            </Card>
          </div>

          <section className="space-y-3" aria-labelledby="titulo-huchas">
            <h3 id="titulo-huchas" className="text-base font-semibold">
              Tus huchas
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {huchas.map((h) => (
                <HuchaCard key={h.id} hucha={h} />
              ))}
            </div>
          </section>

          {resumen.distribucion.length > 1 && (
            <Card className="lg:max-w-xl">
              <Title>Distribución del saldo</Title>
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
        </>
      )}

      <HuchaFormDialog
        open={creando}
        onOpenChange={setCreando}
        onGuardada={() => void recargar()}
      />
    </div>
  )
}
