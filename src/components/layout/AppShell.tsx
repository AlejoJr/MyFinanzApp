import { useState } from "react"
import { Link, Outlet } from "react-router-dom"
import { LogOut, PiggyBank } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"

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
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <PiggyBank className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>MyFinanzApp</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {/* El email ocupa demasiado en movil: solo desde sm */}
            <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground sm:inline">
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

      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  )
}
