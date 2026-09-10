import { useMemo } from "react"
import {
  filasAnio,
  GRUPOS,
  mesActual,
  mesesDelAnio,
  nombreMes,
  resumenMes,
  sumaCelda,
  TITULO_GRUPO,
  type Mes,
  type ResumenMes,
} from "@/lib/presupuesto"
import { cn } from "@/lib/utils"
import type { PagoPartida, Partida } from "@/types/domain"

// Sin símbolo € en cada celda: con 12 columnas solo añade ruido, como en tu Excel.
const NUM = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })

const sumar = (valores: number[]) => valores.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100

type CampoPie = keyof Pick<ResumenMes, "ingresos" | "gastos" | "ahorro" | "paraPagos" | "libre">

/** Tu Excel dentro de la app: una fila por concepto, una columna por mes. */
export function VistaAnio({
  partidas,
  pagos,
  anio,
  huchasPago,
  onIrAMes,
}: {
  partidas: Partida[]
  pagos: PagoPartida[]
  anio: number
  /** Huchas "Para pagar": sus aportaciones van en su propio bloque. */
  huchasPago: ReadonlySet<string>
  onIrAMes: (mes: Mes) => void
}) {
  const hoy = mesActual()
  const meses = useMemo(() => mesesDelAnio(anio), [anio])
  const filas = useMemo(
    () => filasAnio(partidas, pagos, anio, huchasPago),
    [partidas, pagos, anio, huchasPago],
  )
  const resumenes = useMemo(
    () => meses.map((m) => resumenMes(partidas, pagos, m, huchasPago)),
    [partidas, pagos, meses, huchasPago],
  )

  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-background px-4 py-10 text-center text-sm text-muted-foreground">
        No hay partidas en {anio}.
      </p>
    )
  }

  const conPagos = filas.some((f) => f.grupo === "pago")
  const pie: [string, CampoPie][] = [
    ["Entra", "ingresos"],
    ["Gastos", "gastos"],
    ["Ahorro", "ahorro"],
    ...(conPagos ? ([["Para pagos", "paraPagos"]] as [string, CampoPie][]) : []),
    ["Libre", "libre"],
  ]

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[64rem] border-collapse text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted">
              <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-semibold">
                Concepto
              </th>
              {meses.map((m) => (
                <th
                  key={m}
                  scope="col"
                  className={cn("px-2 py-2 text-right font-medium", m === hoy && "text-primary")}
                >
                  <button
                    type="button"
                    onClick={() => onIrAMes(m)}
                    className="capitalize hover:underline"
                    title={`Ver ${nombreMes(m)}`}
                  >
                    {nombreMes(m, "corto")}
                  </button>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-semibold">
                Total
              </th>
            </tr>
          </thead>

          {GRUPOS.map((grupo) => {
            const filasGrupo = filas.filter((f) => f.grupo === grupo)
            if (filasGrupo.length === 0) return null
            return (
              <tbody key={grupo} className="border-b">
                <tr>
                  <th
                    colSpan={14}
                    scope="colgroup"
                    className="sticky left-0 bg-background px-3 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {TITULO_GRUPO[grupo]}
                  </th>
                </tr>
                {filasGrupo.map((fila) => (
                  <tr key={fila.clave} className="hover:bg-muted/30">
                    <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-1.5 text-left font-normal">
                      <span className="block max-w-[11rem] truncate">{fila.concepto}</span>
                    </th>
                    {fila.celdas.map((celda, i) => {
                      const hecha = celda.length > 0 && celda.every((l) => l.pago)
                      const futura = (meses[i] ?? "") > hoy
                      return (
                        <td
                          key={i}
                          className={cn(
                            "px-2 py-1.5 text-right",
                            hecha && "bg-emerald-100 text-emerald-900",
                            !hecha && futura && "text-muted-foreground",
                            celda.length === 0 && "text-muted-foreground/40",
                          )}
                        >
                          {celda.length === 0 ? "·" : NUM.format(sumaCelda(celda))}
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-right font-medium">
                      {NUM.format(sumar(fila.celdas.map(sumaCelda)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            )
          })}

          <tfoot className="bg-muted/50">
            {pie.map(([titulo, campo]) => {
              const esLibre = campo === "libre"
              const color = (v: number) => (esLibre ? (v < 0 ? "text-rose-600" : "text-emerald-700") : "")
              const total = sumar(resumenes.map((r) => r[campo]))
              return (
                <tr key={campo} className={cn(esLibre && "border-t font-semibold")}>
                  <th scope="row" className="sticky left-0 z-10 bg-muted px-3 py-1.5 text-left">
                    {titulo}
                  </th>
                  {resumenes.map((r) => (
                    <td key={r.mes} className={cn("px-2 py-1.5 text-right", color(r[campo]))}>
                      {NUM.format(r[campo])}
                    </td>
                  ))}
                  <td className={cn("px-3 py-1.5 text-right font-semibold", color(total))}>
                    {NUM.format(total)}
                  </td>
                </tr>
              )
            })}
          </tfoot>
        </table>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 ring-1 ring-emerald-300" aria-hidden="true" />
        Hecho. Pulsa un mes para verlo y marcar partidas.
      </p>
    </div>
  )
}
