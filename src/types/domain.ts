export const TIPOS_HUCHA = ["ahorro", "inversion", "hipoteca", "seguro", "otro"] as const
export type TipoHucha = (typeof TIPOS_HUCHA)[number]

export const FINALIDADES_HUCHA = ["ahorro", "pago"] as const
export type FinalidadHucha = (typeof FINALIDADES_HUCHA)[number]

export const TIPOS_MOVIMIENTO = ["ingreso", "retirada"] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

export const TIPOS_PARTIDA = ["ingreso", "gasto", "ahorro"] as const
export type TipoPartida = (typeof TIPOS_PARTIDA)[number]

export const FRECUENCIAS = ["mensual", "anual", "puntual"] as const
export type Frecuencia = (typeof FRECUENCIAS)[number]

export const ETIQUETA_TIPO_HUCHA: Record<TipoHucha, string> = {
  ahorro: "Ahorro",
  inversion: "Inversión",
  hipoteca: "Hipoteca",
  seguro: "Seguro",
  otro: "Otro",
}

export const ETIQUETA_FINALIDAD: Record<FinalidadHucha, string> = {
  ahorro: "Ahorro",
  pago: "Para pagar",
}

export const ETIQUETA_TIPO_PARTIDA: Record<TipoPartida, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  ahorro: "Ahorro",
}

/** Plural para los encabezados de cada bloque. */
export const TITULO_TIPO_PARTIDA: Record<TipoPartida, string> = {
  ingreso: "Ingresos",
  gasto: "Gastos",
  ahorro: "Ahorro",
}

export const ETIQUETA_FRECUENCIA: Record<Frecuencia, string> = {
  mensual: "Cada mes",
  anual: "Una vez al año",
  puntual: "Solo un mes",
}

export interface Hucha {
  id: string
  usuario_id: string
  nombre: string
  tipo: TipoHucha
  /**
   * ahorro: dinero tuyo que se queda.
   * pago: apartado para un pago futuro (un regalo, el coche...).
   */
  finalidad: FinalidadHucha
  objetivo: number
  saldo_actual: number
  /**
   * Último mes para reunir el objetivo ("YYYY-MM-01"). En "pago" es cuándo
   * toca pagar; en "ahorro" es opcional ("quiero 3.000 € en junio").
   */
  fecha_limite: string | null
  /** Solo "pago": null mientras está activa; fecha en que se pagó. */
  pagada_at: string | null
  created_at: string
}

export interface Movimiento {
  id: string
  hucha_id: string
  usuario_id: string
  importe: number
  tipo: TipoMovimiento
  fecha: string
  nota: string | null
}

/**
 * Linea del presupuesto (sueldo, alquiler, colchon financiero...).
 * Los meses van como "YYYY-MM-01", igual que en Postgres.
 */
export interface Partida {
  id: string
  usuario_id: string
  tipo: TipoPartida
  concepto: string
  importe: number
  frecuencia: Frecuencia
  mes_inicio: string
  mes_fin: string | null
  /** Solo en ahorro: al marcar el mes, el importe entra en esta hucha. */
  hucha_id: string | null
  created_at: string
}

/** Un mes marcado como hecho (el verde del Excel). */
export interface PagoPartida {
  id: string
  usuario_id: string
  partida_id: string
  mes: string
  /** Ingreso creado en la hucha, si la partida es de ahorro con hucha. */
  movimiento_id: string | null
  created_at: string
}

/** Porcentaje 0-100 de progreso hacia el objetivo. objetivo <= 0 => 0. */
export function progresoHucha(hucha: Pick<Hucha, "saldo_actual" | "objetivo">): number {
  if (!hucha.objetivo || hucha.objetivo <= 0) return 0
  return Math.min(100, Math.max(0, (hucha.saldo_actual * 100) / hucha.objetivo))
}
