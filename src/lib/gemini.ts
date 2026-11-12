const RETRY_DELAYS_MS = [700, 1600];

export class GeminiApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

export async function generateGeminiContent(
  apiKey: string,
  model: string,
  body: unknown,
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let response: Response | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });

    if (response.status !== 503 || attempt === RETRY_DELAYS_MS.length) {
      return response;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }

  if (!response) {
    throw new Error("Gemini request did not return a response.");
  }
  return response;
}

export function getGeminiErrorMessage(status: number) {
  if (status === 429) {
    return "Gemini's free-tier request limit or quota may have been reached. Check your Google AI Studio usage and try again later.";
  }
  if (status === 503) {
    return "Gemini is temporarily unavailable or overloaded. Please wait a moment and try again.";
  }
  if (status === 400 || status === 403 || status === 404) {
    return "Gemini rejected the translation request. Check that the API key is enabled and GEMINI_TRANSLATION_MODEL names a model available to your key.";
  }
  return "The Gemini translation service returned an error. Please try again later.";
}
