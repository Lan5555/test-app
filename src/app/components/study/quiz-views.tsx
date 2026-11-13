import {
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  Flame,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { StudyArtwork } from "./visuals";

export function QuizHeader({
  active = false,
  title,
}: {
  active?: boolean;
  title: string;
}) {
  return (
    <header className="quiz-topbar">
      <div className="study-brand">
        <span>
          <GraduationCap size={23} />
        </span>
        Lan&apos;s Hub<small>ASSESSMENT</small>
      </div>
      <span className="quiz-topbar-title">{title}</span>
      <span className="quiz-focus-badge">
        <ShieldCheck size={14} />
        {active ? "Focus mode" : "Your learning space"}
      </span>
    </header>
  );
}

export function QuizLanding({
  title,
  count,
  seconds,
  dynamic,
  onStart,
}: {
  title: string;
  count: number;
  seconds: number;
  dynamic: boolean;
  onStart: () => void;
}) {
  return (
    <>
      <QuizHeader title="Before you begin" />
      <div className="quiz-landing">
        <div className="quiz-landing-copy">
          <p className="study-eyebrow">
            <Sparkles size={14} />A moment to put it all together
          </p>
          <h1>
            A curious mind.
            <br />
            <em>A fresh challenge.</em>
          </h1>
          <p>
            Take a breath, find your focus, and show what you know. Your next
            step starts with the first question.
          </p>
          <div className="quiz-assessment-label">
            <BookOpen size={18} />
            <strong>{title}</strong>
          </div>
          <div className="quiz-landing-metrics">
            <span>
              <strong>{count}</strong>
              <small>Questions to explore</small>
            </span>
            <span>
              <strong>
                {seconds}
                <em>sec</em>
              </strong>
              <small>For each question</small>
            </span>
            <span>
              <strong>{dynamic ? "Tutor-set" : "Timed"}</strong>
              <small>Assessment mode</small>
            </span>
          </div>
          <button
            type="button"
            className="study-button-primary"
            onClick={onStart}
          >
            Start your assessment <ArrowRight size={18} />
          </button>
        </div>
        <section className="quiz-preparation">
          <StudyArtwork />
          <div className="quiz-before-you-start">
            <h2>
              <CircleHelp size={17} />A few things to know
            </h2>
            <p>
              <span>01</span>Read each question and all the answer options
              carefully.
            </p>
            <p>
              <span>02</span>Choosing an answer locks it in. You&apos;ll see
              feedback before moving on.
            </p>
            <p>
              <span>03</span>The timer advances unanswered questions
              automatically. Stay present.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

export function QuizTimer({ left, total }: { left: number; total: number }) {
  const progress = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  return (
    <div
      className={`quiz-timer ${left <= 10 ? "is-warning" : ""}`}
      role="timer"
      aria-label="Seconds remaining"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="20" />
        <circle
          cx="24"
          cy="24"
          r="20"
          className="quiz-timer-arc"
          strokeDasharray={2 * Math.PI * 20}
          strokeDashoffset={2 * Math.PI * 20 * (1 - progress)}
        />
      </svg>
      <div>
        <strong>{left}</strong>
        <small>seconds</small>
      </div>
    </div>
  );
}

export function QuizProgressPanel({
  total,
  current,
  answered,
  correct,
  streak,
  history,
}: {
  total: number;
  current: number;
  answered: boolean;
  correct: number;
  streak: number;
  history: {
    question: string;
    selected: number;
    correct: boolean;
    correctAnswer: number;
  }[];
}) {
  const completed = current + (answered ? 1 : 0);
  return (
    <aside className="quiz-sidebar">
      <section className="study-panel">
        <div className="study-panel-heading">
          <h2>Your progress</h2>
          <Target size={19} />
        </div>
        <div className="quiz-progress-summary">
          <strong>
            {completed}
            <small> / {total}</small>
          </strong>
          <span>questions completed</span>
        </div>
        <div className="study-progress-track">
          <span style={{ width: `${(completed / total) * 100}%` }} />
        </div>
        <ol className="quiz-question-map" aria-label="Question progress">
          {Array.from({ length: total }, (_, index) => index + 1).map(
            (position) => (
              <li
                key={position}
                className={
                  position === current + 1
                    ? "is-current"
                    : position < current + 1
                      ? "is-complete"
                      : ""
                }
                aria-current={position === current + 1 ? "step" : undefined}
              >
                <span className="sr-only">{`Question ${position}${position === current + 1 ? ", current" : position < current + 1 ? ", completed" : ", upcoming"}`}</span>
                <span aria-hidden="true">
                  {position < current + 1 ? <Check size={13} /> : position}
                </span>
              </li>
            ),
          )}
        </ol>
        <p className="quiz-map-legend">
          <span />
          Current question <span />
          Completed
        </p>
      </section>
      <section className="study-panel quiz-session-stats">
        <div>
          <span className="tone-lilac">
            <Trophy size={18} />
          </span>
          <p>
            Accuracy
            <strong>
              {completed ? Math.round((correct / completed) * 100) : 0}%
            </strong>
          </p>
        </div>
        <div>
          <span className="tone-peach">
            <Flame size={18} />
          </span>
          <p>
            Current streak
            <strong>
              {streak} <small>correct</small>
            </strong>
          </p>
        </div>
        <p className="quiz-session-caption">
          {history.length} {history.length === 1 ? "answer" : "answers"}{" "}
          selected this session.
        </p>
      </section>
      <p className="quiz-sidebar-tip">
        <Sparkles size={17} />
        One question at a time.
        <br />
        You&apos;ve got this.
      </p>
    </aside>
  );
}

export function QuizResults({
  title,
  percentage,
  correct,
  incorrect,
  unanswered,
  saving,
  saveError,
  saved,
  onRestart,
  onPortal,
  children,
}: {
  title: string;
  percentage: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  saving: boolean;
  saveError: boolean;
  saved: boolean;
  onRestart: () => void;
  onPortal: () => void;
  children?: ReactNode;
}) {
  const circumference = 2 * Math.PI * 64;
  return (
    <>
      <QuizHeader title="Your assessment summary" />
      <div className="quiz-results">
        <section className="quiz-result-card">
          <span className="quiz-result-trophy">
            <Trophy size={30} />
          </span>
          <p className="study-eyebrow">Another step forward</p>
          <h1>
            {percentage >= 80
              ? "Look at you go."
              : percentage >= 60
                ? "A solid step forward."
                : "Keep your curiosity going."}
          </h1>
          <p className="quiz-result-subtitle">{title}</p>
          <div className="quiz-score-ring">
            <svg viewBox="0 0 150 150" aria-hidden="true">
              <circle cx="75" cy="75" r="64" />
              <circle
                className="quiz-score-arc"
                cx="75"
                cy="75"
                r="64"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - percentage / 100)}
              />
            </svg>
            <div>
              <strong>
                {percentage}
                <small>%</small>
              </strong>
              <span>Your score</span>
            </div>
          </div>
          <div className="quiz-result-metrics">
            {[
              { label: "Correct", value: correct, icon: Check, tone: "mint" },
              { label: "Incorrect", value: incorrect, icon: X, tone: "peach" },
              {
                label: "Unanswered",
                value: unanswered,
                icon: Clock3,
                tone: "blue",
              },
            ].map((item) => (
              <div key={item.label}>
                <span className={`tone-${item.tone}`}>
                  <item.icon size={17} />
                </span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
          <p
            className={`quiz-save-status ${saveError ? "is-error" : ""}`}
            aria-live="polite"
          >
            {saving
              ? "Saving your score and responses…"
              : saveError
                ? "Your results could not be fully saved. Please contact your tutor before starting another attempt."
                : saved
                  ? "Your score and responses have been saved."
                  : "Your session results are shown above."}
          </p>
          <div className="quiz-result-actions">
            <button
              type="button"
              className="study-button-outline"
              onClick={onRestart}
              disabled={saving}
            >
              Back to quiz access
            </button>
            <button
              type="button"
              className="study-button-primary"
              onClick={onPortal}
              disabled={saving}
            >
              Student portal <ArrowRight size={17} />
            </button>
          </div>
        </section>
        {children}
      </div>
    </>
  );
}
