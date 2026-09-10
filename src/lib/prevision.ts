import { indexarPagos, mesesEntre, partidaAplica, sumarMeses, type Mes } from "./presupuesto"
import type { Hucha, PagoPartida, Partida } from "@/types/domain"

/**
 * Previsión: cuánto habrá en cada hucha si se cumple lo planificado en el
 * presupuesto. Sin rentabilidad ni imprevistos: solo el dinero que se
 * aporta. Las cuentas van en céntimos para no arrastrar errores de coma
 * flotante.
 */

export const MESES_PREVISION = 12

export interface FilaPrevision {
  /** null: aportaciones de ahorro del presupuesto que no van a ninguna hucha. */
  hucha: Hucha | null
  /** saldos[0] = hoy; saldos[k] = al terminar el k-ésimo mes, contando el actual. */
  saldos: number[]
  /** Primer mes en que se alcanza el objetivo; "ya" si ya está cumplido. */
  objetivoEn: Mes | "ya" | null
  /** Solo "Para pagar": mes en que se paga, si cae dentro de la previsión. */
  pagoEn: Mes | null
}

export interface Prevision {
  /** meses[0] = mes actual (hoy); meses[k] = mes que termina en el punto k. */
  meses: Mes[]
  ahorro: FilaPrevision[]
  paraPagar: FilaPrevision[]
  /** "Tu ahorro" (huchas de ahorro + ahorro sin hucha) en cada punto. */
  totalAhorro: number[]
  totalParaPagar: number[]
}

const aCentimos = (n: number) => Math.round(n * 100)

export function calcularPrevision(
  huchas: Hucha[],
  partidas: Partida[],
  pagos: PagoPartida[],
  mesHoy: Mes,
  horizonte: number = MESES_PREVISION,
): Prevision {
  const indice = indexarPagos(pagos)
  const ahorroPlanificado = partidas.filter((p) => p.tipo === "ahorro")
  const meses = Array.from({ length: horizonte + 1 }, (_, k) => sumarMeses(mesHoy, Math.max(0, k - 1)))

  /** Saldos (en céntimos) mes a mes. Si se paga, queda a 0 al terminar ese mes. */
  function proyectar(inicial: number, aportaciones: Partida[], seQuedaA0Tras: Mes | null): number[] {
    const saldos = [inicial]
    let saldo = inicial
    for (let k = 0; k < horizonte; k++) {
      const mes = sumarMeses(mesHoy, k)
      for (const p of aportaciones) {
        if (!partidaAplica(p, mes)) continue
        // Lo de este mes que ya está marcado ya está en el saldo: no se cuenta dos veces.
        if (mes === mesHoy && indice.has(`${p.id}|${mesHoy}`)) continue
        saldo += aCentimos(p.importe)
      }
      saldos.push(saldo)
      if (mes === seQuedaA0Tras) saldo = 0
    }
    return saldos
  }

  function fila(h: Hucha): FilaPrevision {
    const pagoEn =
      h.finalidad === "pago" &&
      h.fecha_limite !== null &&
      h.fecha_limite >= mesHoy &&
      mesesEntre(mesHoy, h.fecha_limite) < horizonte
        ? h.fecha_limite
        : null
    const centimos = proyectar(
      aCentimos(h.saldo_actual),
      ahorroPlanificado.filter((p) => p.hucha_id === h.id),
      pagoEn,
    )

    let objetivoEn: FilaPrevision["objetivoEn"] = null
    const objetivo = aCentimos(h.objetivo)
    if (objetivo > 0) {
      if (centimos[0]! >= objetivo) objetivoEn = "ya"
      else {
        const k = centimos.findIndex((c, i) => i > 0 && c >= objetivo)
        if (k > 0) objetivoEn = meses[k]!
      }
    }
    return { hucha: h, saldos: centimos.map((c) => c / 100), objetivoEn, pagoEn }
  }

  const activas = huchas.filter((h) => !h.pagada_at)
  const ahorro = activas.filter((h) => h.finalidad === "ahorro").map(fila)
  const paraPagar = activas.filter((h) => h.finalidad === "pago").map(fila)

  // Ahorro planificado que no va a ninguna hucha (p. ej. «Libres»): empieza en 0.
  const sinHucha = proyectar(0, ahorroPlanificado.filter((p) => p.hucha_id === null), null)
  if (sinHucha.some((c) => c > 0)) {
    ahorro.push({ hucha: null, saldos: sinHucha.map((c) => c / 100), objetivoEn: null, pagoEn: null })
  }

  const sumarPuntos = (filas: FilaPrevision[]) =>
    meses.map((_, k) => filas.reduce((acc, f) => acc + aCentimos(f.saldos[k] ?? 0), 0) / 100)

  return {
    meses,
    ahorro,
    paraPagar,
    totalAhorro: sumarPuntos(ahorro),
    totalParaPagar: sumarPuntos(paraPagar),
  }
}
