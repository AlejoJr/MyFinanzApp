import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { isAuthApiError, type Session, type User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { traducirErrorAuth } from "@/lib/auth-errors"

export interface ResultadoRegistro {
  /** true si Supabase exige confirmar el email antes de poder entrar. */
  necesitaConfirmacion: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** true mientras se restaura la sesion guardada. Evita parpadeos al recargar. */
  cargando: boolean
  entrar: (email: string, password: string) => Promise<void>
  registrar: (email: string, password: string) => Promise<ResultadoRegistro>
  salir: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      // IMPORTANTE: nada asincrono aqui dentro. Llamar a otro metodo del
      // cliente de Supabase dentro de este callback bloquea su lock interno
      // y la app se queda colgada. Solo actualizamos estado.
      if (!activo) return
      setSession(nuevaSesion)
      setCargando(false)
    })

    // onAuthStateChange ya emite INITIAL_SESSION al suscribirse, pero
    // getSession() nos cubre por si ese evento no llegase.
    void supabase.auth.getSession().then(({ data }) => {
      if (!activo) return
      setSession(data.session)
      setCargando(false)
    })

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  const entrar = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(traducirErrorAuth(error))
  }, [])

  const registrar = useCallback(
    async (email: string, password: string): Promise<ResultadoRegistro> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (error) throw new Error(traducirErrorAuth(error))

      // Con "Confirm email" ACTIVADO y el email ya registrado, Supabase no da
      // error: devuelve un usuario con identities vacio para no revelar que
      // esa cuenta existe. Sin este control veriamos un alta falsa.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error("Ya existe una cuenta con ese email. Prueba a iniciar sesión.")
      }

      // Sin sesion => Supabase espera la confirmacion por email.
      return { necesitaConfirmacion: data.session === null }
    },
    [],
  )

  const salir = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    // Si la sesion ya no existia en el servidor (expirada, cerrada en otro
    // dispositivo) el objetivo ya esta cumplido: no es un error para el usuario.
    if (error && !(isAuthApiError(error) && [401, 403, 404].includes(error.status ?? 0))) {
      throw new Error(traducirErrorAuth(error))
    }
    setSession(null)
  }, [])

  const valor = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, cargando, entrar, registrar, salir }),
    [session, cargando, entrar, registrar, salir],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth() debe usarse dentro de <AuthProvider>")
  return ctx
}
