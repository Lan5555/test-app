'use client'
import { useEffect, useState } from 'react';
import { ChevronLeft, Calendar, Trophy, TrendingUp, CheckCircle, XCircle, Clock, BookOpen, ChevronRight, Search, ArrowLeft } from 'lucide-react';
import { LogFactory, Review } from '@/app/helpers/factories';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { useRouter } from 'next/navigation';
import Validator from '@/app/components/validator';

const ReviewPage: React.FC = () => {
  const [selectedQuiz, setSelectedQuiz] = useState<LogFactory | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const [Quizzes, setQuizzes] = useState<LogFactory[]>([]);
  const { addToast, studentsInfo } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const service: CoreService = new CoreService();
  const router = useRouter();

  const fetchQuizzes = async () => {
    try {
      const res = await service.get(`/review/api/fetch-reviews?userId=${studentsInfo?.id}`);
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
    if (percentage >= 80) return 'text-emerald-500';
    if (percentage >= 60) return 'text-indigo-500';
    return 'text-rose-500';
  };

  const filteredQuizzes = Quizzes.filter(q => 
    q.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCorrect = (picked: string, correct: string) => picked === correct;

  if (selectedQuiz) {
    const correctCount = selectedQuiz.review.filter(q => isCorrect(q.picked, q.correct)).length;
    const percentage = Math.round(selectedQuiz.score);

    return (
      <div className="w-full min-h-screen bg-[#F8FAFC] p-4 md:p-8 overflow-hidden font-sans">
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
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Quizzes
          </button>

          <div className="animate-slide-down bg-white rounded-4xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 mb-8 border border-slate-100">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
              {selectedQuiz.name}
            </h1>
            <p className="text-slate-500 font-medium mb-8">{selectedQuiz.subtitle}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</p>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {correctCount}/{selectedQuiz.totalQuestions}
                </p>
              </div>
              <div className="stat-card bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grade</p>
                <p className={`text-2xl font-black mt-1 ${getScoreColor(selectedQuiz.score, selectedQuiz.totalQuestions)}`}>
                  {percentage}%
                </p>
              </div>
              <div className="stat-card bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</p>
                <p className="text-sm font-bold text-slate-700 mt-2">
                  {formatDate(selectedQuiz.completedDate)}
                </p>
              </div>
              <div className="stat-card bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Duration</p>
                <p className="text-sm font-bold text-slate-700 mt-2">
                  {selectedQuiz.timeSpent} min
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8 animate-fade-in">
            <div className="flex justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Performance Bar</span>
              <span className="text-xs font-bold text-indigo-600">{percentage}% Accuracy</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="animate-progress bg-indigo-500 h-full rounded-full"
              />
            </div>
          </div>

          <div className="space-y-4 pb-8">
            {selectedQuiz.review.map((q, idx) => {
              const correct = isCorrect(q.picked, q.correct);
              return (
                <div
                  key={`${selectedQuiz.id}-q-${idx}`}
                  className={`question-item rounded-3xl overflow-hidden transition-all duration-300 bg-white border ${
                    correct
                      ? 'border-slate-100 hover:border-emerald-100'
                      : 'border-slate-100 hover:border-rose-100'
                  } shadow-[0_4px_20px_rgb(0,0,0,0.02)]`}
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
                            className={`text-[10px] font-black px-3 py-1 rounded-lg transition-all duration-300 tracking-widest ${
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
                      <div className={`text-xs text-slate-300 transition-all duration-500 ${expandedQuestion === idx ? 'rotate-180' : ''}`}>
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
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Your Answer</p>
                          <div className={`p-4 rounded-2xl transition-all duration-300 ${
                            correct 
                              ? 'bg-white text-emerald-700 border border-emerald-100' 
                              : 'bg-white text-rose-700 border border-rose-100'
                          }`}>
                            <p className="font-medium leading-relaxed">{q.picked}</p>
                          </div>
                        </div>
                        {!correct && (
                          <div className="animate-slide-up">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Correct Answer</p>
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
    <div className="w-full min-h-screen bg-[#F8FAFC] p-4 md:p-8 overflow-hidden font-sans">
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
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-4 font-bold text-sm transition-colors group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Quiz Review</h1>
          <p className="text-slate-500 font-medium">Track your progress and review past performances.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="stat-card bg-white rounded-4xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                <Trophy className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Quizzes</p>
                <p className="text-2xl font-black text-slate-900">{Quizzes.length}</p>
              </div>
            </div>
          </div>
          <div className="stat-card bg-white rounded-4xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Avg Score</p>
                <p className="text-2xl font-black text-slate-900">
                  {Quizzes.length > 0 ? Math.round(Quizzes.reduce((acc, q) => acc + q.score, 0) / Quizzes.length) : 0}%
                </p>
              </div>
            </div>
          </div>
          <div className="stat-card bg-white rounded-4xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Time Spent</p>
                <p className="text-2xl font-black text-slate-900">{Quizzes.reduce((sum, q) => sum + q.timeSpent, 0)}m</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search quizzes..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-[20px] shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-slate-600"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          {filteredQuizzes.map((quiz, idx) => {
            const percentage = Math.round(quiz.score);
            return (
              <button
                key={`${quiz.id}-${idx}`}
                onClick={() => setSelectedQuiz(quiz)}
                className="quiz-item w-full bg-white rounded-[28px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300 text-left group overflow-hidden"
              >
                <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-indigo-50 transition-colors">
                    <BookOpen className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                      {quiz.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> {formatDate(quiz.completedDate)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {quiz.timeSpent}m</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className={`text-2xl font-black ${getScoreColor(quiz.score, 100)}`}>
                        {percentage}%
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Final Score</p>
                    </div>
                    <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all">
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white" />
                    </div>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-50">
                  <div 
                    className={`h-full transition-all duration-1000 ${percentage >= 60 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </button>
            );
          })}
          {filteredQuizzes.length === 0 && (
            <div className="text-center py-20 bg-white rounded-4xl border border-dashed border-slate-200">
              <p className="text-slate-400 font-medium">No quizzes found matching your search.</p>
            </div>
          )}
        </div>
      </div>
      <Validator/>
    </div>
  );
};

export default ReviewPage;