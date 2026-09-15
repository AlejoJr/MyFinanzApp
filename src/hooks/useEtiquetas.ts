import { listarBancos, listarCategorias } from "@/lib/api-etiquetas"
import { useConsulta } from "./useConsulta"

export const useCategorias = () => useConsulta(listarCategorias, [])

export const useBancos = () => useConsulta(listarBancos, [])
