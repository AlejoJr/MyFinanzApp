import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function Cargando({
  texto = "Cargando…",
  className,
}: {
  texto?: string
  className?: string
}) {
  return (
    <div
      className={cn("flex min-h-dvh items-center justify-center gap-3 text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{texto}</span>
    </div>
  )
}
