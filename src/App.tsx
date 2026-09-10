import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { Cargando } from "@/components/layout/Cargando"
import { RutaProtegida } from "@/components/layout/RutaProtegida"
import { RutaPublica } from "@/components/layout/RutaPublica"
import { AuthProvider } from "@/context/AuthContext"
import Login from "@/pages/auth/Login"
import Registro from "@/pages/auth/Registro"

// El dashboard arrastra Tremor y Recharts (~1 MB). Cargandolo con lazy(),
// la pantalla de login no lo descarga.
const Dashboard = lazy(() => import("@/pages/Dashboard"))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Publicas: si ya hay sesion, redirigen al dashboard */}
          <Route element={<RutaPublica />}>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
          </Route>

          {/* Privadas: exigen sesion y comparten la cabecera de AppShell */}
          <Route element={<RutaProtegida />}>
            <Route element={<AppShell />}>
              <Route
                index
                element={
                  <Suspense fallback={<Cargando className="min-h-[40vh]" />}>
                    <Dashboard />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
