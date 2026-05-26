export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      entries: {
        Row: {
          classification: Database["public"]["Enums"]["classification"]
          created_at: string
          credit: number
          debit: number
          description: string
          doc_number: number
          entry_date: string
          id: string
          month_id: string
          notes: string | null
          receipt_path: string | null
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          classification?: Database["public"]["Enums"]["classification"]
          created_at?: string
          credit?: number
          debit?: number
          description?: string
          doc_number: number
          entry_date: string
          id?: string
          month_id: string
          notes?: string | null
          receipt_path?: string | null
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          classification?: Database["public"]["Enums"]["classification"]
          created_at?: string
          credit?: number
          debit?: number
          description?: string
          doc_number?: number
          entry_date?: string
          id?: string
          month_id?: string
          notes?: string | null
          receipt_path?: string | null
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          closed: boolean
          closed_at: string | null
          created_at: string
          id: string
          month: number
          notes: string | null
          reference: string
          updated_at: string
          year: number
        }
        Insert: {
          closed?: boolean
          closed_at?: string | null
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          reference: string
          updated_at?: string
          year: number
        }
        Update: {
          closed?: boolean
          closed_at?: string | null
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          reference?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          identification: string
          initial_balance: number
          period_end: string
          period_start: string
          responsible: string
          updated_at: string
        }
        Insert: {
          id?: string
          identification?: string
          initial_balance?: number
          period_end?: string
          period_start?: string
          responsible?: string
          updated_at?: string
        }
        Update: {
          id?: string
          identification?: string
          initial_balance?: number
          period_end?: string
          period_start?: string
          responsible?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      classification:
        | "salario"
        | "supermercado"
        | "agua_esgoto"
        | "energia"
        | "internet"
        | "telefone"
        | "combustivel"
        | "farmacia"
        | "condominio"
        | "aplicacao_poupanca"
        | "transferencias"
        | "saude"
        | "educacao"
        | "lazer"
        | "vestuario"
        | "alimentacao"
        | "transporte"
        | "impostos"
        | "outros"
        | "nao_classificado"
        | "rendimento"
        | "cartao_credito"
        | "aposentadoria"
        | "reembolso"
        | "saque"
        | "darf_unificado"
        | "guia_simples_nacional"
        | "iptu"
        | "cartorio"
        | "pix_recebido"
        | "faxina"
        | "equipamento_acessibilidade"
        | "e_social"
        | "irrf"
        | "despesas_animais"
        | "despesa_fazenda"
        | "servico_cuidador"
        | "despesas_medicas"
        | "aluguel"
        | "despesas_bancarias"
        | "manutencao_residencial"
        | "reparos_domesticos"
        | "lazer_convivencia_social"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      classification: [
        "salario",
        "supermercado",
        "agua_esgoto",
        "energia",
        "internet",
        "telefone",
        "combustivel",
        "farmacia",
        "condominio",
        "aplicacao_poupanca",
        "transferencias",
        "saude",
        "educacao",
        "lazer",
        "vestuario",
        "alimentacao",
        "transporte",
        "impostos",
        "outros",
        "nao_classificado",
        "rendimento",
        "cartao_credito",
        "aposentadoria",
        "reembolso",
        "saque",
        "darf_unificado",
        "guia_simples_nacional",
        "iptu",
        "cartorio",
        "pix_recebido",
        "faxina",
        "equipamento_acessibilidade",
        "e_social",
        "irrf",
        "despesas_animais",
        "despesa_fazenda",
        "servico_cuidador",
        "despesas_medicas",
        "aluguel",
        "despesas_bancarias",
        "manutencao_residencial",
        "reparos_domesticos",
        "lazer_convivencia_social",
      ],
    },
  },
} as const
