import { supabase } from "./supabase"
import { fallo } from "./api"
import type { Banco, Categoria, ColorEtiqueta } from "@/types/domain"

export interface DatosEtiqueta {
  nombre: string
  color: ColorEtiqueta
}

const normalizar = (d: DatosEtiqueta) => ({ ...d, nombre: d.nombre.trim() })

// ---------------------------------------------------------------- Categorías

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from("categorias").select("*").order("nombre")
  if (error) fallo(error)
  return data ?? []
}

export async function crearCategoria(datos: DatosEtiqueta): Promise<Categoria> {
  const { data, error } = await supabase.from("categorias").insert(normalizar(datos)).select().single()
  if (error) fallo(error)
  return data
}

export async function actualizarCategoria(id: string, datos: DatosEtiqueta): Promise<Categoria> {
  const { data, error } = await supabase
    .from("categorias")
    .update(normalizar(datos))
    .eq("id", id)
    .select()
    .single()
  if (error) fallo(error)
  return data
}

/** Las partidas que la tuvieran se quedan sin categoría (ON DELETE SET NULL). */
export async function eliminarCategoria(id: string): Promise<void> {
  const { data, error } = await supabase.from("categorias").delete().eq("id", id).select("id")
  if (error) fallo(error)
  if (!data?.length) throw new Error("Esta categoría no existe o ya se había borrado.")
}

// -------------------------------------------------------------------- Bancos

export async function listarBancos(): Promise<Banco[]> {
  const { data, error } = await supabase.from("bancos").select("*").order("nombre")
  if (error) fallo(error)
  return data ?? []
}

export async function crearBanco(datos: DatosEtiqueta): Promise<Banco> {
  const { data, error } = await supabase.from("bancos").insert(normalizar(datos)).select().single()
  if (error) fallo(error)
  return data
}

export async function actualizarBanco(id: string, datos: DatosEtiqueta): Promise<Banco> {
  const { data, error } = await supabase
    .from("bancos")
    .update(normalizar(datos))
    .eq("id", id)
    .select()
    .single()
  if (error) fallo(error)
  return data
}

/** Las huchas que lo tuvieran se quedan sin banco (ON DELETE SET NULL). */
export async function eliminarBanco(id: string): Promise<void> {
  const { data, error } = await supabase.from("bancos").delete().eq("id", id).select("id")
  if (error) fallo(error)
  if (!data?.length) throw new Error("Este banco no existe o ya se había borrado.")
}
