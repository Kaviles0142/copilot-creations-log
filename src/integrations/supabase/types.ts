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
      ai_response_cache: {
        Row: {
          ai_provider: string
          cache_key: string
          created_at: string
          expires_at: string
          figure_name: string | null
          hit_count: number | null
          id: string
          model: string | null
          response_content: string
        }
        Insert: {
          ai_provider: string
          cache_key: string
          created_at?: string
          expires_at: string
          figure_name?: string | null
          hit_count?: number | null
          id?: string
          model?: string | null
          response_content: string
        }
        Update: {
          ai_provider?: string
          cache_key?: string
          created_at?: string
          expires_at?: string
          figure_name?: string | null
          hit_count?: number | null
          id?: string
          model?: string | null
          response_content?: string
        }
        Relationships: []
      }
      audio_cache: {
        Row: {
          cached_audio: string
          created_at: string
          expires_at: string
          id: string
          text: string
          voice_id: string
        }
        Insert: {
          cached_audio: string
          created_at?: string
          expires_at?: string
          id?: string
          text: string
          voice_id: string
        }
        Update: {
          cached_audio?: string
          created_at?: string
          expires_at?: string
          id?: string
          text?: string
          voice_id?: string
        }
        Relationships: []
      }
      avatar_image_cache: {
        Row: {
          cache_version: string | null
          cloudinary_url: string
          created_at: string | null
          expires_at: string | null
          figure_id: string
          figure_name: string
          greeting_video_url: string | null
          id: string
          visual_prompt: string | null
        }
        Insert: {
          cache_version?: string | null
          cloudinary_url: string
          created_at?: string | null
          expires_at?: string | null
          figure_id: string
          figure_name: string
          greeting_video_url?: string | null
          id?: string
          visual_prompt?: string | null
        }
        Update: {
          cache_version?: string | null
          cloudinary_url?: string
          created_at?: string | null
          expires_at?: string | null
          figure_id?: string
          figure_name?: string
          greeting_video_url?: string | null
          id?: string
          visual_prompt?: string | null
        }
        Relationships: []
      }
      book_content_cache: {
        Row: {
          book_id: string
          book_title: string
          content_excerpt: string
          created_at: string
          expires_at: string | null
          figure_id: string
          figure_name: string
          full_content: string | null
          id: string
          relevance_score: number | null
          source: string
          updated_at: string
        }
        Insert: {
          book_id: string
          book_title: string
          content_excerpt: string
          created_at?: string
          expires_at?: string | null
          figure_id: string
          figure_name: string
          full_content?: string | null
          id?: string
          relevance_score?: number | null
          source?: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          book_title?: string
          content_excerpt?: string
          created_at?: string
          expires_at?: string | null
          figure_id?: string
          figure_name?: string
          full_content?: string | null
          id?: string
          relevance_score?: number | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      data_health_logs: {
        Row: {
          auto_fixes_applied: number
          check_timestamp: string
          error_message: string | null
          figures_checked: number
          health_results: Json | null
          id: string
          status: string
        }
        Insert: {
          auto_fixes_applied?: number
          check_timestamp?: string
          error_message?: string | null
          figures_checked?: number
          health_results?: Json | null
          id?: string
          status?: string
        }
        Update: {
          auto_fixes_applied?: number
          check_timestamp?: string
          error_message?: string | null
          figures_checked?: number
          health_results?: Json | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      debate_messages: {
        Row: {
          content: string
          created_at: string
          debate_session_id: string
          figure_id: string
          figure_name: string
          id: string
          is_user_message: boolean
          turn_number: number
        }
        Insert: {
          content: string
          created_at?: string
          debate_session_id: string
          figure_id: string
          figure_name: string
          id?: string
          is_user_message?: boolean
          turn_number: number
        }
        Update: {
          content?: string
          created_at?: string
          debate_session_id?: string
          figure_id?: string
          figure_name?: string
          id?: string
          is_user_message?: boolean
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "debate_messages_debate_session_id_fkey"
            columns: ["debate_session_id"]
            isOneToOne: false
            referencedRelation: "debate_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      debate_sessions: {
        Row: {
          created_at: string
          current_round: number
          current_turn: number
          figure_ids: string[]
          figure_names: string[]
          format: string
          id: string
          is_round_complete: boolean
          status: string
          topic: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_round?: number
          current_turn?: number
          figure_ids: string[]
          figure_names: string[]
          format?: string
          id?: string
          is_round_complete?: boolean
          status?: string
          topic: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_round?: number
          current_turn?: number
          figure_ids?: string[]
          figure_names?: string[]
          format?: string
          id?: string
          is_round_complete?: boolean
          status?: string
          topic?: string
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
      figure_metadata: {
        Row: {
          cache_version: string | null
          created_at: string
          figure_id: string
          figure_name: string
          id: string
          nationality: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          cache_version?: string | null
          created_at?: string
          figure_id: string
          figure_name: string
          id?: string
          nationality?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          cache_version?: string | null
          created_at?: string
          figure_id?: string
          figure_name?: string
          id?: string
          nationality?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
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
      news_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string
          id: string
          news_data: Json
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at: string
          id?: string
          news_data: Json
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          news_data?: Json
        }
        Relationships: []
      }
      podcast_messages: {
        Row: {
          content: string
          created_at: string
          figure_id: string
          figure_name: string
          id: string
          podcast_session_id: string
          speaker_role: string
          turn_number: number
        }
        Insert: {
          content: string
          created_at?: string
          figure_id: string
          figure_name: string
          id?: string
          podcast_session_id: string
          speaker_role: string
          turn_number: number
        }
        Update: {
          content?: string
          created_at?: string
          figure_id?: string
          figure_name?: string
          id?: string
          podcast_session_id?: string
          speaker_role?: string
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "podcast_messages_podcast_session_id_fkey"
            columns: ["podcast_session_id"]
            isOneToOne: false
            referencedRelation: "podcast_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_sessions: {
        Row: {
          created_at: string
          current_turn: number
          guest_id: string
          guest_name: string
          host_id: string
          host_name: string
          id: string
          language: string
          status: string
          topic: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          current_turn?: number
          guest_id: string
          guest_name: string
          host_id: string
          host_name: string
          id?: string
          language?: string
          status?: string
          topic: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          current_turn?: number
          guest_id?: string
          guest_name?: string
          host_id?: string
          host_name?: string
          id?: string
          language?: string
          status?: string
          topic?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      serpapi_cache: {
        Row: {
          created_at: string | null
          expires_at: string | null
          figure_id: string
          figure_name: string
          id: string
          query: string
          results: Json
          search_type: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          figure_id: string
          figure_name: string
          id?: string
          query: string
          results: Json
          search_type: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          figure_id?: string
          figure_name?: string
          id?: string
          query?: string
          results?: Json
          search_type?: string
        }
        Relationships: []
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
      youtube_transcripts: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          expires_at: string | null
          figure_id: string | null
          figure_name: string | null
          id: string
          transcript: string
          video_id: string
          video_title: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          figure_id?: string | null
          figure_name?: string | null
          id?: string
          transcript: string
          video_id: string
          video_title?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          expires_at?: string | null
          figure_id?: string | null
          figure_name?: string | null
          id?: string
          transcript?: string
          video_id?: string
          video_title?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_ai_cache: { Args: never; Returns: undefined }
      cleanup_expired_news_cache: { Args: never; Returns: undefined }
      get_cached_avatar: {
        Args: { p_figure_id: string }
        Returns: {
          cloudinary_url: string
          created_at: string
          figure_id: string
          figure_name: string
          id: string
        }[]
      }
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
