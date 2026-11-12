"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export default function SetPasswordPortal() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase));
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError("We couldn't verify the invitation link. Please request a new invitation.");
      } else {
        setHasSession(Boolean(data.session));
      }
      setCheckingSession(false);
    }).catch((reason: unknown) => {
      console.error("Could not verify the password setup session:", reason);
      if (active) {
        setError("We couldn't verify the invitation link. Please request a new invitation.");
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function setAccountPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSaved(true);
      setPassword("");
      setConfirmPassword("");
    } catch (reason) {
      console.error("Could not set the admin account password:", reason);
      setError(reason instanceof Error
        ? reason.message
        : "We couldn't set your password. Please request a new invitation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-shell">
      <div className="admin-login-card">
        <Link className="back-home-link" href="/"><ArrowLeft size={15} /> Back to surveys</Link>
        <div className="admin-logo"><ShieldCheck size={23} /></div>
        <p className="eyebrow">SECURE ACCOUNT SETUP</p>
        <h1>Set your password</h1>
        <p className="login-description">
          Create a password for your administrator account. You can then sign in at the admin dashboard.
        </p>

        {!supabaseConfigured || !supabase ? (
          <div className="setup-notice">
            Supabase is not configured for this deployment. Contact the portal administrator.
          </div>
        ) : checkingSession ? (
          <div className="admin-loading">
            <LoaderCircle className="spin" size={18} />
            <span>Verifying your invitation…</span>
          </div>
        ) : saved ? (
          <>
            <div className="setup-notice" role="status">
              Your password is set. Use your invited email and new password to sign in.
            </div>
            <button type="button" className="button button-primary login-submit" onClick={() => router.replace("/admin")}>
              Continue to admin sign in
            </button>
          </>
        ) : !hasSession ? (
          <>
            <div className="setup-notice" role="alert">
              This invitation link is invalid, expired, or has already been used. Ask the portal administrator to send a new invitation.
            </div>
            <Link className="button button-primary login-submit" href="/admin">
              Go to admin sign in
            </Link>
          </>
        ) : (
          <form className="admin-login-form" onSubmit={(event) => void setAccountPassword(event)}>
            <label>
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="button button-primary login-submit" disabled={saving}>
              {saving ? <><LoaderCircle className="spin" size={16} />Saving password…</> : "Set password"}
            </button>
          </form>
        )}
        <div className="login-security"><ShieldCheck size={15} /> Authorized administrators only</div>
      </div>
    </main>
  );
}
