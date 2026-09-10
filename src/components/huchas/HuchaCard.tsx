import { Link } from "react-router-dom"
import { Card, ProgressBar, Text } from "@tremor/react"
import { CheckCircle2 } from "lucide-react"
import { formatEuro, formatFecha, formatPorcentaje } from "@/lib/format"
import { nombreMes } from "@/lib/presupuesto"
import { cn } from "@/lib/utils"
import { ETIQUETA_TIPO_HUCHA, progresoHucha, type Hucha } from "@/types/domain"
import { ESTILO_TIPO } from "./estilos"

export function HuchaCard({ hucha }: { hucha: Hucha }) {
  const estilo = ESTILO_TIPO[hucha.tipo]
  const Icono = estilo.icono
  const esPago = hucha.finalidad === "pago"
  const pagada = hucha.pagada_at !== null
  const progreso = progresoHucha(hucha)
  const sinObjetivo = hucha.objetivo <= 0
  const completada = !sinObjetivo && hucha.saldo_actual >= hucha.objetivo

  const subtitulo = pagada
    ? `Pagada el ${formatFecha(hucha.pagada_at!)}`
    : esPago && hucha.fecha_limite
      ? `Hasta ${nombreMes(hucha.fecha_limite)}`
      : ETIQUETA_TIPO_HUCHA[hucha.tipo]

  return (
    <Link
      to={`/huchas/${hucha.id}`}
      className="group block rounded-tremor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className={cn("h-full transition-shadow group-hover:shadow-md", pagada && "bg-muted/40")}
        decoration="left"
        decorationColor={pagada ? "slate" : estilo.color}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              pagada ? "bg-slate-100 text-slate-500" : [estilo.fondo, estilo.texto],
            )}
          >
            <Icono className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-tremor-content-strong">{hucha.nombre}</p>
              {esPago && !pagada && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Para pagar
                </span>
              )}
            </div>
            <Text className="first-letter:uppercase">{subtitulo}</Text>
          </div>
        </div>

        {pagada ? (
          <p className="mt-4 flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            Pagada · {formatEuro(hucha.objetivo)}
          </p>
        ) : (
          <>
            <p className="mt-4 text-2xl font-semibold tabular-nums text-tremor-content-strong">
              {formatEuro(hucha.saldo_actual)}
            </p>

            {sinObjetivo ? (
              <Text className="mt-3">Sin objetivo definido</Text>
            ) : (
              <>
                <ProgressBar value={progreso} color={estilo.color} className="mt-3" />
                <div className="mt-2 flex justify-between gap-2 text-tremor-default text-tremor-content">
                  <span>
                    {completada
                      ? esPago
                        ? "¡Listo para pagar!"
                        : "¡Objetivo cumplido!"
                      : formatPorcentaje(progreso)}
                  </span>
                  <span className="tabular-nums">de {formatEuro(hucha.objetivo)}</span>
                </div>
              </>
            )}
          </>
        )}
      </Card>
    </Link>
  )
}
