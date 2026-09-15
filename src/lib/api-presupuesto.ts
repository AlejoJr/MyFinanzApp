import { supabase } from "./supabase"
import { fallo } from "./api"
import type { Mes } from "./presupuesto"
import type { Database } from "@/types/database"
import type { Frecuencia, PagoPartida, Partida, TipoPartida } from "@/types/domain"

const aPartida = (r: Database["public"]["Tables"]["partidas"]["Row"]): Partida => ({
  ...r,
  importe: Number(r.importe),
})

export interface DatosPartida {
  tipo: TipoPartida
  concepto: string
  importe: number
  frecuencia: Frecuencia
  mes_inicio: Mes
  mes_fin: Mes | null
  hucha_id: string | null
  /** Detalle opcional (aseguradora, nº de póliza, qué cubre...). Omitido = sin descripción. */
  descripcion?: string | null
}

// Las mismas reglas que las CHECK de 0005 y 0010: así el error no llega a
// la base de datos por un campo que ni siquiera se ve en el formulario.
const normalizar = (d: DatosPartida) => ({
  ...d,
  concepto: d.concepto.trim(),
  mes_fin: d.frecuencia === "puntual" ? null : d.mes_fin,
  hucha_id: d.tipo === "ahorro" ? d.hucha_id : null,
  descripcion: d.descripcion?.trim() || null,
})

export async function listarPartidas(): Promise<Partida[]> {
  const { data, error } = await supabase
    .from("partidas")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) fallo(error)
  return (data ?? []).map(aPartida)
}

export async function crearPartida(datos: DatosPartida): Promise<Partida> {
  const { data, error } = await supabase
    .from("partidas")
    .insert(normalizar(datos))
    .select()
    .single()
  if (error) fallo(error)
  return aPartida(data)
}

/** Corrige la partida en todos sus meses (para cambiar solo desde un mes, cambiarImporteDesde). */
export async function actualizarPartida(id: string, datos: DatosPartida): Promise<Partida> {
  const { data, error } = await supabase
    .from("partidas")
    .update(normalizar(datos))
    .eq("id", id)
    .select()
    .single()
  if (error) fallo(error)
  return aPartida(data)
}

/** Borra la partida y sus meses marcados; las aportaciones a huchas se deshacen. */
export async function eliminarPartida(id: string): Promise<void> {
  const { data, error } = await supabase.from("partidas").delete().eq("id", id).select("id")
  if (error) fallo(error)
  if (!data?.length) throw new Error("Esta partida no existe o ya se había borrado.")
}

/**
 * Nuevo importe a partir de `desde`, sin tocar los meses anteriores. Lo hace
 * una función de Postgres (0006) en una sola transacción.
 */
export async function cambiarImporteDesde(id: string, desde: Mes, importe: number): Promise<string> {
  const { data, error } = await supabase.rpc("cambiar_importe_partida", {
    p_partida: id,
    p_desde: desde,
    p_importe: importe,
  })
  if (error) fallo(error)
  return data
}

export async function listarPagos(desde: Mes, hasta: Mes): Promise<PagoPartida[]> {
  const { data, error } = await supabase
    .from("pagos_partida")
    .select("*")
    .gte("mes", desde)
    .lte("mes", hasta)
  if (error) fallo(error)
  return data ?? []
}

/** Si la partida es de ahorro con hucha, Postgres crea además el ingreso en la hucha. */
export async function marcarHecho(partidaId: string, mes: Mes): Promise<PagoPartida> {
  const { data, error } = await supabase
    .from("pagos_partida")
    .insert({ partida_id: partidaId, mes })
    .select()
    .single()
  if (error) fallo(error)
  return data
}

/** Deshace la marca y, si la hubo, la aportación a la hucha. */
export async function desmarcar(pagoId: string): Promise<void> {
  const { data, error } = await supabase.from("pagos_partida").delete().eq("id", pagoId).select("id")
  if (error) fallo(error)
  if (!data?.length) throw new Error("Ese mes ya no estaba marcado.")
}
