export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          frequency_type: string;
          frequency_value: Json | null;
          color: string;
          created_at: string;
          archived_at: string | null;
          reminder_time: string | null;
          last_notified_date: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          frequency_type: string;
          frequency_value?: Json | null;
          color: string;
          created_at?: string;
          archived_at?: string | null;
          reminder_time?: string | null;
          last_notified_date?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          frequency_type?: string;
          frequency_value?: Json | null;
          color?: string;
          created_at?: string;
          archived_at?: string | null;
          reminder_time?: string | null;
          last_notified_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'habits_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      completions: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          completed_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          completed_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          habit_id?: string;
          completed_date?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'completions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'completions_habit_id_fkey';
            columns: ['habit_id'];
            isOneToOne: false;
            referencedRelation: 'habits';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
