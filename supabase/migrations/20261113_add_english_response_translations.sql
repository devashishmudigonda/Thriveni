alter table public.survey_responses
  add column if not exists english_answers jsonb,
  add column if not exists english_question_labels jsonb,
  add column if not exists english_response_labels jsonb;
