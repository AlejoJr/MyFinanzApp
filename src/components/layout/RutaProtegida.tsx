import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Cargando } from "./Cargando"

/**
 * Envuelve las rutas que exigen sesion. Mientras se restaura la sesion
 * guardada muestra el spinner: si redirigiesemos ya, al recargar cualquier
 * pantalla el usuario saldria disparado al login durante un instante.
 */
export function RutaProtegida() {
  const { session, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <Cargando texto="Comprobando tu sesión…" />

  if (!session) {
    // Guardamos a donde iba para devolverlo ahi despues de entrar.
    return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  }

  return <Outlet />
}
