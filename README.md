# Lloyds/Thriveni Survey Portal

A Vercel-ready survey portal based on the two questionnaires in the project folder. Respondents choose a language, select the employee or contract-workmen survey, and submit confidential answers. Administrators sign in to review and export responses.

## Features

- Language selection matching the reference portal, including English and the listed Indian languages.
- Both questionnaires are based on the supplied Word documents.
- Gemini machine translation of survey content for the selected language. Public survey text is translated as needed and cached in Supabase.
- Admins can request an English translation of a non-English response. The original is retained, and the English translation is saved for later dashboard viewing. Response text is sent to Gemini only after an administrator chooses to translate it.
- Anonymous response storage in Supabase, including the selected language and the localized question labels used for that submission.
- Supabase Auth admin sign-in and row-level access policies for the dashboard.
- Dashboard filters, response details, totals, and CSV export.

## Run locally

1. Install Node.js 20.9 or later.
2. Copy `.env.example` to `.env.local` and fill in the required values.
3. Configure the Supabase project as described below.
4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

English surveys work without a Gemini key. Other languages require `GEMINI_API_KEY`. Public survey translations are generated on the server on first use and cached in Supabase for reuse. The survey-specific translation no longer repeats shared interface text already translated with the language picker, reducing generation time and tokens. The first request for a new language can still take longer; later requests use the cache. Check Google's current AI Studio/Gemini API data-use terms before using free-tier access, and have machine translations reviewed by a fluent speaker before formal or legally sensitive use.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](./supabase/schema.sql). If the project already has the earlier schema, run [`supabase/migrations/20261113_add_english_response_translations.sql`](./supabase/migrations/20261113_add_english_response_translations.sql) to add the saved English-translation columns.
3. In **Authentication → Users**, create an administrator user and set their password.
4. Add that user's email to the allowlist using the SQL Editor:

   ```sql
   insert into public.survey_admins (email)
   values (lower('admin@example.com'));
   ```

5. Copy the project URL and anon/public key from **Project Settings → API** to:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Admin access is checked against `survey_admins` after Supabase password authentication. Add the Supabase service-role key as the server-only `SUPABASE_SERVICE_ROLE_KEY` for the translation cache. Never put a service-role key or OpenAI key in any `NEXT_PUBLIC_` variable.

## Translation setup

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/api-keys) and set `GEMINI_API_KEY` in `.env.local` and in the deployment environment. The key is used only by server-side translation routes. Set `GEMINI_TRANSLATION_MODEL` only if you want to override the default `gemini-3.5-flash-lite`. Public survey translations are saved in Supabase and reused across respondents. A non-English response is sent to Gemini only when an administrator explicitly requests its English translation; that translation is stored on the response record for future dashboard views.

## Deploy to Vercel

1. Push this project to GitHub.
2. Import the repository in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` in the Vercel project environment variables. Add `GEMINI_TRANSLATION_MODEL` only if overriding the default.
4. Deploy. The project uses the standard Next.js build and Vercel runtime; no custom output directory is needed.
5. Add the deployed domain to Supabase **Authentication → URL Configuration** as the site URL and an allowed redirect URL.

## Response data

Each response stores the survey ID, language code/name, answers keyed by stable question IDs, the question labels shown to the respondent, and localized scale labels. The supplied questionnaires do not ask for employee names or employee numbers. Only an optional contractor name is requested in the workmen survey.

In the admin dashboard, expand a non-English response and choose **Translate to English** to generate and save an English version. The original remains unchanged and can be viewed again. This action sends the response's text fields to Gemini; confirm that this is appropriate under your organization's privacy requirements before using it with real responses. Machine translations may be inaccurate and should be reviewed.

The public database policy permits survey inserts, but only authenticated allowlisted administrators can read responses. Keep Supabase Auth email confirmation and password policies enabled for administrator accounts.
