export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
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
          created_at?: string;
          updated_at?: string;
        };
      };
      items: {
        Row: {
          id: string;
          source_url: string | null;
          raw_markdown: string | null;
          title: string;
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
          title: string;
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
          title?: string;
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
