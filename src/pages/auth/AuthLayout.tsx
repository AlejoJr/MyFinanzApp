import type { ReactNode } from "react"
import { PiggyBank } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function AuthLayout({
  titulo,
  descripcion,
  children,
  pie,
}: {
  titulo: string
  descripcion: string
  children: ReactNode
  pie: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <PiggyBank className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">MyFinanzApp</h1>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">{titulo}</CardTitle>
            <CardDescription>{descripcion}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">{pie}</p>
      </div>
    </div>
  )
}
