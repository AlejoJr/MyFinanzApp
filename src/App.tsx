import { Card, Metric, ProgressBar, Text } from "@tremor/react"
import { formatEuro } from "@/lib/format"
import { progresoHucha } from "@/types/domain"

/**
 * Placeholder del paso 1: solo verifica que Vite, Tailwind, shadcn y Tremor
 * compilan y pintan juntos. Se sustituye por el router en el paso 3.
 */
export default function App() {
  const demo = { nombre: "Fondo de emergencia", saldo_actual: 3200, objetivo: 6000 }
  const progreso = progresoHucha(demo)

  return (
    <main className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">MyFinanzApp</h1>
          <p className="text-sm text-muted-foreground">Stack operativo. Listo para el paso 2.</p>
        </header>

        <Card decoration="top" decorationColor="emerald">
          <Text>{demo.nombre}</Text>
          <Metric>{formatEuro(demo.saldo_actual)}</Metric>
          <ProgressBar value={progreso} color="emerald" className="mt-4" />
          <Text className="mt-2">
            {progreso.toFixed(0)} % de {formatEuro(demo.objetivo)}
          </Text>
        </Card>
      </div>
    </main>
  )
}
