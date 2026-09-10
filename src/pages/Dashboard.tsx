import { useEffect, useState } from "react"
import { Card, Metric, Text } from "@tremor/react"
import { AlertCircle, PiggyBank } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Cargando } from "@/components/layout/Cargando"
import { supabase } from "@/lib/supabase"
import { formatEuro } from "@/lib/format"
import { useAuth } from "@/context/AuthContext"
import type { Hucha } from "@/types/domain"

/**
 * Dashboard minimo del paso 3. Su trabajo aqui es demostrar la cadena
 * completa: sesion -> consulta con RLS -> datos propios del usuario.
 * El paso 4 lo sustituye por los KPI reales por hucha.
 */
export default function Dashboard() {
  const { user } = useAuth()
  const [huchas, setHuchas] = useState<Hucha[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    void (async () => {
      const { data, error } = await supabase
        .from("huchas")
        .select("*")
        .order("created_at", { ascending: false })

      if (!activo) return
      if (error) {
        setError(error.message)
        setHuchas([])
        return
      }
      setHuchas(data as Hucha[])
    })()

    return () => {
      activo = false
    }
  }, [])

  if (huchas === null && !error) return <Cargando className="min-h-[40vh]" texto="Cargando tus huchas…" />

  const total = (huchas ?? []).reduce((acc, h) => acc + Number(h.saldo_actual), 0)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Resumen</h2>
        <p className="text-sm text-muted-foreground">
          Sesión iniciada como {user?.email}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>No se pudieron cargar las huchas</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card decoration="top" decorationColor="emerald">
        <Text>Saldo total en huchas</Text>
        <Metric>{formatEuro(total)}</Metric>
        <Text className="mt-2">
          {huchas?.length ?? 0} {huchas?.length === 1 ? "hucha" : "huchas"}
        </Text>
      </Card>

      {huchas?.length === 0 && !error && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-background px-6 py-12 text-center">
          <PiggyBank className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">Todavía no tienes ninguna hucha</p>
            <p className="text-sm text-muted-foreground">
              En el siguiente paso podrás crearlas y registrar movimientos.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
