import { Suspense, useState } from "react"
import { Link, NavLink, Outlet } from "react-router-dom"
import { CalendarRange, LayoutDashboard, LogOut, PiggyBank, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { cn } from "@/lib/utils"
import { Cargando } from "./Cargando"

const NAVEGACION = [
  { to: "/", texto: "Resumen", icono: LayoutDashboard, end: true },
  { to: "/presupuesto", texto: "Presupuesto", icono: CalendarRange, end: false },
  { to: "/prevision", texto: "Previsión", icono: TrendingUp, end: false },
]

export function AppShell() {
  const { user, salir } = useAuth()
  const [saliendo, setSaliendo] = useState(false)

  const handleSalir = async () => {
    setSaliendo(true)
    try {
      await salir()
      // No navegamos a mano: al desaparecer la sesion, RutaProtegida
      // redirige sola al login.
    } finally {
      setSaliendo(false)
    }
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <PiggyBank className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>MyFinanzApp</span>
          </Link>

          {/* Escritorio: navegación en la cabecera. En el móvil va abajo. */}
          <nav aria-label="Secciones" className="hidden items-center gap-1 sm:flex">
            {NAVEGACION.map(({ to, texto, icono: Icono, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )
                }
              >
                <Icono className="h-4 w-4" aria-hidden="true" />
                {texto}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* El email ocupa demasiado: solo en pantallas grandes */}
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground lg:inline">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSalir}
              disabled={saliendo}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Abajo en el móvil hay que dejar sitio a la barra de navegación. */}
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-6">
        {/* Las paginas privadas son lazy(): la cabecera se queda fija mientras cargan. */}
        <Suspense fallback={<Cargando className="min-h-[40vh]" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Móvil: barra inferior, al alcance del pulgar. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden"
      >
        <div className="grid grid-cols-3">
          {NAVEGACION.map(({ to, texto, icono: Icono, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icono className="h-5 w-5" aria-hidden="true" />
              {texto}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
