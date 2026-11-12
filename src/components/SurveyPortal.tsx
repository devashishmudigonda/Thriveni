"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  Globe2,
  Languages,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getLanguage, languages, type LanguageCode } from "@/lib/languages";
import {
  buildLocalizedResult,
  getTranslationSources,
  type LocalizedCatalog,
  type LocalizedSurvey,
  type TranslationKind,
} from "@/lib/translation";
import {
  responseScale,
  type SurveyId,
  type SurveyQuestion,
  type UiCopyKey,
} from "@/lib/surveys";
import { supabase, supabaseConfigured } from "@/lib/supabase";

type Step = "language" | "surveys" | "welcome" | "about" | "experience" | "feedback" | "done";
type Answers = Record<string, string | number>;
type TranslationResult = LocalizedCatalog | LocalizedSurvey;

const initialCatalog = buildLocalizedResult(
  "catalog",
  "en",
  getTranslationSources("catalog").texts,
) as LocalizedCatalog;

const stepOrder: Exclude<Step, "language" | "surveys" | "done">[] = [
  "welcome",
  "about",
  "experience",
  "feedback",
];

const stepSection = {
  about: "about",
  experience: "experience",
  feedback: "feedback",
} as const;

function isLocalizedSurvey(result: TranslationResult): result is LocalizedSurvey {
  return "questions" in result;
}

async function loadTranslation(
  language: LanguageCode,
  kind: TranslationKind,
  ui?: Record<UiCopyKey, string>,
): Promise<LocalizedCatalog | LocalizedSurvey> {
  const cacheKey = `lloyds-survey-translation-v2:${language}:${kind}`;
  if (language !== "en") {
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as LocalizedCatalog | LocalizedSurvey;
      } catch {
        window.localStorage.removeItem(cacheKey);
      }
    }
  }

  const response = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, kind }),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "Translation could not be loaded.";
    throw new Error(message);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("translations" in payload) ||
    !Array.isArray(payload.translations) ||
    !payload.translations.every((text) => typeof text === "string")
  ) {
    throw new Error("The translation response was incomplete. Please try again.");
  }

  const result = buildLocalizedResult(
    kind,
    language,
    payload.translations as string[],
    ui,
  );
  if (language !== "en") {
    window.localStorage.setItem(cacheKey, JSON.stringify(result));
  }
  return result;
}

export default function SurveyPortal() {
  const [step, setStep] = useState<Step>("language");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [catalog, setCatalog] = useState<LocalizedCatalog>(initialCatalog);
  const [surveyId, setSurveyId] = useState<SurveyId | null>(null);
  const [activeSurvey, setActiveSurvey] = useState<LocalizedSurvey | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");

  const selectedLanguage = getLanguage(language);
  const currentStepIndex = stepOrder.indexOf(
    step as Exclude<Step, "language" | "surveys" | "done">,
  );
  const progress = useMemo(
    () => Math.max(0, currentStepIndex + 1),
    [currentStepIndex],
  );
  const currentQuestions =
    activeSurvey && step in stepSection
      ? activeSurvey.questions.filter(
          (question) => question.section === stepSection[step as keyof typeof stepSection],
        )
      : [];

  async function chooseLanguage(code: LanguageCode) {
    setLanguage(code);
    setError("");
    setLoading(true);
    try {
      const localizedCatalog = await loadTranslation(code, "catalog");
      if (!isLocalizedSurvey(localizedCatalog)) {
        setCatalog(localizedCatalog);
        setStep("surveys");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Translation could not be loaded.");
      if (code === "en") setStep("surveys");
    } finally {
      setLoading(false);
    }
  }

  async function chooseSurvey(id: SurveyId) {
    setError("");
    setLoading(true);
    setSurveyId(id);
    try {
      const localized = await loadTranslation(language, id, catalog.ui);
      if (isLocalizedSurvey(localized)) {
        setActiveSurvey(localized);
        setAnswers({});
        setStep("welcome");
      } else {
        throw new Error("The survey content could not be loaded.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The survey could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function updateAnswer(id: string, value: string | number) {
    setAnswers((current) => ({ ...current, [id]: value }));
    setValidationError("");
  }

  function goNext() {
    if (step === "about" || step === "experience" || step === "feedback") {
      const missing = currentQuestions.some(
        (question) =>
          question.required !== false &&
          (answers[question.id] === undefined || answers[question.id] === ""),
      );
      if (missing) {
        setValidationError(
          step === "experience"
            ? activeSurvey?.ui.scaleRequired ?? "Please answer every statement before continuing."
            : activeSurvey?.ui.required ?? "Please complete the required fields.",
        );
        return;
      }
    }
    setValidationError("");
    if (step === "welcome") setStep("about");
    else if (step === "about") setStep("experience");
    else if (step === "experience") setStep("feedback");
  }

  function goBack() {
    setError("");
    setValidationError("");
    if (step === "surveys") setStep("language");
    else if (step === "welcome") setStep("surveys");
    else if (step === "about") setStep("welcome");
    else if (step === "experience") setStep("about");
    else if (step === "feedback") setStep("experience");
  }

  async function submitSurvey() {
    if (!activeSurvey || !surveyId) return;
    if (!supabaseConfigured || !supabase) {
      setError(
        "Survey submissions are not available yet. Configure the Supabase environment variables before collecting responses.",
      );
      return;
    }

    const missing = currentQuestions.some(
      (question) =>
        question.required !== false &&
        (answers[question.id] === undefined || answers[question.id] === ""),
    );
    if (missing) {
      setValidationError(activeSurvey.ui.required);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const scaleLabels = activeSurvey.questions.find(
        (question) => question.kind === "scale",
      )?.options;
      const responseLabels = Object.fromEntries(
        responseScale.map((option, index) => [
          String(option.value),
          scaleLabels?.[index] ?? option.label,
        ]),
      );
      const questionLabels = Object.fromEntries(
        activeSurvey.questions.map((question) => [question.id, question.label]),
      );
      const { error: insertError } = await supabase
        .from("survey_responses")
        .insert({
          survey_id: surveyId,
          language_code: language,
          language_name: selectedLanguage.name,
          answers,
          question_labels: questionLabels,
          response_labels: responseLabels,
        });
      if (insertError) throw insertError;
      setStep("done");
    } catch (reason) {
      console.error("Survey submission failed:", reason);
      setError(
        "We couldn't save your response. Please check your connection and try submitting again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startAnotherResponse() {
    setAnswers({});
    setError("");
    setValidationError("");
    setSurveyId(null);
    setActiveSurvey(null);
    setStep("surveys");
  }

  return (
    <main className="portal-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Lloyds Thriveni survey portal home">
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.2} /></span>
          <span className="brand-name">Lloyds<span>/</span>Thriveni</span>
        </Link>
        <div className="topbar-actions">
          {step !== "language" && step !== "done" && (
            <span className="language-chip">
              <Globe2 size={15} />
              {selectedLanguage.nativeName}
              <ChevronDown size={13} />
            </span>
          )}
          <Link className="admin-link" href="/admin">
            <LockKeyhole size={15} />
            {catalog.ui.admin}
          </Link>
        </div>
      </header>

      <div className="portal-content">
        {step === "language" && (
          <section className="language-view">
            <div className="intro-mark"><Languages size={22} /></div>
            <p className="eyebrow">EMPLOYEE VOICE · 2026</p>
            <h1>{catalog.title || "Select your language"}</h1>
            <p className="view-subtitle">
              {catalog.subtitle || "Choose the language you prefer for the survey."}
            </p>
            <div className="language-grid">
              {languages.map((item) => (
                <button
                  type="button"
                  className={`language-card ${language === item.code ? "is-selected" : ""}`}
                  key={item.code}
                  onClick={() => void chooseLanguage(item.code)}
                  disabled={loading}
                >
                  <span className="language-native" lang={item.code}>{item.nativeName}</span>
                  <span className="language-name">{item.name}</span>
                  {language === item.code && <Check className="selected-check" size={16} />}
                </button>
              ))}
            </div>
            <div className="language-notes">
              <span><ShieldCheck size={16} /> {catalog.ui.privacyNote}</span>
              <span><Languages size={16} /> {catalog.ui.translationNotice}</span>
            </div>
          </section>
        )}

        {step === "surveys" && (
          <section className="survey-picker">
            <button type="button" className="text-back" onClick={goBack}>
              <ArrowLeft size={16} /> {catalog.ui.changeLanguage}
            </button>
            <p className="eyebrow">YOUR VOICE MATTERS</p>
            <h1>{catalog.ui.selectSurvey}</h1>
            <p className="view-subtitle">{catalog.ui.selectSurveyDescription}</p>
            <div className="survey-card-grid">
              {(["employee", "workmen"] as const).map((id) => {
                const localized = catalog.surveys[id];
                return (
                  <article className={`survey-choice survey-choice-${id}`} key={id}>
                    <div className="survey-card-icon">
                      {id === "employee" ? <Sparkles size={21} /> : <ClipboardCheck size={21} />}
                    </div>
                    <p className="card-overline">
                      {id === "employee" ? catalog.ui.employeeLabel : catalog.ui.workmenLabel}
                    </p>
                    <h2>{localized.title}</h2>
                    <p className="survey-description">{localized.subtitle}</p>
                    <div className="survey-card-foot">
                      <span><LockKeyhole size={14} /> {catalog.ui.confidential}</span>
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => void chooseSurvey(id)}
                        disabled={loading}
                      >
                        {loading && surveyId === id ? (
                          <LoaderCircle className="spin" size={16} />
                        ) : (
                          <>{catalog.ui.continue}<ArrowRight size={16} /></>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeSurvey && stepOrder.includes(step as (typeof stepOrder)[number]) && (
          <section className="survey-form-view">
            <div className="form-heading">
              <button type="button" className="text-back" onClick={goBack}>
                <ArrowLeft size={16} /> {activeSurvey.ui.back}
              </button>
              <div className="form-title-row">
                <div>
                  <p className="eyebrow">{activeSurvey.subtitle}</p>
                  <h1>{activeSurvey.title}</h1>
                </div>
                <span className="section-counter">
                  {activeSurvey.ui.progress} {progress} {activeSurvey.ui.of} 4
                </span>
              </div>
              <div className="progress-track" aria-label={`${progress} of 4`}>
                <span style={{ width: `${(progress / 4) * 100}%` }} />
              </div>
              <div className="progress-labels">
                {stepOrder.map((item, index) => (
                  <span className={index < progress ? "is-active" : ""} key={item}>
                    {item === "welcome" ? activeSurvey.ui.welcomeStep :
                      item === "about" ? activeSurvey.ui.sectionAbout :
                        item === "experience" ? activeSurvey.ui.sectionExperience :
                          activeSurvey.ui.sectionFeedback}
                  </span>
                ))}
              </div>
            </div>

            {step === "welcome" && (
              <article className="welcome-panel">
                <div className="welcome-icon"><ShieldCheck size={22} /></div>
                <p className="eyebrow">A PRIVATE CONVERSATION</p>
                <h2>{activeSurvey.ui.welcomeTitle}</h2>
                <div className="welcome-copy">
                  {activeSurvey.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                <div className="confidential-banner">
                  <LockKeyhole size={17} />
                  <span>{activeSurvey.ui.privacyNote}</span>
                </div>
                <div className="form-actions form-actions-end">
                  <button type="button" className="button button-primary" onClick={goNext}>
                    {activeSurvey.ui.continue}<ArrowRight size={16} />
                  </button>
                </div>
              </article>
            )}

            {(step === "about" || step === "experience" || step === "feedback") && (
              <section className="question-panel">
                <div className="question-panel-heading">
                  <div>
                    <h2>
                      {step === "about" ? activeSurvey.ui.sectionAbout :
                        step === "experience" ? activeSurvey.ui.sectionExperience :
                          activeSurvey.ui.sectionFeedback}
                    </h2>
                    <p>
                      {step === "about" ? activeSurvey.ui.sectionAboutHint :
                        step === "experience" ? activeSurvey.ui.sectionExperienceHint :
                          activeSurvey.ui.sectionFeedbackHint}
                    </p>
                  </div>
                  <span className="question-total">{currentQuestions.length} {currentQuestions.length === 1 ? "item" : "items"}</span>
                </div>
                {step === "experience" && (
                  <div className="scale-legend">
                    <span>{activeSurvey.ui.scaleHint}</span>
                    <span className="legend-dots" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((item) => <i key={item} />)}
                    </span>
                    <span>{activeSurvey.ui.scaleAgree}</span>
                  </div>
                )}
                <div className={`question-list ${step === "experience" ? "scale-list" : ""}`}>
                  {currentQuestions.map((question, index) => (
                    <QuestionField
                      key={question.id}
                      question={question}
                      index={index}
                      value={answers[question.id]}
                      onChange={(value) => updateAnswer(question.id, value)}
                      copy={activeSurvey.ui}
                    />
                  ))}
                </div>
                {validationError && <p className="form-error" role="alert">{validationError}</p>}
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="form-actions">
                  <button type="button" className="button button-secondary" onClick={goBack}>
                    <ArrowLeft size={16} /> {activeSurvey.ui.back}
                  </button>
                  {step === "feedback" ? (
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => void submitSurvey()}
                      disabled={submitting}
                    >
                      {submitting ? <><LoaderCircle className="spin" size={16} />{activeSurvey.ui.submitting}</> :
                        <>{activeSurvey.ui.submit}<ArrowRight size={16} /></>}
                    </button>
                  ) : (
                    <button type="button" className="button button-primary" onClick={goNext}>
                      {activeSurvey.ui.next}<ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </section>
            )}
          </section>
        )}

        {step === "done" && activeSurvey && (
          <section className="done-view">
            <div className="done-icon"><Check size={28} /></div>
            <p className="eyebrow">RESPONSE RECEIVED</p>
            <h1>{activeSurvey.ui.thanksTitle}</h1>
            <p className="view-subtitle">{activeSurvey.ui.thanksBody}</p>
            <button type="button" className="button button-primary" onClick={startAnotherResponse}>
              {activeSurvey.ui.anotherResponse}<ArrowRight size={16} />
            </button>
          </section>
        )}

        {error && (step === "language" || step === "surveys") && (
          <div className="portal-error" role="alert">
            <p>{error}</p>
            {step === "language" && language !== "en" && (
              <button type="button" onClick={() => void chooseLanguage("en")}>
                Continue in English
              </button>
            )}
          </div>
        )}

        {loading && step === "language" && (
          <div className="loading-overlay" role="status">
            <LoaderCircle className="spin" size={18} /> Preparing {selectedLanguage.name}…
          </div>
        )}
      </div>

      <footer className="site-footer">
        <span>© 2026 Lloyds/Thriveni</span>
        <span className="footer-privacy"><ShieldCheck size={14} /> Your responses are confidential</span>
      </footer>
    </main>
  );
}

type FieldCopy = LocalizedSurvey["ui"];

function QuestionField({
  question,
  index,
  value,
  onChange,
  copy,
}: {
  question: SurveyQuestion;
  index: number;
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  copy: FieldCopy;
}) {
  const fieldId = `field-${question.id}`;
  const isOptional = question.required === false;

  if (question.kind === "scale") {
    return (
      <fieldset className="question-item scale-question">
        <legend>
          <span className="question-number">{index + 1}</span>
          <span>{question.label}</span>
          {isOptional ? <small>{copy.optional}</small> : <small>{copy.required}</small>}
        </legend>
        <div className="scale-options">
          {question.options?.map((option, optionIndex) => {
            const score = optionIndex + 1;
            return (
              <label className={`scale-option ${value === score ? "is-selected" : ""}`} key={option}>
                <input
                  type="radio"
                  name={question.id}
                  value={score}
                  checked={value === score}
                  onChange={() => onChange(score)}
                  aria-label={option}
                />
                <span className="scale-score">{score}</span>
                <span className="scale-label">{option}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="question-item">
      <label className="field-label" htmlFor={fieldId}>
        <span className="question-number">{index + 1}</span>
        <span>{question.label}</span>
        <small>{isOptional ? copy.optional : copy.required}</small>
      </label>
      {question.kind === "choice" ? (
        <select
          id={fieldId}
          className="field-control"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          required={!isOptional}
        >
          <option value="">{copy.chooseOption}</option>
          {question.options?.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      ) : question.kind === "text" ? (
        <input
          id={fieldId}
          className="field-control"
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={copy.enterAnswer}
          required={!isOptional}
        />
      ) : (
        <textarea
          id={fieldId}
          className="field-control field-textarea"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={copy.commentsPlaceholder}
          rows={3}
          required={!isOptional}
        />
      )}
    </div>
  );
}
