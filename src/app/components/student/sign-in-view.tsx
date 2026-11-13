"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LoaderCircle,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { StudyArtwork } from "../study/visuals";
import "../study/study.css";
import "./sign-in.css";

export interface StudentSignInProps {
  email: string;
  code: string;
  showCode: boolean;
  loading: boolean;
  error: string;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onToggleCode: () => void;
  onSubmit: () => void;
  onBack: () => void;
}

export default function StudentSignInView({
  email,
  code,
  showCode,
  loading,
  error,
  onEmailChange,
  onCodeChange,
  onToggleCode,
  onSubmit,
  onBack,
}: StudentSignInProps) {
  return (
    <div className="portal-signin">
      <header className="portal-signin-header">
        <button
          type="button"
          className="study-brand"
          onClick={onBack}
          disabled={loading}
          aria-label="Lan's Hub quiz access"
        >
          <span>
            <GraduationCap size={23} />
          </span>
          Lan&apos;s Hub<small>STUDENT PORTAL</small>
        </button>
        <button
          type="button"
          className="portal-signin-back"
          onClick={onBack}
          disabled={loading}
        >
          <ArrowLeft size={15} />
          <span>Back to quiz access</span>
        </button>
      </header>
      <main className="portal-signin-layout">
        <section
          className="portal-signin-story"
          aria-label="Your learning space"
        >
          <div className="portal-signin-story-top">
            <span>
              <Sparkles size={13} />A little curiosity. A lot of possibility.
            </span>
            <span className="portal-signin-story-dot" />
          </div>
          <h2>
            Your next chapter
            <br />
            <em>is waiting.</em>
          </h2>
          <p>
            Pick up where you left off. Follow your progress, learn from your
            answers, and make room for what comes next.
          </p>
          <StudyArtwork />
          <div className="portal-signin-features">
            <div>
              <span>
                <BookOpen size={16} />
              </span>
              <strong>
                Your learning,
                <br />
                in one place.
              </strong>
            </div>
            <div>
              <span>
                <GraduationCap size={17} />
              </span>
              <strong>
                Progress you
                <br />
                can come back to.
              </strong>
            </div>
            <div>
              <span>
                <MessageCircle size={16} />
              </span>
              <strong>
                A community
                <br />
                to grow with.
              </strong>
            </div>
          </div>
          <div className="portal-signin-story-bottom">
            <span>Stay curious. Keep going.</span>
            <Sparkles size={15} />
          </div>
        </section>
        <section
          className="portal-signin-form-section"
          aria-labelledby="portal-signin-title"
        >
          <div className="portal-signin-form-wrap">
            <span className="portal-signin-badge">
              <GraduationCap size={15} />
              Your student space
            </span>
            <h1 id="portal-signin-title">
              Good to see you<span>.</span>
            </h1>
            <p className="portal-signin-intro">
              Your learning story continues here.
              <br />
              Sign in with your email and personal access code.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
              aria-busy={loading}
            >
              <div className="portal-signin-field">
                <label htmlFor="portal-email">Email address</label>
                <div className="portal-signin-input">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="portal-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    required
                    disabled={loading}
                    aria-describedby={error ? "portal-signin-error" : undefined}
                  />
                </div>
              </div>
              <div className="portal-signin-field">
                <div className="portal-signin-labelrow">
                  <label htmlFor="portal-code">Personal access code</label>
                  <span>Provided by your tutor</span>
                </div>
                <div className="portal-signin-input">
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    id="portal-code"
                    name="access-code"
                    type={showCode ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your access code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => onCodeChange(event.target.value)}
                    required
                    disabled={loading}
                    aria-describedby={`portal-code-help${error ? " portal-signin-error" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={onToggleCode}
                    disabled={loading}
                    aria-label={
                      showCode ? "Hide access code" : "Show access code"
                    }
                    aria-pressed={showCode}
                  >
                    {showCode ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p id="portal-code-help" className="portal-signin-code-help">
                  Use the personal code associated with your student account.
                </p>
              </div>
              {error && (
                <div
                  id="portal-signin-error"
                  role="alert"
                  className="portal-signin-error"
                >
                  <TriangleAlert size={17} />
                  <p>{error}</p>
                </div>
              )}
              <button
                type="submit"
                className="portal-signin-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    Signing you in…
                  </>
                ) : (
                  <>
                    Enter your learning space <ArrowRight size={18} />
                  </>
                )}
              </button>
              <p className="portal-signin-secure">
                <ShieldCheck size={14} />
                Your personal gateway to your student dashboard.
              </p>
            </form>
            <div className="portal-signin-help">
              <span>
                <KeyRound size={18} />
              </span>
              <div>
                <strong>Need your access code?</strong>
                <p>
                  Ask your tutor or administrator for the code linked to your
                  account.
                </p>
              </div>
            </div>
            <div className="portal-signin-quiz-link">
              <span>Here for an assessment?</span>
              <button type="button" onClick={onBack} disabled={loading}>
                Go to quiz access <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
