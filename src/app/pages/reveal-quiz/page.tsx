'use client';

import React, { useState, useEffect } from 'react';
import { QuestionFactory, QuestionItem } from '@/app/helpers/factories';
import { BookOpen, Calendar, Clock, Zap, Hash, ChevronRight, ArrowLeft, Sparkles, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import Validator from '@/app/components/validator';


const service:CoreService = new CoreService();
export default function QuizPage() {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuestionItem[]>([]);
  const [quizData, setQuizData] = useState<QuestionFactory | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);
  const {addToast} = useToast();

  useEffect(() => {
    setIsMounted(true);
    const id = localStorage.getItem('revealQuizId');
    if (id) setQuizId(id);
  }, []);

  const fetchQuestions = async (): Promise<void> => {
    if (!quizId) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await service.get(`/question/api/get-questions?id=${+quizId}`);
      if (res.success) {
        const result = QuestionFactory.fromApi(res.data);
        setQuizData(Array.isArray(result) ? result[0] : result);
        const flatQuestions = Array.isArray(result)
          ? result.flatMap(q => q.question)
          : result.question;
        setQuiz(flatQuestions);
      } else {
        addToast(res.message, 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (quizId !== null) fetchQuestions();
  }, [quizId]);

  if (!isMounted) return null;

  if (!quizId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-pulse text-slate-400 font-bold">No Quiz Id</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-4">
        <Loader className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse">Revealing Quiz Content...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-50/50 blur-[120px]" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-50/50 blur-[120px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-12">
        {/* Navigation */}
        <button 
          onClick={() => router.back()}
          className="group mb-8 flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-bold text-sm"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </button>

        {/* Header */}
        <header className="bg-white rounded-4xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                <Sparkles className="w-3 h-3" />
                Quiz Preview
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {quizData?.name}
              </h1>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-xs font-bold">
                  <Hash className="w-3.5 h-3.5 text-indigo-500" />
                  {quizData?.code}
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  {quizData?.createdAt ? new Date(quizData.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </div>
                {quizData?.isDynamic && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 text-xs font-bold">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    {quizData.dynamicTime}s / Question
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200 w-full md:w-auto">
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Content</p>
                <p className="text-2xl font-black">{quiz.length} <span className="text-sm font-bold text-slate-500">Items</span></p>
              </div>
            </div>
          </div>
        </header>

        {/* Questions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Question Overview</h2>
            <div className="h-px flex-1 bg-slate-100 mx-4" />
          </div>

          {quiz.map((q, idx) => (
            <div 
              key={idx} 
              className="group bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300"
            >
              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-sm font-black text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                </div>
                <div className="flex-1 md:pt-2">
                  <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-relaxed mb-6">
                    {q.question}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, oIdx) => (
                      <div 
                        key={oIdx}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50/50 border border-slate-100 text-slate-500 text-sm font-medium"
                      >
                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Validator/>
    </div>
  );
}