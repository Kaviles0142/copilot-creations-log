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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      books: {
        Row: {
          authors: string[]
          book_type: string
          categories: string[] | null
          created_at: string
          description: string | null
          figure_id: string
          figure_name: string
          google_books_id: string | null
          id: string
          info_link: string | null
          isbn_10: string | null
          isbn_13: string | null
          language: string | null
          page_count: number | null
          preview_link: string | null
          published_date: string | null
          relevance_score: number | null
          search_query: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          authors: string[]
          book_type: string
          categories?: string[] | null
          created_at?: string
          description?: string | null
          figure_id: string
          figure_name: string
          google_books_id?: string | null
          id?: string
          info_link?: string | null
          isbn_10?: string | null
          isbn_13?: string | null
          language?: string | null
          page_count?: number | null
          preview_link?: string | null
          published_date?: string | null
          relevance_score?: number | null
          search_query?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          authors?: string[]
          book_type?: string
          categories?: string[] | null
          created_at?: string
          description?: string | null
          figure_id?: string
          figure_name?: string
          google_books_id?: string | null
          id?: string
          info_link?: string | null
          isbn_10?: string | null
          isbn_13?: string | null
          language?: string | null
          page_count?: number | null
          preview_link?: string | null
          published_date?: string | null
          relevance_score?: number | null
          search_query?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cloned_voices: {
        Row: {
          audio_quality_score: number | null
          created_at: string
          figure_id: string
          figure_name: string
          id: string
          is_active: boolean | null
          provider: string | null
          source_description: string | null
          source_url: string | null
          updated_at: string
          voice_id: string
          voice_name: string
        }
        Insert: {
          audio_quality_score?: number | null
          created_at?: string
          figure_id: string
          figure_name: string
          id?: string
          is_active?: boolean | null
          provider?: string | null
          source_description?: string | null
          source_url?: string | null
          updated_at?: string
          voice_id: string
          voice_name: string
        }
        Update: {
          audio_quality_score?: number | null
          created_at?: string
          figure_id?: string
          figure_name?: string
          id?: string
          is_active?: boolean | null
          provider?: string | null
          source_description?: string | null
          source_url?: string | null
          updated_at?: string
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          figure_id: string
          figure_name: string
          id: string
          language: string | null
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          figure_id: string
          figure_name: string
          id?: string
          language?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          figure_id?: string
          figure_name?: string
          id?: string
          language?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          conversation_id: string | null
          created_at: string
          file_size: number
          file_type: string
          filename: string
          id: string
          parsed_content: string | null
          storage_path: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          file_size: number
          file_type: string
          filename: string
          id?: string
          parsed_content?: string | null
          storage_path: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          file_size?: number
          file_type?: string
          filename?: string
          id?: string
          parsed_content?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_voices: {
        Row: {
          created_at: string
          description: string | null
          figure_id: string | null
          id: string
          is_cloned: boolean | null
          updated_at: string
          voice_id: string
          voice_name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          figure_id?: string | null
          id?: string
          is_cloned?: boolean | null
          updated_at?: string
          voice_id: string
          voice_name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          figure_id?: string | null
          id?: string
          is_cloned?: boolean | null
          updated_at?: string
          voice_id?: string
          voice_name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          type: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_training_pipeline: {
        Row: {
          api_endpoint: string | null
          cleaned_audio_files: Json | null
          created_at: string
          current_step: number | null
          error_log: string | null
          figure_id: string
          figure_name: string
          id: string
          model_path: string | null
          raw_audio_files: Json | null
          status: string
          training_metrics: Json | null
          updated_at: string
          youtube_videos: Json | null
        }
        Insert: {
          api_endpoint?: string | null
          cleaned_audio_files?: Json | null
          created_at?: string
          current_step?: number | null
          error_log?: string | null
          figure_id: string
          figure_name: string
          id?: string
          model_path?: string | null
          raw_audio_files?: Json | null
          status?: string
          training_metrics?: Json | null
          updated_at?: string
          youtube_videos?: Json | null
        }
        Update: {
          api_endpoint?: string | null
          cleaned_audio_files?: Json | null
          created_at?: string
          current_step?: number | null
          error_log?: string | null
          figure_id?: string
          figure_name?: string
          id?: string
          model_path?: string | null
          raw_audio_files?: Json | null
          status?: string
          training_metrics?: Json | null
          updated_at?: string
          youtube_videos?: Json | null
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
