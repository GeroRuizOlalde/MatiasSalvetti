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
      hunts: {
        Row: {
          id: string;
          title: string;
          casino_id: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          start_cost: number;
          status: Database["public"]["Enums"]["hunt_status"];
          calls_open: boolean;
          guesses_open: boolean;
          final_balance: number | null;
          gtb_winner_id: string | null;
          finished_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          casino_id?: string | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          start_cost: number;
          status?: Database["public"]["Enums"]["hunt_status"];
          calls_open?: boolean;
          guesses_open?: boolean;
          final_balance?: number | null;
          gtb_winner_id?: string | null;
          finished_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hunts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "hunts_casino_id_fkey";
            columns: ["casino_id"];
            isOneToOne: false;
            referencedRelation: "casinos";
            referencedColumns: ["id"];
          },
        ];
      };
      hunt_bonuses: {
        Row: {
          id: string;
          hunt_id: string;
          position: number;
          slot_id: string | null;
          slot_name: string;
          provider: string | null;
          bet: number;
          payout: number | null;
          multi: number | null;
          called_by: string | null;
          opened_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hunt_id: string;
          position?: number;
          slot_id?: string | null;
          slot_name: string;
          provider?: string | null;
          bet: number;
          payout?: number | null;
          called_by?: string | null;
          opened_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hunt_bonuses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "hunt_bonuses_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hunt_bonuses_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "slots";
            referencedColumns: ["id"];
          },
        ];
      };
      hunt_calls: {
        Row: {
          id: string;
          hunt_id: string;
          user_id: string;
          slot_id: string | null;
          slot_name: string;
          status: Database["public"]["Enums"]["call_status"];
          bonus_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hunt_id: string;
          user_id: string;
          slot_id?: string | null;
          slot_name: string;
          status?: Database["public"]["Enums"]["call_status"];
          bonus_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hunt_calls"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "hunt_calls_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
        ];
      };
      hunt_guesses: {
        Row: {
          id: string;
          hunt_id: string;
          user_id: string;
          amount: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hunt_id: string;
          user_id: string;
          amount: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["hunt_guesses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "hunt_guesses_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
        ];
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
      accept_hunt_call: { Args: { p_call: string; p_bet: number }; Returns: string };
      accept_terms: { Args: { p_version: number }; Returns: undefined };
      auth_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["user_role"] };
      can_participate: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_legal_version: { Args: { p_kind: Database["public"]["Enums"]["legal_kind"] }; Returns: number };
      hit_rate_limit: { Args: { p_action: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      hunt_guess_count: { Args: { p_hunt: string }; Returns: number };
      import_slots: { Args: { p_rows: Json }; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_mod: { Args: Record<PropertyKey, never>; Returns: boolean };
      reject_hunt_call: { Args: { p_call: string }; Returns: undefined };
      search_slots: {
        Args: { p_query: string; p_limit?: number };
        Returns: Database["public"]["Tables"]["slots"]["Row"][];
      };
      set_user_ban: { Args: { p_user: string; p_banned: boolean; p_reason?: string }; Returns: undefined };
      set_user_role: {
        Args: { p_user: string; p_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      submit_hunt_call: {
        Args: { p_hunt: string; p_slot?: string | null; p_slot_name?: string | null };
        Returns: string;
      };
      submit_hunt_guess: { Args: { p_hunt: string; p_amount: number }; Returns: undefined };
      setting_int: { Args: { p_key: string; p_default: number }; Returns: number };
    };
    Enums: {
      call_status: "pending" | "accepted" | "rejected";
      currency_code: "ARS" | "USD";
      hunt_status: "draft" | "collecting" | "opening" | "finished";
      legal_kind: "terms" | "privacy" | "responsible_gaming";
      user_role: "viewer" | "mod" | "admin";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
