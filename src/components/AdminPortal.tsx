"use client";

import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Languages,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { languages } from "@/lib/languages";
import { surveys, type SurveyId } from "@/lib/surveys";
import {
  supabase,
  supabaseConfigured,
  type SurveyResponseRecord,
} from "@/lib/supabase";

type DashboardTotals = {
  total: number;
  employee: number;
  workmen: number;
};

const emptyTotals: DashboardTotals = { total: 0, employee: 0, workmen: 0 };
const PAGE_SIZE = 100;

function escapeCsv(value: string | number) {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminPortal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [rows, setRows] = useState<SurveyResponseRecord[]>([]);
  const [totals, setTotals] = useState<DashboardTotals>(emptyTotals);
  const [filteredCount, setFilteredCount] = useState(0);
  const [page, setPage] = useState(0);
  const [surveyFilter, setSurveyFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [englishViewId, setEnglishViewId] = useState<string | null>(null);
  const [translatingResponseId, setTranslatingResponseId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadResponses = useCallback(async (
    pageIndex: number,
    selectedSurvey: string,
    selectedLanguage: string,
  ) => {
    const client = supabase;
    if (!client) return;
    try {
      let responseRequest = client
          .from("survey_responses")
          .select("id,survey_id,language_code,language_name,answers,question_labels,response_labels,english_answers,english_question_labels,english_response_labels,submitted_at", { count: "exact" })
          .order("submitted_at", { ascending: false })
          .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
      if (selectedSurvey !== "all") {
        responseRequest = responseRequest.eq("survey_id", selectedSurvey);
      }
      if (selectedLanguage !== "all") {
        responseRequest = responseRequest.eq("language_code", selectedLanguage);
      }
      const [initialResponseResult, totalResult, employeeResult, workmenResult] = await Promise.all([
        responseRequest,
        client
          .from("survey_responses")
          .select("id", { count: "exact", head: true }),
        client
          .from("survey_responses")
          .select("id", { count: "exact", head: true })
          .eq("survey_id", "employee"),
        client
          .from("survey_responses")
          .select("id", { count: "exact", head: true })
          .eq("survey_id", "workmen"),
      ]);
      let responseResult = initialResponseResult;
      if (responseResult.error?.code === "42703") {
        let legacyRequest = client
          .from("survey_responses")
          .select("id,survey_id,language_code,language_name,answers,question_labels,response_labels,submitted_at", { count: "exact" })
          .order("submitted_at", { ascending: false })
          .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);
        if (selectedSurvey !== "all") legacyRequest = legacyRequest.eq("survey_id", selectedSurvey);
        if (selectedLanguage !== "all") legacyRequest = legacyRequest.eq("language_code", selectedLanguage);
        const legacyResult = await legacyRequest;
        if (legacyResult.error) throw legacyResult.error;
        responseResult = {
          ...legacyResult,
          data: legacyResult.data?.map((row) => ({
            ...row,
            english_answers: null,
            english_question_labels: null,
            english_response_labels: null,
          })) ?? null,
        };
        setError("Run supabase/schema.sql in the Supabase SQL Editor to enable saved English response translations.");
      }
      if (responseResult.error) throw responseResult.error;
      if (totalResult.error) throw totalResult.error;
      if (employeeResult.error) throw employeeResult.error;
      if (workmenResult.error) throw workmenResult.error;
      setRows((responseResult.data ?? []) as SurveyResponseRecord[]);
      setFilteredCount(responseResult.count ?? 0);
      setTotals({
        total: totalResult.count ?? 0,
        employee: employeeResult.count ?? 0,
        workmen: workmenResult.count ?? 0,
      });
    } catch (reason) {
      console.error("Could not load survey responses:", reason);
      setError("We couldn't load the responses. Check your database setup and try again.");
    } finally {
      setLoadingResponses(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function checkSession() {
      try {
        if (!supabase) return;
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!active) return;
        if (sessionError) {
          setError("We couldn't verify your admin session. Please sign in again.");
        } else if (data.session) {
          const { data: isAdmin, error: roleError } = await supabase.rpc("is_survey_admin");
          if (!active) return;
          if (roleError) {
            setError("Admin access could not be verified. Check the database setup.");
            await supabase.auth.signOut();
          } else if (isAdmin === true) {
            setAuthenticated(true);
            void loadResponses(0, "all", "all");
          } else {
            await supabase.auth.signOut();
          }
        }
      } catch (reason) {
        console.error("Could not verify the admin session:", reason);
        if (active) setError("We couldn't verify your admin session. Please sign in again.");
      } finally {
        if (active) setCheckingSession(false);
      }
    }
    void checkSession();
    return () => { active = false; };
  }, [loadResponses]);

  const filteredRows = rows;
  const usedLanguages = useMemo(
    () => new Set(rows.map((row) => row.language_code)).size,
    [rows],
  );
  const languageOptions = languages;
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  function applyFilters(nextSurvey: string, nextLanguage: string) {
    setError("");
    setSurveyFilter(nextSurvey);
    setLanguageFilter(nextLanguage);
    setPage(0);
    setExpandedId(null);
    setLoadingResponses(true);
    void loadResponses(0, nextSurvey, nextLanguage);
  }

  function changePage(nextPage: number) {
    setError("");
    setPage(nextPage);
    setExpandedId(null);
    setLoadingResponses(true);
    void loadResponses(nextPage, surveyFilter, languageFilter);
  }

  function refreshResponses() {
    setError("");
    setLoadingResponses(true);
    void loadResponses(page, surveyFilter, languageFilter);
  }

  async function translateResponse(row: SurveyResponseRecord) {
    if (row.english_answers && row.english_question_labels && row.english_response_labels) {
      setEnglishViewId(row.id);
      return;
    }
    if (!supabase) return;
    setTranslatingResponseId(row.id);
    setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your admin session has expired. Sign in again.");
      const response = await fetch("/api/translate-response", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responseId: row.id }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" &&
          "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "The response could not be translated.";
        throw new Error(message);
      }
      if (
        !payload ||
        typeof payload !== "object" ||
        !("answers" in payload) ||
        !("questionLabels" in payload) ||
        !("responseLabels" in payload)
      ) {
        throw new Error("The translation response was incomplete.");
      }
      const englishAnswers = payload.answers as Record<string, string | number>;
      const englishQuestionLabels = payload.questionLabels as Record<string, string>;
      const englishResponseLabels = payload.responseLabels as Record<string, string>;
      setRows((current) => current.map((item) => item.id === row.id
        ? {
            ...item,
            english_answers: englishAnswers,
            english_question_labels: englishQuestionLabels,
            english_response_labels: englishResponseLabels,
          }
        : item));
      setEnglishViewId(row.id);
    } catch (reason) {
      console.error("Could not translate survey response:", reason);
      setError(reason instanceof Error
        ? reason.message
        : "The response could not be translated. Please try again.");
    } finally {
      setTranslatingResponseId(null);
    }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSigningIn(true);
    setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const { data: isAdmin, error: roleError } = await supabase.rpc("is_survey_admin");
      if (roleError) throw roleError;
      if (isAdmin !== true) {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access.");
      }
      setAuthenticated(true);
      setPassword("");
      setLoadingResponses(true);
      setPage(0);
      void loadResponses(0, surveyFilter, languageFilter);
    } catch (reason) {
      console.error("Admin sign in failed:", reason);
      if (reason instanceof Error && reason.message === "This account does not have admin access.") {
        setError(reason.message);
      } else if (
        reason instanceof Error &&
        (reason.name === "AuthRetryableFetchError" || reason.message === "Failed to fetch")
      ) {
        setError(
          "Couldn't connect to Supabase. Check that NEXT_PUBLIC_SUPABASE_URL is your actual project URL (not the example URL), then restart the dev server.",
        );
      } else {
        setError(
          "Sign-in failed. Check your email and password, and confirm this account is an administrator.",
        );
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError("We couldn't sign you out. Please try again.");
      return;
    }
    setAuthenticated(false);
    setRows([]);
    setTotals(emptyTotals);
    setFilteredCount(0);
  }

  async function exportCsv() {
    const client = supabase;
    if (!client) return;
    setExporting(true);
    setError("");
    try {
      const exportRows: SurveyResponseRecord[] = [];
      for (let offset = 0; ; offset += 500) {
        let query = client
          .from("survey_responses")
          .select("id,survey_id,language_code,language_name,answers,question_labels,response_labels,submitted_at")
          .order("submitted_at", { ascending: false })
          .range(offset, offset + 499);
        if (surveyFilter !== "all") query = query.eq("survey_id", surveyFilter);
        if (languageFilter !== "all") query = query.eq("language_code", languageFilter);
        const { data, error: exportError } = await query;
        if (exportError) throw exportError;
        const batch = (data ?? []) as SurveyResponseRecord[];
        exportRows.push(...batch);
        if (batch.length < 500) break;
      }

      const questionIds = [...new Set(exportRows.flatMap((row) => Object.keys(row.answers)))];
      const labels = new Map<string, string>();
      for (const row of exportRows) {
        for (const [id, label] of Object.entries(row.question_labels)) labels.set(id, label);
      }
      const headers = [
        "Response ID",
        "Survey",
        "Language",
        "Submitted at",
        ...questionIds.map((id) => labels.get(id) ?? id),
      ];
      const body = exportRows.map((row) => [
        row.id,
        surveys[row.survey_id].title,
        row.language_name,
        formatDate(row.submitted_at),
        ...questionIds.map((id) => {
          const answer = row.answers[id];
          if (typeof answer === "number") {
            return `${answer} - ${row.response_labels?.[String(answer)] ?? answer}`;
          }
          return answer ?? "";
        }),
      ]);
      const csv = [headers, ...body]
        .map((record) => record.map(escapeCsv).join(","))
        .join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `survey-responses-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      console.error("Could not export survey responses:", reason);
      setError("We couldn't export the responses. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="admin-shell admin-loading">
        <LoaderCircle className="spin" size={22} />
        <span>Checking admin access…</span>
      </main>
    );
  }

  if (!supabaseConfigured || !supabase) {
    return (
      <main className="admin-shell">
        <div className="admin-login-card">
          <div className="admin-logo"><ShieldCheck size={23} /></div>
          <p className="eyebrow">LLOYDS / THRIVENI</p>
          <h1>Admin dashboard</h1>
          <p className="login-description">
            Connect the Supabase project to enable secure admin access and response storage.
          </p>
          <div className="setup-notice">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment.
          </div>
          <Link className="back-home-link" href="/"><ArrowLeft size={15} /> Back to surveys</Link>
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="admin-shell">
        <div className="admin-login-card">
          <Link className="back-home-link" href="/"><ArrowLeft size={15} /> Back to surveys</Link>
          <div className="admin-logo"><ShieldCheck size={23} /></div>
          <p className="eyebrow">SECURE AREA</p>
          <h1>Admin sign in</h1>
          <p className="login-description">Sign in to view survey responses.</p>
          <form className="admin-login-form" onSubmit={(event) => void signIn(event)}>
            <label>
              <span>Email address</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@company.com"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary login-submit" disabled={signingIn}>
              {signingIn ? <><LoaderCircle className="spin" size={16} />Signing in…</> : "Sign in"}
            </button>
          </form>
          <div className="login-security"><ShieldCheck size={15} /> Authorized administrators only</div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark"><ShieldCheck size={18} /></span>
          <span className="brand-name">Lloyds<span>/</span>Thriveni</span>
        </Link>
        <div className="dashboard-account">
          <span className="admin-role"><ShieldCheck size={15} /> Administrator</span>
          <button type="button" className="sign-out-button" onClick={() => void signOut()}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>

      <div className="dashboard-main">
        <div className="dashboard-heading">
          <div>
            <p className="eyebrow">INSIGHTS & RESPONSES</p>
            <h1>Response dashboard</h1>
            <p>Confidential employee feedback, all in one place.</p>
          </div>
          <div className="dashboard-actions">
            <button type="button" className="button button-secondary" onClick={refreshResponses} disabled={loadingResponses}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button type="button" className="button button-primary" onClick={() => void exportCsv()} disabled={!filteredCount || exporting}>
              {exporting ? <LoaderCircle className="spin" size={16} /> : <ArrowDownToLine size={17} />}
              {exporting ? "Preparing CSV…" : "Export CSV"}
            </button>
          </div>
        </div>

        <div className="stat-grid">
          <StatCard label="Total responses" value={totals.total} icon={<BarChart3 size={19} />} />
          <StatCard label="Employee responses" value={totals.employee} icon={<UsersRound size={19} />} tone="green" />
          <StatCard label="Workmen responses" value={totals.workmen} icon={<UsersRound size={19} />} tone="blue" />
          <StatCard label="Languages shown" value={usedLanguages} icon={<Languages size={19} />} tone="gold" />
        </div>

        <section className="responses-panel">
          <div className="responses-toolbar">
            <div>
              <h2>Survey responses</h2>
              <p>
                {filteredCount === 0
                  ? "No matching responses"
                  : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filteredCount)} of ${filteredCount}`}
              </p>
            </div>
            <div className="filter-group">
              <label className="filter-select">
                <span className="sr-only">Filter by survey</span>
                <select value={surveyFilter} onChange={(event) => applyFilters(event.target.value, languageFilter)}>
                  <option value="all">All surveys</option>
                  <option value="employee">Employee survey</option>
                  <option value="workmen">Workmen survey</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="filter-select">
                <span className="sr-only">Filter by language</span>
                <select value={languageFilter} onChange={(event) => applyFilters(surveyFilter, event.target.value)}>
                  <option value="all">All languages</option>
                  {languageOptions.map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
            </div>
          </div>

          {error && <div className="dashboard-error"><CircleAlert size={17} />{error}</div>}
          {loadingResponses ? (
            <div className="table-state"><LoaderCircle className="spin" size={22} />Loading responses…</div>
          ) : filteredRows.length === 0 ? (
            <div className="table-state empty-state">
              <div className="empty-icon"><BarChart3 size={22} /></div>
              <strong>No responses yet</strong>
              <span>Submitted surveys will appear here.</span>
            </div>
          ) : (
            <div className="responses-table-wrap">
              <table className="responses-table">
                <thead>
                  <tr><th>Survey</th><th>Language</th><th>Submitted</th><th aria-label="Details" /></tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <ResponseRow
                      key={row.id}
                      row={row}
                      expanded={expandedId === row.id}
                      englishView={englishViewId === row.id}
                      translating={translatingResponseId === row.id}
                      onTranslate={() => void translateResponse(row)}
                      onToggleEnglish={() => setEnglishViewId(englishViewId === row.id ? null : row.id)}
                      onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loadingResponses && filteredCount > PAGE_SIZE && (
            <div className="pagination">
              <button type="button" className="button button-secondary" onClick={() => changePage(page - 1)} disabled={page === 0}>
                <ChevronLeft size={15} /> Previous
              </button>
              <span>Page {page + 1} of {pageCount}</span>
              <button type="button" className="button button-secondary" onClick={() => changePage(page + 1)} disabled={page + 1 >= pageCount}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </section>
        <p className="dashboard-footnote">
          <ShieldCheck size={14} /> Responses are anonymous; names and employee numbers are not collected.
        </p>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "purple",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon stat-${tone}`}>{icon}</span>
      <div><p>{label}</p><strong>{value.toLocaleString("en")}</strong></div>
    </article>
  );
}

function ResponseRow({
  row,
  expanded,
  englishView,
  translating,
  onTranslate,
  onToggleEnglish,
  onToggle,
}: {
  row: SurveyResponseRecord;
  expanded: boolean;
  englishView: boolean;
  translating: boolean;
  onTranslate: () => void;
  onToggleEnglish: () => void;
  onToggle: () => void;
}) {
  const surveyId: SurveyId = row.survey_id;
  const answers = englishView && row.english_answers ? row.english_answers : row.answers;
  const questionLabels = englishView && row.english_question_labels
    ? row.english_question_labels
    : row.question_labels;
  const responseLabels = englishView && row.english_response_labels
    ? row.english_response_labels
    : row.response_labels;
  return (
    <>
      <tr className="response-row">
        <td>
          <button type="button" className="response-survey-button" onClick={onToggle} aria-expanded={expanded}>
            <span className={`survey-dot ${surveyId}`} />
            <span>{surveys[surveyId].title}</span>
          </button>
        </td>
        <td><span className="language-badge">{row.language_name}</span></td>
        <td className="date-cell">{formatDate(row.submitted_at)}</td>
        <td><button type="button" className="expand-button" onClick={onToggle} aria-label={expanded ? "Hide response" : "Show response"}>
          {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </button></td>
      </tr>
      {expanded && (
        <tr className="response-detail-row">
          <td colSpan={4}>
            <div className="response-detail-toolbar">
              <div>
                <strong>{englishView ? "English translation · AI-generated" : `Original response · ${row.language_name}`}</strong>
                {row.language_code !== "en" && (
                  <p>
                    To translate, this response&apos;s text will be sent to Google Gemini. Review it for accuracy.
                  </p>
                )}
              </div>
              {row.language_code !== "en" && (
                row.english_answers && row.english_question_labels && row.english_response_labels
                  ? (
                    <button type="button" className="button button-secondary translate-button" onClick={onToggleEnglish}>
                      {englishView ? "Show original" : "Show English"}
                    </button>
                  )
                  : (
                    <button type="button" className="button button-secondary translate-button" onClick={onTranslate} disabled={translating}>
                      {translating
                        ? <><LoaderCircle className="spin" size={14} /> Translating…</>
                        : <><Languages size={14} /> Translate to English</>}
                    </button>
                  )
              )}
            </div>
            <dl className="answer-list">
              {Object.entries(answers).map(([id, answer]) => (
                <div className="answer-item" key={id}>
                  <dt>{questionLabels[id] ?? id}</dt>
                  <dd>
                    {typeof answer === "number"
                      ? `${answer} · ${responseLabels?.[String(answer)] ?? answer}`
                      : answer || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      )}
    </>
  );
}
