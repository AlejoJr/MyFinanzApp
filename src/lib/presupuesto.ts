import type { Hucha, PagoPartida, Partida } from "@/types/domain"

/**
 * Logica pura del presupuesto mensual (sin red ni React), para poder
 * probarla sola. Un mes se representa como "YYYY-MM-01", igual que en
 * Postgres, y asi las comparaciones de texto ordenan bien los meses.
 */
export type Mes = string

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

export function mesDe(fecha: Date): Mes {
  const mm = String(fecha.getMonth() + 1).padStart(2, "0")
  return `${fecha.getFullYear()}-${mm}-01`
}

/** Mes en curso en hora local (la base de datos usa la hora de España). */
export const mesActual = (): Mes => mesDe(new Date())

export const anioDe = (mes: Mes): number => Number(mes.slice(0, 4))
export const numMesDe = (mes: Mes): number => Number(mes.slice(5, 7))

export function crearMes(anio: number, numMes: number): Mes {
  return `${anio}-${String(numMes).padStart(2, "0")}-01`
}

export function sumarMeses(mes: Mes, n: number): Mes {
  const total = anioDe(mes) * 12 + (numMesDe(mes) - 1) + n
  return crearMes(Math.floor(total / 12), (total % 12) + 1)
}

/** Meses de diferencia: mesesEntre("2026-01-01", "2026-03-01") === 2. */
export function mesesEntre(desde: Mes, hasta: Mes): number {
  return (anioDe(hasta) - anioDe(desde)) * 12 + (numMesDe(hasta) - numMesDe(desde))
}

export const mesesDelAnio = (anio: number): Mes[] =>
  Array.from({ length: 12 }, (_, i) => crearMes(anio, i + 1))

/** "septiembre 2026", o solo "sep" / "septiembre" según el formato. */
export function nombreMes(mes: Mes, formato: "largo" | "mes" | "corto" = "largo"): string {
  const nombre = NOMBRES_MES[numMesDe(mes) - 1] ?? ""
  if (formato === "corto") return nombre.slice(0, 3)
  if (formato === "mes") return nombre
  return `${nombre} ${anioDe(mes)}`
}

/** Misma regla que public.partida_aplica en Postgres (0006). */
export function partidaAplica(
  p: Pick<Partida, "frecuencia" | "mes_inicio" | "mes_fin">,
  mes: Mes,
): boolean {
  if (mes < p.mes_inicio) return false
  if (p.mes_fin && mes > p.mes_fin) return false
  switch (p.frecuencia) {
    case "mensual":
      return true
    case "anual":
      return numMesDe(mes) === numMesDe(p.mes_inicio)
    case "puntual":
      return mes === p.mes_inicio
  }
}

/** "3/7" para una partida mensual con fin (plazos); null si no aplica. */
export function cuota(
  p: Pick<Partida, "frecuencia" | "mes_inicio" | "mes_fin">,
  mes: Mes,
): { actual: number; total: number } | null {
  if (p.frecuencia !== "mensual" || !p.mes_fin) return null
  return { actual: mesesEntre(p.mes_inicio, mes) + 1, total: mesesEntre(p.mes_inicio, p.mes_fin) + 1 }
}

// Los importes se suman en céntimos: 0,10 + 0,20 tiene que dar 0,30.
const aCentimos = (n: number) => Math.round(n * 100)

/**
 * Bloques del presupuesto. "pago" no es un tipo de partida: es una partida
 * de ahorro cuya hucha es "Para pagar" (el regalo, el coche...). Ese dinero
 * se aparta igual que el ahorro, pero no es tuyo: ya tiene destino.
 */
export const GRUPOS = ["ingreso", "gasto", "ahorro", "pago"] as const
export type Grupo = (typeof GRUPOS)[number]

export const TITULO_GRUPO: Record<Grupo, string> = {
  ingreso: "Ingresos",
  gasto: "Gastos",
  ahorro: "Ahorro",
  pago: "Para pagos",
}

/** Ids de las huchas "Para pagar", también las ya pagadas (su historial sigue siendo un pago). */
export const huchasParaPagar = (huchas: Pick<Hucha, "id" | "finalidad">[]): ReadonlySet<string> =>
  new Set(huchas.filter((h) => h.finalidad === "pago").map((h) => h.id))

const NINGUNA: ReadonlySet<string> = new Set()

export function grupoDe(p: Pick<Partida, "tipo" | "hucha_id">, huchasPago: ReadonlySet<string>): Grupo {
  return p.tipo === "ahorro" && p.hucha_id !== null && huchasPago.has(p.hucha_id) ? "pago" : p.tipo
}

export interface LineaMes {
  partida: Partida
  /** Pago del mes, o null si aún no está marcado como hecho. */
  pago: PagoPartida | null
}

export interface ResumenMes {
  mes: Mes
  ingresos: number
  gastos: number
  ahorro: number
  paraPagos: number
  /** ingresos - gastos - ahorro - paraPagos: lo que queda del sueldo. */
  libre: number
  lineas: Record<Grupo, LineaMes[]>
  hechas: number
  total: number
}

/** Clave de fila: Internet 72 € y su continuación a 34 € son la misma fila. */
const claveConcepto = (p: Pick<Partida, "tipo" | "concepto">) =>
  `${p.tipo}|${p.concepto.trim().toLowerCase()}`

/**
 * Orden estable de las filas: por la primera vez que se creó cada concepto.
 * Así, al cambiar un importe la fila no salta al final de la lista.
 */
export function ordenarPartidas(partidas: Partida[]): Partida[] {
  const primera = new Map<string, string>()
  for (const p of partidas) {
    const clave = claveConcepto(p)
    const actual = primera.get(clave)
    if (!actual || p.created_at < actual) primera.set(clave, p.created_at)
  }
  return [...partidas].sort((a, b) => {
    const pa = primera.get(claveConcepto(a)) ?? a.created_at
    const pb = primera.get(claveConcepto(b)) ?? b.created_at
    return pa === pb ? a.mes_inicio.localeCompare(b.mes_inicio) : pa.localeCompare(pb)
  })
}

const clavePago = (partidaId: string, mes: Mes) => `${partidaId}|${mes}`

export function indexarPagos(pagos: PagoPartida[]): Map<string, PagoPartida> {
  return new Map(pagos.map((p) => [clavePago(p.partida_id, p.mes), p]))
}

export function resumenMes(
  partidas: Partida[],
  pagos: PagoPartida[] | Map<string, PagoPartida>,
  mes: Mes,
  huchasPago: ReadonlySet<string> = NINGUNA,
): ResumenMes {
  const indice = pagos instanceof Map ? pagos : indexarPagos(pagos)
  const lineas: Record<Grupo, LineaMes[]> = { ingreso: [], gasto: [], ahorro: [], pago: [] }
  const centimos: Record<Grupo, number> = { ingreso: 0, gasto: 0, ahorro: 0, pago: 0 }
  let hechas = 0

  for (const partida of ordenarPartidas(partidas)) {
    if (!partidaAplica(partida, mes)) continue
    const grupo = grupoDe(partida, huchasPago)
    const pago = indice.get(clavePago(partida.id, mes)) ?? null
    lineas[grupo].push({ partida, pago })
    centimos[grupo] += aCentimos(partida.importe)
    if (pago) hechas++
  }

  return {
    mes,
    ingresos: centimos.ingreso / 100,
    gastos: centimos.gasto / 100,
    ahorro: centimos.ahorro / 100,
    paraPagos: centimos.pago / 100,
    libre: (centimos.ingreso - centimos.gasto - centimos.ahorro - centimos.pago) / 100,
    lineas,
    hechas,
    total: GRUPOS.reduce((acc, g) => acc + lineas[g].length, 0),
  }
}

export interface FilaAnio {
  clave: string
  grupo: Grupo
  concepto: string
  /** 12 celdas; cada una con las líneas que tocan ese mes (normalmente 0 o 1). */
  celdas: LineaMes[][]
}

/** La vista del Excel: una fila por concepto y una columna por mes. */
export function filasAnio(
  partidas: Partida[],
  pagos: PagoPartida[],
  anio: number,
  huchasPago: ReadonlySet<string> = NINGUNA,
): FilaAnio[] {
  const indice = indexarPagos(pagos)
  const meses = mesesDelAnio(anio)
  const filas = new Map<string, FilaAnio>()

  for (const partida of ordenarPartidas(partidas)) {
    const grupo = grupoDe(partida, huchasPago)
    const clave = `${grupo}|${partida.concepto.trim().toLowerCase()}`
    meses.forEach((mes, i) => {
      if (!partidaAplica(partida, mes)) return
      let fila = filas.get(clave)
      if (!fila) {
        fila = { clave, grupo, concepto: partida.concepto, celdas: meses.map(() => []) }
        filas.set(clave, fila)
      }
      fila.celdas[i]!.push({ partida, pago: indice.get(clavePago(partida.id, mes)) ?? null })
    })
  }
  return [...filas.values()]
}

export const sumaCelda = (celda: LineaMes[]): number =>
  celda.reduce((acc, l) => acc + aCentimos(l.partida.importe), 0) / 100
