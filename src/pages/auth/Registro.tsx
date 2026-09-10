import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertCircle, Loader2, MailCheck } from "lucide-react"
import { Cargando } from "@/components/layout/Cargando"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { useRegistroAbierto } from "@/hooks/useRegistroAbierto"
import { AuthLayout } from "./AuthLayout"

const MIN_PASSWORD = 6

export default function Registro() {
  const { registrar } = useAuth()
  const navigate = useNavigate()
  const registroAbierto = useRegistroAbierto()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [password2, setPassword2] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmarEmail, setConfirmarEmail] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validacion en cliente: evita un viaje al servidor para fallos obvios.
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`)
      return
    }
    if (password !== password2) {
      setError("Las dos contraseñas no coinciden.")
      return
    }

    setEnviando(true)
    try {
      const { necesitaConfirmacion } = await registrar(email, password)

      if (necesitaConfirmacion) {
        // "Confirm email" sigue activo en Supabase: no hay sesion todavia.
        setConfirmarEmail(true)
        setEnviando(false)
        return
      }

      // Registro inmediato: signUp ya devolvio sesion, entramos directos.
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.")
      setEnviando(false)
    }
  }

  // Mientras se consulta a Supabase: mejor esperar que enseñar un formulario
  // que un segundo después desaparece.
  if (registroAbierto === null) return <Cargando />

  if (!registroAbierto) {
    return (
      <AuthLayout
        titulo="Registro cerrado"
        descripcion="Esta app no admite cuentas nuevas."
        pie={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Ir a iniciar sesión
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Si ya tienes cuenta, entra con tu email y tu contraseña.
        </p>
      </AuthLayout>
    )
  }

  if (confirmarEmail) {
    return (
      <AuthLayout
        titulo="Revisa tu correo"
        descripcion="Te falta un último paso para activar la cuenta."
        pie={
          <Link to="/login" className="font-medium text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        }
      >
        <Alert>
          <MailCheck className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Confirma tu email</AlertTitle>
          <AlertDescription>
            Hemos enviado un enlace de confirmación a <strong>{email.trim()}</strong>. Ábrelo y
            después inicia sesión. Si no lo ves, mira en la carpeta de spam.
          </AlertDescription>
        </Alert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      titulo="Crea tu cuenta"
      descripcion="Empieza a organizar tus huchas y tu presupuesto."
      pie={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </>
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
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={enviando}
            aria-describedby="ayuda-password"
          />
          <p id="ayuda-password" className="text-xs text-muted-foreground">
            Mínimo {MIN_PASSWORD} caracteres.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password2">Repite la contraseña</Label>
          <Input
            id="password2"
            type="password"
            autoComplete="new-password"
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            disabled={enviando}
          />
        </div>

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {enviando ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>
    </AuthLayout>
  )
}
