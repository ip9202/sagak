export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      books: {
        Row: {
          author: string
          cover_url: string | null
          created_at: string
          id: string
          isbn: string
          kakao_id: string | null
          published_at: string | null
          publisher: string | null
          title: string
          total_pages: number | null
        }
        Insert: {
          author: string
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn: string
          kakao_id?: string | null
          published_at?: string | null
          publisher?: string | null
          title: string
          total_pages?: number | null
        }
        Update: {
          author?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          isbn?: string
          kakao_id?: string | null
          published_at?: string | null
          publisher?: string | null
          title?: string
          total_pages?: number | null
        }
        Relationships: []
      }
      club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          book_id: string
          created_at: string
          description: string | null
          host_id: string
          id: string
          max_members: number | null
          name: string
          status: string
          type: string
        }
        Insert: {
          book_id: string
          created_at?: string
          description?: string | null
          host_id: string
          id?: string
          max_members?: number | null
          name: string
          status?: string
          type: string
        }
        Update: {
          book_id?: string
          created_at?: string
          description?: string | null
          host_id?: string
          id?: string
          max_members?: number | null
          name?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clubs_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      completion_reports: {
        Row: {
          book_id: string
          created_at: string
          id: string
          report_data: Json
          user_book_id: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          report_data: Json
          user_book_id: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          report_data?: Json
          user_book_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completion_reports_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_reports_user_book_id_fkey"
            columns: ["user_book_id"]
            isOneToOne: true
            referencedRelation: "user_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      emotion_records: {
        Row: {
          book_id: string
          club_id: string | null
          content: string
          created_at: string
          id: string
          page_number: number | null
          updated_at: string | null
          user_id: string
          visibility: string
        }
        Insert: {
          book_id: string
          club_id?: string | null
          content: string
          created_at?: string
          id?: string
          page_number?: number | null
          updated_at?: string | null
          user_id: string
          visibility?: string
        }
        Update: {
          book_id?: string
          club_id?: string | null
          content?: string
          created_at?: string
          id?: string
          page_number?: number | null
          updated_at?: string | null
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "emotion_records_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emotion_records_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emotion_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emotion_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          club_id: string
          created_at: string
          id: string
          message: string | null
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean | null
          ref_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          ref_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          ref_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      point_logs: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_sessions: {
        Row: {
          book_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          pages_read: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          pages_read?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          pages_read?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_reactions: {
        Row: {
          created_at: string
          id: string
          record_id: string
          sticker_type: Database["public"]["Enums"]["sticker_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          record_id: string
          sticker_type: Database["public"]["Enums"]["sticker_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          record_id?: string
          sticker_type?: Database["public"]["Enums"]["sticker_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sticker_reactions_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "emotion_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sticker_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sticker_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_books: {
        Row: {
          book_id: string
          completed_at: string | null
          created_at: string
          current_page: number | null
          id: string
          is_public: boolean | null
          last_progress_at: string | null
          started_reading_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          completed_at?: string | null
          created_at?: string
          current_page?: number | null
          id?: string
          is_public?: boolean | null
          last_progress_at?: string | null
          started_reading_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          completed_at?: string | null
          created_at?: string
          current_page?: number | null
          id?: string
          is_public?: boolean | null
          last_progress_at?: string | null
          started_reading_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nickname: string
          provider: string
          reading_alarm_enabled: boolean | null
          reading_alarm_time: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          nickname: string
          provider: string
          reading_alarm_enabled?: boolean | null
          reading_alarm_time?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nickname?: string
          provider?: string
          reading_alarm_enabled?: boolean | null
          reading_alarm_time?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_books_public: {
        Row: {
          book_id: string | null
          current_page: number | null
          started_reading_at: string | null
          user_id: string | null
        }
        Insert: {
          book_id?: string | null
          current_page?: number | null
          started_reading_at?: string | null
          user_id?: string | null
        }
        Update: {
          book_id?: string | null
          current_page?: number | null
          started_reading_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          id: string | null
          nickname: string | null
        }
        Insert: {
          avatar_url?: string | null
          id?: string | null
          nickname?: string | null
        }
        Update: {
          avatar_url?: string | null
          id?: string | null
          nickname?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      fn_user_in_club: { Args: { p_club_id: string }; Returns: boolean }
    }
    Enums: {
      sticker_type: "empathy" | "touching" | "comforted"
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
      sticker_type: ["empathy", "touching", "comforted"],
    },
  },
} as const

