import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const globalForSupabase = globalThis as typeof globalThis & {
  surveyPortalSupabase?: SupabaseClient;
};

export const supabase = supabaseConfigured
  ? (globalForSupabase.surveyPortalSupabase ??=
      createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }))
  : null;

export type SurveyResponseRecord = {
  id: string;
  survey_id: "employee" | "workmen";
  language_code: string;
  language_name: string;
  answers: Record<string, string | number>;
  question_labels: Record<string, string>;
  response_labels: Record<string, string>;
  english_answers: Record<string, string | number> | null;
  english_question_labels: Record<string, string> | null;
  english_response_labels: Record<string, string> | null;
  submitted_at: string;
};
