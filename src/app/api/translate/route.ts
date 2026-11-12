import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { generateGeminiContent, getGeminiErrorMessage } from "@/lib/gemini";
import { getLanguage, isLanguageCode } from "@/lib/languages";
import {
  getTranslationSources,
  isTranslationKind,
} from "@/lib/translation";

export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("language" in body) ||
    !("kind" in body)
  ) {
    return NextResponse.json(
      { error: "Choose a supported language and survey." },
      { status: 400 },
    );
  }

  const { language, kind } = body;
  if (!isLanguageCode(language) || !isTranslationKind(kind)) {
    return NextResponse.json(
      { error: "Choose a supported language and survey." },
      { status: 400 },
    );
  }

  const source = getTranslationSources(kind).texts;
  if (language === "en") {
    return NextResponse.json({ translations: source });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "Translations are not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the deployment environment." },
      { status: 503 },
    );
  }

  try {
    const model = process.env.GEMINI_TRANSLATION_MODEL || "gemini-3.5-flash-lite";
    const sourceHash = createHash("sha256")
      .update(source.join("\u0000"))
      .update(model)
      .digest("hex")
      .slice(0, 16);
    const cacheKey = `${language}:${kind}:${sourceHash}`;
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: cached, error: cacheReadError } = await serviceClient
      .from("survey_translation_cache")
      .select("translations")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (cacheReadError) {
      console.error("Could not read the survey translation cache:", cacheReadError);
      return NextResponse.json(
        { error: "Translations are temporarily unavailable. Check the Supabase translation-cache setup." },
        { status: 503 },
      );
    }
    if (
      cached &&
      Array.isArray(cached.translations) &&
      cached.translations.length === source.length &&
      cached.translations.every(
        (item: unknown) => typeof item === "string" && item.trim().length > 0,
      )
    ) {
      return NextResponse.json({ translations: cached.translations });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "This language has not been translated yet. Add GEMINI_API_KEY to generate the translation." },
        { status: 503 },
      );
    }

    const targetLanguage = getLanguage(language).name;
    const response = await generateGeminiContent(apiKey, model, {
        systemInstruction: {
          parts: [{
            text:
              "Translate survey interface content into the requested language. Preserve meaning, respectful tone, names, product terms, punctuation and numbers. Return one JSON object with a translations array. It must contain exactly one translated string for each input string, in the same order. Do not combine, omit, explain, or add strings.",
          }],
        },
        contents: [{
          role: "user",
          parts: [{ text: JSON.stringify({ targetLanguage, strings: source }) }],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              translations: {
                type: "ARRAY",
                items: { type: "STRING" },
              },
            },
            required: ["translations"],
          },
        },
      });

    if (!response.ok) {
      console.error("Gemini translation request failed:", response.status);
      return NextResponse.json(
        { error: getGeminiErrorMessage(response.status) },
        { status: response.status === 503 || response.status === 429 ? 503 : 502 },
      );
    }

    const payload: unknown = await response.json();
    const message = getGeminiText(payload);
    const parsed: unknown = JSON.parse(message);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("translations" in parsed) ||
      !Array.isArray(parsed.translations) ||
      parsed.translations.length !== source.length ||
      !parsed.translations.every(
        (item: unknown) => typeof item === "string" && item.trim().length > 0,
      )
    ) {
      console.error("Gemini returned an invalid translation response.");
      return NextResponse.json(
        { error: "The translation service returned an incomplete translation. Please try again." },
        { status: 502 },
      );
    }

    const { error: cacheWriteError } = await serviceClient
      .from("survey_translation_cache")
      .upsert(
        {
          cache_key: cacheKey,
          language_code: language,
          kind,
          translations: parsed.translations,
        },
        { onConflict: "cache_key" },
      );
    if (cacheWriteError) {
      console.error("Could not save the survey translation cache:", cacheWriteError);
      return NextResponse.json(
        { error: "The translation was generated but could not be saved. Check the Supabase translation-cache setup and try again." },
        { status: 503 },
      );
    }

    return NextResponse.json({ translations: parsed.translations });
  } catch (error) {
    console.error("Translation request failed:", error);
    return NextResponse.json(
      { error: "The translation service is temporarily unavailable. Please try again or choose English." },
      { status: 502 },
    );
  }
}

function getGeminiText(payload: unknown): string {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("candidates" in payload) ||
    !Array.isArray(payload.candidates)
  ) {
    throw new Error("Gemini returned an invalid response.");
  }
  const candidate = payload.candidates[0];
  if (
    !candidate ||
    typeof candidate !== "object" ||
    !("content" in candidate) ||
    !candidate.content ||
    typeof candidate.content !== "object" ||
    !("parts" in candidate.content) ||
    !Array.isArray(candidate.content.parts)
  ) {
    throw new Error("Gemini returned an invalid response.");
  }
  const text = candidate.content.parts
    .filter(
      (part: unknown): part is { text: string } =>
        Boolean(
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string",
        ),
    )
    .map((part: { text: string }) => part.text)
    .join("");
  if (!text) throw new Error("Gemini returned no translation text.");
  return text;
}
