import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function isSupabaseAdminConfigured(): boolean {
  const serviceKey = supabaseServiceKey?.trim();
  return Boolean(
    serviceKey &&
      !/[<>]/.test(serviceKey) &&
      [...serviceKey].every((character) => character.charCodeAt(0) <= 255)
  );
}

// Client-side (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side (bypasses RLS — only use in API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);