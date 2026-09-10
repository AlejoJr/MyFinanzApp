export const TIPOS_HUCHA = ["ahorro", "inversion", "hipoteca", "seguro", "otro"] as const
export type TipoHucha = (typeof TIPOS_HUCHA)[number]

export const TIPOS_MOVIMIENTO = ["ingreso", "retirada"] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

export const PERIODICIDADES = ["mensual", "anual", "otro"] as const
export type Periodicidad = (typeof PERIODICIDADES)[number]

export const ETIQUETA_TIPO_HUCHA: Record<TipoHucha, string> = {
  ahorro: "Ahorro",
  inversion: "Inversión",
  hipoteca: "Hipoteca",
  seguro: "Seguro",
  otro: "Otro",
}

export const ETIQUETA_PERIODICIDAD: Record<Periodicidad, string> = {
  mensual: "Mensual",
  anual: "Anual",
  otro: "Otro",
}

export interface Hucha {
  id: string
  usuario_id: string
  nombre: string
  tipo: TipoHucha
  objetivo: number
  saldo_actual: number
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

export interface GastoFijo {
  id: string
  usuario_id: string
  concepto: string
  importe: number
  periodicidad: Periodicidad
  created_at: string
}

/** Porcentaje 0-100 de progreso hacia el objetivo. objetivo <= 0 => 0. */
export function progresoHucha(hucha: Pick<Hucha, "saldo_actual" | "objetivo">): number {
  if (!hucha.objetivo || hucha.objetivo <= 0) return 0
  return Math.min(100, Math.max(0, (hucha.saldo_actual * 100) / hucha.objetivo))
}

/** Coste mensual equivalente de un gasto fijo. */
export function costeMensual(gasto: Pick<GastoFijo, "importe" | "periodicidad">): number {
  switch (gasto.periodicidad) {
    case "mensual":
      return gasto.importe
    case "anual":
      return gasto.importe / 12
    default:
      return 0
  }
}
