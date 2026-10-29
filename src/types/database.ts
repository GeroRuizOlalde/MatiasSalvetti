// Escrito a mano siguiendo el formato de `supabase gen types typescript`.
// Cuando el proyecto de Supabase esté conectado, se reemplaza con:
//   npm run db:types

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      notifications: {
        Row: {
          id: string;
          audience: "user" | "all" | "panel";
          user_id: string | null;
          kind: string;
          title: string;
          body: string | null;
          link: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          audience: "user" | "all" | "panel";
          user_id?: string | null;
          kind: string;
          title: string;
          body?: string | null;
          link?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
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
          notifications_read_at: string;
          panel_notifications_read_at: string;
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
          notifications_read_at?: string;
          panel_notifications_read_at?: string;
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
          opening_balance: number;
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
          opening_balance?: number;
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
      buy_sessions: {
        Row: {
          id: string;
          title: string;
          casino_id: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          status: Database["public"]["Enums"]["buy_session_status"];
          calls_open: boolean;
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
          status?: Database["public"]["Enums"]["buy_session_status"];
          calls_open?: boolean;
          finished_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["buy_sessions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "buy_sessions_casino_id_fkey";
            columns: ["casino_id"];
            isOneToOne: false;
            referencedRelation: "casinos";
            referencedColumns: ["id"];
          },
        ];
      };
      buys: {
        Row: {
          id: string;
          session_id: string;
          position: number;
          slot_id: string | null;
          slot_name: string;
          provider: string | null;
          bet: number;
          cost: number;
          payout: number | null;
          multi: number | null;
          opened_at: string | null;
          called_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          position?: number;
          slot_id?: string | null;
          slot_name: string;
          provider?: string | null;
          bet: number;
          cost: number;
          payout?: number | null;
          opened_at?: string | null;
          called_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["buys"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "buys_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "buy_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      buy_calls: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          slot_id: string | null;
          slot_name: string;
          status: Database["public"]["Enums"]["call_status"];
          buy_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          slot_id?: string | null;
          slot_name: string;
          status?: Database["public"]["Enums"]["call_status"];
          buy_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["buy_calls"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "buy_calls_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "buy_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      buy_polls: {
        Row: {
          id: string;
          session_id: string;
          is_open: boolean;
          winner_option_id: string | null;
          created_at: string;
          closed_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          is_open?: boolean;
          winner_option_id?: string | null;
          created_at?: string;
          closed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["buy_polls"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "buy_polls_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "buy_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      buy_poll_options: {
        Row: {
          id: string;
          poll_id: string;
          position: number;
          slot_id: string | null;
          slot_name: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          position: number;
          slot_id?: string | null;
          slot_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["buy_poll_options"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "buy_poll_options_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "buy_polls";
            referencedColumns: ["id"];
          },
        ];
      };
      buy_poll_votes: {
        Row: {
          poll_id: string;
          user_id: string;
          option_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          poll_id: string;
          user_id: string;
          option_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["buy_poll_votes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "buy_poll_votes_poll_id_fkey";
            columns: ["poll_id"];
            isOneToOne: false;
            referencedRelation: "buy_polls";
            referencedColumns: ["id"];
          },
        ];
      };
      battles: {
        Row: {
          id: string;
          title: string;
          casino_id: string | null;
          currency: Database["public"]["Enums"]["currency_code"];
          status: Database["public"]["Enums"]["battle_status"];
          size: number;
          winner_entry_id: string | null;
          started_at: string | null;
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
          status?: Database["public"]["Enums"]["battle_status"];
          size?: number;
          winner_entry_id?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["battles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "battles_casino_id_fkey";
            columns: ["casino_id"];
            isOneToOne: false;
            referencedRelation: "casinos";
            referencedColumns: ["id"];
          },
        ];
      };
      battle_calls: {
        Row: {
          id: string;
          battle_id: string;
          user_id: string;
          slot_id: string | null;
          slot_name: string;
          status: Database["public"]["Enums"]["call_status"];
          entry_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          battle_id: string;
          user_id: string;
          slot_id?: string | null;
          slot_name: string;
          status?: Database["public"]["Enums"]["call_status"];
          entry_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["battle_calls"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "battle_calls_battle_id_fkey";
            columns: ["battle_id"];
            isOneToOne: false;
            referencedRelation: "battles";
            referencedColumns: ["id"];
          },
        ];
      };
      battle_entries: {
        Row: {
          id: string;
          battle_id: string;
          seed: number;
          slot_id: string | null;
          slot_name: string;
          provider: string | null;
          called_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          battle_id: string;
          seed?: number;
          slot_id?: string | null;
          slot_name: string;
          provider?: string | null;
          called_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["battle_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "battle_entries_battle_id_fkey";
            columns: ["battle_id"];
            isOneToOne: false;
            referencedRelation: "battles";
            referencedColumns: ["id"];
          },
        ];
      };
      battle_matches: {
        Row: {
          id: string;
          battle_id: string;
          round: number;
          slot: number;
          entry_a: string | null;
          entry_b: string | null;
          bet_a: number | null;
          payout_a: number | null;
          bet_b: number | null;
          payout_b: number | null;
          winner_entry_id: string | null;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          battle_id: string;
          round: number;
          slot: number;
          entry_a?: string | null;
          entry_b?: string | null;
          bet_a?: number | null;
          payout_a?: number | null;
          bet_b?: number | null;
          payout_b?: number | null;
          winner_entry_id?: string | null;
          decided_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["battle_matches"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "battle_matches_battle_id_fkey";
            columns: ["battle_id"];
            isOneToOne: false;
            referencedRelation: "battles";
            referencedColumns: ["id"];
          },
        ];
      };
      battle_picks: {
        Row: {
          battle_id: string;
          user_id: string;
          entry_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          battle_id: string;
          user_id: string;
          entry_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["battle_picks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "battle_picks_battle_id_fkey";
            columns: ["battle_id"];
            isOneToOne: false;
            referencedRelation: "battles";
            referencedColumns: ["id"];
          },
        ];
      };
      casino_accounts: {
        Row: {
          id: string;
          user_id: string;
          casino_id: string;
          account_id: string;
          screenshot_path: string | null;
          status: Database["public"]["Enums"]["verification_status"];
          reject_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          casino_id: string;
          account_id: string;
          screenshot_path?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          reject_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["casino_accounts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "casino_accounts_casino_id_fkey";
            columns: ["casino_id"];
            isOneToOne: false;
            referencedRelation: "casinos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "casino_accounts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      wager_races: {
        Row: {
          id: string;
          title: string;
          casino_id: string;
          currency: Database["public"]["Enums"]["currency_code"];
          starts_at: string;
          ends_at: string;
          prizes: number[];
          rules_md: string | null;
          status: Database["public"]["Enums"]["wager_race_status"];
          wager_updated_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          casino_id: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          starts_at: string;
          ends_at: string;
          prizes?: number[];
          rules_md?: string | null;
          status?: Database["public"]["Enums"]["wager_race_status"];
          wager_updated_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wager_races"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "wager_races_casino_id_fkey";
            columns: ["casino_id"];
            isOneToOne: false;
            referencedRelation: "casinos";
            referencedColumns: ["id"];
          },
        ];
      };
      wager_entries: {
        Row: {
          race_id: string;
          account_id: string;
          wager: number;
          updated_at: string;
        };
        Insert: {
          race_id: string;
          account_id: string;
          wager: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["wager_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "wager_entries_race_id_fkey";
            columns: ["race_id"];
            isOneToOne: false;
            referencedRelation: "wager_races";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wager_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "casino_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      point_events: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          source_id: string | null;
          points: number;
          xp: number;
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          source_id?: string | null;
          points?: number;
          xp?: number;
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["point_events"]["Insert"]>;
        Relationships: [];
      };
      missions: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          type: Database["public"]["Enums"]["mission_type"];
          points: number;
          xp: number;
          url: string | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          type: Database["public"]["Enums"]["mission_type"];
          points?: number;
          xp?: number;
          url?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["missions"]["Insert"]>;
        Relationships: [];
      };
      mission_codes: {
        Row: {
          mission_id: string;
          code: string;
        };
        Insert: {
          mission_id: string;
          code: string;
        };
        Update: Partial<Database["public"]["Tables"]["mission_codes"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "mission_codes_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_claims: {
        Row: {
          mission_id: string;
          user_id: string;
          claim_key: string;
          created_at: string;
        };
        Insert: {
          mission_id: string;
          user_id: string;
          claim_key: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mission_claims"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "mission_claims_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_items: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          image_path: string | null;
          kind: Database["public"]["Enums"]["shop_item_kind"];
          tickets: number | null;
          cost: number;
          stock: number | null;
          per_user_limit: number | null;
          min_level: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          image_path?: string | null;
          kind?: Database["public"]["Enums"]["shop_item_kind"];
          tickets?: number | null;
          cost: number;
          stock?: number | null;
          per_user_limit?: number | null;
          min_level?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shop_items"]["Insert"]>;
        Relationships: [];
      };
      shop_orders: {
        Row: {
          id: string;
          item_id: string | null;
          user_id: string;
          item_title: string;
          cost: number;
          status: Database["public"]["Enums"]["order_status"];
          note: string | null;
          handled_by: string | null;
          handled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id?: string | null;
          user_id: string;
          item_title: string;
          cost: number;
          status: Database["public"]["Enums"]["order_status"];
          note?: string | null;
          handled_by?: string | null;
          handled_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shop_orders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shop_orders_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "shop_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      giveaways: {
        Row: {
          id: string;
          title: string;
          prize: string;
          description: string | null;
          image_path: string | null;
          starts_at: string;
          ends_at: string;
          status: Database["public"]["Enums"]["giveaway_status"];
          entry_mode: Database["public"]["Enums"]["giveaway_entry_mode"];
          max_tickets_per_user: number;
          winners_count: number;
          min_level: number;
          casino_id: string | null;
          drawn_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          prize: string;
          description?: string | null;
          image_path?: string | null;
          starts_at?: string;
          ends_at: string;
          status?: Database["public"]["Enums"]["giveaway_status"];
          entry_mode?: Database["public"]["Enums"]["giveaway_entry_mode"];
          max_tickets_per_user?: number;
          winners_count?: number;
          min_level?: number;
          casino_id?: string | null;
          drawn_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["giveaways"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "giveaways_casino_id_fkey";
            columns: ["casino_id"];
            isOneToOne: false;
            referencedRelation: "casinos";
            referencedColumns: ["id"];
          },
        ];
      };
      giveaway_entries: {
        Row: {
          giveaway_id: string;
          user_id: string;
          entries: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          giveaway_id: string;
          user_id: string;
          entries: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["giveaway_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "giveaway_entries_giveaway_id_fkey";
            columns: ["giveaway_id"];
            isOneToOne: false;
            referencedRelation: "giveaways";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "giveaway_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      giveaway_winners: {
        Row: {
          giveaway_id: string;
          user_id: string;
          position: number;
          status: Database["public"]["Enums"]["winner_status"];
          drawn_at: string;
        };
        Insert: {
          giveaway_id: string;
          user_id: string;
          position: number;
          status?: Database["public"]["Enums"]["winner_status"];
          drawn_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["giveaway_winners"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "giveaway_winners_giveaway_id_fkey";
            columns: ["giveaway_id"];
            isOneToOne: false;
            referencedRelation: "giveaways";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "giveaway_winners_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      replay_providers: {
        Row: { id: string; name: string; domain: string; embeddable: boolean; created_at: string };
        Insert: { id?: string; name: string; domain: string; embeddable?: boolean; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["replay_providers"]["Insert"]>;
        Relationships: [];
      };
      replays: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          host: string;
          slot_id: string | null;
          slot_name: string;
          multi: number | null;
          note: string | null;
          status: "pending" | "approved" | "rejected";
          reject_reason: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          host: string;
          slot_id?: string | null;
          slot_name: string;
          multi?: number | null;
          note?: string | null;
          status?: "pending" | "approved" | "rejected";
          reject_reason?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["replays"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "replays_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tipeos: {
        Row: {
          id: string;
          bonus_id: string | null;
          hunt_id: string | null;
          buy_id: string | null;
          session_id: string | null;
          user_id: string | null;
          slot_name: string | null;
          bet: number | null;
          payout: number | null;
          multi: number | null;
          status: Database["public"]["Enums"]["tipeo_status"];
          note: string | null;
          decided_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bonus_id?: string | null;
          hunt_id?: string | null;
          buy_id?: string | null;
          session_id?: string | null;
          user_id?: string | null;
          slot_name?: string | null;
          bet?: number | null;
          payout?: number | null;
          multi?: number | null;
          status: Database["public"]["Enums"]["tipeo_status"];
          note?: string | null;
          decided_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tipeos"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "tipeos_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "buy_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tipeos_hunt_id_fkey";
            columns: ["hunt_id"];
            isOneToOne: false;
            referencedRelation: "hunts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tipeos_bonus_id_fkey";
            columns: ["bonus_id"];
            isOneToOne: true;
            referencedRelation: "hunt_bonuses";
            referencedColumns: ["id"];
          },
        ];
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
      accept_battle_call: { Args: { p_call: string }; Returns: string };
      accept_buy_call: { Args: { p_call: string; p_bet: number; p_cost: number }; Returns: string };
      accept_hunt_call: { Args: { p_call: string; p_bet: number }; Returns: string };
      accept_terms: { Args: { p_version: number }; Returns: undefined };
      admin_adjust_points: {
        Args: { p_user: string; p_points: number; p_xp: number; p_note: string };
        Returns: undefined;
      };
      auth_role: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Enums"]["user_role"] };
      battle_pick_counts: { Args: { p_battle: string }; Returns: { entry_id: string; picks: number }[] };
      buy_poll_counts: { Args: { p_session: string }; Returns: { option_id: string; votes: number }[] };
      buy_shop_item: { Args: { p_item: string }; Returns: string };
      can_participate: { Args: Record<PropertyKey, never>; Returns: boolean };
      cast_buy_vote: { Args: { p_option: string }; Returns: undefined };
      check_overlay_token: { Args: { p_key: string }; Returns: boolean };
      decide_buy_tipeo: { Args: { p_buy: string; p_give: boolean }; Returns: string };
      give_manual_tipeo: { Args: { p_user: string; p_note: string; p_slot?: string | null }; Returns: string };
      submit_replay: {
        Args: {
          p_url: string;
          p_slot?: string | null;
          p_slot_name?: string | null;
          p_multi?: number | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      review_replay: { Args: { p_id: string; p_approve: boolean; p_reason?: string | null }; Returns: undefined };
      remove_manual_tipeo: { Args: { p_tipeo: string }; Returns: undefined };
      decide_tipeo: { Args: { p_bonus: string; p_give: boolean }; Returns: string };
      claim_mission: { Args: { p_mission: string; p_code?: string | null }; Returns: undefined };
      close_buy_poll: { Args: { p_session: string }; Returns: undefined };
      current_legal_version: { Args: { p_kind: Database["public"]["Enums"]["legal_kind"] }; Returns: number };
      draw_giveaway: { Args: { p_giveaway: string; p_count?: number | null }; Returns: number };
      enter_giveaway: { Args: { p_giveaway: string; p_tickets?: number }; Returns: number };
      giveaway_stats: { Args: { p_giveaway: string }; Returns: { participants: number; entries: number }[] };
      handle_shop_order: { Args: { p_order: string; p_deliver: boolean; p_note?: string | null }; Returns: undefined };
      hit_rate_limit: { Args: { p_action: string; p_limit: number; p_window_seconds: number }; Returns: boolean };
      battle_taken_slots: { Args: { p_battle: string }; Returns: { slot_name: string }[] };
      reject_battle_call: { Args: { p_call: string }; Returns: undefined };
      submit_battle_call: {
        Args: { p_battle: string; p_slot?: string | null; p_slot_name?: string | null };
        Returns: string;
      };
      buy_taken_slots: { Args: { p_session: string }; Returns: { slot_name: string }[] };
      reject_buy_call: { Args: { p_call: string }; Returns: undefined };
      submit_buy_call: {
        Args: { p_session: string; p_slot?: string | null; p_slot_name?: string | null };
        Returns: string;
      };
      mark_notifications_read: { Args: { p_panel?: boolean }; Returns: undefined };
      hunt_taken_slots: { Args: { p_hunt: string }; Returns: { slot_name: string }[] };
      hunt_guess_count: { Args: { p_hunt: string }; Returns: number };
      import_slots: { Args: { p_rows: Json }; Returns: number };
      import_wagers: { Args: { p_race: string; p_rows: Json }; Returns: Json };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_mod: { Args: Record<PropertyKey, never>; Returns: boolean };
      level_for_xp: { Args: { p_xp: number }; Returns: number };
      mask_account_id: { Args: { p_id: string }; Returns: string };
      open_buy_poll: { Args: { p_session: string; p_options: Json }; Returns: string };
      pick_battle_entry: { Args: { p_entry: string }; Returns: undefined };
      reject_hunt_call: { Args: { p_call: string }; Returns: undefined };
      reset_battle: { Args: { p_battle: string }; Returns: undefined };
      review_casino_account: {
        Args: { p_id: string; p_approve: boolean; p_reason?: string | null };
        Returns: undefined;
      };
      search_slots: {
        Args: { p_query: string; p_limit?: number };
        Returns: Database["public"]["Tables"]["slots"]["Row"][];
      };
      set_user_ban: { Args: { p_user: string; p_banned: boolean; p_reason?: string }; Returns: undefined };
      set_user_role: {
        Args: { p_user: string; p_role: Database["public"]["Enums"]["user_role"] };
        Returns: undefined;
      };
      set_winner_status: {
        Args: { p_giveaway: string; p_user: string; p_status: Database["public"]["Enums"]["winner_status"] };
        Returns: undefined;
      };
      setting_int: { Args: { p_key: string; p_default: number }; Returns: number };
      start_battle: { Args: { p_battle: string }; Returns: undefined };
      submit_casino_account: {
        Args: { p_casino: string; p_account_id: string; p_screenshot_path: string };
        Returns: string;
      };
      submit_hunt_call: {
        Args: { p_hunt: string; p_slot?: string | null; p_slot_name?: string | null };
        Returns: string;
      };
      submit_hunt_guess: { Args: { p_hunt: string; p_amount: number }; Returns: undefined };
      wager_leaderboard: {
        Args: { p_race: string; p_limit?: number };
        Returns: {
          rank: number;
          user_id: string;
          display_name: string;
          avatar_url: string | null;
          masked_account: string;
          wager: number;
          prize: number | null;
        }[];
      };
    };
    Enums: {
      battle_status: "draft" | "open" | "live" | "finished";
      buy_session_status: "draft" | "live" | "finished";
      call_status: "pending" | "accepted" | "rejected";
      currency_code: "ARS" | "USD";
      giveaway_entry_mode: "free" | "tickets";
      giveaway_status: "draft" | "published";
      hunt_status: "draft" | "collecting" | "opening" | "finished";
      legal_kind: "terms" | "privacy" | "responsible_gaming";
      mission_type: "daily" | "code" | "link";
      order_status: "pending" | "delivered" | "cancelled";
      shop_item_kind: "reward" | "tickets";
      tipeo_status: "given" | "dismissed";
      user_role: "viewer" | "mod" | "admin";
      verification_status: "pending" | "approved" | "rejected";
      wager_race_status: "draft" | "published";
      winner_status: "pending" | "contacted" | "delivered" | "void";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
