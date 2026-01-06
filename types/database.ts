export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          description: string | null;
          type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          description?: string | null;
          type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          description?: string | null;
          type?: string | null;
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
          brand: string | null;
          price: number | null;
          currency: string | null;
          retailer: string | null;
          image_url: string | null;
          category: string | null;
          tags: string[] | null;
          attributes: Record<string, unknown>;
          user_notes: string | null;
          confidence_score: number | null;
          extraction_model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_url?: string | null;
          raw_markdown?: string | null;
          title: string;
          brand?: string | null;
          price?: number | null;
          currency?: string | null;
          retailer?: string | null;
          image_url?: string | null;
          category?: string | null;
          tags?: string[] | null;
          attributes?: Record<string, unknown>;
          user_notes?: string | null;
          confidence_score?: number | null;
          extraction_model?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_url?: string | null;
          raw_markdown?: string | null;
          title?: string;
          brand?: string | null;
          price?: number | null;
          currency?: string | null;
          retailer?: string | null;
          image_url?: string | null;
          category?: string | null;
          tags?: string[] | null;
          attributes?: Record<string, unknown>;
          user_notes?: string | null;
          confidence_score?: number | null;
          extraction_model?: string | null;
          created_at?: string;
          updated_at?: string;
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
    };
  };
};
