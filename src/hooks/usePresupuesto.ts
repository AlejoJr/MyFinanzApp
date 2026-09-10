import { listarPagos, listarPartidas } from "@/lib/api-presupuesto"
import { crearMes } from "@/lib/presupuesto"
import { useConsulta } from "./useConsulta"

/**
 * Todas las partidas (son pocas: las filas de tu Excel) y los meses
 * marcados de un año.
 */
export const usePresupuesto = (anio: number) =>
  useConsulta(async () => {
    const [partidas, pagos] = await Promise.all([
      listarPartidas(),
      listarPagos(crearMes(anio, 1), crearMes(anio, 12)),
    ])
    // anio viaja con los datos: al cambiar de año, los que siguen en pantalla
    // mientras llega la respuesta son de otro año y no deben mezclarse.
    return { anio, partidas, pagos }
  }, [anio])
