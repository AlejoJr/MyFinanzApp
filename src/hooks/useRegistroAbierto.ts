import { useEffect, useState } from "react"
import { registroAbierto } from "@/lib/auth-config"

/** null mientras se consulta; después, si Supabase admite cuentas nuevas. */
export function useRegistroAbierto(): boolean | null {
  const [abierto, setAbierto] = useState<boolean | null>(null)

  useEffect(() => {
    let activo = true
    void registroAbierto().then((valor) => {
      if (activo) setAbierto(valor)
    })
    return () => {
      activo = false
    }
  }, [])

  return abierto
}
