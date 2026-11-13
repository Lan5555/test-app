"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileQuestion,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { LogFactory } from "../../helpers/factories";
import {
  answerStatus,
  recordedNumber,
  reviewDate,
  reviewFacts,
  reviewScore,
} from "./model";
import "../study/study.css";
import "./reviews.css";

function ScoreRing({ score }: { score: number | null }) {
  const length = 2 * Math.PI * 44;
  return (
    <div
      className="reviews-score-ring"
      role="img"
      aria-label={
        score === null
          ? "Recorded score unavailable"
          : `Recorded score ${score}%`
      }
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" />
        <circle
          cx="50"
          cy="50"
          r="44"
          className="reviews-score-arc"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - (score ?? 0) / 100)}
        />
      </svg>
      <div>
        <strong>
          {score === null ? "—" : Math.round(score)}
          {score !== null && <small>%</small>}
        </strong>
        <span>Recorded score</span>
      </div>
    </div>
  );
}

export function ReviewsOverview({
  reviews,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  reviews: LogFactory[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (review: LogFactory) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const scores = reviews
    .map((review) => reviewScore(review.score))
    .filter((score): score is number => score !== null);
  const times = reviews
    .map((review) => recordedNumber(review.timeSpent))
    .filter((time): time is number => time !== null);
  const average = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : null;
  const filtered = reviews.filter((review) => {
    const score = reviewScore(review.score);
    return (
      (review.name || "").toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" ||
        (filter === "high" && score !== null && score >= 80) ||
        (filter === "low" && score !== null && score < 60))
    );
  });
  const ready = !loading && !error;
  return (
    <div className="reviews-page">
      <Link href="/pages/student" className="reviews-back">
        <ArrowLeft size={15} />
        Student dashboard
      </Link>
      <section className="reviews-hero">
        <div>
          <span className="reviews-eyebrow">
            <Sparkles size={13} />A closer look at your learning
          </span>
          <h1>
            Every answer has
            <br />a <em>next step.</em>
          </h1>
          <p>
            Revisit your assessments, understand your answers, and take a little
            more confidence into what comes next.
          </p>
        </div>
        <div className="reviews-hero-art" aria-hidden="true">
          <span>
            <BookOpen size={52} strokeWidth={1.3} />
          </span>
          <div>
            <CheckCircle2 size={16} />A little reflection. A lot of growth.
          </div>
        </div>
      </section>
      <div className="reviews-metrics">
        {[
          {
            label: "Saved reviews",
            value: ready ? String(reviews.length) : "—",
            icon: BookOpen,
          },
          {
            label: "Average recorded score",
            value: ready && average !== null ? `${average}%` : "—",
            icon: Target,
          },
          {
            label: "Best recorded score",
            value:
              ready && scores.length
                ? `${Math.round(Math.max(...scores))}%`
                : "—",
            icon: Trophy,
          },
          {
            label: "Recorded study time",
            value:
              ready && times.length
                ? `${times.reduce((sum, time) => sum + time, 0)} min`
                : "—",
            icon: Clock3,
          },
        ].map((item) => (
          <div key={item.label}>
            <span>
              <item.icon size={18} />
            </span>
            <p>
              {item.label}
              <strong>{item.value}</strong>
            </p>
          </div>
        ))}
      </div>
      <section
        className="reviews-library"
        aria-labelledby="reviews-library-title"
      >
        <div className="reviews-library-heading">
          <div>
            <p className="study-eyebrow">Your saved assessments</p>
            <h2 id="reviews-library-title">The learning continues.</h2>
          </div>
          <label className="reviews-search">
            <Search size={17} />
            <span className="sr-only">Search quiz reviews</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a quiz review…"
            />
          </label>
        </div>
        <fieldset className="reviews-filters" aria-label="Filter review scores">
          {[
            { value: "all", label: "All reviews" },
            { value: "high", label: "80% and above" },
            { value: "low", label: "Below 60%" },
          ].map((item) => (
            <button
              type="button"
              key={item.value}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
        {loading ? (
          <div className="reviews-empty" aria-live="polite">
            <RefreshCw size={24} className="animate-spin" />
            <h3>Opening your learning history…</h3>
            <p>Loading the review records linked to your student account.</p>
          </div>
        ) : error ? (
          <div className="reviews-empty">
            <FileQuestion size={30} />
            <h3>Your reviews are unavailable.</h3>
            <p role="alert">{error}</p>
            <button
              type="button"
              className="study-button-primary"
              onClick={onRetry}
            >
              Try again <RefreshCw size={15} />
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="reviews-empty">
            <BookOpen size={30} />
            <h3>
              {search || filter !== "all"
                ? "No matching reviews."
                : "Your learning story starts here."}
            </h3>
            <p>
              {search || filter !== "all"
                ? "Try a different search or score filter."
                : "Your completed assessments will appear once their reviews have been saved."}
            </p>
            {(search || filter !== "all") && (
              <button
                type="button"
                className="study-button-outline"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Show all reviews
              </button>
            )}
          </div>
        ) : (
          <div className="reviews-records">
            {filtered.map((review, index) => {
              const score = reviewScore(review.score);
              const time = recordedNumber(review.timeSpent);
              return (
                <button
                  type="button"
                  key={
                    review.id ??
                    `${review.name}-${review.completedDate}-${index}`
                  }
                  className="reviews-record"
                  onClick={() => onSelect(review)}
                >
                  <span className="reviews-record-icon">
                    <BookOpen size={23} />
                  </span>
                  <div className="reviews-record-copy">
                    <h3>{review.name || "Assessment review"}</h3>
                    <p>
                      <span>
                        <CalendarDays size={12} />
                        {reviewDate(review.completedDate)}
                      </span>
                      <span>
                        <Clock3 size={12} />
                        {time === null ? "Timing unavailable" : `${time} min`}
                      </span>
                      <span>
                        {recordedNumber(review.totalQuestions) ?? "—"} questions
                      </span>
                    </p>
                  </div>
                  <div className="reviews-record-score">
                    <strong>
                      {score === null ? "—" : `${Math.round(score)}%`}
                    </strong>
                    <small>Recorded score</small>
                    <div className="reviews-record-track" aria-hidden="true">
                      <span style={{ width: `${score ?? 0}%` }} />
                    </div>
                  </div>
                  <span className="reviews-record-arrow">
                    <ArrowUpRight size={19} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <p className="reviews-data-note">
          Based on available saved review records. Missing scores and timing are
          shown as unavailable.
        </p>
      </section>
    </div>
  );
}

export function ReviewDetail({
  review,
  onBack,
}: {
  review: LogFactory;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const facts = reviewFacts(review);
  const filtered = facts.answers
    .map((answer, index) => ({ answer, position: index + 1 }))
    .filter(
      ({ answer }) => filter === "all" || answerStatus(answer) === filter,
    );
  const labels = {
    correct: "Correct",
    incorrect: "Incorrect",
    unanswered: "No selected answer",
    unavailable: "Answer unavailable",
  };
  return (
    <div className="reviews-page">
      <button type="button" className="reviews-back" onClick={onBack}>
        <ArrowLeft size={15} />
        All your reviews
      </button>
      <section className="reviews-detail-hero">
        <div>
          <span className="reviews-eyebrow">
            <BookOpen size={13} />
            Your assessment, in focus
          </span>
          <h1 tabIndex={-1}>{review.name || "Assessment review"}</h1>
          <p>
            {review.subtitle ||
              "Explore your saved answers and the answer key for this assessment."}
          </p>
          <div className="reviews-detail-meta">
            <span>
              <CalendarDays size={14} />
              {reviewDate(review.completedDate)}
            </span>
            <span>
              <Clock3 size={14} />
              {recordedNumber(review.timeSpent) === null
                ? "Timing unavailable"
                : `${review.timeSpent} min recorded`}
            </span>
          </div>
        </div>
        <ScoreRing score={facts.score} />
      </section>
      <div className="reviews-detail-metrics">
        <div>
          <span>
            <CheckCircle2 size={18} />
            Correct saved answers
          </span>
          <strong>{facts.correct}</strong>
        </div>
        <div>
          <span>
            <XCircle size={18} />
            Incorrect saved answers
          </span>
          <strong>{facts.incorrect}</strong>
        </div>
        <div>
          <span>
            <BookOpen size={18} />
            Question records
          </span>
          <strong>
            {facts.answers.length}
            <small> / {facts.total ?? "—"}</small>
          </strong>
        </div>
      </div>
      <section
        className="reviews-answer-section"
        aria-labelledby="reviews-answers-title"
      >
        <div className="reviews-library-heading">
          <div>
            <p className="study-eyebrow">Turn reflection into progress</p>
            <h2 id="reviews-answers-title">One answer at a time.</h2>
          </div>
          <span className="reviews-expand-hint">
            Open a question to see the details <ChevronDown size={13} />
          </span>
        </div>
        <fieldset className="reviews-filters" aria-label="Filter saved answers">
          {[
            { value: "all", label: "All saved answers" },
            { value: "correct", label: "Correct" },
            { value: "incorrect", label: "Incorrect" },
            { value: "unanswered", label: "No selected answer" },
            { value: "unavailable", label: "Unavailable" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
        {facts.missing !== null && facts.missing > 0 && (
          <p className="reviews-missing-note">
            {facts.missing}{" "}
            {facts.missing === 1 ? "question does" : "questions do"} not have a
            saved question record in this response. Their answer details are
            unavailable.
          </p>
        )}
        {filtered.length === 0 ? (
          <div className="reviews-empty">
            <FileQuestion size={29} />
            <h3>No saved answers in this view.</h3>
            <p>
              {facts.answers.length
                ? "Try another answer filter."
                : "There are no question-level records available for this assessment."}
            </p>
          </div>
        ) : (
          <div className="reviews-questions">
            {filtered.map(({ answer, position }) => {
              const status = answerStatus(answer);
              return (
                <details
                  className={`reviews-question answer-${status}`}
                  key={position}
                >
                  <summary>
                    <span className="reviews-question-number">
                      {String(position).padStart(2, "0")}
                    </span>
                    <span className="reviews-question-copy">
                      <small>{labels[status]}</small>
                      <strong>
                        {answer.question || "Question text unavailable"}
                      </strong>
                    </span>
                    <span
                      className="reviews-question-status"
                      aria-hidden="true"
                    >
                      {status === "correct" ? (
                        <Check size={17} />
                      ) : status === "incorrect" ? (
                        <XCircle size={17} />
                      ) : (
                        <FileQuestion size={17} />
                      )}
                    </span>
                    <ChevronDown
                      size={17}
                      className="reviews-question-chevron"
                    />
                  </summary>
                  <div className="reviews-answer-grid">
                    <div>
                      <small>Your saved answer</small>
                      <p>
                        {typeof answer.picked === "string" &&
                        answer.picked.trim()
                          ? answer.picked
                          : "No selected answer saved."}
                      </p>
                    </div>
                    <div>
                      <small>Correct answer</small>
                      <p>
                        {typeof answer.correct === "string" &&
                        answer.correct.trim()
                          ? answer.correct
                          : "The correct answer is unavailable."}
                      </p>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        )}
        <div className="reviews-detail-footer">
          <span>
            <Sparkles size={16} />
            Every answer is another chance to learn.
          </span>
          <button
            type="button"
            className="study-button-outline"
            onClick={onBack}
          >
            Back to all reviews <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
