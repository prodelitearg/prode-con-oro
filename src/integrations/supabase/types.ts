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
      matchday_commissions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          matchday_id: string
          recipient_user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          kind: string
          matchday_id: string
          recipient_user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          matchday_id?: string
          recipient_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matchday_commissions_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      matchday_payouts: {
        Row: {
          base_prize: number
          created_at: string
          id: string
          matchday_id: string
          rank_position: number | null
          ranking_prize: number
          user_id: string
        }
        Insert: {
          base_prize?: number
          created_at?: string
          id?: string
          matchday_id: string
          rank_position?: number | null
          ranking_prize?: number
          user_id: string
        }
        Update: {
          base_prize?: number
          created_at?: string
          id?: string
          matchday_id?: string
          rank_position?: number | null
          ranking_prize?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchday_payouts_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      matchdays: {
        Row: {
          closed_at: string | null
          created_at: string
          entry_cost: number
          external_league_id: number | null
          external_season: number | null
          id: string
          is_open: boolean
          number: number
          pot_carry: number
          prize_pool: number
          starts_at: string
          tournament_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          entry_cost?: number
          external_league_id?: number | null
          external_season?: number | null
          id?: string
          is_open?: boolean
          number: number
          pot_carry?: number
          prize_pool?: number
          starts_at: string
          tournament_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          entry_cost?: number
          external_league_id?: number | null
          external_season?: number | null
          id?: string
          is_open?: boolean
          number?: number
          pot_carry?: number
          prize_pool?: number
          starts_at?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchdays_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_color: string
          away_score: number | null
          away_short: string
          away_team: string
          created_at: string
          external_id: number | null
          home_color: string
          home_score: number | null
          home_short: string
          home_team: string
          id: string
          kickoff: string
          matchday_id: string
          status: string
        }
        Insert: {
          away_color?: string
          away_score?: number | null
          away_short: string
          away_team: string
          created_at?: string
          external_id?: number | null
          home_color?: string
          home_score?: number | null
          home_short: string
          home_team: string
          id?: string
          kickoff: string
          matchday_id: string
          status?: string
        }
        Update: {
          away_color?: string
          away_score?: number | null
          away_short?: string
          away_team?: string
          created_at?: string
          external_id?: number | null
          home_color?: string
          home_score?: number | null
          home_short?: string
          home_team?: string
          id?: string
          kickoff?: string
          matchday_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_matchday_id_fkey"
            columns: ["matchday_id"]
            isOneToOne: false
            referencedRelation: "matchdays"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          away_score: number
          created_at: string
          home_score: number
          id: string
          locked: boolean
          match_id: string
          points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          away_score: number
          created_at?: string
          home_score: number
          id?: string
          locked?: boolean
          match_id: string
          points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          away_score?: number
          created_at?: string
          home_score?: number
          id?: string
          locked?: boolean
          match_id?: string
          points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_id: string | null
          apellido: string
          created_at: string
          dni: string | null
          email: string | null
          id: string
          localidad: string | null
          nombre: string
          provincia: string | null
          ref_code: string | null
          referred_by: string | null
          telefono: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          apellido?: string
          created_at?: string
          dni?: string | null
          email?: string | null
          id?: string
          localidad?: string | null
          nombre?: string
          provincia?: string | null
          ref_code?: string | null
          referred_by?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          apellido?: string
          created_at?: string
          dni?: string | null
          email?: string | null
          id?: string
          localidad?: string | null
          nombre?: string
          provincia?: string | null
          ref_code?: string | null
          referred_by?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          country: string | null
          created_at: string
          external_id: number | null
          external_provider: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          external_id?: number | null
          external_provider?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          country?: string | null
          created_at?: string
          external_id?: number | null
          external_provider?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          bonus: number
          retirables: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus?: number
          retirables?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus?: number
          retirables?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_id: string | null
          alias: string
          amount: number
          created_at: string
          id: string
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          alias: string
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          alias?: string
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_prediction_points: {
        Args: {
          pred_away: number
          pred_home: number
          real_away: number
          real_home: number
        }
        Returns: number
      }
      close_matchday: { Args: { _matchday_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      request_withdrawal: {
        Args: { _alias: string; _amount: number }
        Returns: Json
      }
      resolve_withdrawal: {
        Args: { _approve: boolean; _notes?: string; _withdrawal_id: string }
        Returns: Json
      }
      tournament_leaderboard: {
        Args: { _tournament_id: string }
        Returns: {
          accuracy: number
          display_name: string
          exact_hits: number
          played: number
          total_points: number
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "user" | "admin" | "superadmin"
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
      app_role: ["user", "admin", "superadmin"],
    },
  },
} as const
