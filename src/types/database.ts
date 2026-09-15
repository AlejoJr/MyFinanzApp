/**
 * Tipos del esquema de Supabase (ver supabase/migrations/).
 * Regenerables con:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Insert/Update omiten a proposito las columnas que gestiona la base de
 * datos: usuario_id (default auth.uid()), created_at, huchas.saldo_actual,
 * huchas.pagada_at, movimientos.usuario_id y pagos_partida.movimiento_id,
 * que mantienen triggers y funciones. Enviarlas desde el cliente no da
 * error: se descarta el valor.
 */
import type {
  ColorEtiqueta,
  FinalidadHucha,
  Frecuencia,
  TipoHucha,
  TipoMovimiento,
  TipoPartida,
} from "./domain"

export interface Database {
  public: {
    Tables: {
      huchas: {
        Row: {
          id: string
          usuario_id: string
          nombre: string
          tipo: TipoHucha
          finalidad: FinalidadHucha
          objetivo: number
          saldo_actual: number
          fecha_limite: string | null
          pagada_at: string | null
          banco_id: string | null
          created_at: string
        }
        Insert: {
          nombre: string
          tipo: TipoHucha
          finalidad?: FinalidadHucha
          objetivo?: number
          fecha_limite?: string | null
          banco_id?: string | null
        }
        Update: {
          nombre?: string
          tipo?: TipoHucha
          finalidad?: FinalidadHucha
          objetivo?: number
          fecha_limite?: string | null
          banco_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "huchas_banco_id_fkey"
            columns: ["banco_id"]
            referencedRelation: "bancos"
            referencedColumns: ["id"]
          },
        ]
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
      partidas: {
        Row: {
          id: string
          usuario_id: string
          tipo: TipoPartida
          concepto: string
          importe: number
          frecuencia: Frecuencia
          mes_inicio: string
          mes_fin: string | null
          hucha_id: string | null
          descripcion: string | null
          categoria_id: string | null
          created_at: string
        }
        Insert: {
          tipo: TipoPartida
          concepto: string
          importe: number
          frecuencia?: Frecuencia
          mes_inicio: string
          mes_fin?: string | null
          hucha_id?: string | null
          descripcion?: string | null
          categoria_id?: string | null
        }
        Update: {
          tipo?: TipoPartida
          concepto?: string
          importe?: number
          frecuencia?: Frecuencia
          mes_inicio?: string
          mes_fin?: string | null
          hucha_id?: string | null
          descripcion?: string | null
          categoria_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partidas_hucha_id_fkey"
            columns: ["hucha_id"]
            referencedRelation: "huchas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partidas_categoria_id_fkey"
            columns: ["categoria_id"]
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_partida: {
        Row: {
          id: string
          usuario_id: string
          partida_id: string
          mes: string
          movimiento_id: string | null
          created_at: string
        }
        Insert: {
          partida_id: string
          mes: string
        }
        Update: {
          partida_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_partida_partida_id_fkey"
            columns: ["partida_id"]
            referencedRelation: "partidas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_partida_movimiento_id_fkey"
            columns: ["movimiento_id"]
            referencedRelation: "movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          id: string
          usuario_id: string
          nombre: string
          color: ColorEtiqueta
          created_at: string
        }
        Insert: {
          nombre: string
          color?: ColorEtiqueta
        }
        Update: {
          nombre?: string
          color?: ColorEtiqueta
        }
        Relationships: []
      }
      bancos: {
        Row: {
          id: string
          usuario_id: string
          nombre: string
          color: ColorEtiqueta
          created_at: string
        }
        Insert: {
          nombre: string
          color?: ColorEtiqueta
        }
        Update: {
          nombre?: string
          color?: ColorEtiqueta
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      cambiar_importe_partida: {
        Args: { p_partida: string; p_desde: string; p_importe: number }
        Returns: string
      }
      pagar_hucha: {
        Args: { p_hucha: string; p_nota?: string | null }
        Returns: undefined
      }
      mantener_activo: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      tipo_hucha: TipoHucha
      finalidad_hucha: FinalidadHucha
      tipo_movimiento: TipoMovimiento
      tipo_partida: TipoPartida
      frecuencia_partida: Frecuencia
      color_etiqueta: ColorEtiqueta
    }
    CompositeTypes: Record<never, never>
  }
}
