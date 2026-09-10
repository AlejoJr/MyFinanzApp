import { Link } from "react-router-dom"
import { Card, ProgressBar, Text } from "@tremor/react"
import { ArrowRight } from "lucide-react"
import { usePresupuesto } from "@/hooks/usePresupuesto"
import { formatEuro } from "@/lib/format"
import { anioDe, mesActual, nombreMes, resumenMes } from "@/lib/presupuesto"
import { cn } from "@/lib/utils"

/** El mes en curso en el dashboard: lo que entra, lo que sale y lo que queda libre. */
export function ResumenMesCard() {
  const mes = mesActual()
  const { datos, error } = usePresupuesto(anioDe(mes))

  // Si falla, el dashboard sigue funcionando: las huchas no dependen de esto.
  if (error && !datos) return null
  if (!datos) return <Card className="h-40 animate-pulse" aria-hidden="true" />

  const r = resumenMes(datos.partidas, datos.pagos, mes)

  if (r.total === 0) {
    return (
      <Card>
        <Text className="capitalize">{nombreMes(mes)}</Text>
        <p className="mt-2 text-sm">
          Aún no tienes presupuesto.{" "}
          <Link to="/presupuesto" className="font-medium text-primary hover:underline">
            Añade tu sueldo y tus gastos fijos
          </Link>{" "}
          para ver cuánto te queda libre cada mes.
        </p>
      </Card>
    )
  }

  const cifras = [
    { titulo: "Entra", valor: r.ingresos, clase: "" },
    { titulo: "Gastos", valor: r.gastos, clase: "" },
    { titulo: "Ahorro", valor: r.ahorro, clase: "" },
    { titulo: "Libre", valor: r.libre, clase: r.libre < 0 ? "text-rose-600" : "text-emerald-700" },
  ]

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Text className="capitalize">{nombreMes(mes)}</Text>
        <Link
          to="/presupuesto"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver presupuesto
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {cifras.map((c) => (
          <div key={c.titulo}>
            <dt className="text-sm text-muted-foreground">{c.titulo}</dt>
            <dd className={cn("text-lg font-semibold tabular-nums", c.clase)}>{formatEuro(c.valor)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex justify-between text-xs text-muted-foreground">
        <span>Hecho este mes</span>
        <span className="tabular-nums">
          {r.hechas} de {r.total}
        </span>
      </div>
      <ProgressBar value={(r.hechas * 100) / r.total} color="emerald" className="mt-1" />
    </Card>
  )
}
