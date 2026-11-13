"use client";

import {
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Announcement,
  AnnouncementModal,
} from "@/app/components/dynamic-modal";
import PageState from "@/app/components/page-state";
import {
  QuizHeader,
  QuizLanding,
  QuizProgressPanel,
  QuizResults,
  QuizTimer,
} from "@/app/components/study/quiz-views";
import { useToast } from "@/app/components/toast";
import Validator from "@/app/components/validator";
import { CoreService } from "@/app/helpers/api-handler";
import {
  type LogFactory,
  QuestionFactory,
  type QuestionItem,
  type Review,
} from "@/app/helpers/factories";
import "@/app/components/study/study.css";

// ─── Design Tokens ──────────────────────────────────────────────────────────
const service = new CoreService();
const QuizApp: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [startQuiz, setStartQuiz] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const { addToast, information, questionId, setState } = useToast();
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [backUpQuestion, setBackUpQuestion] = useState<QuestionFactory[]>([]);
  const [loggedResponses, setLoggedResponses] = useState<Review[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [answersHistory, setAnswersHistory] = useState<
    {
      question: string;
      selected: number;
      correct: boolean;
      correctAnswer: number;
    }[]
  >([]);

  const [isDynamicTest, setIsDynamicTest] = useState<boolean>(false);
  const [isDynamicModalOpen, setDynamicModalOpen] = useState<boolean>(true);
  const [dynamicTime, setDynamicTime] = useState<number>(0);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const advanceLock = useRef(false);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  const fetchQuestions = useCallback(async (): Promise<void> => {
    setQuestionsLoading(true);
    try {
      const res = await service.get(
        `/question/api/get-questions?id=${questionId}`,
      );
      if (res.success) {
        const result = QuestionFactory.fromApi(res.data);
        setBackUpQuestion(Array.isArray(result) ? result : [result]);
        setHasError(false);
        const first = Array.isArray(result) ? result[0] : result;
        setIsDynamicTest(first?.isDynamic || false);
        setDynamicTime(first?.dynamicTime || 0);
        const flatQuestions: QuestionItem[] = Array.isArray(result)
          ? result.flatMap((q) => q.question)
          : result.question;
        setQuestions(flatQuestions);
      } else {
        setErrorMessage(res.message);
        setHasError(true);
      }
    } catch (e: any) {
      setHasError(true);
      setErrorMessage(e.message || "Unable to load your assessment.");
    } finally {
      setQuestionsLoading(false);
    }
  }, [questionId]);

  const logResponse = useCallback(async (): Promise<void> => {
    const timeSpentMinutes = Math.floor((Date.now() - startTime) / (1000 * 60));
    const payload: LogFactory = {
      userId: information?.userId,
      review: loggedResponses,
      taken: true,
      quizName: backUpQuestion.find((u) => u.name)?.name || "Unknown Quiz",
      totalQuestions: questions.length,
      timeSpent: timeSpentMinutes,
      subtitle: "Quiz response data",
      name: backUpQuestion.find((u) => u.name)?.name || "No question",
      completedDate: new Date().toISOString(),
      score: Math.round((score / questions.length) * 100),
    };
    try {
      setIsLoading(true);
      const res = await service.send("/review/api/log-responses", payload);
      if (res.success) {
        setSaveStatus("saved");
        addToast(res.message, "success");
      } else {
        setSaveStatus("error");
        setTimeout(() => addToast(res.message, "error"), 2000);
      }
    } catch (e: any) {
      setSaveStatus("error");
      addToast(e.message, "error");
    } finally {
      setIsLoading(false);
    }
  }, [
    startTime,
    information?.userId,
    loggedResponses,
    backUpQuestion,
    questions.length,
    score,
    addToast,
  ]);

  useEffect(() => {
    fetchQuestions();
    const userSession = sessionStorage.getItem("userSession");
    if (!userSession) {
      router.push("/pages/login");
      return;
    }
    setTimeLeft(information?.time || 0);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      sessionStorage.removeItem("userSession");
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [fetchQuestions, information?.time, router]);

  const handleAnswerClick = (index: number) => {
    if (answered) return;
    setSelectedAnswer(index);
    setAnswered(true);
    const isCorrect = index === questions[currentQuestion].correct;
    const data: Review = {
      question: questions[currentQuestion].question,
      picked: questions[currentQuestion].options[index],
      correct:
        questions[currentQuestion].options[questions[currentQuestion].correct],
    };
    setAnswersHistory((prev) => [
      ...prev,
      {
        question: questions[currentQuestion].question,
        selected: index,
        correct: isCorrect,
        correctAnswer: questions[currentQuestion].correct,
      },
    ]);
    setLoggedResponses((prev) => [...prev, data]);
    if (isCorrect) {
      setScore(score + 1);
      setStreak(streak + 1);
    } else {
      setStreak(0);
    }
  };

  const saveScore = useCallback(
    async (percentage: number) => {
      setIsLoading(true);
      try {
        const res = await service.send("/users/api/save-score", {
          userId: information?.userId,
          score: percentage,
        });
        if (res.success) {
          await logResponse();
        } else {
          setSaveStatus("error");
          addToast(res.message, "error");
        }
      } catch (e: any) {
        setSaveStatus("error");
        addToast(e.message, "warning");
      } finally {
        setIsLoading(false);
      }
    },
    [information?.userId, logResponse, addToast],
  );

  const handleNext = useCallback(async () => {
    if (advanceLock.current) return;
    advanceLock.current = true;
    try {
      const nextQuestion = currentQuestion + 1;
      if (nextQuestion < questions.length) {
        setCurrentQuestion(nextQuestion);
        setSelectedAnswer(null);
        setAnswered(false);
        setTimeLeft(dynamicTime > 0 ? dynamicTime : information?.time || 0);
      } else {
        setShowScore(true);
        const percentage = Math.round((score / questions.length) * 100);
        await saveScore(percentage);
      }
    } finally {
      advanceLock.current = false;
    }
  }, [
    currentQuestion,
    questions.length,
    dynamicTime,
    information?.time,
    score,
    saveScore,
  ]);
  useEffect(() => {
    if (!startQuiz || showScore || answered) return;
    if (timeLeft <= 0) {
      void handleNext();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, startQuiz, showScore, answered, handleNext]);

  const restartQuiz = async () => {
    router.push("/pages/login");
    setCurrentQuestion(0);
    setScore(0);
    setShowScore(false);
    setSelectedAnswer(null);
    setAnswered(false);
    setTimeLeft(information!.time);
    setStartQuiz(false);
    setStreak(0);
    setAnswersHistory([]);
  };

  const startQuizHandler = () => {
    if (!questions.length || !information || questionsLoading) return;
    setStartQuiz(true);
    setTimeLeft(dynamicTime > 0 ? dynamicTime : information!.time);
    setStartTime(Date.now());
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: Move keyboard focus whenever the displayed question changes.
  useEffect(() => {
    if (startQuiz && !showScore) questionHeadingRef.current?.focus();
  }, [currentQuestion, startQuiz, showScore]);

  const handleDynamicModalClose = () => {
    setTimeLeft(dynamicTime);
    setDynamicModalOpen(false);
  };

  const announcement: Announcement[] = [
    {
      id: "0",
      title: "⚡ Dynamic Test Mode",
      body: "This test is dynamic, meaning each question has a specific time limit set by your tutor. Stay focused and manage your time carefully throughout the test.",
    },
    {
      id: "0",
      title: "✅ Ready to Begin?",
      body: "By clicking Start, you confirm that you understand the time limits for each question and agree to complete the test within the assigned schedule.",
      cta: {
        label: "Start Challenge",
        onClick: () => handleDynamicModalClose(),
      },
    },
  ];

  const limit = dynamicTime > 0 ? dynamicTime : information?.time || 0;
  const title =
    backUpQuestion.find((quiz) => quiz.name)?.name || "Your assessment";
  if (questionsLoading)
    return (
      <div className="quiz-experience">
        <PageState
          loading
          title="Preparing your next challenge."
          description="Loading your assessment and its time settings."
        />
        <Validator />
      </div>
    );
  if (hasError || !questions.length || !information || limit <= 0)
    return (
      <div className="quiz-experience">
        <PageState
          title="Your assessment isn’t ready yet."
          description={
            errorMessage ||
            "Open an available quiz from the access screen to get started."
          }
        >
          <button
            type="button"
            className="study-button-primary"
            onClick={() => router.push("/pages/login")}
          >
            Back to quiz access
          </button>
        </PageState>
        <Validator />
      </div>
    );
  if (!startQuiz)
    return (
      <div className="quiz-experience">
        {isDynamicTest && (
          <AnnouncementModal
            announcements={announcement}
            isOpen={isDynamicModalOpen}
            onClose={handleDynamicModalClose}
          />
        )}
        <QuizLanding
          title={title}
          count={questions.length}
          seconds={limit}
          dynamic={isDynamicTest}
          onStart={startQuizHandler}
        />
        <Validator />
      </div>
    );
  if (showScore)
    return (
      <div className="quiz-experience">
        <QuizResults
          title={title}
          percentage={Math.round((score / questions.length) * 100)}
          correct={score}
          incorrect={answersHistory.filter((answer) => !answer.correct).length}
          unanswered={questions.length - answersHistory.length}
          saving={isLoading}
          saved={saveStatus === "saved"}
          saveError={saveStatus === "error"}
          onRestart={restartQuiz}
          onPortal={() => {
            setState(true);
            router.push("/pages/login");
          }}
        >
          <section className="quiz-review-panel">
            <button
              type="button"
              className="study-button-outline"
              aria-expanded={isReviewMode}
              onClick={() => setIsReviewMode((value) => !value)}
            >
              {isReviewMode ? "Hide" : "Review"} your selected answers
            </button>
            {isReviewMode && (
              <div className="quiz-result-review-list">
                {answersHistory.length === 0 ? (
                  <p>No answers were selected during this assessment.</p>
                ) : (
                  answersHistory.map((answer, index) => (
                    <article key={`${answer.question}-${index}`}>
                      <span
                        className={
                          answer.correct ? "is-correct" : "is-incorrect"
                        }
                      >
                        {answer.correct ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <XCircle size={17} />
                        )}
                        {answer.correct ? "Correct" : "Incorrect"}
                      </span>
                      <h2>{answer.question}</h2>
                      <p>
                        Your answer:{" "}
                        {loggedResponses[index]?.picked || "Unavailable"}
                      </p>
                      <p>
                        Correct answer:{" "}
                        {loggedResponses[index]?.correct || "Unavailable"}
                      </p>
                    </article>
                  ))
                )}
              </div>
            )}
          </section>
        </QuizResults>
        <Validator />
      </div>
    );
  const question = questions[currentQuestion];
  return (
    <div className="quiz-experience">
      <QuizHeader active title={title} />
      <div className="quiz-workspace">
        <div className="quiz-workspace-heading">
          <div>
            <p className="study-eyebrow">
              <Sparkles size={13} />A little focus goes a long way
            </p>
            <h1>One question. One step forward.</h1>
          </div>
          <span className="quiz-question-counter">
            Question <strong>{currentQuestion + 1}</strong> of{" "}
            {questions.length}
          </span>
        </div>
        <div className="quiz-workspace-grid">
          <main className="quiz-main-column">
            <section
              className="quiz-question-card"
              aria-labelledby="quiz-question-title"
            >
              <div className="quiz-question-card-header">
                <div>
                  <span className="quiz-question-label">
                    QUESTION {String(currentQuestion + 1).padStart(2, "0")}
                  </span>
                  <p>Select the answer you believe is correct.</p>
                </div>
                <QuizTimer left={timeLeft} total={limit} />
              </div>
              <h2
                id="quiz-question-title"
                tabIndex={-1}
                ref={questionHeadingRef}
              >
                {question?.question}
              </h2>
              <div className="quiz-answer-options">
                {question?.options.map((option, index) => {
                  const correct = answered && index === question.correct;
                  const wrong =
                    answered &&
                    selectedAnswer === index &&
                    index !== question.correct;
                  return (
                    <button
                      key={`${currentQuestion}-${index}`}
                      type="button"
                      className={`quiz-option ${correct ? "is-correct" : wrong ? "is-incorrect" : answered ? "is-muted" : ""}`}
                      onClick={() => handleAnswerClick(index)}
                      disabled={answered}
                      aria-pressed={selectedAnswer === index}
                    >
                      <span className="quiz-option-letter">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span>{option}</span>
                      {correct ? (
                        <CheckCircle2 size={21} />
                      ) : wrong ? (
                        <XCircle size={21} />
                      ) : (
                        <span className="quiz-option-circle" />
                      )}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <div
                  className={`quiz-answer-feedback ${selectedAnswer === question.correct ? "is-correct" : "is-incorrect"}`}
                  aria-live="polite"
                >
                  {selectedAnswer === question.correct ? (
                    <>
                      <CheckCircle2 size={18} />
                      <span>That’s right. Keep the momentum going.</span>
                    </>
                  ) : (
                    <>
                      <Lightbulb size={18} />
                      <span>
                        Every answer is a chance to learn. The correct option is
                        highlighted above.
                      </span>
                    </>
                  )}
                </div>
              )}
            </section>
            <div className="quiz-question-footer">
              <span>
                <Lightbulb size={15} />
                {answered
                  ? "Your answer is locked in."
                  : "Take your time within the question limit."}
              </span>
              <button
                type="button"
                className="study-button-primary"
                disabled={!answered || isLoading}
                onClick={() => void handleNext()}
              >
                {currentQuestion === questions.length - 1
                  ? "See your results"
                  : "Next question"}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="quiz-focus-note">
              <span>STAY CURIOUS.</span>Read carefully. Trust your preparation.
              Keep going.
            </div>
          </main>
          <QuizProgressPanel
            total={questions.length}
            current={currentQuestion}
            answered={answered}
            correct={score}
            streak={streak}
            history={answersHistory}
          />
        </div>
      </div>
      <Validator />
    </div>
  );
};
export default QuizApp;
