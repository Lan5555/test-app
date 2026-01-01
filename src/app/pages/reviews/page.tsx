'use client'
import { useEffect, useState } from 'react';
import { ChevronLeft, Calendar, Trophy, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { LogFactory, Review } from '@/app/helpers/factories';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';

const ReviewPage: React.FC = () => {
  const [selectedQuiz, setSelectedQuiz] = useState<LogFactory | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [Quizzes, setQuizzes] = useState<LogFactory[]>([]);
  const { addToast, information } = useToast();
  const service: CoreService = new CoreService();

  const fetchQuizzes = async () => {
    try {
      const res = await service.get(`/review/api/fetch-reviews?userId=${information?.userId}`);
      if (res.success) {
        addToast(res.message, 'success');
        const rev = Array.isArray(res.data) ? res.data : [res.data];
        const resultVal = rev.map((u) => LogFactory.fromJson(u)).filter(Boolean)
        setQuizzes(resultVal);
      }else{
        addToast(res.message,'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-emerald-600';
    if (percentage >= 60) return 'text-amber-600';
    return 'text-rose-600';
  };

  const isCorrect = (picked: string, correct: string) => picked === correct;

  if (selectedQuiz) {
    const correctCount = selectedQuiz.review.filter(q => isCorrect(q.picked, q.correct)).length;
    const percentage = Math.round(selectedQuiz.score);

    return (
      <div className="w-full min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-8 overflow-hidden">
        <style>{`
          @keyframes slideInDown {
            from { opacity: 0; transform: translateY(-30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes progressFill {
            from { width: 0; }
            to { width: 100%; }
          }
          @keyframes pulseSoft {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
          .animate-slide-down { animation: slideInDown 0.6s ease-out; }
          .animate-slide-up { animation: slideInUp 0.6s ease-out; }
          .animate-fade-in { animation: fadeIn 0.8s ease-out; }
          .animate-scale-in { animation: scaleIn 0.5s ease-out; }
          .animate-progress { animation: progressFill 1.5s ease-out forwards; }
          .animate-pulse-soft { animation: pulseSoft 3s ease-in-out infinite; }
          .question-item { animation: slideInUp 0.6s ease-out; }
          .question-item:nth-child(1) { animation-delay: 0.1s; }
          .question-item:nth-child(2) { animation-delay: 0.2s; }
          .question-item:nth-child(3) { animation-delay: 0.3s; }
          .question-item:nth-child(4) { animation-delay: 0.4s; }
          .question-item:nth-child(5) { animation-delay: 0.5s; }
          .stat-card { animation: scaleIn 0.5s ease-out; }
          .stat-card:nth-child(1) { animation-delay: 0.1s; }
          .stat-card:nth-child(2) { animation-delay: 0.2s; }
          .stat-card:nth-child(3) { animation-delay: 0.3s; }
          .stat-card:nth-child(4) { animation-delay: 0.4s; }
        `}</style>

        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setSelectedQuiz(null)}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-700 mb-6 font-medium transition-all duration-300 hover:gap-3 animate-slide-down group"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            Back to Quizzes
          </button>

          <div className="animate-slide-down bg-white rounded-2xl shadow-lg p-8 mb-8 border border-slate-100 backdrop-blur-sm">
            <h1 className="text-4xl font-bold bg-linear-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent mb-2">
              {selectedQuiz.name}
            </h1>
            <p className="text-slate-500 mb-8">{selectedQuiz.subtitle}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card bg-linear-to-br from-blue-50 to-blue-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-blue-100 hover:border-blue-200">
                <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Score</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {selectedQuiz.score} / {selectedQuiz.totalQuestions}Q
                </p>
              </div>
              <div className="stat-card bg-linear-to-br from-emerald-50 to-emerald-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-emerald-100 hover:border-emerald-200">
                <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Percentage</p>
                <p className={`text-3xl font-bold mt-2 ${getScoreColor(selectedQuiz.score, selectedQuiz.totalQuestions)}`}>
                  {percentage}%
                </p>
              </div>
              <div className="stat-card bg-linear-to-br from-purple-50 to-purple-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-purple-100 hover:border-purple-200">
                <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide flex items-center gap-1">
                  <Calendar size={14} /> Date
                </p>
                <p className="text-lg font-semibold text-slate-700 mt-2">
                  {formatDate(selectedQuiz.completedDate)}
                </p>
              </div>
              <div className="stat-card bg-linear-to-br from-rose-50 to-rose-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-rose-100 hover:border-rose-200">
                <p className="text-slate-600 text-xs font-semibold uppercase tracking-wide">Time</p>
                <p className="text-lg font-semibold text-slate-700 mt-2">
                  {selectedQuiz.timeSpent} min
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8 animate-fade-in">
            <div className="flex justify-between mb-3">
              <span className="text-sm font-semibold text-slate-700">Progress</span>
              <span className="text-sm font-semibold text-slate-600">{correctCount}/{selectedQuiz.totalQuestions} Correct</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-sm">
              <div
                className="animate-progress bg-linear-to-r from-emerald-400 via-emerald-500 to-teal-500 h-3 rounded-full shadow-lg"
              />
            </div>
          </div>

          <div className="space-y-4 pb-8">
            {selectedQuiz.review.map((q, idx) => {
              const correct = isCorrect(q.picked, q.correct);
              return (
                <div
                  key={`${selectedQuiz.id}-q-${idx}`}
                  className={`question-item rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 bg-white border ${
                    correct
                      ? 'border-emerald-100 hover:border-emerald-200'
                      : 'border-rose-100 hover:border-rose-200'
                  }`}
                >
                  <button
                    onClick={() => setExpandedQuestion(expandedQuestion === idx ? null : idx)}
                    className={`w-full p-6 text-left transition-all duration-300 ${
                      expandedQuestion === idx
                        ? correct ? 'bg-emerald-50' : 'bg-rose-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {correct ? (
                            <div className="animate-pulse-soft">
                              <CheckCircle className="text-emerald-500" size={24} />
                            </div>
                          ) : (
                            <XCircle className="text-rose-500" size={24} />
                          )}
                          <h3 className="font-semibold text-slate-800 text-lg">
                            Question {idx + 1}
                          </h3>
                          <span
                            className={`text-xs font-bold px-3 py-1 rounded-full transition-all duration-300 ${
                              correct
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {correct ? '✓ CORRECT' : '✗ INCORRECT'}
                          </span>
                        </div>
                        <p className="text-slate-700 font-medium text-base leading-relaxed">{q.question}</p>
                      </div>
                      <div className={`text-2xl text-slate-400 transition-all duration-500 ${expandedQuestion === idx ? 'rotate-180' : ''}`}>
                        ▼
                      </div>
                    </div>
                  </button>

                  {expandedQuestion === idx && (
                    <div className={`px-6 pb-6 pt-4 border-t transition-all duration-300 ${
                      correct 
                        ? 'border-emerald-100 bg-emerald-50' 
                        : 'border-rose-100 bg-rose-50'
                    }`}>
                      <div className="space-y-4">
                        <div className="animate-slide-up">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-2">Your Answer</p>
                          <div className={`p-4 rounded-xl transition-all duration-300 ${
                            correct 
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' 
                              : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}>
                            <p className="font-medium leading-relaxed">{q.picked}</p>
                          </div>
                        </div>
                        {!correct && (
                          <div className="animate-slide-up">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 mb-2">Correct Answer</p>
                            <div className="p-4 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-200">
                              <p className="font-medium leading-relaxed">{q.correct}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-purple-50 p-4 md:p-8 overflow-hidden">
      <style>{`
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-slide-down { animation: slideInDown 0.6s ease-out; }
        .animate-scale-in { animation: scaleIn 0.5s ease-out; }
        .stat-card { animation: scaleIn 0.5s ease-out; }
        .stat-card:nth-child(1) { animation-delay: 0.1s; }
        .stat-card:nth-child(2) { animation-delay: 0.2s; }
        .stat-card:nth-child(3) { animation-delay: 0.3s; }
        .quiz-item { animation: scaleIn 0.5s ease-out; }
        .quiz-item:nth-child(1) { animation-delay: 0.1s; }
        .quiz-item:nth-child(2) { animation-delay: 0.2s; }
        .quiz-item:nth-child(3) { animation-delay: 0.3s; }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <div className="mb-12 animate-slide-down">
          <h1 className="text-5xl md:text-6xl font-bold bg-linear-to-r from-slate-800 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            Quiz Review
          </h1>
          <p className="text-slate-600 text-lg font-medium">
            Review your completed quizzes and track your progress
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="stat-card group bg-white rounded-2xl shadow-lg hover:shadow-xl p-6 border border-slate-100 hover:border-blue-200 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Total Quizzes</p>
                <p className="text-5xl font-bold text-blue-600 mt-3">{Quizzes.length}</p>
              </div>
              <Trophy className="text-blue-400 group-hover:text-blue-500 transition-colors" size={48} />
            </div>
          </div>
          <div className="stat-card group bg-white rounded-2xl shadow-lg hover:shadow-xl p-6 border border-slate-100 hover:border-emerald-200 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Avg Score</p>
                <p className="text-5xl font-bold text-emerald-600 mt-3">
                  {Quizzes.length > 0 && Quizzes.reduce((sum, q) => sum + q.totalQuestions, 0) > 0
                    ? Math.round(
                        (Quizzes.find((u) => u.score)!.score /
                          Quizzes.find((sum) => sum.totalQuestions)!.totalQuestions)
                      )
                    : 0}%
                </p>
              </div>
              <TrendingUp className="text-emerald-400 group-hover:text-emerald-500 transition-colors" size={48} />
            </div>
          </div>
          <div className="stat-card group bg-white rounded-2xl shadow-lg hover:shadow-xl p-6 border border-slate-100 hover:border-purple-200 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-600 text-xs font-bold uppercase tracking-wider">Time Spent</p>
                <p className="text-5xl font-bold text-purple-600 mt-3">
                  {Quizzes.reduce((sum, q) => sum + q.timeSpent, 0)}
                </p>
                <p className="text-slate-500 text-xs mt-1">minutes</p>
              </div>
              <Calendar className="text-purple-400 group-hover:text-purple-500 transition-colors" size={48} />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {Quizzes.map((quiz, idx) => {
            const percentage = Math.round((quiz.score));
            const correctCount = quiz.review.filter(q => isCorrect(q.picked, q.correct)).length;
            return (
              <button
                key={`${quiz.id}-${idx}`}
                onClick={() => setSelectedQuiz(quiz)}
                className={`quiz-item w-full rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 text-left overflow-hidden border ${
                  percentage >= 80
                    ? 'bg-linear-to-br from-emerald-50 to-teal-50 border-emerald-100 hover:border-emerald-200'
                    : percentage >= 60
                    ? 'bg-linear-to-br from-amber-50 to-orange-50 border-amber-100 hover:border-amber-200'
                    : 'bg-linear-to-br from-rose-50 to-pink-50 border-rose-100 hover:border-rose-200'
                }`}
              >
                <div className="p-6 md:p-8">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex-1 pr-4">
                      <h2 className="text-2xl font-bold text-slate-800 mb-1">
                        {quiz.name}
                      </h2>
                      <p className="text-slate-600 font-medium">{quiz.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-bold ${getScoreColor(quiz.score, quiz.totalQuestions)}`}>
                        {quiz.score} passed out of {quiz.totalQuestions} questions
                      </p>
                      <p className={`text-xl font-bold mt-1 ${getScoreColor(quiz.score, quiz.totalQuestions)}`}>
                        {percentage}%
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600 mb-5 pb-5 border-b border-slate-200">
                    <div className="flex items-center gap-2 font-medium">
                      <Calendar size={16} className="text-slate-400" />
                      {formatDate(quiz.completedDate)}
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      ⏱️ <span>{quiz.timeSpent} min</span>
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      ✓ <span>{correctCount}/{quiz.totalQuestions} Correct</span>
                    </div>
                  </div>

                  <div className="w-full">
                    <div className="bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-linear-to-r from-emerald-400 via-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-700 shadow-lg"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ReviewPage;