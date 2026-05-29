'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, Clock, Zap, Trophy, RotateCcw, Sparkles, Star, 
  Target, Flame, Brain, Shield, Award, Medal, CheckCircle,
  XCircle, AlertCircle, Volume2, VolumeX, BarChart3, Activity,
  Gauge, Timer, Crown, TrendingUp, PartyPopper, Rocket,
  BadgeCheck, Lightbulb, Compass, Gem, Layers, ArrowRight,
  Circle, Check, Play, Pause, SkipForward, RefreshCw,
  Home, TrendingDown, ThumbsUp, ThumbsDown, Share2, ZapOff, Sparkle
} from 'lucide-react';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { LogFactory, QuestionFactory, QuestionItem, Review } from '@/app/helpers/factories';
import { useRouter } from 'next/navigation';
import ErrorPage from '@/app/components/error-page';
import InsetLoader from '@/app/components/inset-loader';
import { useMediaQuery } from '@/app/components/media';
import { Announcement, AnnouncementModal } from '@/app/components/dynamic-modal';
import { motion, AnimatePresence } from 'framer-motion';
import Validator from '@/app/components/validator';

// ─── Design Tokens ──────────────────────────────────────────────────────────
const tokens = {
  bg:        '#F8FAFC',
  surface:   '#FFFFFF',
  surfaceUp: '#F1F5F9',
  border:    '#E2E8F0',
  borderUp:  '#CBD5E1',
  gold:      '#4F46E5',
  goldLight: '#818CF8',
  goldMuted: '#EEF2FF',
  accent:    '#6366F1',
  accentMid: '#4F46E5',
  accentMuted:'#EEF2FF',
  success:   '#22C55E',
  error:     '#EF4444',
  textPrimary:   '#0F172A',
  textSecondary: '#475569',
  textMuted:     '#94A3B8',
};

// ─── Reusable styled helpers ─────────────────────────────────────────────────
const glassCard = `
  bg-[#111118] border border-[#25252E] rounded-3xl shadow-2xl
`;

const optionBase = `
  relative p-4 md:p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer
  font-medium
`;

// ─── Component ───────────────────────────────────────────────────────────────
const QuizApp: React.FC = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [startQuiz, setStartQuiz] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const { addToast, information, questionId, setState } = useToast();
  const service: CoreService = new CoreService();
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [backUpQuestion, setBackUpQuestion] = useState<QuestionFactory[]>([]);
  const [loggedResponses, setLoggedResponses] = useState<Review[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [answersHistory, setAnswersHistory] = useState<any[]>([]);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isDynamicTest, setIsDynamicTest] = useState<boolean>(false);
  const [isDynamicModalOpen, setDynamicModalOpen] = useState<boolean>(true);
  const [dynamicTime, setDynamicTime] = useState<number>(0);

  const fetchQuestions = async (): Promise<void> => {
    try {
      const res = await service.get(`/question/api/get-questions?id=${questionId}`);
      if (res.success) {
        const result = QuestionFactory.fromApi(res.data);
        setBackUpQuestion(Array.isArray(result) ? result : [result]);
        setHasError(false);
        setIsDynamicTest(result.isDynamic || false);
        setDynamicTime(result.dynamicTime || 0);
        const flatQuestions: QuestionItem[] = Array.isArray(result)
          ? result.flatMap(q => q.question)
          : result.question;
        setQuestions(flatQuestions);
      } else {
        setErrorMessage(res.message);
        setHasError(true);
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  const logResponse = async (): Promise<void> => {
    const timeSpentMinutes = Math.floor((Date.now() - startTime) / (1000 * 60));
    const payload: LogFactory = {
      userId: information!.userId,
      review: loggedResponses,
      taken: true,
      quizName: backUpQuestion.find((u) => u.name)?.name || 'Unknown Quiz',
      totalQuestions: questions.length,
      timeSpent: timeSpentMinutes,
      subtitle: 'Quiz response data',
      name: backUpQuestion.find((u) => u.name)?.name || 'No question',
      completedDate: new Date().toISOString(),
      score: Math.round(score / questions.length * 100),
    };
    try {
      setIsLoading(true);
      const res = await service.send('/review/api/log-responses', payload);
      if (res.success) {
        addToast(res.message, 'success');
      } else {
        setTimeout(() => addToast(res.message, 'error'), 2000);
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
    const userSession = sessionStorage.getItem('userSession');
    if (!userSession) {
      router.push('/pages/login');
      return;
    }
    setTimeLeft(information!.time);
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      sessionStorage.removeItem('userSession');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!startQuiz || showScore || answered) return;
    if (timeLeft === 0) { handleNext(); return; }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, startQuiz, showScore, answered]);

  const handleAnswerClick = (index: any) => {
    if (answered) return;
    setSelectedAnswer(index);
    setAnswered(true);
    const isCorrect = index === questions[currentQuestion].correct;
    const data: Review = {
      question: questions[currentQuestion].question,
      picked: questions[currentQuestion].options[index],
      correct: questions[currentQuestion].options[questions[currentQuestion].correct],
    };
    setAnswersHistory(prev => [...prev, {
      question: questions[currentQuestion].question,
      selected: index,
      correct: isCorrect,
      correctAnswer: questions[currentQuestion].correct,
    }]);
    setLoggedResponses(prev => [...prev, data]);
    if (isCorrect) { setScore(score + 1); setStreak(streak + 1); }
    else { setStreak(0); }
  };

  const saveScore = async (percentage: number) => {
    try {
      const res = await service.send('/users/api/save-score', {
        userId: information?.userId,
        score: percentage,
      });
      if (res.success) {
        await logResponse().then(() => addToast(res.message, 'success'));
      } else {
        addToast(res.message, 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'warning');
    }
  };

  const handleNext = async () => {
    const nextQuestion = currentQuestion + 1;
    if (nextQuestion < questions.length) {
      setCurrentQuestion(nextQuestion);
      setSelectedAnswer(null);
      setAnswered(false);
      setTimeLeft(dynamicTime > 0 ? dynamicTime : information!.time);
    } else {
      setShowScore(true);
      const percentage = Math.round((score / questions.length) * 100);
      await saveScore(percentage);
    }
  };

  const restartQuiz = async () => {
    router.push('/pages/login');
    setCurrentQuestion(0); setScore(0); setShowScore(false);
    setSelectedAnswer(null); setAnswered(false);
    setTimeLeft(information!.time); setStartQuiz(false);
    setStreak(0); setAnswersHistory([]);
  };

  const startQuizHandler = () => {
    setStartQuiz(true);
    setTimeLeft(dynamicTime > 0 ? dynamicTime : information!.time);
    setStartTime(Date.now());
  };

  const handleDynamicModalClose = () => {
    setTimeLeft(dynamicTime);
    setDynamicModalOpen(false);
  };

  const announcement: Announcement[] = [
    {
      id: '0',
      title: '⚡ Dynamic Test Mode',
      body: 'This test is dynamic, meaning each question has a specific time limit set by your tutor. Stay focused and manage your time carefully throughout the test.',
    },
    {
      id: '0',
      title: '✅ Ready to Begin?',
      body: 'By clicking Start, you confirm that you understand the time limits for each question and agree to complete the test within the assigned schedule.',
      cta: { label: 'Start Challenge', onClick: () => handleDynamicModalClose() },
    },
  ];

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const timeWarning = timeLeft <= 10;
  const timePercent = (timeLeft / (dynamicTime > 0 ? dynamicTime : (information?.time || 30))) * 100;

  if (isLoading) return <InsetLoader />;
  if (hasError) return <ErrorPage errorMessage={errorMessage} />;

  // ─── LANDING ──────────────────────────────────────────────────────────────
  if (!startQuiz) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
        style={{ background: tokens.bg, fontFamily: "'DM Sans', sans-serif" }}
      >
        {isDynamicTest && (
          <AnnouncementModal announcements={announcement} isOpen={isDynamicModalOpen} onClose={() => setIsDynamicTest(false)} />
        )}

        {/* Background grid */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${tokens.border} 1px, transparent 1px), linear-gradient(90deg, ${tokens.border} 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            opacity: 0.35,
          }}
        />
        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/3 w-125 h-125 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${tokens.accent}22 0%, transparent 70%)` }}
        />
        <div className="absolute bottom-1/4 right-1/4 w-100 h-100 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${tokens.gold}18 0%, transparent 70%)` }}
        />

        <div className="relative w-full max-w-2xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 border text-xs font-semibold tracking-widest uppercase"
            style={{ borderColor: tokens.border, color: tokens.gold, background: tokens.surface }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Knowledge Challenge
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            className="text-5xl md:text-7xl font-black tracking-tight mb-4 leading-none"
            style={{ color: tokens.textPrimary }}
          >
            Quiz
            <span style={{ color: tokens.gold }}>Master</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-base md:text-lg mb-12"
            style={{ color: tokens.textSecondary }}
          >
            Prove what you know. Sharpen what you don't.
          </motion.p>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="grid grid-cols-3 gap-4 mb-12"
          >
            {[
              { icon: <Layers className="w-5 h-5" />, value: questions.length, label: 'Questions' },
              { icon: <Timer className="w-5 h-5" />, value: dynamicTime > 0 ? `${dynamicTime}s` : `${information?.time}s`, label: 'Per Question' },
              { icon: <Crown className="w-5 h-5" />, value: 'Mastery', label: 'Target' },
            ].map((s, i) => (
              <div
                key={i}
                className="rounded-2xl p-5 flex flex-col items-center gap-2 border"
                style={{ background: tokens.surfaceUp, borderColor: tokens.border }}
              >
                <div className="rounded-xl p-2" style={{ background: tokens.accentMuted, color: tokens.accentMid }}>
                  {s.icon}
                </div>
                <p className="text-2xl font-black" style={{ color: tokens.textPrimary }}>{s.value}</p>
                <p className="text-xs" style={{ color: tokens.textMuted }}>{s.label}</p>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startQuizHandler}
            className="inline-flex items-center gap-3 font-bold text-base px-10 py-4 rounded-2xl transition-all duration-200 shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.accent} 100%)`,
              color: '#FFFFFF',
              boxShadow: `0 8px 32px ${tokens.gold}44`,
            }}
          >
            <Zap className="w-5 h-5 fill-current" />
            Begin Challenge
            <ArrowRight className="w-5 h-5" />
          </motion.button>

          {/* Decorative dots */}
          <div className="mt-14 flex justify-center gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-full" style={{ width: 6, height: 6, background: i === 2 ? tokens.gold : tokens.border }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if (showScore) {
    const percentage = Math.round((score / questions.length) * 100);
    const correctAnswers = score;
    const incorrectAnswers = questions.length - score;
    const isExcellent = percentage >= 80;
    const isGood = percentage >= 60 && percentage < 80;

    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden"
        style={{ background: tokens.bg, fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${tokens.border} 1px, transparent 1px), linear-gradient(90deg, ${tokens.border} 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
            opacity: 0.3,
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
          style={{ background: `radial-gradient(ellipse, ${tokens.gold}18 0%, transparent 70%)` }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-xl mx-auto"
        >
          {/* Trophy */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: `${tokens.gold}44`, transform: 'scale(1.4)' }}
              />
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center border-2"
                style={{ background: tokens.goldMuted, borderColor: `${tokens.gold}66` }}
              >
                <Trophy className="w-9 h-9" style={{ color: tokens.gold }} />
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="rounded-3xl overflow-hidden border" style={{ background: tokens.surface, borderColor: tokens.border }}>
            {/* Score ring */}
            <div className="p-8 text-center border-b" style={{ borderColor: tokens.border }}>
              <div className="relative inline-flex items-center justify-center mb-6">
                <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke={tokens.surfaceUp} strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    stroke={isExcellent ? tokens.gold : isGood ? tokens.accentMid : tokens.error}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - percentage / 100)}`}
                    style={{ transition: 'stroke-dashoffset 1.2s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black" style={{ color: tokens.textPrimary }}>{percentage}%</span>
                  <span className="text-xs" style={{ color: tokens.textMuted }}>Score</span>
                </div>
              </div>

              <h2 className="text-2xl font-black mb-1" style={{ color: tokens.textPrimary }}>
                {isExcellent ? 'Outstanding! 🎯' : isGood ? 'Solid Work! 💪' : 'Keep Grinding! 📚'}
              </h2>
              <p className="text-sm" style={{ color: tokens.textSecondary }}>
                {score} of {questions.length} questions answered correctly
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-px" style={{ background: tokens.border }}>
              {[
                { icon: <CheckCircle className="w-5 h-5" />, val: correctAnswers, label: 'Correct', color: tokens.success, bg: '#0D2117' },
                { icon: <XCircle className="w-5 h-5" />, val: incorrectAnswers, label: 'Incorrect', color: tokens.error, bg: '#1F0D0D' },
              ].map((s, i) => (
                <div key={i} className="flex flex-col items-center gap-1 py-6" style={{ background: tokens.surface }}>
                  <div style={{ color: s.color }}>{s.icon}</div> 
                  <p className="text-3xl font-black" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-xs" style={{ color: tokens.textSecondary }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="px-8 py-6 border-t" style={{ borderColor: tokens.border }}>
              <div className="flex justify-between text-xs mb-2" style={{ color: tokens.textSecondary }}>
                <span>Overall Performance</span><span style={{ color: tokens.gold }}>{percentage}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: tokens.surfaceUp }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${tokens.accent}, ${tokens.gold})` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4 p-6 border-t" style={{ borderColor: tokens.border }}>
              <button
                onClick={restartQuiz}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border font-bold text-sm transition-all duration-200 hover:opacity-80"
                style={{ borderColor: tokens.borderUp, color: tokens.textSecondary, background: tokens.surfaceUp }}
              >
                <RotateCcw className="w-4 h-4" /> Try Again
              </button>
              <button
                onClick={() => { setState(true); router.push('/pages/login'); }}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.accent} 100%)`,
                  color: '#FFFFFF',
                  boxShadow: `0 4px 20px ${tokens.gold}44`,
                }}
              >
                <Home className="w-4 h-4" /> Portal
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── QUIZ ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: tokens.bg, fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Grid bg */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${tokens.border} 1px, transparent 1px), linear-gradient(90deg, ${tokens.border} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          opacity: 0.3,
        }}
      />

      <div className="relative max-w-3xl mx-auto px-4 py-6 md:py-10">
        {/* ── Top bar ── */}
        <div className="flex justify-between items-center mb-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: tokens.accentMuted }}>
              <Brain className="w-5 h-5" style={{ color: tokens.accentMid }} />
            </div>
            <div>
              <p className="text-sm font-black" style={{ color: tokens.textPrimary }}>Lan&apos; Hub</p>
              <p className="text-xs" style={{ color: tokens.textMuted }}>Challenge Mode</p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex gap-2">
            <AnimatePresence>
              {streak > 0 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold"
                  style={{ background: '#FFF7ED', borderColor: '#FED7AA', color: '#EA580C' }}
                >
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  {streak} streak
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold"
              style={{ background: tokens.accentMuted, borderColor: tokens.border, color: tokens.accentMid }}>
              <Star className="w-3.5 h-3.5 fill-current" />
              {score} pts
            </div>
          </div>
        </div>

        {/* ── Progress meta ── */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: tokens.textSecondary }}>
            Question <span style={{ color: tokens.textPrimary }}>{currentQuestion + 1}</span>
            <span style={{ color: tokens.textMuted }}> / {questions.length}</span>
          </span>

          {/* Timer pill */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all"
            style={{
              background: timeWarning ? '#FEF2F2' : tokens.surfaceUp,
              borderColor: timeWarning ? tokens.error : tokens.border,
              color: timeWarning ? tokens.error : tokens.textSecondary,
            }}
          >
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}s
          </div>
        </div>

        {/* ── Main progress bar ── */}
        <div className="mb-8 rounded-full overflow-hidden h-1.5" style={{ background: tokens.surfaceUp }}>
          {/* question progress */}
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${tokens.accent}, ${tokens.gold})`,
            }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* ── Question card ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-3xl border overflow-hidden mb-5"
            style={{ background: tokens.surface, borderColor: tokens.border }}
          >
            {/* Timer bar on top of card */}
            <div className="h-0.5 w-full" style={{ background: tokens.surfaceUp }}>
              <motion.div
                className="h-full"
                style={{
                  width: `${timePercent}%`,
                  background: timeWarning
                    ? `linear-gradient(90deg, ${tokens.error}, #FF7777)`
                    : `linear-gradient(90deg, ${tokens.accent}, ${tokens.gold})`,
                  transition: 'width 1s linear',
                }}
              />
            </div>

            <div className="p-6 md:p-10">
              {/* Question label */}
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                  style={{ background: tokens.accentMuted, color: tokens.accentMid }}>
                  {currentQuestion + 1}
                </div>
                <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: tokens.textMuted }}>
                  Question
                </span>
              </div>

              {/* Question text */}
              <h3
                className="text-xl md:text-2xl font-bold leading-snug mb-8"
                style={{ color: tokens.textPrimary }}
              >
                {questions[currentQuestion]?.question}
              </h3>

              {/* Options */}
              <div className="space-y-3">
                {questions[currentQuestion]?.options.map((option, index) => {
                  const isSelected = selectedAnswer === index;
                  const isCorrect = index === questions[currentQuestion]?.correct;
                  const showCorrect = answered && isCorrect;
                  const showWrong = answered && isSelected && !isCorrect;
                  const isNeutral = answered && !isCorrect && !isSelected;

                  let borderColor = tokens.border;
                  let bgColor = tokens.surfaceUp;
                  let textColor = tokens.textSecondary;
                  let labelBg = tokens.surface;
                  let labelText = tokens.textMuted;
                  let icon = null;

                  if (showCorrect) {
                    borderColor = `${tokens.success}88`;
                    bgColor = '#F0FDF4';
                    textColor = '#166534';
                    labelBg = `${tokens.success}22`;
                    labelText = tokens.success;
                    icon = <CheckCircle className="w-5 h-5 shrink-0" style={{ color: tokens.success }} />;
                  } else if (showWrong) {
                    borderColor = `${tokens.error}88`;
                    bgColor = '#FEF2F2';
                    textColor = '#991B1B';
                    labelBg = `${tokens.error}22`;
                    labelText = tokens.error;
                    icon = <XCircle className="w-5 h-5 shrink-0" style={{ color: tokens.error }} />;
                  } else if (isNeutral) {
                    borderColor = tokens.border;
                    bgColor = tokens.surface;
                    textColor = tokens.textMuted;
                    labelBg = tokens.surfaceUp;
                    labelText = tokens.textMuted;
                  }

                  return (
                    <motion.div
                      key={index}
                      whileHover={!answered ? { x: 4 } : {}}
                      whileTap={!answered ? { scale: 0.99 } : {}}
                      onClick={() => handleAnswerClick(index)}
                      className="flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-colors duration-200"
                      style={{
                        borderColor,
                        background: bgColor,
                        cursor: answered ? 'default' : 'pointer',
                      }}
                    >
                      {/* Letter badge */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 transition-colors duration-200"
                        style={{ background: labelBg, color: labelText }}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1 text-sm md:text-base font-medium transition-colors duration-200"
                        style={{ color: textColor }}>
                        {option}
                      </span>
                      {icon}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Next button ── */}
        <AnimatePresence>
          {answered && (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all"
              style={{
                background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.accent} 100%)`,
                color: '#FFFFFF',
                boxShadow: `0 6px 28px ${tokens.gold}44`,
              }}
            >
              {currentQuestion === questions.length - 1 ? (
                <><Trophy className="w-5 h-5" /> See Results</>
              ) : (
                <>Next Question <ArrowRight className="w-5 h-5" /></>
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Dot indicators ── */}
        <div className="mt-8 flex justify-center gap-1.5 flex-wrap">
          {questions.map((_, idx) => {
            const done = idx < currentQuestion;
            const active = idx === currentQuestion;
            return (
              <div
                key={idx}
                className="rounded-full transition-all duration-300"
                style={{
                  width: active ? 24 : 6,
                  height: 6,
                  background: active ? tokens.gold : done ? tokens.accent : tokens.border,
                }}
              />
            );
          })}
        </div>

        {/* ── Additional Context / Tips ── */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 p-6 rounded-3xl border border-dashed flex flex-col md:flex-row items-center gap-4"
          style={{ borderColor: tokens.border, background: 'transparent' }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: tokens.goldMuted }}>
            <Lightbulb className="w-6 h-6" style={{ color: tokens.gold }} />
          </div>
          <div className="text-center md:text-left">
            <h4 className="text-sm font-bold" style={{ color: tokens.textPrimary }}>Pro Tip</h4>
            <p className="text-xs leading-relaxed" style={{ color: tokens.textSecondary }}>
              Read all options carefully before selecting. Once an answer is chosen in this mode, it cannot be changed. 
              Stay calm and trust your preparation!
            </p>
          </div>
          <div className="hidden md:block ml-auto">
            <Shield className="w-8 h-8 opacity-20" style={{ color: tokens.textMuted }} />
          </div>
        </motion.div>

        {/* ── Floating Desktop Sidebar ── */}
        <div className="hidden xl:block fixed right-8 top-1/2 -translate-y-1/2 w-64 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 rounded-3xl border bg-white shadow-sm"
            style={{ borderColor: tokens.border }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Activity className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm" style={{ color: tokens.textPrimary }}>Live Stats</h4>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Accuracy</p>
                <p className="text-xl font-black" style={{ color: tokens.textPrimary }}>
                  {currentQuestion > 0 ? Math.round((score / currentQuestion) * 100) : 0}%
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Current Streak</p>
                <p className="text-xl font-black text-orange-500">{streak} 🔥</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      <Validator/>
    </div>
  );
};

export default QuizApp;