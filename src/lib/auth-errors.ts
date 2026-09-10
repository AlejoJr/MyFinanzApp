import { AuthError, isAuthApiError } from "@supabase/supabase-js"

/**
 * Supabase devuelve los errores de Auth en ingles. Traducimos por `code`
 * (estable) y solo caemos al texto del mensaje como ultimo recurso, porque
 * la redaccion cambia entre versiones.
 */
const POR_CODIGO: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed:
    "Tu email aún no está confirmado. Revisa tu bandeja de entrada (y la carpeta de spam).",
  user_already_exists: "Ya existe una cuenta con ese email. Prueba a iniciar sesión.",
  email_exists: "Ya existe una cuenta con ese email. Prueba a iniciar sesión.",
  weak_password: "La contraseña es demasiado débil. Usa al menos 6 caracteres.",
  validation_failed: "Revisa los datos: hay algún campo con formato incorrecto.",
  over_request_rate_limit:
    "Demasiados intentos seguidos. Espera un minuto y vuelve a probarlo.",
  over_email_send_rate_limit:
    "Se han enviado demasiados emails. Espera unos minutos antes de reintentarlo.",
  signup_disabled: "El registro está desactivado en este proyecto de Supabase.",
  email_provider_disabled:
    "El acceso por email y contraseña está desactivado en Supabase (Authentication → Providers → Email).",
  same_password: "La contraseña nueva tiene que ser distinta de la actual.",
}

const POR_MENSAJE: [RegExp, string][] = [
  [/invalid login credentials/i, "Email o contraseña incorrectos."],
  [/email not confirmed/i, "Tu email aún no está confirmado. Revisa tu bandeja de entrada."],
  [/user already registered|already been registered/i, "Ya existe una cuenta con ese email."],
  [/password should be at least (\d+)/i, "La contraseña debe tener al menos $1 caracteres."],
  [/unable to validate email address/i, "El email no tiene un formato válido."],
  [/signups not allowed|signup is disabled/i, "El registro está desactivado en Supabase."],
  [/rate limit/i, "Demasiados intentos seguidos. Espera un momento y reinténtalo."],
]

export function traducirErrorAuth(error: unknown): string {
  if (error instanceof AuthError) {
    if (error.code && POR_CODIGO[error.code]) return POR_CODIGO[error.code]!

    for (const [patron, texto] of POR_MENSAJE) {
      const m = error.message.match(patron)
      if (m) return texto.replace("$1", m[1] ?? "")
    }

    // Fallo de red: el navegador no llegó a hablar con Supabase.
    if (!isAuthApiError(error)) {
      return "No se pudo conectar con el servidor. Comprueba tu conexión a internet."
    }
    return error.message
  }

  if (error instanceof Error) return error.message
  return "Ha ocurrido un error inesperado."
}
