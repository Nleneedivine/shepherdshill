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
      branches: {
        Row: {
          branch_code: string
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          branch_code: string
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          branch_code?: string
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      cell_groups: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          is_active: boolean
          leader_name: string | null
          meeting_day: string | null
          meeting_time: string | null
          name: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          leader_name?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          leader_name?: string | null
          meeting_day?: string | null
          meeting_time?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cell_groups_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      member_registrations: {
        Row: {
          cell_group_id: string | null
          church_life: Json
          completeness_score: number | null
          consent: Json
          contact: Json
          created_at: string
          family: Json
          id: string
          personal: Json
          spiritual: Json
          status: string
        }
        Insert: {
          cell_group_id?: string | null
          church_life: Json
          completeness_score?: number | null
          consent: Json
          contact: Json
          created_at?: string
          family: Json
          id?: string
          personal: Json
          spiritual: Json
          status?: string
        }
        Update: {
          cell_group_id?: string | null
          church_life?: Json
          completeness_score?: number | null
          consent?: Json
          contact?: Json
          created_at?: string
          family?: Json
          id?: string
          personal?: Json
          spiritual?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_registrations_cell_group_id_fkey"
            columns: ["cell_group_id"]
            isOneToOne: false
            referencedRelation: "cell_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          address: string | null
          branch_id: string | null
          cell_group_id: string | null
          city: string | null
          country: string | null
          created_at: string
          dob: string | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          marital_status: string | null
          member_code: string | null
          membership_status: string | null
          middle_name: string | null
          phone_primary: string | null
          phone_secondary: string | null
          preferred_name: string | null
          profile_photo_url: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_id?: string | null
          cell_group_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          marital_status?: string | null
          member_code?: string | null
          membership_status?: string | null
          middle_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_id?: string | null
          cell_group_id?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          marital_status?: string | null
          member_code?: string | null
          membership_status?: string | null
          middle_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_cell_group_id_fkey"
            columns: ["cell_group_id"]
            isOneToOne: false
            referencedRelation: "cell_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_super_admin: boolean
          member_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_super_admin?: boolean
          member_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_super_admin?: boolean
          member_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "senior_pastor"
        | "pastoral_team"
        | "worker"
        | "member"
        | "first_timer"
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
      app_role: [
        "super_admin",
        "admin",
        "senior_pastor",
        "pastoral_team",
        "worker",
        "member",
        "first_timer",
      ],
    },
  },
} as const
