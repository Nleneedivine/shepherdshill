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
      department_members: {
        Row: {
          department_id: string
          id: string
          joined_at: string
          member_id: string
          role_title: string | null
        }
        Insert: {
          department_id: string
          id?: string
          joined_at?: string
          member_id: string
          role_title?: string | null
        }
        Update: {
          department_id?: string
          id?: string
          joined_at?: string
          member_id?: string
          role_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
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
      field_memory: {
        Row: {
          field_key: string
          id: string
          updated_at: string
          user_id: string
          values: string[]
        }
        Insert: {
          field_key: string
          id?: string
          updated_at?: string
          user_id: string
          values?: string[]
        }
        Update: {
          field_key?: string
          id?: string
          updated_at?: string
          user_id?: string
          values?: string[]
        }
        Relationships: []
      }
      form_drafts: {
        Row: {
          completeness_score: number
          created_at: string
          current_step: number
          expires_at: string
          form_data: Json
          form_key: string
          id: string
          last_saved_at: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          completeness_score?: number
          created_at?: string
          current_step?: number
          expires_at?: string
          form_data?: Json
          form_key: string
          id?: string
          last_saved_at?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          completeness_score?: number
          created_at?: string
          current_step?: number
          expires_at?: string
          form_data?: Json
          form_key?: string
          id?: string
          last_saved_at?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      incomplete_profiles: {
        Row: {
          completeness_score: number
          created_at: string
          id: string
          member_id: string
          missing_fields: Json
          updated_at: string
        }
        Insert: {
          completeness_score?: number
          created_at?: string
          id?: string
          member_id: string
          missing_fields?: Json
          updated_at?: string
        }
        Update: {
          completeness_score?: number
          created_at?: string
          id?: string
          member_id?: string
          missing_fields?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomplete_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_biometrics: {
        Row: {
          created_at: string
          face_template: string | null
          fingerprint_template: string | null
          has_face: boolean
          has_fingerprint: boolean
          has_qr: boolean
          id: string
          member_id: string
          qr_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          face_template?: string | null
          fingerprint_template?: string | null
          has_face?: boolean
          has_fingerprint?: boolean
          has_qr?: boolean
          id?: string
          member_id: string
          qr_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          face_template?: string | null
          fingerprint_template?: string | null
          has_face?: boolean
          has_fingerprint?: boolean
          has_qr?: boolean
          id?: string
          member_id?: string
          qr_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_biometrics_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_registrations: {
        Row: {
          ai_cell_group_suggestion_id: string | null
          ai_completeness_score: number | null
          ai_duplicate_flag: boolean
          ai_family_match_suggestions: Json
          ai_processing_notes: string | null
          branch_id: string | null
          cell_group_id: string | null
          church_life: Json
          completeness_score: number | null
          consent: Json
          contact: Json
          created_at: string
          created_member_id: string | null
          family: Json
          first_name: string | null
          id: string
          last_name: string | null
          membership_stage: string | null
          personal: Json
          phone_primary: string | null
          profile_photo_url: string | null
          rejection_reason: string | null
          spiritual: Json
          status: string
          submission_method: string
          submitted_at: string
          updated_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          ai_cell_group_suggestion_id?: string | null
          ai_completeness_score?: number | null
          ai_duplicate_flag?: boolean
          ai_family_match_suggestions?: Json
          ai_processing_notes?: string | null
          branch_id?: string | null
          cell_group_id?: string | null
          church_life: Json
          completeness_score?: number | null
          consent: Json
          contact: Json
          created_at?: string
          created_member_id?: string | null
          family: Json
          first_name?: string | null
          id?: string
          last_name?: string | null
          membership_stage?: string | null
          personal: Json
          phone_primary?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          spiritual: Json
          status?: string
          submission_method?: string
          submitted_at?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          ai_cell_group_suggestion_id?: string | null
          ai_completeness_score?: number | null
          ai_duplicate_flag?: boolean
          ai_family_match_suggestions?: Json
          ai_processing_notes?: string | null
          branch_id?: string | null
          cell_group_id?: string | null
          church_life?: Json
          completeness_score?: number | null
          consent?: Json
          contact?: Json
          created_at?: string
          created_member_id?: string | null
          family?: Json
          first_name?: string | null
          id?: string
          last_name?: string | null
          membership_stage?: string | null
          personal?: Json
          phone_primary?: string | null
          profile_photo_url?: string | null
          rejection_reason?: string | null
          spiritual?: Json
          status?: string
          submission_method?: string
          submitted_at?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
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
          membership_stage: string | null
          membership_status: string | null
          middle_name: string | null
          phone_primary: string | null
          phone_secondary: string | null
          preferred_name: string | null
          profile_photo_url: string | null
          registration_id: string | null
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
          membership_stage?: string | null
          membership_status?: string | null
          middle_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          registration_id?: string | null
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
          membership_stage?: string | null
          membership_status?: string | null
          middle_name?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          preferred_name?: string | null
          profile_photo_url?: string | null
          registration_id?: string | null
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
          {
            foreignKeyName: "members_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "member_registrations"
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
          notification_opt_out: boolean
          phone: string | null
          preferred_notification_channel: string
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
          notification_opt_out?: boolean
          phone?: string | null
          preferred_notification_channel?: string
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
          notification_opt_out?: boolean
          phone?: string | null
          preferred_notification_channel?: string
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
      spiritual_journey: {
        Row: {
          id: string
          member_id: string
          milestone: string
          notes: string | null
          recorded_at: string
          status: string
        }
        Insert: {
          id?: string
          member_id: string
          milestone: string
          notes?: string | null
          recorded_at?: string
          status: string
        }
        Update: {
          id?: string
          member_id?: string
          milestone?: string
          notes?: string | null
          recorded_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "spiritual_journey_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          performed_by: string | null
          performed_by_name: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          performed_by?: string | null
          performed_by_name?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_member_submission: {
        Args: {
          p_confirmed_cell_group_id?: string
          p_edited?: Json
          p_submission_id: string
        }
        Returns: {
          member_code: string
          member_id: string
        }[]
      }
      assign_user_role: {
        Args: {
          p_branch_id?: string
          p_new_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: undefined
      }
      grant_super_admin_by_email: { Args: { p_email: string }; Returns: string }
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
        | "cell_leader"
        | "parish_pastor"
        | "area_supervisor"
        | "zonal_pastor"
        | "provincial_pastor"
        | "finance_director"
        | "finance_team"
        | "media_team"
        | "communications_team"
        | "facilities_team"
        | "prayer_coordinator"
        | "counselling_pastor"
        | "volunteer"
        | "department_head"
        | "it_team"
        | "protocol_team"
        | "usher"
        | "visitor"
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
        "cell_leader",
        "parish_pastor",
        "area_supervisor",
        "zonal_pastor",
        "provincial_pastor",
        "finance_director",
        "finance_team",
        "media_team",
        "communications_team",
        "facilities_team",
        "prayer_coordinator",
        "counselling_pastor",
        "volunteer",
        "department_head",
        "it_team",
        "protocol_team",
        "usher",
        "visitor",
      ],
    },
  },
} as const
