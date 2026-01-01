'use client'
import React, { useState, useEffect } from 'react';
import { ChevronRight, Clock, Zap, Trophy, RotateCcw, Sparkles, Star, Target, Flame, PersonStanding, User } from 'lucide-react';
import { useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { LogFactory, QuestionFactory, QuestionItem, Review } from '@/app/helpers/factories';
import { useRouter } from 'next/navigation';
import ErrorPage from '@/app/components/error-page';


const QuizApp: React.FC = ({}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [startQuiz, setStartQuiz] = useState(false);
  const [streak, setStreak] = useState(0);
  const {addToast, information, questionId, setState} = useToast();
  const service:CoreService = new CoreService();
  const router = useRouter();
  const [questions, setQuestions] =  useState<QuestionItem[]>([]);
  const [finalResult, setFinalResult] = useState<Number>(0);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [backUpQuestion, setBackUpQuestion] = useState<QuestionFactory[]>([]);
  const [loggedResponses, setLoggedResponses] = useState<Review[]>([]);

  const fetchQuestions = async (): Promise<void> => {
  try {
    const res = await service.get(`/question/api/get-questions?id=${questionId}`);

    if (res.success) {
      const result = QuestionFactory.fromApi(res.data);
      setBackUpQuestion(Array.isArray(result) ? result : [result]);
      setHasError(false);
      const flatQuestions: QuestionItem[] = Array.isArray(result)
      ? result.flatMap(q => q.question)
      : result.question;

      setQuestions(flatQuestions);
    }else{
      setErrorMessage(res.message);
      setHasError(true);
    }
  } catch (e: any) {
    addToast(e.message, 'error');
  }
};


const logResponse = async(): Promise<void> => {
  const payload:LogFactory = {
    userId: information!.userId,
    review: loggedResponses,
    taken: true,
    quizName: backUpQuestion.find((u) => u.name)?.name || 'Unknown Quiz',
    totalQuestions: questions.length,
    timeSpent: 15,
    subtitle: 'Quiz reponse data',
    name: backUpQuestion.find((u) => u.name)?.name || 'No question',
    completedDate: new Date().toISOString(),
    score: Math.round(score / questions.length * 100),
  }
  try{
    const res = await service.send('/review/api/log-responses', payload)
    if(res.success){
      addToast(res.message,'success');
    }else{
      setTimeout(() => addToast(res.message,'error'),2000)
    }
  }catch(e:any){
    addToast(e.message,'error');
  }
}


  useEffect(() => {
  fetchQuestions();
  const userSession = localStorage.getItem('userSession');
  if (!userSession) {
    router.push('/pages/login');
    return;
  }

  setTimeLeft(information!.time);


  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
    // Clear session safely
    localStorage.removeItem('userSession');
  };

  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, []);


  

  useEffect(() => {
    if (!startQuiz || showScore || answered) return;
    
    if (timeLeft === 0) {
      handleNext();
      return;
    }

    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, startQuiz, showScore, answered]);

  const handleAnswerClick = (index:any) => {
    if (answered) return;
    
    setSelectedAnswer(index);
    setAnswered(true);

    const data:Review = {
      question: questions[currentQuestion].question,
      picked: questions[currentQuestion].options[index],
      correct: questions[currentQuestion].options[questions[currentQuestion].correct]
    }
    setLoggedResponses(prev => [...prev, data]);
    
    if (index === questions[currentQuestion].correct) {
      setScore(score + 1);
      setStreak(streak + 1);
    } else {
      setStreak(0);
    }
  };

  const saveScore = async(percentage:number) => {
    try{
        const res = await service.send('/users/api/save-score', {
          id:information?.userId,
          score: percentage
        });
        
        if(res.success){
          await logResponse().then(() => {
          addToast(res.message, 'success');
          });
        }else{
          addToast(res.message, 'error');
        }
      }catch(e:any){
        addToast(e.message,'warning');
      }
  }

  const handleNext = async() => {
    const nextQuestion = currentQuestion + 1;
    if (nextQuestion < questions.length) {
      setCurrentQuestion(nextQuestion);
      setSelectedAnswer(null);
      setAnswered(false);
      setTimeLeft(information!.time);
    } else {
      setShowScore(true);
      const percentage = Math.round((score / questions.length) * 100);
      await saveScore(percentage);

    }
  };

  

  const restartQuiz = async() => {
    router.push('/pages/login');
    setCurrentQuestion(0);
    setScore(0);
    setShowScore(false);
    setSelectedAnswer(null);
    setAnswered(false);
    setTimeLeft(information!.time);
    setStartQuiz(false);
    setStreak(0);
  };

  const startQuizHandler = () => {
    setStartQuiz(true);
    setTimeLeft(information!.time);
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const timeWarning = timeLeft <= 10;

  if(hasError) return <ErrorPage errorMessage={errorMessage}></ErrorPage>

  if (!startQuiz) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4 overflow-hidden relative">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-64 md:w-80 h-64 md:h-80 bg-linear-to-br from-purple-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-64 md:w-80 h-64 md:h-80 bg-linear-to-tr from-blue-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 w-64 md:w-80 h-64 md:h-80 bg-linear-to-br from-pink-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        <div className="text-center max-w-2xl relative z-10">
          {/* Header Badge */}
          
              <div className="flex justify-center items-center gap-2 bg-white/70 backdrop-blur-xl px-4 md:px-5 py-2.5 mb-2 rounded-full border border-purple-200/60 shadow-md hover:shadow-lg hover:bg-white/80 transition-all duration-300">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-purple-600 shrink-0" />
                <span className="font-semibold text-gray-700 text-sm md:text-base">Welcome to QuizMaster</span>
            </div>
          {/* Main Title */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-3 md:mb-4 leading-tight">
            <span className="bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">Quiz</span>
            <span className="text-gray-900"> Master</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 mb-2 md:mb-3 font-medium">Challenge Your Brain</p>
          <p className="text-gray-500 mb-8 md:mb-12 max-w-md mx-auto text-sm md:text-base">{questions.length} questions of pure intellectual battle. Test your knowledge and climb the leaderboard!</p>

          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-2 md:gap-4 mb-8 md:mb-12">
            <div className="bg-white/50 backdrop-blur-xl border border-white/80 rounded-lg md:rounded-2xl p-3 md:p-4 shadow-lg hover:shadow-xl transition">
              <Target className="w-5 h-5 md:w-6 md:h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-xl md:text-2xl font-bold text-gray-900">{questions.length}</p>
              <p className="text-xs text-gray-600">Questions</p>
            </div>
            <div className="bg-white/50 backdrop-blur-xl border border-white/80 rounded-lg md:rounded-2xl p-3 md:p-4 shadow-lg hover:shadow-xl transition">
              <Clock className="w-5 h-5 md:w-6 md:h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-xl md:text-2xl font-bold text-gray-900">{information?.time}s</p>
              <p className="text-xs text-gray-600">Per Question</p>
            </div>
            <div className="bg-white/50 backdrop-blur-xl border border-white/80 rounded-lg md:rounded-2xl p-3 md:p-4 shadow-lg hover:shadow-xl transition">
              <Flame className="w-5 h-5 md:w-6 md:h-6 text-orange-600 mx-auto mb-2" />
              <p className="text-xl md:text-2xl font-bold text-gray-900">100%</p>
              <p className="text-xs text-gray-600">Possible</p>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={startQuizHandler}
            className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg md:rounded-2xl transition transform hover:scale-105 flex items-center justify-center gap-2 group shadow-2xl hover:shadow-3xl mb-4 md:mb-6 text-sm md:text-base"
          >
            <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
            Start Quiz Now
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-1 transition" />
          </button>

          <p className="text-gray-500 text-xs md:text-sm">🚀 Nicholas Johnson all rights reserved</p>
        </div>
      </div>
    );
  }

  if (showScore) {
    const percentage = Math.round((score / questions.length) * 100);
    const rank = percentage === 100 ? 'S' : percentage >= 80 ? 'A' : percentage >= 60 ? 'B' : 'C';
    
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4 overflow-hidden relative">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-64 md:w-80 h-64 md:h-80 bg-linear-to-br from-purple-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-64 md:w-80 h-64 md:h-80 bg-linear-to-tr from-blue-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        </div>

        <div className="text-center max-w-2xl relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-linear-to-r from-yellow-400 to-orange-400 text-white px-3 md:px-4 py-2 rounded-full mb-6 md:mb-8 shadow-lg font-semibold text-xs md:text-sm">
            <Trophy className="w-3 h-3 md:w-4 md:h-4" />
            Quiz Complete!
          </div>

          {/* Rank Display */}
          <div className="mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full bg-linear-to-br from-yellow-400 to-orange-500 shadow-2xl mb-4 md:mb-6 animate-bounce">
              <div className="text-4xl md:text-6xl font-black text-white drop-shadow-lg">{rank}</div>
            </div>
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-2 md:mb-3">
            {percentage === 100 && "Perfect! 🎉"}
            {percentage >= 80 && percentage < 100 && "Excellent! 🌟"}
            {percentage >= 60 && percentage < 80 && "Good Job! 💪"}
            {percentage < 60 && "Keep Trying! 🚀"}
          </h2>
          <p className="text-gray-600 mb-8 md:mb-12 text-sm md:text-lg">Here's your performance breakdown</p>

          {/* Score Cards */}
          <div className="grid md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10">
            {/* Main Score */}
            <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl">
              <p className="text-gray-600 text-xs md:text-sm font-semibold mb-2">SCORE</p>
              <div className="text-3xl md:text-5xl font-black bg-linear-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {score}/{questions.length}
              </div>
            </div>

            {/* Percentage */}
            <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl">
              <p className="text-gray-600 text-xs md:text-sm font-semibold mb-2">PERCENTAGE</p>
              <div className="text-3xl md:text-5xl font-black text-blue-600">{percentage}%</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8 md:mb-10">
            <div className="w-full bg-gray-200 rounded-full h-3 md:h-4 overflow-hidden shadow-inner">
              <div 
                className="bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 h-full rounded-full transition-all duration-1000 shadow-lg"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <p className="text-gray-600 text-xs md:text-sm mt-2 md:mt-3 font-medium">Performance Score</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8 md:mb-10">
            <div className="bg-green-50 border-2 border-green-200 rounded-lg md:rounded-2xl p-4 md:p-6">
              <Star className="w-5 h-5 md:w-6 md:h-6 text-green-600 mx-auto mb-2" />
              <p className="text-xl md:text-2xl font-bold text-green-600">{score}</p>
              <p className="text-xs text-green-700">Correct</p>
            </div>
            <div className="bg-red-50 border-2 border-red-200 rounded-lg md:rounded-2xl p-4 md:p-6">
              <Target className="w-5 h-5 md:w-6 md:h-6 text-red-600 mx-auto mb-2" />
              <p className="text-xl md:text-2xl font-bold text-red-600">{questions.length - score}</p>
              <p className="text-xs text-red-700">Incorrect</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 md:gap-4 flex-col sm:flex-row">
            <button
              onClick={restartQuiz}
              className="flex-1 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 md:py-4 px-4 md:px-6 rounded-lg md:rounded-2xl transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl text-sm md:text-base"
            >
              <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
              Try Again
            </button>
            <button
              onClick={() => {
                setState(true);
                router.push('/pages/login');
              }}
              className="flex-1 bg-white/70 backdrop-blur-xl border-2 border-gray-300 hover:border-purple-400 text-gray-900 font-bold py-3 md:py-4 px-4 md:px-6 rounded-lg md:rounded-2xl transition hover:bg-purple-50 text-sm md:text-base"
            >
              To dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 p-4 md:p-8 overflow-hidden relative">
      {/* Background animations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-64 md:w-80 h-64 md:h-80 bg-linear-to-br from-purple-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-64 md:w-80 h-64 md:h-80 bg-linear-to-tr from-blue-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 w-64 md:w-80 h-64 md:h-80 bg-linear-to-br from-pink-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Top Navigation */}
        <div className="flex justify-between items-center mb-8 md:mb-10 flex-wrap gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-linear-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg text-sm md:text-base">
              Q
            </div>
            <span className="text-lg md:text-xl font-bold text-gray-900 hidden sm:inline">QuizMaster</span>
          </div>
          
          <div className="flex gap-2 md:gap-3">
            {streak > 0 && (
              <div className="bg-white/60 backdrop-blur-xl px-3 md:px-4 py-2 rounded-full border border-orange-200/50 shadow-lg flex items-center gap-2">
                <Flame className="w-4 h-4 md:w-5 md:h-5 text-orange-600 animate-pulse shrink-0" />
                <span className="text-xs md:text-sm font-bold text-gray-900">{streak} streak</span>
              </div>
            )}
            <div className="bg-white/60 backdrop-blur-xl px-3 md:px-4 py-2 rounded-full border border-purple-200/50 shadow-lg flex items-center gap-2">
              <Star className="w-4 h-4 md:w-5 md:h-5 text-purple-600 shrink-0" />
              <span className="text-xs md:text-sm font-bold text-gray-900">{score} pts</span>
            </div>
          </div>
        </div>

        {/* Question Number and Timer */}
        <div className="flex justify-between items-start mb-6 md:mb-8 gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-gray-600 text-xs md:text-sm font-semibold mb-2">QUESTION {currentQuestion + 1} OF {questions.length}</p>
            <div className="w-full md:w-64 bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
              <div 
                className="bg-linear-to-r from-purple-600 to-pink-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          
          <div className={`flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3 rounded-lg md:rounded-xl backdrop-blur-xl border-2 shadow-lg font-bold text-base md:text-lg shrink-0 ${
            timeWarning 
              ? 'bg-red-100/60 border-red-400 text-red-600 animate-pulse' 
              : 'bg-white/60 border-blue-200/50 text-blue-600'
          }`}>
            <Clock className="w-4 h-4 md:w-5 md:h-5" />
            {timeLeft}s
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl md:rounded-3xl p-6 md:p-10 mb-6 md:mb-8 shadow-2xl">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-8 md:mb-12 leading-tight">
            {questions[currentQuestion].question}
          </h2>

          {/* Options Grid */}
          <div className="grid md:grid-cols-2 gap-3 md:gap-4">
            {questions[currentQuestion].options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerClick(index)}
                disabled={answered}
                className={`group relative p-4 md:p-6 rounded-lg md:rounded-2xl font-semibold text-left transition-all duration-300 border-2 overflow-hidden text-sm md:text-base ${
                  selectedAnswer === index
                    ? index === questions[currentQuestion].correct
                      ? 'bg-green-100 border-green-500 text-gray-900 shadow-xl'
                      : 'bg-red-100 border-red-500 text-gray-900 shadow-xl'
                    : answered && index === questions[currentQuestion].correct
                    ? 'bg-green-100 border-green-500 text-gray-900 shadow-xl'
                    : 'bg-white/50 border-gray-200 text-gray-900 hover:border-purple-400 hover:bg-purple-50/50 shadow-lg hover:shadow-xl active:scale-95'
                } disabled:cursor-not-allowed`}
              >
                <div className="flex items-start gap-3 md:gap-4 relative z-10">
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-white shrink-0 transition-all duration-300 text-sm md:text-base ${
                    selectedAnswer === index
                      ? index === questions[currentQuestion].correct
                        ? 'bg-green-500 shadow-lg scale-110'
                        : 'bg-red-500 shadow-lg scale-110'
                      : answered && index === questions[currentQuestion].correct
                      ? 'bg-green-500 shadow-lg scale-110'
                      : 'bg-linear-to-br from-purple-600 to-pink-600 shadow-lg group-hover:scale-110'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="pt-1">{option}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Next Button */}
        {answered && (
          <button
            onClick={handleNext}
            className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 md:py-5 px-6 md:px-8 rounded-lg md:rounded-2xl transition transform hover:scale-105 flex items-center justify-center gap-2 md:gap-3 shadow-2xl hover:shadow-3xl animate-in fade-in duration-300 text-sm md:text-lg"
          >
            {currentQuestion === questions.length - 1 ? (
              <>
                <Trophy className="w-4 h-4 md:w-6 md:h-6" />
                See Results
              </>
            ) : (
              <>
                Next Question
                <ChevronRight className="w-4 h-4 md:w-6 md:h-6 group-hover:translate-x-1 transition" />
              </>
            )}
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}

export default QuizApp;