import { useCallback, useEffect, useRef, useState, type DependencyList } from "react"

export interface EstadoConsulta<T> {
  /** undefined hasta que llega la primera respuesta. */
  datos: T | undefined
  cargando: boolean
  error: string | null
  /** Vuelve a pedir los datos sin vaciar los actuales (sin parpadeo). */
  recargar: () => Promise<void>
}

/**
 * Carga datos asíncronos al montar y cada vez que cambian `deps`.
 * Descarta las respuestas que llegan tarde (de una petición anterior o de un
 * componente ya desmontado), para que una respuesta lenta no pise a una nueva.
 */
export function useConsulta<T>(
  consulta: () => Promise<T>,
  deps: DependencyList,
): EstadoConsulta<T> {
  const [datos, setDatos] = useState<T>()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const ultima = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ejecutar = useCallback(consulta, deps)

  const recargar = useCallback(async () => {
    const id = ++ultima.current
    setCargando(true)
    try {
      const resultado = await ejecutar()
      if (id !== ultima.current) return
      setDatos(resultado)
      setError(null)
    } catch (e) {
      if (id !== ultima.current) return
      setError(e instanceof Error ? e.message : "Ha ocurrido un error inesperado.")
    } finally {
      if (id === ultima.current) setCargando(false)
    }
  }, [ejecutar])

  useEffect(() => {
    void recargar()
    return () => {
      ultima.current++ // invalida la petición que siga en vuelo
    }
  }, [recargar])

  return { datos, cargando, error, recargar }
}
