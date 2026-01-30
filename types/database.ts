export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          default_visibility: 'public' | 'private';
          username: string | null;
          bio: string | null;
          website: string | null;
          social_reddit: string | null;
          social_x: string | null;
          social_github: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          default_visibility?: 'public' | 'private';
          username?: string | null;
          bio?: string | null;
          website?: string | null;
          social_reddit?: string | null;
          social_x?: string | null;
          social_github?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          default_visibility?: 'public' | 'private';
          username?: string | null;
          bio?: string | null;
          website?: string | null;
          social_reddit?: string | null;
          social_x?: string | null;
          social_github?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          owner_id: string | null;
          name: string;
          description: string | null;
          type: string | null;
          visibility: 'public' | 'private';
          ai_overview: string | null;
          ai_overview_generated_at: string | null;
          ai_overview_model: string | null;
          ai_overview_valid: boolean;
          ai_mode: 'standard' | 'researcher' | 'curator';
          custom_prompt: string | null;
          fork_count: number;
          star_count: number;
          is_forkable: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          name: string;
          description?: string | null;
          type?: string | null;
          visibility?: 'public' | 'private';
          ai_overview?: string | null;
          ai_overview_generated_at?: string | null;
          ai_overview_model?: string | null;
          ai_overview_valid?: boolean;
          ai_mode?: 'standard' | 'researcher' | 'curator';
          custom_prompt?: string | null;
          fork_count?: number;
          star_count?: number;
          is_forkable?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          name?: string;
          description?: string | null;
          type?: string | null;
          visibility?: 'public' | 'private';
          ai_overview?: string | null;
          ai_overview_generated_at?: string | null;
          ai_overview_model?: string | null;
          ai_overview_valid?: boolean;
          ai_mode?: 'standard' | 'researcher' | 'curator';
          custom_prompt?: string | null;
          fork_count?: number;
          star_count?: number;
          is_forkable?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      collection_forks: {
        Row: {
          id: string;
          source_collection_id: string | null;
          forked_collection_id: string;
          forked_at: string;
          source_owner_username: string | null;
          source_collection_name: string | null;
        };
        Insert: {
          id?: string;
          source_collection_id?: string | null;
          forked_collection_id: string;
          forked_at?: string;
          source_owner_username?: string | null;
          source_collection_name?: string | null;
        };
        Update: {
          id?: string;
          source_collection_id?: string | null;
          forked_collection_id?: string;
          forked_at?: string;
          source_owner_username?: string | null;
          source_collection_name?: string | null;
        };
      };
      collection_stars: {
        Row: {
          id: string;
          user_id: string;
          collection_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          collection_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          collection_id?: string;
          created_at?: string;
        };
      };
      items: {
        Row: {
          id: string;
          source_url: string | null;
          raw_markdown: string | null;
          title: string | null;
          item_type: string;
          brand: string | null;
          price: number | null;
          currency: string | null;
          retailer: string | null;
          image_url: string | null;
          category: string | null;
          tags: string[] | null;
          attributes: Record<string, unknown>;
          confidence_score: number | null;
          extraction_model: string | null;
          extraction_status: 'pending' | 'processing' | 'complete' | 'failed';
          extraction_error: string | null;
          extraction_started_at: string | null;
          extraction_completed_at: string | null;
          last_viewed_at: string | null;
          last_extracted_at: string | null;
          current_snapshot_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_url?: string | null;
          raw_markdown?: string | null;
          title?: string | null;
          item_type?: string;
          brand?: string | null;
          price?: number | null;
          currency?: string | null;
          retailer?: string | null;
          image_url?: string | null;
          category?: string | null;
          tags?: string[] | null;
          attributes?: Record<string, unknown>;
          confidence_score?: number | null;
          extraction_model?: string | null;
          extraction_status?: 'pending' | 'processing' | 'complete' | 'failed';
          extraction_error?: string | null;
          extraction_started_at?: string | null;
          extraction_completed_at?: string | null;
          last_viewed_at?: string | null;
          last_extracted_at?: string | null;
          current_snapshot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_url?: string | null;
          raw_markdown?: string | null;
          title?: string | null;
          item_type?: string;
          brand?: string | null;
          price?: number | null;
          currency?: string | null;
          retailer?: string | null;
          image_url?: string | null;
          category?: string | null;
          tags?: string[] | null;
          attributes?: Record<string, unknown>;
          confidence_score?: number | null;
          extraction_model?: string | null;
          extraction_status?: 'pending' | 'processing' | 'complete' | 'failed';
          extraction_error?: string | null;
          extraction_started_at?: string | null;
          extraction_completed_at?: string | null;
          last_viewed_at?: string | null;
          last_extracted_at?: string | null;
          current_snapshot_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      item_snapshots: {
        Row: {
          id: string;
          item_id: string;
          price: number | null;
          currency: string | null;
          image_url: string | null;
          raw_markdown: string | null;
          captured_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          price?: number | null;
          currency?: string | null;
          image_url?: string | null;
          raw_markdown?: string | null;
          captured_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          price?: number | null;
          currency?: string | null;
          image_url?: string | null;
          raw_markdown?: string | null;
          captured_at?: string;
          created_at?: string;
        };
      };
      collection_items: {
        Row: {
          collection_id: string;
          item_id: string;
          added_at: string;
          position: number | null;
          notes: string | null;
        };
        Insert: {
          collection_id: string;
          item_id: string;
          added_at?: string;
          position?: number | null;
          notes?: string | null;
        };
        Update: {
          collection_id?: string;
          item_id?: string;
          added_at?: string;
          position?: number | null;
          notes?: string | null;
        };
      };
      collection_access: {
        Row: {
          id: string;
          collection_id: string;
          invited_identity: string;
          user_id: string | null;
          access_level: 'viewer' | 'editor';
          expires_at: string | null;
          granted_by: string;
          granted_at: string;
          claimed_at: string | null;
        };
        Insert: {
          id?: string;
          collection_id: string;
          invited_identity: string;
          user_id?: string | null;
          access_level: 'viewer' | 'editor';
          expires_at?: string | null;
          granted_by: string;
          granted_at?: string;
          claimed_at?: string | null;
        };
        Update: {
          id?: string;
          collection_id?: string;
          invited_identity?: string;
          user_id?: string | null;
          access_level?: 'viewer' | 'editor';
          expires_at?: string | null;
          granted_by?: string;
          granted_at?: string;
          claimed_at?: string | null;
        };
      };
      attribute_schemas: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          description: string | null;
          source_type: 'direct' | 'computed' | 'extracted';
          source_field: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          description?: string | null;
          source_type: 'direct' | 'computed' | 'extracted';
          source_field?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_name?: string;
          description?: string | null;
          source_type?: 'direct' | 'computed' | 'extracted';
          source_field?: string | null;
          is_active?: boolean;
          display_order?: number;
          created_at?: string;
        };
      };
      item_attributes: {
        Row: {
          id: string;
          item_id: string;
          schema_id: string | null;
          collection_schema_id: string | null;
          raw_value: string;
          normalized_value: string;
          group_key: string;
          confidence: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          schema_id?: string | null;
          collection_schema_id?: string | null;
          raw_value: string;
          normalized_value: string;
          group_key: string;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          schema_id?: string | null;
          collection_schema_id?: string | null;
          raw_value?: string;
          normalized_value?: string;
          group_key?: string;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_pinned_connections: {
        Row: {
          id: string;
          user_id: string;
          schema_id: string;
          is_pinned: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          schema_id: string;
          is_pinned?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          schema_id?: string;
          is_pinned?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      collection_filter_preferences: {
        Row: {
          id: string;
          collection_id: string;
          schema_id: string;
          is_hidden: boolean;
          force_show: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          schema_id: string;
          is_hidden?: boolean;
          force_show?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          schema_id?: string;
          is_hidden?: boolean;
          force_show?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      collection_attribute_schemas: {
        Row: {
          id: string;
          collection_id: string;
          name: string;
          display_name: string;
          description: string | null;
          source_path: string;
          value_type: 'string' | 'number' | 'numeric_range';
          range_config: Record<string, unknown>[] | null;
          discovery_confidence: number | null;
          sample_values: string[] | null;
          item_coverage: number | null;
          is_visible: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          name: string;
          display_name: string;
          description?: string | null;
          source_path: string;
          value_type?: 'string' | 'number' | 'numeric_range';
          range_config?: Record<string, unknown>[] | null;
          discovery_confidence?: number | null;
          sample_values?: string[] | null;
          item_coverage?: number | null;
          is_visible?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          name?: string;
          display_name?: string;
          description?: string | null;
          source_path?: string;
          value_type?: 'string' | 'number' | 'numeric_range';
          range_config?: Record<string, unknown>[] | null;
          discovery_confidence?: number | null;
          sample_values?: string[] | null;
          item_coverage?: number | null;
          is_visible?: boolean;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_user_collection: {
        Args: {
          collection_name: string;
          collection_description?: string | null;
          collection_type?: string | null;
          collection_visibility?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
