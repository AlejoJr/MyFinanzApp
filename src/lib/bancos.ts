import type { Hucha } from "@/types/domain"

export interface TotalBanco {
  /** null = sin banco asignado. */
  bancoId: string | null
  total: number
}

/**
 * Suma el saldo de las huchas activas (no pagadas) agrupado por banco (las
 * sin banco quedan bajo bancoId=null). Una hucha pagada ya no tiene el
 * dinero en ningún banco: se excluye. De mayor a menor saldo.
 */
export function saldoPorBanco(huchas: Pick<Hucha, "banco_id" | "saldo_actual" | "pagada_at">[]): TotalBanco[] {
  const centimos = new Map<string | null, number>()
  for (const h of huchas) {
    if (h.pagada_at) continue
    centimos.set(h.banco_id, (centimos.get(h.banco_id) ?? 0) + Math.round(h.saldo_actual * 100))
  }
  return [...centimos.entries()]
    .map(([bancoId, c]) => ({ bancoId, total: c / 100 }))
    .sort((a, b) => b.total - a.total)
}
