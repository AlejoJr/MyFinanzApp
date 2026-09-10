import { lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"
import { AppShell } from "@/components/layout/AppShell"
import { RutaProtegida } from "@/components/layout/RutaProtegida"
import { RutaPublica } from "@/components/layout/RutaPublica"
import { AuthProvider } from "@/context/AuthContext"
import Login from "@/pages/auth/Login"
import Registro from "@/pages/auth/Registro"

// Las pantallas privadas arrastran Tremor y Recharts (~800 kB). Con lazy()
// el login no las descarga. El <Suspense> que las espera está en AppShell.
const Dashboard = lazy(() => import("@/pages/Dashboard"))
const HuchaDetalle = lazy(() => import("@/pages/HuchaDetalle"))

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
              <Route index element={<Dashboard />} />
              <Route path="huchas/:id" element={<HuchaDetalle />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </BrowserRouter>
  )
}
