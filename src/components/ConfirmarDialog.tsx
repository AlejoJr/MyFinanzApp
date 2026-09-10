import { useState, type ReactNode } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"

/**
 * Confirmación de una acción importante. Si `onConfirmar` lanza un error,
 * se muestra dentro del diálogo y este no se cierra.
 */
export function ConfirmarDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  textoConfirmar,
  onConfirmar,
  variante = "destructive",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion: ReactNode
  textoConfirmar: string
  onConfirmar: () => Promise<void>
  /** "destructive" (rojo) para borrar; "default" para acciones como pagar. */
  variante?: "destructive" | "default"
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiarOpen = (abierto: boolean) => {
    if (enviando) return
    if (!abierto) setError(null)
    onOpenChange(abierto)
  }

  const confirmar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await onConfirmar()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la operación.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={cambiarOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: variante })}
            disabled={enviando}
            onClick={(e) => {
              // Evita que Radix cierre el diálogo antes de saber si ha ido bien.
              e.preventDefault()
              void confirmar()
            }}
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {textoConfirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
