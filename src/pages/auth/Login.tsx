import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { useRegistroAbierto } from "@/hooks/useRegistroAbierto"
import { AuthLayout } from "./AuthLayout"

export default function Login() {
  const { entrar } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Con el registro cerrado en Supabase, no se ofrece crear cuenta.
  const registroAbierto = useRegistroAbierto()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await entrar(email, password)
      // Vuelve a donde intentaba ir antes de que le pidieramos login.
      const desde = (location.state as { desde?: string } | null)?.desde
      navigate(desde ?? "/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.")
      setEnviando(false)
    }
    // Si va bien no reactivamos el boton: el componente se desmonta al navegar.
  }

  return (
    <AuthLayout
      titulo="Inicia sesión"
      descripcion="Accede a tus huchas y a tu presupuesto."
      pie={
        registroAbierto ? (
          <>
            ¿Aún no tienes cuenta?{" "}
            <Link to="/registro" className="font-medium text-primary hover:underline">
              Regístrate
            </Link>
          </>
        ) : null
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={enviando}
          />
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthLayout>
  )
}
