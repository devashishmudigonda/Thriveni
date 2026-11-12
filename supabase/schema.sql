create extension if not exists pgcrypto;

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id text not null check (survey_id in ('employee', 'workmen')),
  language_code text not null check (
    language_code in (
      'en', 'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'or',
      'pa', 'as', 'mai', 'sa', 'ks', 'ne', 'kok', 'sd', 'doi', 'brx',
      'sat', 'mni'
    )
  ),
  language_name text not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  question_labels jsonb not null check (jsonb_typeof(question_labels) = 'object'),
  response_labels jsonb not null default '{}'::jsonb check (jsonb_typeof(response_labels) = 'object'),
  english_answers jsonb,
  english_question_labels jsonb,
  english_response_labels jsonb,
  submitted_at timestamptz not null default now()
);

alter table public.survey_responses
  add column if not exists english_answers jsonb,
  add column if not exists english_question_labels jsonb,
  add column if not exists english_response_labels jsonb;

create index if not exists survey_responses_submitted_at_idx
  on public.survey_responses (submitted_at desc);
create index if not exists survey_responses_survey_id_idx
  on public.survey_responses (survey_id);
create index if not exists survey_responses_language_code_idx
  on public.survey_responses (language_code);

create table if not exists public.survey_admins (
  email text primary key check (email = lower(email))
);

create table if not exists public.survey_translation_cache (
  cache_key text primary key,
  language_code text not null,
  kind text not null check (kind in ('catalog', 'employee', 'workmen')),
  translations jsonb not null check (jsonb_typeof(translations) = 'array'),
  created_at timestamptz not null default now()
);

alter table public.survey_translation_cache
  drop constraint if exists survey_translation_cache_kind_check;
alter table public.survey_translation_cache
  add constraint survey_translation_cache_kind_check
  check (kind in ('catalog', 'employee', 'workmen'));

alter table public.survey_responses enable row level security;
alter table public.survey_admins enable row level security;
alter table public.survey_translation_cache enable row level security;

create or replace function public.is_survey_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.survey_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_survey_admin() from public, anon;
grant execute on function public.is_survey_admin() to authenticated;

grant select, insert on public.survey_responses to anon, authenticated;
grant select on public.survey_responses to authenticated;

drop policy if exists "Anyone can submit a survey response"
  on public.survey_responses;
create policy "Anyone can submit a survey response"
  on public.survey_responses
  for insert
  to anon, authenticated
  with check (
    survey_id in ('employee', 'workmen')
    and language_code in (
      'en', 'hi', 'bn', 'te', 'mr', 'ta', 'ur', 'gu', 'kn', 'ml', 'or',
      'pa', 'as', 'mai', 'sa', 'ks', 'ne', 'kok', 'sd', 'doi', 'brx',
      'sat', 'mni'
    )
    and jsonb_typeof(answers) = 'object'
    and jsonb_typeof(question_labels) = 'object'
    and jsonb_typeof(response_labels) = 'object'
  );

drop policy if exists "Admins can view survey responses"
  on public.survey_responses;
create policy "Admins can view survey responses"
  on public.survey_responses
  for select
  to authenticated
  using (public.is_survey_admin());

revoke all on public.survey_admins from anon, authenticated;
revoke all on public.survey_translation_cache from anon, authenticated;
grant select, insert, update on public.survey_translation_cache to service_role;
