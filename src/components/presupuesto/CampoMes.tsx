import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { anioDe, crearMes, mesActual, nombreMes, numMesDe, type Mes } from "@/lib/presupuesto"

/**
 * Campo de formulario para elegir un mes: dos desplegables (mes y año).
 * <input type="month"> no existe en Firefox de escritorio, por eso no se usa.
 */
export function CampoMes({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: Mes
  onChange: (mes: Mes) => void
  disabled?: boolean
}) {
  const anioHoy = anioDe(mesActual())
  const desde = Math.min(anioHoy - 5, anioDe(value))
  const hasta = Math.max(anioHoy + 5, anioDe(value))
  const anios = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)

  return (
    <div className="grid grid-cols-[1fr_6.5rem] gap-2">
      <Select
        value={String(numMesDe(value))}
        onValueChange={(v) => onChange(crearMes(anioDe(value), Number(v)))}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="capitalize" aria-label="Mes">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <SelectItem key={n} value={String(n)} className="capitalize">
              {nombreMes(crearMes(2000, n), "mes")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(anioDe(value))}
        onValueChange={(v) => onChange(crearMes(Number(v), numMesDe(value)))}
        disabled={disabled}
      >
        <SelectTrigger aria-label="Año">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {anios.map((a) => (
            <SelectItem key={a} value={String(a)}>
              {a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
