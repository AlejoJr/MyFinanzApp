import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { Cargando } from "./Cargando"

/** Login y registro: si ya hay sesion, no tiene sentido mostrarlos. */
export function RutaPublica() {
  const { session, cargando } = useAuth()

  if (cargando) return <Cargando />
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}
