// Supabase 자동 생성 타입을 정리한 것 — downforce-v1 (2026-09-27, 마이그레이션 001~008 기준 · 011 피드는 손으로 추가). 헬퍼 타입만 간소화
// 스키마를 바꾸면 다시 생성한다. 손으로 고치지 않는다.
/** 005 — profiles.account_type. 회원이 직접 바꿀 수 없다 */
export type AccountType = 'member' | 'founder' | 'developer' | 'tester'

/** 011 — 피드 */
export type FeedEmoji = 'fire' | 'clap' | 'muscle'
export type FeedReportReason = 'spam' | 'abuse' | 'private' | 'other'
export type FeedRow = {
  id: string; user_id: string; handle: string; display_name: string; avatar_url: string | null
  title: string; axis: 'work' | 'life'; window_start: string | null; window_end: string | null; caption: string | null
  local_date: string; created_at: string; hidden: boolean
  streak: number; fire: number; clap: number; muscle: number; my_reaction: FeedEmoji | null
  import_count: number | null; imported_by_me: boolean; is_mine: boolean
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      // 011 · 피드
      feed_posts: {
        Row: { id: string; user_id: string; checkin_id: string; title: string; axis: 'work' | 'life'; window_start: string | null; window_end: string | null; caption: string | null; local_date: string; created_at: string; hidden_at: string | null }
        Insert: { user_id: string; checkin_id: string; caption?: string | null; title?: string; axis?: 'work' | 'life'; local_date?: string }
        Update: Record<string, never>
        Relationships: []
      }
      feed_reactions: {
        Row: { post_id: string; user_id: string; emoji: FeedEmoji; created_at: string }
        Insert: { post_id: string; user_id: string; emoji: FeedEmoji }
        Update: { emoji?: FeedEmoji }
        Relationships: []
      }
      feed_imports: {
        Row: { post_id: string; user_id: string; routine_id: string | null; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      feed_mutes: {
        Row: { user_id: string; muted_user_id: string; created_at: string }
        Insert: { user_id: string; muted_user_id: string }
        Update: never
        Relationships: []
      }
      feed_reports: {
        Row: { post_id: string; reporter_id: string; reason: FeedReportReason; created_at: string }
        Insert: { post_id: string; reporter_id: string; reason: FeedReportReason }
        Update: never
        Relationships: []
      }
      app_opens: {
        Row: { local_date: string; user_id: string }
        Insert: { local_date: string; user_id: string }
        Update: { local_date?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "app_opens_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      card_dismissals: {
        Row: { card_key: string; dismissed_at: string; mute_until: string | null; user_id: string }
        Insert: { card_key: string; dismissed_at?: string; mute_until?: string | null; user_id: string }
        Update: { card_key?: string; dismissed_at?: string; mute_until?: string | null; user_id?: string }
        Relationships: [
          { foreignKeyName: "card_dismissals_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      calendar_notes: {
        Row: { body: string; created_at: string; id: string; note_date: string; time_of_day: string | null; user_id: string }
        Insert: { body: string; created_at?: string; id?: string; note_date: string; time_of_day?: string | null; user_id: string }
        Update: { body?: string; created_at?: string; id?: string; note_date?: string; time_of_day?: string | null; user_id?: string }
        Relationships: [
          { foreignKeyName: "calendar_notes_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      checkin_photos: {
        Row: { bytes: number | null; checkin_id: string; created_at: string; height: number | null; id: string; storage_path: string; taken_at: string | null; thumb_path: string | null; user_id: string; width: number | null }
        Insert: { bytes?: number | null; checkin_id: string; created_at?: string; height?: number | null; id?: string; storage_path: string; taken_at?: string | null; thumb_path?: string | null; user_id: string; width?: number | null }
        Update: { bytes?: number | null; checkin_id?: string; created_at?: string; height?: number | null; id?: string; storage_path?: string; taken_at?: string | null; thumb_path?: string | null; user_id?: string; width?: number | null }
        Relationships: [
          { foreignKeyName: "checkin_photos_checkin_id_fkey"; columns: ["checkin_id"]; isOneToOne: true; referencedRelation: "checkins"; referencedColumns: ["id"] },
          { foreignKeyName: "checkin_photos_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      checkins: {
        // 008: off_window = 체크한 순간이 루틴 시각대 밖이었는가 (트리거가 정한다). 회원이 고칠 수 있는 건 note뿐
        Row: { axis: Database["public"]["Enums"]["axis_kind"]; category: string | null; created_at: string; crew_id: string | null; id: string; local_date: string; note: string | null; off_window: boolean; routine_id: string; title_at_time: string; user_id: string }
        Insert: { axis: Database["public"]["Enums"]["axis_kind"]; category?: string | null; created_at?: string; crew_id?: string | null; id?: string; local_date: string; note?: string | null; routine_id: string; title_at_time: string; user_id: string }
        Update: { note?: string | null }
        Relationships: [
          { foreignKeyName: "checkins_routine_id_fkey"; columns: ["routine_id"]; isOneToOne: false; referencedRelation: "routines"; referencedColumns: ["id"] },
          { foreignKeyName: "checkins_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      day_cutoff_settings: {
        Row: { effective_on: string; hour: number; set_at: string; user_id: string }
        Insert: { effective_on: string; hour: number; set_at?: string; user_id: string }
        Update: { effective_on?: string; hour?: number; set_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "day_cutoff_settings_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      day_logs: {
        // 007: *_required = 그날 해야 할 루틴 수, *_completed = 그중 끝낸 수, *_done = 전부 끝냈는가 (DB 생성 컬럼)
        Row: { first_at: string | null; life_count: number; local_date: string; total_count: number | null; user_id: string; work_count: number; work_required: number; work_completed: number; life_required: number; life_completed: number; work_done: boolean; life_done: boolean }
        Insert: { first_at?: string | null; life_count?: number; local_date: string; total_count?: number | null; user_id: string; work_count?: number }
        Update: { first_at?: string | null; life_count?: number; local_date?: string; total_count?: number | null; user_id?: string; work_count?: number }
        Relationships: [
          { foreignKeyName: "day_logs_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      profiles: {
        Row: { account_type: AccountType; avatar_url: string | null; cohort_month: string; created_at: string; display_name: string; handle: string; id: string; onboarded_at: string | null; role: string; signup_seq: number; timezone: string }
        Insert: { account_type?: never; avatar_url?: string | null; cohort_month?: string; created_at?: string; display_name: string; handle: string; id: string; onboarded_at?: string | null; role?: string; signup_seq?: never; timezone?: string }
        Update: { account_type?: never; avatar_url?: string | null; cohort_month?: string; created_at?: string; display_name?: string; handle?: string; id?: string; onboarded_at?: string | null; role?: string; signup_seq?: never; timezone?: string }
        Relationships: []
      }
      routines: {
        // 008: hint = 설명 한 줄, window_start/end = 매일 반복되는 시각대 ('HH:MM:SS', 둘 다 있거나 둘 다 없음)
        Row: { archived_at: string | null; axis: Database["public"]["Enums"]["axis_kind"]; category: string | null; created_at: string; crew_id: string | null; hint: string | null; id: string; schedule: Json | null; sort_order: number; source: Database["public"]["Enums"]["routine_source"]; title: string; user_id: string; window_end: string | null; window_start: string | null }
        Insert: { archived_at?: string | null; axis?: Database["public"]["Enums"]["axis_kind"]; category?: string | null; created_at?: string; crew_id?: string | null; hint?: string | null; id?: string; schedule?: Json | null; sort_order?: number; source?: Database["public"]["Enums"]["routine_source"]; title: string; user_id: string; window_end?: string | null; window_start?: string | null }
        Update: { archived_at?: string | null; axis?: Database["public"]["Enums"]["axis_kind"]; category?: string | null; created_at?: string; crew_id?: string | null; hint?: string | null; id?: string; schedule?: Json | null; sort_order?: number; source?: Database["public"]["Enums"]["routine_source"]; title?: string; user_id?: string; window_end?: string | null; window_start?: string | null }
        Relationships: [
          { foreignKeyName: "routines_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      share_events: {
        Row: { action: Database["public"]["Enums"]["share_action"]; created_at: string; id: number; kind: Database["public"]["Enums"]["share_kind"]; ratio: string | null; target_date: string | null; user_id: string }
        Insert: { action: Database["public"]["Enums"]["share_action"]; created_at?: string; id?: number; kind: Database["public"]["Enums"]["share_kind"]; ratio?: string | null; target_date?: string | null; user_id: string }
        Update: { action?: Database["public"]["Enums"]["share_action"]; created_at?: string; id?: number; kind?: Database["public"]["Enums"]["share_kind"]; ratio?: string | null; target_date?: string | null; user_id?: string }
        Relationships: [
          { foreignKeyName: "share_events_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
      user_streaks: {
        Row: { current_streak: number; last_active_on: string | null; longest_streak: number; updated_at: string; user_id: string }
        Insert: { current_streak?: number; last_active_on?: string | null; longest_streak?: number; updated_at?: string; user_id: string }
        Update: { current_streak?: number; last_active_on?: string | null; longest_streak?: number; updated_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "user_streaks_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      // 011 · 피드
      feed_page: { Args: { p_before?: string | null; p_limit?: number }; Returns: FeedRow[] }
      feed_import: { Args: { p_post: string }; Returns: 'imported' | 'exists' | 'already' | 'own' | 'gone' }
      current_cutoff: { Args: { p_today: string; p_user: string }; Returns: number }
      recalc_streak: {
        Args: { p_today: string; p_user: string }
        Returns: { current_streak: number; longest_streak: number }[]
      }
      // 005 · 계정 유형과 회원 번호
      membership: {
        Args: { p_user: string }
        Returns: { account_type: AccountType; member_number: number | null; founding_member: boolean }[]
      }
      member_number: { Args: { p_user: string }; Returns: number | null }
      is_founder: { Args: Record<PropertyKey, never>; Returns: boolean }
      admin_list_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          display_name: string
          handle: string
          email: string | null
          account_type: AccountType
          member_number: number | null
          created_at: string
        }[]
      }
      admin_set_account_type: { Args: { p_user: string; p_type: 'member' | 'developer' | 'tester' }; Returns: string }
      // ↓ 개발 DB 전용 (supabase/dev/101). 운영 DB에는 없다 — NEXT_PUBLIC_DEV_LOGIN=1 일 때만 호출한다
      dev_signup: {
        Args: { p_email: string; p_password: string; p_nickname: string; p_note?: string }
        Returns: string
      }
      dev_is_owner: { Args: Record<PropertyKey, never>; Returns: boolean }
      dev_list_signup_requests: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          nickname: string
          note: string | null
          status: string
          requested_at: string
          decided_at: string | null
        }[]
      }
      dev_decide_signup: { Args: { p_email: string; p_approve: boolean }; Returns: string }
    }
    Enums: {
      axis_kind: "work" | "life"
      routine_source: "personal" | "crew"
      share_action: "save_image" | "copy_text" | "share_sheet" | "open_sheet"
      share_kind: "daily_card" | "weekly_grid" | "monthly_grid" | "yearly_grid" | "crew_card"
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      axis_kind: ["work", "life"],
      routine_source: ["personal", "crew"],
      share_action: ["save_image", "copy_text", "share_sheet", "open_sheet"],
      share_kind: ["daily_card", "weekly_grid", "monthly_grid", "yearly_grid", "crew_card"],
    },
  },
} as const
