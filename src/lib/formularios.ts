import { aInputDate } from "./format"

/**
 * Convierte lo que teclea el usuario en un importe. Acepta coma o punto
 * decimal ("12,5", "12.50"), el símbolo € y hasta 2 decimales.
 * Rechaza "1.000" a propósito: es ambiguo (¿mil o uno?).
 * Devuelve null si el texto no es un importe válido.
 */
export function parseImporte(texto: string): number | null {
  const limpio = texto.trim().replace(/[\s€]/g, "")
  if (!/^\d+([.,]\d{1,2})?$/.test(limpio)) return null
  const valor = Number(limpio.replace(",", "."))
  return Number.isFinite(valor) ? valor : null
}

/** Importe -> texto editable: 5000 -> "5000", 49.9 -> "49,90". */
export function importeATexto(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2).replace(".", ",")
}

/**
 * yyyy-MM-dd de un <input type="date"> -> ISO para guardar.
 * Si es hoy se guarda la hora actual, para que los movimientos del mismo día
 * mantengan su orden. Si es otro día, las 12:00 locales: así ningún desfase
 * de zona horaria lo arrastra al día anterior o al siguiente.
 */
export function fechaMovimientoISO(dia: string): string {
  if (dia === aInputDate(new Date())) return new Date().toISOString()
  const [y = 1970, m = 1, d = 1] = dia.split("-").map(Number)
  return new Date(y, m - 1, d, 12).toISOString()
}
