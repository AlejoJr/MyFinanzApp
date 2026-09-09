const EUR = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const FECHA_CORTA = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

export const formatEuro = (valor: number) => EUR.format(valor ?? 0)

export const formatPorcentaje = (valor: number) =>
  `${valor.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`

export const formatFecha = (iso: string) => FECHA_CORTA.format(new Date(iso))

/** Fecha en formato yyyy-MM-dd para <input type="date">. */
export const aInputDate = (iso: string | Date = new Date()) => {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}
