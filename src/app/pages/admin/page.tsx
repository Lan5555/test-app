'use client';

import React, { useState, useEffect, JSX } from 'react';
import { Plus, Trash2, Copy, LogOut, Settings, Lock, Share2, Check, X, Eye, Edit2, Save, ArrowLeft, Users, BarChart3, Zap, Loader, User2, Code } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AddUserModal from '@/app/components/add-user';
import { useToast } from '@/app/components/toast';
import { generateId, generateSmallNumbers } from '@/app/helpers/id-generator';
import { CoreService } from '@/app/helpers/api-handler';
import UpdateUserCode from '@/app/components/update-code';
import { Users as Person } from '@/app/helpers/factories';
import AddProductModal from '@/app/components/shop-modal';

interface Question {
  id: number;
  name?:string;
  question: string;
  options: string[];
  correct: number;
}

interface Quiz {
  id: string;
  name: string;
  code: string;
  questions: Question[];
  createdAt: string;
  totalQuestions: number;
  enrolledStudents?: number;
}

interface AdminSession {
  type: string;
  token: string;
}

interface Stats {
  totalQuizzes: number;
  totalStudents: number;
  totalQuestions: number;
  averageScore: number;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  quizzes?: Quiz[];
  stats?: Stats;
}

export default function AdminDashboard(): JSX.Element {
  const router = useRouter();
  const [showNewQuizModal, setShowNewQuizModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [addUserModal, setAddUserModal] = useState<boolean>(false);
  const [updateCodeModal, setUpdateCodeModal] = useState<boolean>(false);
  const [user, setUsers] = useState<Person[]>([]);

  const service:CoreService = new CoreService();
  const {addToast} = useToast();

  // Quizzes list
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // New quiz form
  const [quizName, setQuizName] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([
    { id: 1, question: '', name:'', options: ['', '', '', ''], correct: 0 }
  ]);

  // Stats
  const [stats, setStats] = useState<Stats>({
    totalQuizzes: 0,
    totalStudents: 1,
    totalQuestions: 0,
    averageScore: 0
  });

  // Check authentication on mount
  useEffect(() => {
    fetchQuizzes();
    fetchStats();
    fetchAllUsers();
  }, [router]);

  const fetchAllUsers = async () => {
  try {
    const res = await service.get('/users/api/find-all-users');

    if (res.success) {
      if (!res.data) {
        setUsers([]); // no users returned
        return;
      }

      // Convert to array safely
      const resultArray = Array.isArray(res.data) ? res.data : [res.data];

      // Map through and parse each user
      const users = resultArray.map(userJson => Person.fromJson(userJson)).filter(Boolean);

      setUsers(users);
      //calculate avarage score
      const numberOfStudents = users.length;
      const totalScore = users.reduce((u,a) => u + a.score, 0)
      const averageScore = totalScore / numberOfStudents;
      setStats(prev => {
      return {
        ...prev,
        averageScore: averageScore,
      };
    });
    
    } else {
      addToast(res.message, 'error');
    }
  } catch (e: any) {
    addToast(e.message, 'error');
  }
};




  const getAuthHeader = (): string => {
    const adminSession = localStorage.getItem('adminSession');
    if (!adminSession) return '';
    const parsed: AdminSession = JSON.parse(adminSession);
    return `Bearer ${parsed.token}`;
  };

  const fetchQuizzes = async (): Promise<void> => {
    try {
      const response = await service.get('/question/api/fetch-all-questions?take=50&skip=0');
      if (response.success) {
        setQuizzes((response.data as Quiz[]) || []);
      }
    } catch (error) {
      console.error('Failed to fetch quizzes', error);
    }
  };

  const fetchStats = async (): Promise<void> => {
    try {
      const response = await service.get('/question/api/get-stats');
      if (response.success && response.data) {
        setStats(response.data as Stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats', error);
    }
  };

  const showNotification = (msg: string): void => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleCreateQuiz = async (): Promise<void> => {
    if (!quizName.trim()) {
      showNotification('Please enter a quiz name');
      return;
    }

    if (questions.some(q => !q.question.trim() || q.options.some(o => !o.trim()))) {
      showNotification('Please fill in all questions and options');
      return;
    }

    setLoading(true);
    try {
      const payload = {
      name: quizName,
      code: generateSmallNumbers(), // or generateId()
      totalQuestions: questions.length,
      question: questions.map(q => ({
        question: q.question,
        options: q.options,
        correct: q.correct,
      })),
    };
    

      const response = await service.send('/question/api/save-quiz', 
        payload
      );
      if (response.success) {
        setQuizName('');
        setQuestions([{ id: 1, question: '', name:'', options: ['', '', '', ''], correct: 0 }]);
        setQuizzes([{
          id: '1', questions: questions, name: quizName, code: 'encrypted', createdAt: Date.now().toLocaleString(),
          totalQuestions: questions.length
        }])
        setShowNewQuizModal(false);
        showNotification('Quiz created successfully! 🎉');
        fetchQuizzes();
      } else {
        addToast(response.message, 'error');
        showNotification(response.message || 'Failed to create quiz');
      }
    } catch (error) {
      showNotification('Error creating quiz');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this quiz?')){
      return;
    }else{
      const idValue = prompt('Enter quiz id');
    try {
      const response = await service.delete('/question/api/delete-quiz',{idValue})
      if (response.data) {
        showNotification('Quiz deleted');
        fetchQuizzes();
      }
    } catch (error) {
      showNotification('Failed to delete quiz');
      console.error(error);
    }
  }
  };

  const handleCopyCode = (code: string): void => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showNotification('Code copied to clipboard!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLogout = (): void => {
    localStorage.removeItem('adminSession');
    router.push('/');
  };

  const handleAddQuestion = (): void => {
    setQuestions([
      ...questions,
      { id: questions.length + 1, question: '', options: ['', '', '', ''], correct: 0 }
    ]);
  };

  const handleRemoveQuestion = (index: number): void => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: keyof Question, value: string | number): void => {
    const updated:Question[] = [...questions];
    if (field === 'correct') {
      updated[index][field] = value as number;
    } else {
      updated[index][field] = value as never;
    }
    setQuestions(updated);
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string): void => {
    const updated = [...questions];
    updated[questionIndex].options[optionIndex] = value;
    setQuestions(updated);
  };

  //======//
  const handleCreateUser = async(email:string, name:string, code:string) => {
    const id = generateId();
    const score:number = 0;
    const attempts = 0;
    
    const codeInfo = {
      code,
      attempts
    }
    const payload = {
      email,
      name,
      id,
      codeInfo,
      score,
      time: 30
    }
    try{
      const res = await service.send('/users/api/save-user', payload);
      if(res.success){
        addToast(res.message, 'success');
      }else{
        addToast(res.message,'error');
      }
    }catch(e:any){
      addToast(`${e}`,'error');
    }
  }


  const handleUpdateCode = async(e: any, id:number, val:string, attempt:number) => {
    e.preventDefault();
    setLoading(true);
    try{
      const res = await service.send('/users/api/update-code',{
        'id':id,
        'code':val,
        'attempt':attempt
      });
      if(res.success){
        addToast(res.message, 'success');
      }else{
        addToast(res.message, 'error');
      }
    }catch(e:any){
      addToast(e.message,'warning');
    }finally{
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 p-4 overflow-hidden relative">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-linear-to-br from-purple-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-linear-to-tr from-blue-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-4xl md:text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Settings className="w-10 h-10 text-purple-600" />
              Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Manage quizzes and track student performance</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-3 px-4 rounded-xl transition"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className="mb-6 p-4 bg-green-100 border-2 border-green-400 rounded-xl text-green-700 font-semibold flex items-center gap-2 animate-in fade-in">
            <Check className="w-5 h-5" />
            {notification}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-10">
          <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-semibold">Total Quizzes</p>
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-4xl font-black text-gray-900">{stats.totalQuizzes || 0}</p>
          </div>

          <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-semibold">Students</p>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-4xl font-black text-gray-900">{user.length || 0}</p>
          </div>

          <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-semibold">Questions</p>
              <Edit2 className="w-5 h-5 text-pink-600" />
            </div>
            <p className="text-4xl font-black text-gray-900">{stats.totalQuestions || 0}</p>
          </div>

          <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-600 text-sm font-semibold">Avg. Score</p>
              <BarChart3 className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-4xl font-black text-gray-900">{stats.averageScore || 0}%</p>
          </div>
        </div>

        {/* Create New Quiz Button */}
        <div className='flex justify-start items-center gap-10'>
        <button
          onClick={() => setShowNewQuizModal(true)}
          className="mb-8 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 flex items-center gap-2 shadow-lg hover:shadow-xl"
        >
           {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : <>
            <Plus className="w-5 h-5" />
            <span>Create new quiz</span>
            </>}
        </button>

        {/* Admin action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          {/* Add user */}
          <button
            onClick={() => setAddUserModal(true)}
            className="bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
             {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : <>
            <Plus className="w-5 h-5" />
            <span>Add new user</span>
            </>}
          </button>

          {/* Update user code */}
          <button
            onClick={() => setUpdateCodeModal(true)}
            className="bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
             {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : <>
            <Code className="w-5 h-5" />
            <span>Update user code</span>
            </>}
          </button>

          {/* View all users */}
          <button
            onClick={() => router.push('/pages/users')}
            className="bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : <>
            <User2 className="w-5 h-5" />
            <span>View all users</span>
            </>}
          </button>
          {/* Add product */}
          <AddProductModal/>
        </div>
        </div>

        

        <UpdateUserCode isOpen={updateCodeModal} onClose={() => setUpdateCodeModal(false)} onSubmit={async(e,id,val, attempt) => handleUpdateCode(e,id,val, attempt)} isLoading={loading}/>
        <AddUserModal isOpen={addUserModal} isLoading={loading} onClose={() => setAddUserModal(false)} onSubmit={async(UserFormData) => handleCreateUser(UserFormData.email, UserFormData.name, UserFormData.code!) }/>

        {/* Create Quiz Modal */}
        {showNewQuizModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-8 max-w-4xl w-full my-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-900">Create New Quiz</h2>
                <button
                  onClick={() => setShowNewQuizModal(false)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Quiz Name */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quiz Name *</label>
                <input
                  type="text"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder="e.g., Biology 101, Math Basics"
                  className="w-full px-4 py-3 text-black placeholder:text-black rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none text-lg"
                />
              </div>

              {/* Questions */}
              <div className="mb-6 md:mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">Questions</h3>
                  <button
                    onClick={handleAddQuestion}
                    className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-2 px-3 md:px-4 rounded-lg transition text-sm md:text-base w-full sm:w-auto justify-center sm:justify-start"
                  >
                    <Plus className="w-4 h-4" />
                    Add Question
                  </button>
                </div>

                <div className="space-y-4 md:space-y-6 max-h-96 overflow-y-auto pr-2 md:pr-4">
                  {questions.map((q, qIndex) => (
                    <div key={q.id} className="bg-gray-50 border-2 border-gray-200 rounded-xl md:rounded-2xl p-4 md:p-6">
                      <div className="flex justify-between items-start mb-4 gap-2">
                        <label className="text-xs md:text-sm font-semibold text-gray-700">Question {qIndex + 1} *</label>
                        {questions.length > 1 && (
                          <button
                            onClick={() => handleRemoveQuestion(qIndex)}
                            className="text-red-600 hover:text-red-700 shrink-0"
                          >
                            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => handleQuestionChange(qIndex, 'question', e.target.value)}
                        placeholder="Enter question"
                        className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base text-black placeholder:text-gray-500 rounded-lg md:rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none mb-4"
                      />

                      {/* Options */}
                      <div className="space-y-2 md:space-y-3">
                        {q.options.map((option, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2 md:gap-3">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={q.correct === optIndex}
                              onChange={() => handleQuestionChange(qIndex, 'correct', optIndex)}
                              className="w-4 h-4 md:w-5 md:h-5 cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)} *`}
                              className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base text-black placeholder:text-gray-500 rounded-lg border-2 border-gray-200 focus:border-purple-500 focus:outline-none min-w-0"
                            />
                            <span className="text-xs font-bold text-white bg-linear-to-br from-purple-600 to-pink-600 px-2 md:px-3 py-1 md:py-2 rounded-lg shrink-0">
                              {String.fromCharCode(65 + optIndex)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
                <button
                  onClick={handleCreateQuiz}
                  disabled={loading}
                  className="flex-1 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl transition flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <Save className="w-4 h-4 md:w-5 md:h-5" />
                  {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : 'Create Quiz'}
                </button>
                <button
                  onClick={() => setShowNewQuizModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl transition text-sm md:text-base"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quizzes List */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Quizzes</h2>
          {quizzes.length === 0 ? (
            <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-12 text-center shadow-lg">
              <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No quizzes created yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-6 shadow-lg hover:shadow-xl transition">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{quiz.name}</h3>
                  
                  <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">{quiz.totalQuestions}</span> questions
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">{user.length || 0}</span> students
                    </p>
                    <p className="text-xs text-gray-500">Created: {new Date(quiz.createdAt).toLocaleDateString()}</p>
                  </div>

                  {/* Code Display */}
                  <div className="bg-linear-to-r from-purple-100 to-pink-100 border-2 border-purple-300 rounded-xl p-4 mb-6">
                    <p className="text-xs font-semibold text-gray-700 mb-2 uppercase">Access Code</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-2xl font-black text-purple-600 tracking-wider">
                        {quiz.code}
                      </div>
                      <button
                        onClick={() => handleCopyCode(quiz.code)}
                        className={`p-2 rounded-lg transition ${
                          copiedCode === quiz.code
                            ? 'bg-green-500 text-white'
                            : 'bg-white hover:bg-gray-100 text-purple-600'
                        }`}
                      >
                        {copiedCode === quiz.code ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDeleteQuiz(quiz.id)}
                      className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                    <button
                      className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-2 px-4 rounded-lg transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
      `}</style>
    </div>
  );
}