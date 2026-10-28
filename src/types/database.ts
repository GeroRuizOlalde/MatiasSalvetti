// Escrito a mano siguiendo el formato de `supabase gen types typescript`.
// Cuando el proyecto de Supabase esté conectado, se reemplaza con:
//   npm run db:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["user_role"];
          twitch_id: string | null;
          twitch_login: string | null;
          display_name: string;
          avatar_url: string | null;
          twitch_created_at: string | null;
          adult_confirmed_at: string | null;
          terms_version: number | null;
          terms_accepted_at: string | null;
          banned_at: string | null;
          ban_reason: string | null;
          xp: number;
          level: number;
          points: number;
          tickets: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: Database["public"]["Enums"]["user_role"];
          twitch_id?: string | null;
          twitch_login?: string | null;
          display_name?: string;
          avatar_url?: string | null;
          twitch_created_at?: string | null;
          adult_confirmed_at?: string | null;
          terms_version?: number | null;
          terms_accepted_at?: string | null;
          banned_at?: string | null;
          ban_reason?: string | null;
          xp?: number;
          level?: number;
          points?: number;
          tickets?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      site_settings: {
        Row: {
          key: string;
          value: Json;
          is_public: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          is_public?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Insert"]>;
        Relationships: [];
      };
      legal_documents: {
        Row: {
          id: string;
          kind: Database["public"]["Enums"]["legal_kind"];
          version: number;
          title: string;
          content_md: string;
          published_at: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          kind: Database["public"]["Enums"]["legal_kind"];
          version: number;
          title: string;
          content_md: string;
          published_at?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["legal_documents"]["Insert"]>;
        Relationships: [];
      };
      casinos: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_path: string | null;
          referral_url: string;
          code: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_path?: string | null;
          referral_url: string;
          code?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["casinos"]["Insert"]>;
        Relationships: [];
      };
      slots: {
        Row: {
          id: string;
          name: string;
          provider: string | null;
          image_path: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          provider?: string | null;
          image_path?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["slots"]["Insert"]>;
        Relationships: [];
      };
      rate_limits: {
        Row: { key: string; window_start: string; count: number };
        Insert: { key: string; window_start: string; count: number };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string | null;
          twitch_login: string | null;
          display_name: string | null;
          avatar_url: string | null;
          level: number | null;
          xp: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      accept_terms: { Args: { p_version: number }; Returns: undefined };
      auth_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["user_role"] };
      can_participate: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_legal_version: { Args: { p_kind: Database["public"]["Enums"]["legal_kind"] }; Returns: number };
      hit_rate_limit: { Args: { p_action: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      import_slots: { Args: { p_rows: Json }; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_mod: { Args: Record<PropertyKey, never>; Returns: boolean };
      search_slots: {
        Args: { p_query: string; p_limit?: number };
        Returns: Database["public"]["Tables"]["slots"]["Row"][];
      };
      set_user_ban: { Args: { p_user: string; p_banned: boolean; p_reason?: string }; Returns: undefined };
      set_user_role: {
        Args: { p_user: string; p_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      setting_int: { Args: { p_key: string; p_default: number }; Returns: number };
    };
    Enums: {
      currency_code: "ARS" | "USD";
      legal_kind: "terms" | "privacy" | "responsible_gaming";
      user_role: "viewer" | "mod" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
