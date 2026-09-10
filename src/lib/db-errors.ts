import type { PostgrestError } from "@supabase/supabase-js"

/**
 * Traduce los errores de la API de datos (PostgREST / Postgres) a mensajes
 * para el usuario. Las restricciones CHECK se reconocen por su nombre, que
 * Postgres genera como <tabla>_<columna>_check.
 */
export function traducirErrorDb(
  error: Pick<PostgrestError, "message" | "code"> | null | undefined,
): string {
  if (!error) return "Ha ocurrido un error inesperado."
  const code = error.code ?? ""
  const message = error.message ?? ""

  // Lo lanza el trigger movimientos_set_usuario (0003).
  if (/no existe o no te pertenece/i.test(message)) {
    return "Esa hucha no existe o no te pertenece."
  }

  if (code === "23514" || /check constraint/i.test(message)) {
    if (/huchas_saldo_no_negativo/.test(message)) {
      return "La hucha quedaría en negativo. No puedes retirar, ni borrar un ingreso, por encima del saldo disponible."
    }
    if (/importe_check/.test(message)) return "El importe tiene que ser mayor que cero."
    if (/objetivo_check/.test(message)) return "El objetivo no puede ser negativo."
    if (/(nombre|concepto)_check/.test(message)) {
      return "El nombre tiene que tener entre 1 y 80 caracteres."
    }
    if (/nota_check/.test(message)) return "La nota no puede superar los 280 caracteres."
    return "Algún dato no cumple las reglas de la base de datos."
  }

  if (code === "42501" || /row-level security/i.test(message)) {
    return "No tienes permiso para esta operación. Prueba a cerrar sesión y volver a entrar."
  }
  if (code === "22P02") return "El enlace no es válido."
  if (code === "PGRST116") return "No se ha encontrado. Puede que ya se haya borrado."
  if (/jwt/i.test(message) || code.startsWith("PGRST3")) {
    return "Tu sesión ha caducado. Vuelve a iniciar sesión."
  }
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return "No se pudo conectar con el servidor. Comprueba tu conexión a internet."
  }
  return message || "Ha ocurrido un error inesperado."
}
