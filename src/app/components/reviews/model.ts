import type { LogFactory, Review } from "../../helpers/factories";

export function recordedNumber(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim()))
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// The backend stores percentages, not points out of totalQuestions.
export function reviewScore(value: unknown): number | null {
  const score = recordedNumber(value);
  return score !== null && score <= 100 ? score : null;
}

export function answerStatus(
  answer: Review,
): "correct" | "incorrect" | "unanswered" | "unavailable" {
  if (typeof answer.correct !== "string" || !answer.correct.trim())
    return "unavailable";
  if (typeof answer.picked !== "string" || !answer.picked.trim())
    return "unanswered";
  return answer.picked === answer.correct ? "correct" : "incorrect";
}

export function reviewFacts(review: LogFactory) {
  const answers: Review[] = Array.isArray(review.review) ? review.review : [];
  const total = recordedNumber(review.totalQuestions);
  return {
    answers,
    score: reviewScore(review.score),
    total,
    correct: answers.filter((answer) => answerStatus(answer) === "correct")
      .length,
    incorrect: answers.filter((answer) => answerStatus(answer) === "incorrect")
      .length,
    missing: total === null ? null : Math.max(0, total - answers.length),
  };
}

export function reviewDate(value: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Date unavailable";
}
