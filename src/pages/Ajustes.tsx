import { EtiquetaSeccion } from "@/components/etiquetas/EtiquetaSeccion"
import { useCategorias, useBancos } from "@/hooks/useEtiquetas"
import {
  crearBanco,
  actualizarBanco,
  eliminarBanco,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "@/lib/api-etiquetas"

export default function Ajustes() {
  const categorias = useCategorias()
  const bancos = useBancos()

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Ajustes</h2>
        <p className="text-sm text-muted-foreground">
          Categorías para tus gastos y bancos para tus huchas.
        </p>
      </div>

      <EtiquetaSeccion
        titulo="Categorías"
        descripcion="Clasifica tus gastos (Seguros, Vivienda, Ocio…) para verlos agrupados en el presupuesto."
        singular="categoría"
        etiquetas={categorias.datos ?? []}
        cargando={categorias.datos === undefined && categorias.cargando}
        error={categorias.error}
        onCrear={async (datos) => {
          await crearCategoria(datos)
          await categorias.recargar()
        }}
        onActualizar={async (id, datos) => {
          await actualizarCategoria(id, datos)
          await categorias.recargar()
        }}
        onEliminar={async (id) => {
          await eliminarCategoria(id)
          await categorias.recargar()
        }}
      />

      <EtiquetaSeccion
        titulo="Bancos"
        descripcion="Identifica dónde está guardado el dinero de cada hucha (BBVA, Trade Republic…)."
        singular="banco"
        etiquetas={bancos.datos ?? []}
        cargando={bancos.datos === undefined && bancos.cargando}
        error={bancos.error}
        onCrear={async (datos) => {
          await crearBanco(datos)
          await bancos.recargar()
        }}
        onActualizar={async (id, datos) => {
          await actualizarBanco(id, datos)
          await bancos.recargar()
        }}
        onEliminar={async (id) => {
          await eliminarBanco(id)
          await bancos.recargar()
        }}
      />
    </div>
  )
}
