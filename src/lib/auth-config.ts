/**
 * Configuración pública de Supabase Auth. La usamos para saber si el
 * registro de cuentas nuevas está abierto y ocultar «Regístrate» cuando no
 * lo está. Así la única fuente de verdad es la opción de Supabase, sin una
 * variable de entorno aparte. (Aunque la app mostrase el formulario,
 * Supabase rechazaría el alta igualmente.)
 */
let consulta: Promise<boolean> | null = null

export function registroAbierto(): Promise<boolean> {
  consulta ??= fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((ajustes: { disable_signup?: boolean }) => ajustes.disable_signup !== true)
    // Si no se puede consultar, se muestra: al registrarse decide el servidor.
    .catch(() => true)
  return consulta
}
