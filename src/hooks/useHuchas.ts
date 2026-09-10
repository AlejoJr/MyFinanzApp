import { listarHuchas, listarMovimientos, obtenerHucha } from "@/lib/api"
import { useConsulta } from "./useConsulta"

export const useHuchas = () => useConsulta(listarHuchas, [])

export const useHucha = (id: string) => useConsulta(() => obtenerHucha(id), [id])

export const useMovimientos = (huchaId: string) =>
  useConsulta(() => listarMovimientos(huchaId), [huchaId])
