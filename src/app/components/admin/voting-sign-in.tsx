"use client";

import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { saveVotingAdminSession, votingService } from "../../votes/service";
import type { VotingAdminSession } from "../../votes/types";
import "./admin.css";

interface FormProps {
  password: string;
  showPassword: boolean;
  pending: boolean;
  error: string;
  onChange: (value: string) => void;
  onToggle: () => void;
  onSubmit: () => void;
}
export function VotingAdminSignInForm({
  password,
  showPassword,
  pending,
  error,
  onChange,
  onToggle,
  onSubmit,
}: FormProps) {
  return (
    <div className="admin-voting-auth">
      <section className="admin-voting-auth-story">
        <span className="admin-eyebrow">
          <ShieldCheck size={14} />
          Voting administration
        </span>
        <h1>
          A clear direction.
          <br />
          <em>A stronger poll.</em>
        </h1>
        <p>
          Bring your candidates into the spotlight. Create polls, manage
          registrations, and follow verified voting activity.
        </p>
        <div className="admin-voting-auth-art" aria-hidden="true">
          <Vote size={56} strokeWidth={1.4} />
          <span>
            <Check size={17} />
          </span>
        </div>
        <div className="admin-voting-auth-features">
          <span>
            <Check size={13} />
            Create & publish polls
          </span>
          <span>
            <Check size={13} />
            Register candidates
          </span>
          <span>
            <Check size={13} />
            View verified vote totals
          </span>
        </div>
      </section>
      <section
        className="admin-voting-auth-form"
        aria-labelledby="voting-admin-login-title"
      >
        <span className="admin-auth-icon">
          <KeyRound size={24} />
        </span>
        <p className="admin-eyebrow">Your voting workspace</p>
        <h2 id="voting-admin-login-title">Welcome to the voting desk.</h2>
        <p>
          Sign in with your voting admin password. Your regular portal login
          stays separate.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          aria-busy={pending}
        >
          <label htmlFor="voting-admin-password">Voting admin password</label>
          <div className="admin-auth-password">
            <KeyRound size={17} aria-hidden="true" />
            <input
              id="voting-admin-password"
              name="voting-admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={512}
              value={password}
              disabled={pending}
              onChange={(event) => onChange(event.target.value)}
              placeholder="Enter voting admin password"
              aria-describedby={
                error ? "voting-admin-login-error" : "voting-admin-login-hint"
              }
            />
            <button
              type="button"
              disabled={pending}
              onClick={onToggle}
              aria-label={
                showPassword ? "Hide voting password" : "Show voting password"
              }
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {error && (
            <p
              className="admin-auth-error"
              role="alert"
              id="voting-admin-login-error"
            >
              {error}
            </p>
          )}
          <button className="admin-primary" type="submit" disabled={pending}>
            {pending ? (
              <>
                <LoaderCircle size={17} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Open voting workspace
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
        <p className="admin-auth-hint" id="voting-admin-login-hint">
          Use the password configured for voting administration. The original
          portal password is used on the regular admin login screen.
        </p>
        <div className="admin-auth-links">
          <Link href="/pages/admin">Back to portal admin</Link>
          <Link href="/pages/votes">
            View public voting <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default function VotingAdminSignIn({
  onAuthenticated,
  initialMessage = "",
}: {
  onAuthenticated: (session: VotingAdminSession) => void;
  initialMessage?: string;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  async function signIn() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setSubmitted(true);
    try {
      const result = await votingService.adminLogin(password);
      const session = saveVotingAdminSession(result);
      setPassword("");
      onAuthenticated(session);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to sign in to voting administration.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <VotingAdminSignInForm
      password={password}
      showPassword={showPassword}
      pending={pending}
      error={error || (!submitted ? initialMessage : "")}
      onChange={(value) => {
        setPassword(value);
        setError("");
      }}
      onToggle={() => setShowPassword((value) => !value)}
      onSubmit={() => void signIn()}
    />
  );
}
