import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { surveys, type SurveyId } from "@/lib/surveys";
import {
  generateGeminiContent,
  GeminiApiError,
  getGeminiErrorMessage,
} from "@/lib/gemini";

export const maxDuration = 60;

type TranslationEntry = {
  key: string;
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Admin sign-in is required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.responseId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.responseId)) {
    return NextResponse.json({ error: "A valid response ID is required." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Supabase server configuration is incomplete." },
      { status: 503 },
    );
  }

  try {
    const token = authorization.slice("Bearer ".length);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userResult, error: authError } = await userClient.auth.getUser(token);
    if (authError || !userResult.user) {
      return NextResponse.json({ error: "Your admin session has expired. Sign in again." }, { status: 401 });
    }

    const { data: isAdmin, error: adminCheckError } = await userClient.rpc("is_survey_admin");
    if (adminCheckError) {
      console.error("Could not verify admin access for response translation:", adminCheckError);
      return NextResponse.json({ error: "Admin access could not be verified." }, { status: 403 });
    }
    if (isAdmin !== true) {
      return NextResponse.json({ error: "Admin access is required to translate responses." }, { status: 403 });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: responseRow, error: readError } = await serviceClient
      .from("survey_responses")
      .select("id,survey_id,language_code,answers,question_labels,response_labels,english_answers,english_question_labels,english_response_labels")
      .eq("id", body.responseId)
      .maybeSingle();

    if (readError) {
      console.error("Could not read response for translation:", readError);
      if (readError.code === "42703") {
        return NextResponse.json(
          { error: "Run the updated supabase/schema.sql in the Supabase SQL Editor to add the saved English-translation columns." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Could not load this survey response." }, { status: 500 });
    }
    if (!responseRow) {
      return NextResponse.json({ error: "Survey response not found." }, { status: 404 });
    }

    const current = responseRow as {
      id: string;
      survey_id: SurveyId;
      language_code: string;
      answers: Record<string, unknown>;
      question_labels: Record<string, unknown>;
      response_labels: Record<string, unknown>;
      english_answers: Record<string, unknown> | null;
      english_question_labels: Record<string, unknown> | null;
      english_response_labels: Record<string, unknown> | null;
    };

    if (
      current.english_answers &&
      current.english_question_labels &&
      current.english_response_labels
    ) {
      return NextResponse.json({
        answers: current.english_answers,
        questionLabels: current.english_question_labels,
        responseLabels: current.english_response_labels,
      });
    }

    if (current.language_code !== "en" && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Add GEMINI_API_KEY to enable on-demand English response translations." },
        { status: 503 },
      );
    }

    const englishSurvey = surveys[current.survey_id];
    const englishLabels = Object.fromEntries(
      englishSurvey.questions.map((question) => [question.id, question.label]),
    );
    const englishAnswers: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(current.answers)) {
      englishAnswers[key] = typeof value === "number" ? value : value;
    }
    const englishResponseLabels: Record<string, string> = {
      "1": "Strongly Disagree",
      "2": "Disagree",
      "3": "Neutral",
      "4": "Agree",
      "5": "Strongly Agree",
    };

    if (current.language_code !== "en") {
      const entries: TranslationEntry[] = [
        ...Object.entries(current.answers)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
          .map(([key, text]) => ({ key, text })),
      ];

      const uniqueTexts = [...new Set(entries.map((entry) => entry.text))];
      if (uniqueTexts.length > 0) {
        const apiKey = process.env.GEMINI_API_KEY!;
        const model = process.env.GEMINI_TRANSLATION_MODEL || "gemini-3.5-flash-lite";
        const translations = await translateTexts(apiKey, model, current.language_code, uniqueTexts);
        if (!translations) {
          return NextResponse.json(
            { error: "Gemini did not return a complete translation. Please try again." },
            { status: 502 },
          );
        }

        const translatedByText = new Map(uniqueTexts.map((text, index) => [text, translations[index]]));
        for (const entry of entries) {
          const translation = translatedByText.get(entry.text);
          if (translation === undefined) {
            return NextResponse.json(
              { error: "A response field could not be translated. Please try again." },
              { status: 502 },
            );
          }
          englishAnswers[entry.key] = translation;
        }
      }
    }

    const { error: updateError } = await serviceClient
      .from("survey_responses")
      .update({
        english_answers: englishAnswers,
        english_question_labels: englishLabels,
        english_response_labels: englishResponseLabels,
      })
      .eq("id", current.id);

    if (updateError) {
      console.error("Could not save English response translation:", updateError);
      return NextResponse.json({ error: "Could not save this response's English translation." }, { status: 500 });
    }

    return NextResponse.json({
      answers: englishAnswers,
      questionLabels: englishLabels,
      responseLabels: englishResponseLabels,
    });
  } catch (error) {
    console.error("Response translation failed:", error);
    if (error instanceof GeminiApiError) {
      return NextResponse.json(
        { error: getGeminiErrorMessage(error.status) },
        { status: error.status === 503 || error.status === 429 ? 503 : 502 },
      );
    }
    return NextResponse.json(
      { error: "The response could not be translated. Please try again." },
      { status: 502 },
    );
  }
}

async function translateTexts(
  apiKey: string,
  model: string,
  sourceLanguage: string,
  strings: string[],
): Promise<string[] | null> {
  const response = await generateGeminiContent(apiKey, model, {
        systemInstruction: {
          parts: [{
            text: "Translate the provided survey response text into English. Preserve the respondent's intended meaning, tone, names, numbers, and punctuation. Return exactly one English string for each input string in the same order. Do not explain or add content.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{ text: JSON.stringify({ sourceLanguage, targetLanguage: "English", strings }) }],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              translations: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["translations"],
          },
        },
      });
  if (!response.ok) {
    console.error("Gemini response-translation request failed:", response.status);
    throw new GeminiApiError(response.status, getGeminiErrorMessage(response.status));
  }
  const payload: unknown = await response.json();
  const text = extractGeminiText(payload);
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      isRecord(parsed) &&
      Array.isArray(parsed.translations) &&
      parsed.translations.length === strings.length &&
      parsed.translations.every((value) => typeof value === "string" && value.trim().length > 0)
    ) {
      return parsed.translations as string[];
    }
  } catch (error) {
    console.error("Gemini returned invalid JSON for response translation:", error);
  }
  return null;
}

function extractGeminiText(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.candidates)) return null;
  const candidate = payload.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return null;
  }
  const text = candidate.content.parts
    .filter((part): part is Record<string, unknown> => isRecord(part) && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
  return text || null;
}
