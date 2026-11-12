import type { LanguageCode } from "@/lib/languages";
import {
  surveys,
  uiCopy,
  type SurveyDefinition,
  type SurveyId,
  type SurveyQuestion,
  type UiCopyKey,
} from "@/lib/surveys";

export type TranslationKind = "catalog" | SurveyId;

export type LocalizedSurvey = Omit<SurveyDefinition, "questions"> & {
  questions: SurveyQuestion[];
  ui: Record<UiCopyKey, string>;
};

export type LocalizedCatalog = {
  title: string;
  subtitle: string;
  surveys: Record<SurveyId, { title: string; subtitle: string }>;
  ui: Record<UiCopyKey, string>;
};

export function getTranslationSources(kind: TranslationKind) {
  const uiKeys = Object.keys(uiCopy) as UiCopyKey[];
  const copy = uiKeys.map((key) => uiCopy[key]);
  const language = kind === "catalog" ? undefined : surveys[kind];

  if (!language) {
    return {
      texts: [
        uiCopy.languageHeading,
        uiCopy.languageDescription,
        surveys.employee.title,
        surveys.employee.subtitle,
        surveys.workmen.title,
        surveys.workmen.subtitle,
        ...copy,
      ],
      uiKeys,
    };
  }

  return {
    texts: [
      language.title,
      language.subtitle,
      ...language.intro,
      ...language.questions.flatMap((item) => [
        item.label,
        ...(item.options ?? []),
      ]),
    ],
    uiKeys,
  };
}

export function buildLocalizedResult(
  kind: TranslationKind,
  code: LanguageCode,
  texts: string[],
  uiOverride?: Record<UiCopyKey, string>,
): LocalizedCatalog | LocalizedSurvey {
  const source = getTranslationSources(kind).texts;
  if (texts.length !== source.length) {
    throw new Error("The translation response did not match the survey content.");
  }
  const translated = code === "en" ? source : texts;
  let index = 0;
  const next = () => translated[index++];

  if (kind === "catalog") {
    const title = next();
    const subtitle = next();
    const employee = { title: next(), subtitle: next() };
    const workmen = { title: next(), subtitle: next() };
    const ui = Object.fromEntries(
      getTranslationSources(kind).uiKeys.map((key) => [key, next()]),
    ) as Record<UiCopyKey, string>;
    return {
      title,
      subtitle,
      surveys: { employee, workmen },
      ui,
    };
  }

  const definition = surveys[kind];
  const title = next();
  const subtitle = next();
  const intro = definition.intro.map(() => next());
  const ui = uiOverride ?? uiCopy;
  const questions = definition.questions.map((question) => ({
    ...question,
    label: next(),
    options: question.options?.map(() => next()),
  }));
  return {
    ...definition,
    title,
    subtitle,
    intro,
    questions,
    ui,
  };
}

export function isTranslationKind(value: unknown): value is TranslationKind {
  return value === "catalog" || value === "employee" || value === "workmen";
}
