import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import { traducirErrorDb } from "./db-errors"
import type { Database } from "@/types/database"
import type {
  FinalidadHucha,
  Hucha,
  Movimiento,
  TipoHucha,
  TipoMovimiento,
} from "@/types/domain"

type Tablas = Database["public"]["Tables"]

// PostgREST devuelve numeric como number, pero Number() lo normaliza en un
// único sitio por si algún día llegase como texto.
const aHucha = (r: Tablas["huchas"]["Row"]): Hucha => ({
  ...r,
  objetivo: Number(r.objetivo),
  saldo_actual: Number(r.saldo_actual),
})

const aMovimiento = (r: Tablas["movimientos"]["Row"]): Movimiento => ({
  ...r,
  importe: Number(r.importe),
})

/** Lanza el error de Supabase ya traducido para el usuario. */
export function fallo(error: PostgrestError): never {
  throw new Error(traducirErrorDb(error))
}

// ------------------------------------------------------------------ Huchas

export interface DatosHucha {
  nombre: string
  tipo: TipoHucha
  finalidad: FinalidadHucha
  objetivo: number
  /** Último mes para reunir el objetivo ("YYYY-MM-01"). Obligatorio en "pago", opcional en "ahorro". */
  fecha_limite: string | null
}

const normalizarHucha = (d: DatosHucha) => ({ ...d, nombre: d.nombre.trim() })

export async function listarHuchas(): Promise<Hucha[]> {
  const { data, error } = await supabase
    .from("huchas")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) fallo(error)
  return (data ?? []).map(aHucha)
}

export async function obtenerHucha(id: string): Promise<Hucha> {
  const { data, error } = await supabase.from("huchas").select("*").eq("id", id).maybeSingle()
  if (error) fallo(error)
  if (!data) throw new Error("Esta hucha no existe o ya se ha borrado.")
  return aHucha(data)
}

export async function crearHucha(datos: DatosHucha): Promise<Hucha> {
  const { data, error } = await supabase
    .from("huchas")
    .insert(normalizarHucha(datos))
    .select()
    .single()
  if (error) fallo(error)
  return aHucha(data)
}

export async function actualizarHucha(id: string, datos: DatosHucha): Promise<Hucha> {
  const { data, error } = await supabase
    .from("huchas")
    .update(normalizarHucha(datos))
    .eq("id", id)
    .select()
    .single()
  if (error) fallo(error)
  return aHucha(data)
}

/** Borra la hucha y, en cascada, todos sus movimientos. */
export async function eliminarHucha(id: string): Promise<void> {
  // .select() devuelve las filas borradas. Con RLS, borrar algo ajeno o
  // inexistente no da error: simplemente afecta a 0 filas.
  const { data, error } = await supabase.from("huchas").delete().eq("id", id).select("id")
  if (error) fallo(error)
  if (!data?.length) throw new Error("Esta hucha no existe o ya se había borrado.")
}

/**
 * Paga una hucha "Para pagar": retira todo su saldo, detiene sus
 * aportaciones del presupuesto y la archiva como pagada. Lo hace Postgres
 * (0007) en una sola transacción.
 */
export async function pagarHucha(id: string, nota?: string): Promise<void> {
  const { error } = await supabase.rpc("pagar_hucha", {
    p_hucha: id,
    p_nota: nota?.trim() || null,
  })
  if (error) fallo(error)
}

// ------------------------------------------------------------- Movimientos

export interface DatosMovimiento {
  hucha_id: string
  tipo: TipoMovimiento
  importe: number
  fecha: string
  nota: string | null
}

export async function listarMovimientos(huchaId: string): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from("movimientos")
    .select("*")
    .eq("hucha_id", huchaId)
    .order("fecha", { ascending: false })
  if (error) fallo(error)
  return (data ?? []).map(aMovimiento)
}

/** El saldo de la hucha no se toca aquí: lo recalcula un trigger en Postgres. */
export async function crearMovimiento(datos: DatosMovimiento): Promise<Movimiento> {
  const { data, error } = await supabase
    .from("movimientos")
    .insert({ ...datos, nota: datos.nota?.trim() || null })
    .select()
    .single()
  if (error) fallo(error)
  return aMovimiento(data)
}

export async function eliminarMovimiento(id: string): Promise<void> {
  const { data, error } = await supabase.from("movimientos").delete().eq("id", id).select("id")
  if (error) fallo(error)
  if (!data?.length) throw new Error("Este movimiento no existe o ya se había borrado.")
}
