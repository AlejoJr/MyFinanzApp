import { Link } from "react-router-dom"
import { Card, ProgressBar, Text } from "@tremor/react"
import { formatEuro, formatPorcentaje } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ETIQUETA_TIPO_HUCHA, progresoHucha, type Hucha } from "@/types/domain"
import { ESTILO_TIPO } from "./estilos"

export function HuchaCard({ hucha }: { hucha: Hucha }) {
  const estilo = ESTILO_TIPO[hucha.tipo]
  const Icono = estilo.icono
  const progreso = progresoHucha(hucha)
  const sinObjetivo = hucha.objetivo <= 0
  const completada = !sinObjetivo && hucha.saldo_actual >= hucha.objetivo

  return (
    <Link
      to={`/huchas/${hucha.id}`}
      className="group block rounded-tremor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        className="h-full transition-shadow group-hover:shadow-md"
        decoration="left"
        decorationColor={estilo.color}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              estilo.fondo,
              estilo.texto,
            )}
          >
            <Icono className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-tremor-content-strong">{hucha.nombre}</p>
            <Text>{ETIQUETA_TIPO_HUCHA[hucha.tipo]}</Text>
          </div>
        </div>

        <p className="mt-4 text-2xl font-semibold tabular-nums text-tremor-content-strong">
          {formatEuro(hucha.saldo_actual)}
        </p>

        {sinObjetivo ? (
          <Text className="mt-3">Sin objetivo definido</Text>
        ) : (
          <>
            <ProgressBar value={progreso} color={estilo.color} className="mt-3" />
            <div className="mt-2 flex justify-between gap-2 text-tremor-default text-tremor-content">
              <span>{completada ? "¡Objetivo cumplido!" : formatPorcentaje(progreso)}</span>
              <span className="tabular-nums">de {formatEuro(hucha.objetivo)}</span>
            </div>
          </>
        )}
      </Card>
    </Link>
  )
}
