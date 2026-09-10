import { Card, Metric, ProgressBar, Text } from "@tremor/react"
import { Check, Loader2, MoreHorizontal, Pencil, Plus, Trash2, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatEuro } from "@/lib/format"
import { cuota, type LineaMes, type ResumenMes } from "@/lib/presupuesto"
import { cn } from "@/lib/utils"
import {
  ETIQUETA_TIPO_PARTIDA,
  TIPOS_PARTIDA,
  TITULO_TIPO_PARTIDA,
  type Hucha,
  type Partida,
  type TipoPartida,
} from "@/types/domain"

interface Acciones {
  onEditar: (partida: Partida) => void
  onCambiarImporte: (partida: Partida) => void
  onEliminar: (partida: Partida) => void
}

interface Props extends Acciones {
  resumen: ResumenMes
  huchas: Hucha[]
  /** false en meses futuros: no se puede marcar lo que aún no ha pasado. */
  puedeMarcar: boolean
  /** Partida cuya marca se está guardando. */
  marcandoId: string | null
  onMarcar: (linea: LineaMes) => void
  onAnadir: (tipo: TipoPartida) => void
}

export function VistaMes({ resumen, huchas, puedeMarcar, marcandoId, onMarcar, onAnadir, ...acciones }: Props) {
  const subtotal: Record<TipoPartida, number> = {
    ingreso: resumen.ingresos,
    gasto: resumen.gastos,
    ahorro: resumen.ahorro,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi titulo="Entra" valor={resumen.ingresos} />
        <Kpi titulo="Gastos" valor={resumen.gastos} />
        <Kpi titulo="Ahorro" valor={resumen.ahorro} />
        <Kpi
          titulo="Libre"
          valor={resumen.libre}
          clase={resumen.libre < 0 ? "text-rose-600" : "text-emerald-700"}
          destacado
        />
      </div>

      {puedeMarcar && resumen.total > 0 ? (
        <Card className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Hecho este mes</span>
            <span className="tabular-nums text-muted-foreground">
              {resumen.hechas} de {resumen.total}
            </span>
          </div>
          <ProgressBar value={(resumen.hechas * 100) / resumen.total} color="emerald" className="mt-2" />
        </Card>
      ) : (
        !puedeMarcar && (
          <p className="text-sm text-muted-foreground">
            Mes futuro: podrás marcar las partidas como hechas cuando llegue.
          </p>
        )
      )}

      {TIPOS_PARTIDA.map((tipo) => {
        const lineas = resumen.lineas[tipo]
        return (
          <section key={tipo} className="space-y-2" aria-labelledby={`titulo-${tipo}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 id={`titulo-${tipo}`} className="text-base font-semibold">
                {TITULO_TIPO_PARTIDA[tipo]}
              </h3>
              <div className="flex items-center gap-1">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatEuro(subtotal[tipo])}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAnadir(tipo)}
                  aria-label={`Añadir ${ETIQUETA_TIPO_PARTIDA[tipo].toLowerCase()}`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Añadir</span>
                </Button>
              </div>
            </div>

            {lineas.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-background px-4 py-4 text-center text-sm text-muted-foreground">
                Nada este mes.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border bg-background">
                {lineas.map((linea) => (
                  <FilaLinea
                    key={linea.partida.id}
                    linea={linea}
                    mes={resumen.mes}
                    hucha={huchas.find((h) => h.id === linea.partida.hucha_id)}
                    puedeMarcar={puedeMarcar}
                    marcando={marcandoId === linea.partida.id}
                    onMarcar={onMarcar}
                    {...acciones}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function Kpi({
  titulo,
  valor,
  clase,
  destacado = false,
}: {
  titulo: string
  valor: number
  clase?: string
  destacado?: boolean
}) {
  return (
    <Card className="p-4" decoration={destacado ? "top" : undefined} decorationColor="emerald">
      <Text>{titulo}</Text>
      <Metric className={cn("text-2xl tabular-nums", clase)}>{formatEuro(valor)}</Metric>
    </Card>
  )
}

function FilaLinea({
  linea,
  mes,
  hucha,
  puedeMarcar,
  marcando,
  onMarcar,
  onEditar,
  onCambiarImporte,
  onEliminar,
}: Acciones & {
  linea: LineaMes
  mes: string
  hucha: Hucha | undefined
  puedeMarcar: boolean
  marcando: boolean
  onMarcar: (linea: LineaMes) => void
}) {
  const { partida, pago } = linea
  const hecha = pago !== null
  const c = cuota(partida, mes)
  const detalles = [
    c && `cuota ${c.actual}/${c.total}`,
    partida.frecuencia === "anual" && "anual",
    partida.frecuencia === "puntual" && "solo este mes",
    hucha && `→ ${hucha.nombre}`,
  ].filter((d): d is string => typeof d === "string")

  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5 transition-colors", hecha && "bg-emerald-50")}>
      {puedeMarcar && (
        <button
          type="button"
          onClick={() => onMarcar(linea)}
          disabled={marcando}
          aria-pressed={hecha}
          aria-label={`${hecha ? "Desmarcar" : "Marcar como hecho"}: ${partida.concepto}`}
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            hecha
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-input bg-background hover:border-emerald-600",
          )}
        >
          {marcando ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            hecha && <Check className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => onEditar(partida)}
        className="min-w-0 flex-1 text-left focus-visible:underline focus-visible:outline-none"
      >
        <p className="truncate text-sm font-medium">{partida.concepto}</p>
        {detalles.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">{detalles.join(" · ")}</p>
        )}
      </button>

      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatEuro(partida.importe)}</span>

      {/* modal={false}: abrir un Dialog desde un menú modal de Radix deja la página sin clics */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-label={`Opciones de ${partida.concepto}`}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEditar(partida)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Editar
          </DropdownMenuItem>
          {partida.frecuencia !== "puntual" && (
            <DropdownMenuItem onSelect={() => onCambiarImporte(partida)}>
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
              Cambiar importe desde un mes
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onEliminar(partida)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
