import type { PostgrestError } from "@supabase/supabase-js"
import { supabase } from "./supabase"
import { traducirErrorDb } from "./db-errors"
import type { Database } from "@/types/database"
import type { Hucha, Movimiento, TipoHucha, TipoMovimiento } from "@/types/domain"

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

function fallo(error: PostgrestError): never {
  throw new Error(traducirErrorDb(error))
}

// ------------------------------------------------------------------ Huchas

export interface DatosHucha {
  nombre: string
  tipo: TipoHucha
  objetivo: number
}

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
    .insert({ ...datos, nombre: datos.nombre.trim() })
    .select()
    .single()
  if (error) fallo(error)
  return aHucha(data)
}

export async function actualizarHucha(id: string, datos: DatosHucha): Promise<Hucha> {
  const { data, error } = await supabase
    .from("huchas")
    .update({ ...datos, nombre: datos.nombre.trim() })
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
