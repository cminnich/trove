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
          collection_id: string | null;
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
          collection_id?: string | null;
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
          collection_id?: string | null;
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
    };
  };
};
