import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          created_at: string
          share_token?: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          share_token?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          share_token?: string
        }
      }
      notes: {
        Row: {
          id: string
          project_id: string
          title: string
          content: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          content: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          content?: string
          updated_at?: string
        }
      }
    }
  }
}