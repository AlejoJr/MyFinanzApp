/**
 * Tipos del esquema de Supabase (ver supabase/migrations/).
 * Regenerables con:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Insert/Update omiten a proposito las columnas que gestiona la base de
 * datos: usuario_id (default auth.uid()), created_at, y sobre todo
 * huchas.saldo_actual y movimientos.usuario_id, que mantienen triggers.
 * Enviarlas desde el cliente no da error, simplemente se descarta el valor.
 */
import type { Periodicidad, TipoHucha, TipoMovimiento } from "./domain"

export interface Database {
  public: {
    Tables: {
      huchas: {
        Row: {
          id: string
          usuario_id: string
          nombre: string
          tipo: TipoHucha
          objetivo: number
          saldo_actual: number
          created_at: string
        }
        Insert: {
          nombre: string
          tipo: TipoHucha
          objetivo?: number
        }
        Update: {
          nombre?: string
          tipo?: TipoHucha
          objetivo?: number
        }
        Relationships: []
      }
      movimientos: {
        Row: {
          id: string
          hucha_id: string
          usuario_id: string
          importe: number
          tipo: TipoMovimiento
          fecha: string
          nota: string | null
        }
        Insert: {
          hucha_id: string
          importe: number
          tipo: TipoMovimiento
          fecha?: string
          nota?: string | null
        }
        Update: {
          importe?: number
          tipo?: TipoMovimiento
          fecha?: string
          nota?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_hucha_id_fkey"
            columns: ["hucha_id"]
            referencedRelation: "huchas"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_fijos: {
        Row: {
          id: string
          usuario_id: string
          concepto: string
          importe: number
          periodicidad: Periodicidad
          created_at: string
        }
        Insert: {
          concepto: string
          importe: number
          periodicidad: Periodicidad
        }
        Update: {
          concepto?: string
          importe?: number
          periodicidad?: Periodicidad
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: {
      tipo_hucha: TipoHucha
      tipo_movimiento: TipoMovimiento
      periodicidad: Periodicidad
    }
    CompositeTypes: Record<never, never>
  }
}
