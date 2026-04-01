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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          publication_id: string | null
          publication_title: string | null
          pubzub_yaml_detected: boolean | null
          source: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          publication_id?: string | null
          publication_title?: string | null
          pubzub_yaml_detected?: boolean | null
          source: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          publication_id?: string | null
          publication_title?: string | null
          pubzub_yaml_detected?: boolean | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          google_scholar_url: string | null
          id: string
          orcid_id: string | null
          personal_website_url: string | null
          university_affiliation: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          google_scholar_url?: string | null
          id: string
          orcid_id?: string | null
          personal_website_url?: string | null
          university_affiliation?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          google_scholar_url?: string | null
          id?: string
          orcid_id?: string | null
          personal_website_url?: string | null
          university_affiliation?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publication_bin: {
        Row: {
          deleted_at: string
          id: string
          original_stage: string
          publication_data: Json
          user_id: string
        }
        Insert: {
          deleted_at?: string
          id?: string
          original_stage: string
          publication_data: Json
          user_id: string
        }
        Update: {
          deleted_at?: string
          id?: string
          original_stage?: string
          publication_data?: Json
          user_id?: string
        }
        Relationships: []
      }
      publication_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          publication_id: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          publication_id: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          publication_id?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_collaborators_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          publication_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          publication_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          publication_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_comments_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          authors: string[] | null
          created_at: string
          data_sources: string[] | null
          github_repo: string | null
          grants: string[] | null
          id: string
          links: string[] | null
          notes: string | null
          output_type: string | null
          overleaf_link: string | null
          owner_id: string
          paper_file_path: string | null
          related_papers: string[] | null
          stage: string
          stage_history: Json[] | null
          target_year: number | null
          themes: string[] | null
          title: string
          updated_at: string
          working_paper: Json | null
        }
        Insert: {
          authors?: string[] | null
          created_at?: string
          data_sources?: string[] | null
          github_repo?: string | null
          grants?: string[] | null
          id?: string
          links?: string[] | null
          notes?: string | null
          output_type?: string | null
          overleaf_link?: string | null
          owner_id: string
          paper_file_path?: string | null
          related_papers?: string[] | null
          stage?: string
          stage_history?: Json[] | null
          target_year?: number | null
          themes?: string[] | null
          title?: string
          updated_at?: string
          working_paper?: Json | null
        }
        Update: {
          authors?: string[] | null
          created_at?: string
          data_sources?: string[] | null
          github_repo?: string | null
          grants?: string[] | null
          id?: string
          links?: string[] | null
          notes?: string | null
          output_type?: string | null
          overleaf_link?: string | null
          owner_id?: string
          paper_file_path?: string | null
          related_papers?: string[] | null
          stage?: string
          stage_history?: Json[] | null
          target_year?: number | null
          themes?: string[] | null
          title?: string
          updated_at?: string
          working_paper?: Json | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_completed: boolean
          publication_id: string | null
          reminder_type: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          is_completed?: boolean
          publication_id?: string | null
          reminder_type?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_completed?: boolean
          publication_id?: string | null
          reminder_type?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          has_dashboard_access: boolean
          id: string
          invited_email: string | null
          role: Database["public"]["Enums"]["team_role"]
          status: string
          team_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          has_dashboard_access?: boolean
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: string
          team_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          has_dashboard_access?: boolean
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["team_role"]
          status?: string
          team_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string
          dashboard_public: boolean
          description: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          dashboard_public?: boolean
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          dashboard_public?: boolean
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      visibility_settings: {
        Row: {
          created_at: string
          id: string
          min_visible_stage: Database["public"]["Enums"]["pipeline_stage"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_visible_stage?: Database["public"]["Enums"]["pipeline_stage"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          min_visible_stage?: Database["public"]["Enums"]["pipeline_stage"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visibility_settings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visibility_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      team_members_secure: {
        Row: {
          created_at: string | null
          has_dashboard_access: boolean | null
          id: string | null
          invited_email: string | null
          role: Database["public"]["Enums"]["team_role"] | null
          status: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          has_dashboard_access?: boolean | null
          id?: string | null
          invited_email?: never
          role?: Database["public"]["Enums"]["team_role"] | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          has_dashboard_access?: boolean | null
          id?: string | null
          invited_email?: never
          role?: Database["public"]["Enums"]["team_role"] | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_team_member_publications: {
        Args: { _member_id: string; _viewer_id: string }
        Returns: boolean
      }
      find_user_id_by_email: { Args: { _email: string }; Returns: string }
      get_pending_invitations: {
        Args: never
        Returns: {
          created_at: string
          id: string
          owner_id: string
          owner_name: string
          publication_id: string
          publication_title: string
          role: string
        }[]
      }
      get_stage_index: { Args: { _stage: string }; Returns: number }
      get_team_all_publications: { Args: { _team_id: string }; Returns: Json }
      get_team_dashboard_data: { Args: { _team_id: string }; Returns: Json }
      get_team_member_publications: {
        Args: { _member_id: string; _team_id: string; _viewer_id: string }
        Returns: Json
      }
      has_any_team_membership: { Args: { _team_id: string }; Returns: boolean }
      has_dashboard_access: { Args: { _team_id: string }; Returns: boolean }
      is_current_user_email: { Args: { _email: string }; Returns: boolean }
      is_direct_collaborator: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      is_team_admin: { Args: { _team_id: string }; Returns: boolean }
      is_team_creator: { Args: { _team_id: string }; Returns: boolean }
      is_team_member: { Args: { _team_id: string }; Returns: boolean }
      user_is_collaborator: { Args: { pub_id: string }; Returns: boolean }
      validate_api_key: { Args: { _key_hash: string }; Returns: string }
    }
    Enums: {
      pipeline_stage:
        | "idea"
        | "draft"
        | "submitted"
        | "revise_resubmit"
        | "resubmitted"
        | "accepted"
        | "published"
      team_role: "admin" | "member"
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
      pipeline_stage: [
        "idea",
        "draft",
        "submitted",
        "revise_resubmit",
        "resubmitted",
        "accepted",
        "published",
      ],
      team_role: ["admin", "member"],
    },
  },
} as const
