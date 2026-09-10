import { indexarPagos, mesesEntre, partidaAplica, type Mes } from "./presupuesto"
import type { Hucha, PagoPartida, Partida } from "@/types/domain"

/**
 * Logica pura de las huchas "Para pagar" (el regalo, el coche...): cuánto
 * hay que apartar al mes y si se va a llegar a tiempo.
 */

/**
 * Cuota mensual para reunir `falta` en `meses`, redondeada al céntimo hacia
 * arriba para no quedarse corto: 100 € en 6 meses -> 16,67 € (100,02 €).
 */
export function cuotaMensual(falta: number, meses: number): number {
  if (falta <= 0 || meses <= 0) return 0
  return Math.ceil(Math.round(falta * 100) / meses) / 100
}

export type EstadoPago =
  | "pagada" //          ya se pagó y está archivada
  | "lista" //           ya está reunido todo: se puede pagar
  | "sin_limite" //      no tiene fecha límite: no se puede calcular cuota
  | "vencida" //         pasó la fecha límite y aún falta dinero
  | "sin_aportacion" //  tiene fecha, pero ninguna partida del presupuesto aporta
  | "retrasada" //       lo que se aporta al mes no llega a tiempo
  | "al_dia"

export interface PlanPago {
  estado: EstadoPago
  falta: number
  /** Meses que quedan para aportar, incluido el actual si aún no se ha aportado. */
  mesesRestantes: number
  /** Lo que habría que apartar cada mes desde ahora para llegar a tiempo. */
  cuotaNecesaria: number
}

export interface Aportacion {
  /** Suma de las partidas mensuales que aportan a la hucha este mes. */
  mensual: number
  /** true si la aportación de este mes ya está marcada como hecha. */
  hechaEsteMes: boolean
}

/** Lo que el presupuesto aporta a una hucha en el mes indicado. */
export function aportacionDe(
  huchaId: string,
  partidas: Partida[],
  pagos: PagoPartida[],
  mes: Mes,
): Aportacion {
  const indice = indexarPagos(pagos)
  let centimos = 0
  let hechaEsteMes = false
  for (const p of partidas) {
    if (p.hucha_id !== huchaId || p.tipo !== "ahorro" || p.frecuencia !== "mensual") continue
    if (!partidaAplica(p, mes)) continue
    centimos += Math.round(p.importe * 100)
    if (indice.has(`${p.id}|${mes}`)) hechaEsteMes = true
  }
  return { mensual: centimos / 100, hechaEsteMes }
}

export function planPago(
  hucha: Pick<Hucha, "objetivo" | "saldo_actual" | "fecha_limite" | "pagada_at">,
  mesHoy: Mes,
  aportacion: Aportacion | null,
): PlanPago {
  const falta = Math.max(0, Math.round((hucha.objetivo - hucha.saldo_actual) * 100) / 100)
  const base = { falta, mesesRestantes: 0, cuotaNecesaria: 0 }

  if (hucha.pagada_at) return { ...base, estado: "pagada" }
  if (falta <= 0) return { ...base, estado: "lista" }
  if (!hucha.fecha_limite) return { ...base, estado: "sin_limite" }

  // Si la aportación de este mes ya está hecha, este mes ya no cuenta.
  const mesesRestantes =
    mesesEntre(mesHoy, hucha.fecha_limite) + (aportacion?.hechaEsteMes ? 0 : 1)
  if (mesesRestantes <= 0) return { ...base, estado: "vencida" }

  const cuotaNecesaria = cuotaMensual(falta, mesesRestantes)
  const plan = { falta, mesesRestantes, cuotaNecesaria }
  if (!aportacion || aportacion.mensual <= 0) return { ...plan, estado: "sin_aportacion" }
  // Comparación en céntimos: 208,34 aportados cubren una cuota de 208,34.
  if (Math.round(aportacion.mensual * 100) < Math.round(cuotaNecesaria * 100)) {
    return { ...plan, estado: "retrasada" }
  }
  return { ...plan, estado: "al_dia" }
}
