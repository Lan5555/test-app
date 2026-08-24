'use client';

import React, { useState, useEffect, JSX, useCallback } from 'react';
import { 
  Plus, Trash2, Copy, LogOut, Settings, Lock, Share2, Check, X, 
  Eye, Edit2, Save, ArrowLeft, Users, BarChart3, Zap, Loader, 
  User2, Code, MoreHorizontal, Divide, Space, Menu, ChevronLeft,
  Home, BookOpen, TrendingUp, Award, Bell, Search, Filter,
  Calendar, Clock, Star, TrendingDown, Activity, PieChart,
  Download, FileText, Printer, RefreshCw, ChevronRight,
  Moon, Sun, Monitor, Globe, BellRing, ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AddUserModal from '@/app/components/add-user';
import { useToast } from '@/app/components/toast';
import { generateId, generateSmallNumbers } from '@/app/helpers/id-generator';
import { CoreService } from '@/app/helpers/api-handler';
import UpdateUserCode from '@/app/components/update-code';
import { LogFactory, Users as Person } from '@/app/helpers/factories';
import AddProductModal from '@/app/components/shop-modal';
import { Box, Button, Divider, Fab, Input, InputLabel, Switch, Tab, TextField, Avatar, Chip, LinearProgress, IconButton, Tooltip, Badge } from '@mui/material';
import Modal from '@/app/components/modal';
import Validator from '@/app/components/validator';

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
  category?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  dynamicTime?: number;
  isDynamic?: boolean;
}

interface AdminSession {
  type: string;
  token: string;
  name: string;
  email: string;
}

interface Stats {
  totalQuizzes: number;
  totalStudents: number;
  totalQuestions: number;
  averageScore: number;
  completionRate?: number;
  activeQuizzes?: number;
  passRate?: number;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  message?: string;
  quizzes?: Quiz[];
  stats?: Stats;
}

interface MiscController {
  userId:number,
  value:string | number
}

interface ActivityItem {
  id: number;
  type: 'quiz_created' | 'student_joined' | 'quiz_completed';
  message: string;
  timestamp: Date;
  user?: string;
  quizName?: string;
}

interface ReviewRecord extends LogFactory {
  userId?: number;
  quizName?: string;
  taken?: boolean;
}

export default function AdminDashboard(): JSX.Element {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [showNewQuizModal, setShowNewQuizModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [addUserModal, setAddUserModal] = useState<boolean>(false);
  const [updateCodeModal, setUpdateCodeModal] = useState<boolean>(false);
  const [deadlineModal, setDeadlineModal] = useState<boolean>(false);
  const [user, setUsers] = useState<Person[]>([]);
  const [isModalOpen, setModalOpen] = useState<boolean>(false);
  const service:CoreService = new CoreService();
  const {addToast} = useToast();
  const [isAttemptUpdate, setIsAttemptUpdate] = useState<boolean>(false); 
  const [miscController, setMiscValues] = useState<MiscController>({userId: 0, value: ''});
  const [dynamic, setDynamic] = useState<boolean>(false);
  const [dynamicTime, setDynamicTime] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [deadlineSearch, setDeadlineSearch] = useState<string>('');
  const [admin, setAdmin] = useState<AdminSession>();
  const [selectedUser, setSelectedUser] = useState<Person>();
  const [selectedQuizId, setSelectedQuizId] = useState<string>('');
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState<boolean>(false);
  const [reviewSearch, setReviewSearch] = useState<string>('');
  const [expandedReviewId, setExpandedReviewId] = useState<number | null>(null);
  const [reviewTake, setReviewTake] = useState<number>(10);
  const [hasMoreReviews, setHasMoreReviews] = useState<boolean>(true);
  const [selectedReviewForPrint, setSelectedReviewForPrint] = useState<ReviewRecord | null>(null);


  // Browser Settings State
  const [settings, setSettings] = useState({
    darkMode: false,
    notifications: true,
    language: 'English',
    autoSave: true
  });

  // ...existing code...

  const [flyerData, setFlyerData] = useState({
    studentName: '',
    programName: "Lan's Hub Learning Program",
    completionDate: new Date().toISOString().split('T')[0],
    message: 'Your dedication, consistency, and commitment have led to this achievement.',
    signatureImage: ''
  });

//

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
    averageScore: 0,
    activeQuizzes: 0
  });

  // Check authentication on mount
  useEffect(() => {
    // Set sidebar open by default only on desktop
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
    
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('admin_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const updateSetting = (key: keyof typeof settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('admin_settings', JSON.stringify(newSettings));
    addToast('Setting updated', 'success');
  };

  useEffect(() => {
    fetchQuizzes();
    fetchStats();
    fetchAllUsers();
    fetchAllReviews();
    loadMockActivities();
    setAdminSession();
  }, [router]);

  useEffect(() => {
    const clearSelectedReview = () => {
      document.body.classList.remove('printing-review');
      setSelectedReviewForPrint(null);
    };
    window.addEventListener('afterprint', clearSelectedReview);
    return () => window.removeEventListener('afterprint', clearSelectedReview);
  }, []);

  const fetchAllReviews = async (take: number = reviewTake): Promise<void> => {
    setReviewsLoading(true);
    try {
      const response = await service.get(`/review/api/fetch-all-reviews?take=${take}&skip=0`);
      if (response.success) {
        const records = Array.isArray(response.data) ? response.data : response.data ? [response.data] : [];
        setReviews(records.map((record) => LogFactory.fromJson(record) as ReviewRecord));
        setHasMoreReviews(records.length >= take);
      } else {
        addToast(response.message || 'Unable to load reviews', 'error');
      }
    } catch (error: any) {
      addToast(error.message || 'Unable to load reviews', 'error');
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadMoreReviews = (): void => {
    const nextTake = reviewTake + 10;
    setReviewTake(nextTake);
    fetchAllReviews(nextTake);
  };

  const printSelectedReview = (review: ReviewRecord): void => {
    setSelectedReviewForPrint(review);
    document.body.classList.add('printing-review');
    window.setTimeout(() => window.print(), 100);
  };

  const filteredReviews = reviews.filter((review) => {
    const query = reviewSearch.toLowerCase();
    return [review.name, review.quizName, review.subtitle].some((value) =>
      value?.toLowerCase().includes(query)
    );
  });

  const exportReviewsCsv = (): void => {
    const headers = ['ID', 'Student', 'Quiz', 'Subtitle', 'Completed', 'Score', 'Total Questions', 'Time Spent', 'Taken'];
    const rows = reviews.map((review) => [
      review.id,
      review.name,
      review.quizName || review.subtitle,
      review.subtitle,
      new Date(review.completedDate).toISOString(),
      review.score,
      review.totalQuestions,
      review.timeSpent,
      review.taken ? 'Yes' : 'No'
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `quiz-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const analyticsCompletionRate = stats.completionRate ?? (user.length
    ? Math.min(100, Math.round((reviews.length / user.length) * 100))
    : 0);
  const analyticsPassRate = stats.passRate ?? (reviews.length
    ? Math.round((reviews.filter((review) => review.score >= 50).length / reviews.length) * 100)
    : 0);
  const scoreBands = [
    { label: '0-39', min: 0, max: 39, color: 'bg-rose-400' },
    { label: '40-59', min: 40, max: 59, color: 'bg-amber-400' },
    { label: '60-69', min: 60, max: 69, color: 'bg-yellow-400' },
    { label: '70-79', min: 70, max: 79, color: 'bg-emerald-400' },
    { label: '80-89', min: 80, max: 89, color: 'bg-teal-400' },
    { label: '90-100', min: 90, max: 100, color: 'bg-indigo-500' },
  ].map((band) => ({
    ...band,
    count: reviews.filter((review) => review.score >= band.min && review.score <= band.max).length,
  }));
  const highestBandCount = Math.max(...scoreBands.map((band) => band.count), 1);
  const topPerformers = [...user].sort((first, second) => second.score - first.score).slice(0, 5);
  const latestReviews = [...reviews]
    .sort((first, second) => new Date(second.completedDate).getTime() - new Date(first.completedDate).getTime())
    .slice(0, 3);
  const selectedReviewAnswers = selectedReviewForPrint?.review ?? [];
  const selectedReviewCorrectCount = selectedReviewAnswers.filter((answer) => answer.picked === answer.correct).length;
  const selectedReviewPassed = (selectedReviewForPrint?.score ?? 0) >= 50;

  const loadMockActivities = () => {
    const mockActivities: ActivityItem[] = [
      { id: 1, type: 'quiz_created', message: 'New quiz "JavaScript Fundamentals" created', timestamp: new Date(), user: 'Admin', quizName: 'JavaScript Fundamentals' },
      { id: 2, type: 'student_joined', message: 'John Doe joined the platform', timestamp: new Date(Date.now() - 3600000), user: 'John Doe' },
      { id: 3, type: 'quiz_completed', message: 'Sarah Johnson completed "React Basics" with 85%', timestamp: new Date(Date.now() - 7200000), user: 'Sarah Johnson', quizName: 'React Basics' },
      { id: 4, type: 'quiz_created', message: 'New quiz "Python Data Structures" created', timestamp: new Date(Date.now() - 86400000), user: 'Admin', quizName: 'Python Data Structures' },
    ];
    setRecentActivities(mockActivities);
  };

  const setAdminSession = () => {
    const session = sessionStorage.getItem('adminSession');
    if(session){
    const admin = JSON.parse(session) as AdminSession;
    setAdmin(admin);
    }
  }

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await service.get('/users/api/find-all-users');

      if (res.success) {
        if (!res.data) {
          setUsers([]);
          return;
        }

        const resultArray = Array.isArray(res.data) ? res.data : [res.data];
        const users = resultArray.map(userJson => Person.fromJson(userJson)).filter(Boolean);
        setUsers(users);
        
        const numberOfStudents = users.length;
        const totalScore = users.reduce((u, a) => u + a.score, 0);
        const averageScore = numberOfStudents > 0 ? totalScore / numberOfStudents : 0;
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
  }, [service, addToast]);

  const fetchQuizzes = async (): Promise<void> => {
    try {
      const response = await service.get('/question/api/fetch-all-questions?take=50&skip=0');
      if (response.success) {
        const rawQuizzes = Array.isArray(response.data) ? response.data : response.data ? [response.data] : [];
        const normalizedQuizzes = rawQuizzes.map((quiz: any) => ({
          ...quiz,
          questions: Array.isArray(quiz.questions)
            ? quiz.questions
            : Array.isArray(quiz.question)
              ? quiz.question
              : []
        })) as Quiz[];
        setQuizzes(normalizedQuizzes);
        setStats(prev => ({
          ...prev,
          activeQuizzes: normalizedQuizzes.length
        }));
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
      code: generateSmallNumbers(),
      totalQuestions: questions.length,
      question: questions.map(q => ({
        question: q.question,
        options: q.options,
        correct: q.correct,
      })),
      isDynamic: dynamic,
      dynamicTime: dynamicTime
    };
    

      const response = await service.send('/question/api/save-quiz', payload);
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
    sessionStorage.removeItem('adminSession');
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
      'userId':id,
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
        'userId':id,
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

  const handleUpdateDeadline = async (userId: number, deadline: string, quizId: string) => {
    if (!userId || !deadline || !quizId) {
      addToast('Please select a user, quiz and a date', 'warning');
      return;
    }
    setLoading(true);
    try {
      const res = await service.send(`/users/api/update-deadline/${userId}`, { deadline, quizId });
      if (res.success) {
        addToast('Deadline updated successfully', 'success');
        setDeadlineModal(false);
        fetchAllUsers();
      } else {
        addToast(res.message || 'Failed to update deadline', 'error');
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateAttempt = async(e:any, id:number, attempt:number) => {
    e.preventDefault();
    setLoading(true);
    try{
      const res = await service.send('/users/api/update-code-attempt',{
        'userId':id,
        'attempts':attempt
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
      setMiscValues({userId: 0, value: ''});
    }
  }

  const updateTime = async(e:any, id:number, time:number) => {
    e.preventDefault();
    setLoading(true);
    try{
      const res = await service.send('/users/api/update-user-time',{
        'userId':id,
        'time':time
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
      setMiscValues({userId: 0, value: ''});
    }
  }

  const filteredQuizzes = quizzes.filter(quiz => 
    quiz.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDifficultyColor = (difficulty?: string) => {
    switch(difficulty) {
      case 'Easy': return 'success';
      case 'Medium': return 'warning';
      case 'Hard': return 'error';
      default: return 'default';
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch(type) {
      case 'quiz_created': return <BookOpen className="w-4 h-4 text-green-500" />;
      case 'student_joined': return <Users className="w-4 h-4 text-blue-500" />;
      case 'quiz_completed': return <Award className="w-4 h-4 text-purple-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row font-sans">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 lg:w-20'} bg-white border-r border-slate-100 shadow-xl transition-all duration-300 flex flex-col fixed lg:sticky top-0 h-screen z-30 text-slate-600 print:hidden`}>
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">Lan&apos;s Hub</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Portal</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200">
              <Zap className="w-6 h-6 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <ChevronLeft className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${!sidebarOpen && 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => {
              setActiveTab('overview');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'overview' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Home className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Overview</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab('quizzes');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'quizzes' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Quizzes</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab('students');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'students' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Users className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Students</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab('reviews');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'reviews'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Reviews</span>}
          </button>

        

          <button
            onClick={() => {
              setActiveTab('flyer');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'flyer'
                ? 'bg-indigo-50 text-indigo-600'
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Award className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Completion Flyer</span>}
          </button>


          <button
            onClick={() => {
              setActiveTab('analytics');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'analytics' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Analytics</span>}
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all ${
              activeTab === 'settings' 
                ? 'bg-indigo-50 text-indigo-600' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Settings</span>}
          </button>
        </nav>

        {/* User Section */}
        <div className="p-8 border-t border-slate-100 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
              <User2 className="w-5 h-5" />
            </div>
            {sidebarOpen && (
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{admin?.name || 'Admin User'}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrator</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm text-rose-500 hover:bg-rose-50 transition-all"
          > 
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Top Navigation Bar */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 lg:px-8 py-4 print:hidden">
          <div className="flex items-center justify-between">
            <IconButton onClick={() => setSidebarOpen(true)} className="lg:hidden mr-2">
              <Menu className="w-6 h-6" />
            </IconButton>
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search quizzes, students, or settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Tooltip title="Notifications">
                <IconButton className="relative">
                  <Badge badgeContent={3} color="error">
                    <Bell className="w-5 h-5 text-gray-600" />
                  </Badge>
                </IconButton>
              </Tooltip>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900">{admin?.name || 'Admin User'}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
                <Avatar className="bg-indigo-600 cursor-pointer">
                  <User2 className="w-5 h-5" />
                </Avatar>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-8">
          {activeTab === 'overview' && (
            <>
              {/* Welcome Banner */}
              <div className="overview-banner bg-linear-to-br from-slate-950 via-indigo-950 to-slate-900 rounded-3xl lg:rounded-4xl p-5 sm:p-6 lg:p-8 mb-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute -right-16 -top-20 w-72 h-72 border border-indigo-400/20 rounded-full"></div>
                <div className="absolute right-12 -top-10 w-44 h-44 border border-cyan-300/10 rounded-full"></div>
                <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                  <div>
                    <p className="text-cyan-300 text-xs font-black uppercase tracking-[0.2em] mb-3">Admin overview</p>
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-2 tracking-tight">Welcome back, {admin?.name?.split(' ')[0] || 'Admin'}.</h2>
                    <p className="text-slate-300 font-medium max-w-lg">Keep an eye on your learners, spot performance shifts, and move straight into the work that matters.</p>
                  </div>
                  <div className="overview-pulse relative min-w-0 w-full lg:min-w-64 lg:w-auto bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-4"><span className="text-xs font-bold uppercase tracking-widest text-slate-300">Performance pulse</span><Activity className="w-4 h-4 text-cyan-300" /></div>
                    <div className="flex items-end gap-3"><span className="text-4xl font-black">{analyticsPassRate}%</span><span className="text-sm text-slate-300 pb-1">passing rate</span></div>
                    <div className="mt-4 h-1.5 bg-white/15 rounded-full overflow-hidden"><div className="h-full bg-cyan-300 rounded-full" style={{ width: `${analyticsPassRate}%` }} /></div>
                    <p className="text-xs text-slate-400 mt-3">{reviews.length} submitted review{reviews.length === 1 ? '' : 's'} loaded</p>
                  </div>
                </div>
                <div className="relative mt-7 flex flex-wrap items-center gap-3">
                  <div className="max-w-full bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Today's Date</p>
                    <p className="text-sm font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <button onClick={() => setActiveTab('reviews')} className="px-4 py-2.5 rounded-xl bg-cyan-300 text-slate-950 text-sm font-black hover:bg-white transition-colors flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Review submissions
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="overview-stats grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-indigo-600" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Quizzes</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalQuizzes || 0}</p>
                  <p className="text-xs text-green-600 mt-2">+12% from last month</p>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900">{user.length || 0}</p>
                  <p className="text-xs text-green-600 mt-2">+8 new this week</p>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                      <Award className="w-6 h-6 text-green-600" />
                    </div>
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Average Score</p>
                  <p className="text-3xl font-bold text-gray-900">{Math.floor(stats.averageScore) || 0}%</p>
                  <p className="text-xs text-red-600 mt-2">-3% from last month</p>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
                      <Activity className="w-6 h-6 text-yellow-600" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <p className="text-gray-600 text-sm mb-1">Completion Rate</p>
                  <p className="text-3xl font-bold text-gray-900">{analyticsCompletionRate}%</p>
                  <p className="text-xs text-slate-500 mt-2">Based on submitted reviews</p>
                </div>
              </div>

              {/* Recent Activity & Quick Actions */}
              <div className="overview-activity-grid grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-8 items-start">
                {/* Recent Activity */}
                <div className="min-w-0 w-full bg-white rounded-3xl sm:rounded-4xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="p-4 sm:p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Latest updates</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {latestReviews.length > 0 ? latestReviews.map((review) => (
                      <div key={`review-${review.id}`} className="p-4 hover:bg-indigo-50/40 transition">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center"><FileText className="w-4 h-4 text-indigo-600" /></div>
                          <div className="flex-1 min-w-0"><p className="text-sm text-gray-900 truncate"><span className="font-bold">{review.name}</span> completed {review.quizName || review.subtitle}</p><p className="text-xs text-gray-500 mt-1">Scored {Math.round(review.score)}% · {new Date(review.completedDate).toLocaleDateString()}</p></div>
                          <span className="text-xs font-black text-indigo-600">NEW</span>
                        </div>
                      </div>
                    )) : recentActivities.map((activity) => (
                      <div key={activity.id} className="p-4 hover:bg-gray-50 transition">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{activity.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {activity.timestamp.toLocaleTimeString()} • {activity.timestamp.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="min-w-0 w-full bg-white rounded-3xl sm:rounded-4xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="p-4 sm:p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Common tasks</p>
                  </div>
                  <div className="p-4 sm:p-6 space-y-4">
                    <button
                      onClick={() => setAddUserModal(true)}
                      className="w-full group bg-slate-50 border border-slate-100 hover:border-indigo-600 p-4 rounded-2xl transition-all duration-300 flex items-center gap-4 text-left hover:bg-white hover:shadow-md"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 transition-colors">
                        <Users className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Add New Student</p>
                        <p className="text-xs text-slate-500">Enroll a single student</p>
                      </div>
                    </button>

                    <button
                      onClick={() => router.push('/pages/users')}
                      className="w-full group bg-slate-50 border border-slate-100 hover:border-indigo-600 p-4 rounded-2xl transition-all duration-300 flex items-center gap-4 text-left hover:bg-white hover:shadow-md"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:bg-indigo-600 transition-colors">
                        <Settings className="w-6 h-6 text-indigo-600 group-hover:text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Manage Users</p>
                        <p className="text-xs text-slate-500">View and edit student records</p>
                      </div>
                    </button>

                    <div className="pt-2">
                      <AddProductModal />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'quizzes' && (
            <>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Your Quizzes</h2>
                  <p className="text-gray-600 mt-1">Manage and monitor all your created quizzes</p>
                </div>
                <button
                  onClick={() => setShowNewQuizModal(true)}
                  className="bg-indigo-600 text-white font-bold py-2.5 px-5 rounded-xl transition transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Plus className="w-5 h-5" />
                  Create New Quiz
                </button>
              </div>

              {filteredQuizzes.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
                  <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 text-lg">No quizzes found. Create your first quiz to get started!</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredQuizzes.map((quiz) => (
                    <div key={quiz.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 overflow-hidden group">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-1">{quiz.name}</h3>
                            <div className="flex items-center gap-2">
                              <Chip 
                                label={`${quiz.totalQuestions} Questions`} 
                                size="small" 
                                className="bg-indigo-50 text-indigo-700"
                              />
                              <Chip 
                                label="Active" 
                                size="small" 
                                color="success"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="opacity-0 group-hover:opacity-100 transition p-2 hover:bg-red-100 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>

                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Enrolled Students</span>
                            <span className="font-semibold text-gray-900">{user.length || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Created</span>
                            <span className="text-gray-900">{new Date(quiz.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Code Display */}
                        <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                          <p className="text-xs font-semibold text-gray-700 mb-2 uppercase flex items-center gap-2">
                            <Lock className="w-3 h-3" />
                            Access Code
                          </p>
                          <div className="flex items-center justify-between gap-3">
                            <code className="text-xl font-mono font-bold text-indigo-600 tracking-wider">
                              {quiz.code}
                            </code>
                            <Tooltip title="Copy Code">
                              <IconButton
                                onClick={() => handleCopyCode(quiz.code)}
                                className={`transition-all ${copiedCode === quiz.code ? 'bg-green-500 text-white' : 'bg-white border border-slate-200'}`}
                                size="small"
                              >
                                {copiedCode === quiz.code ? (
                                  <Check className="w-4 h-4" />
                                ) : (
                                  <Copy className="w-4 h-4 text-slate-400" />
                                )}
                              </IconButton>
                            </Tooltip>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => setSelectedQuiz(quiz)}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                          <button className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2">
                            <Share2 className="w-4 h-4" />
                            Share
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'students' && (
            <>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
                  <p className="text-gray-600 mt-1">View and manage all enrolled students</p>
                </div>
                <button
                  onClick={() => setAddUserModal(true)}
                  className="bg-indigo-600 text-white font-bold py-2.5 px-5 rounded-xl transition transform hover:scale-105 flex items-center gap-2 shadow-lg shadow-indigo-200"
                >
                  <Plus className="w-5 h-5" />
                  Add Student
                </button>
              </div>

              <div className="mb-8">
                <UpdateUserCode isOpen={false} onClose={() => {}} onSubmit={async() => {}} isLoading={false} />
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-4 font-semibold text-gray-700">Student Name</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Email</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Score</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Status</th>
                        <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {user.map((student, index) => (
                        <tr key={index} className="hover:bg-gray-50 transition">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8 bg-indigo-100 text-indigo-600">
                                {student.name?.charAt(0) || 'S'}
                              </Avatar>
                              <span className="font-medium text-gray-900">{student.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-gray-600">{student.email}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{student.score}%</span>
                              <LinearProgress 
                                variant="determinate" 
                                value={student.score} 
                                className="w-20 h-1 rounded-full"
                                sx={{
                                  backgroundColor: '#e5e7eb',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: student.score >= 70 ? '#10b981' : student.score >= 50 ? '#f59e0b' : '#ef4444'
                                  }
                                }}
                              />
                            </div>
                          </td>
                          <td className="p-4">
                            <Chip 
                              label={student.score >= 60 ? 'Active' : 'Needs Improvement'} 
                              size="small"
                              color={student.score >= 60 ? 'success' : 'warning'}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Tooltip title="Edit Student">
                                <IconButton size="small" className="text-blue-600">
                                  <Edit2 className="w-4 h-4" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="View Progress">
                                <IconButton size="small" className="text-indigo-600">
                                  <BarChart3 className="w-4 h-4" />
                                </IconButton>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => setModalOpen(true)}
                  className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
                >
                  <Settings className="w-5 h-5" />
                  Advanced User Controls
                </button>
                <button
                  onClick={() => setUpdateCodeModal(true)}
                  className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition flex items-center gap-2 shadow-sm"
                >
                  <Lock className="w-5 h-5" />
                  Update Student Codes
                </button>
              </div>
            </>
          )}

          {activeTab === 'reviews' && (
            <section className={`reviews-report ${selectedReviewForPrint ? 'review-printing' : ''}`}>
              <div className="review-screen">
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 mb-8">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 text-xs font-black uppercase tracking-[0.2em] mb-3">
                    <FileText className="w-4 h-4" /> Assessment archive
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">All quiz reviews</h2>
                  <p className="text-slate-500 mt-2 max-w-xl">A clear record of every submitted assessment, ready to print or take offline.</p>
                </div>
                <div className="flex flex-wrap gap-3 print:hidden">
                  <button
                    onClick={() => fetchAllReviews()}
                    disabled={reviewsLoading}
                    className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${reviewsLoading ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                  <button
                    onClick={exportReviewsCsv}
                    disabled={!reviews.length}
                    className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm hover:border-indigo-300 hover:text-indigo-600 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" /> CSV
                  </button>
                  <button
                    onClick={() => window.print()}
                    disabled={!reviews.length}
                    className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" /> Print / Save PDF
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg shadow-slate-200">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Submissions</p>
                  <p className="text-3xl font-black mt-2">{reviews.length}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Average score</p>
                  <p className="text-3xl font-black text-indigo-600 mt-2">
                    {reviews.length ? Math.round(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length) : 0}%
                  </p>
                </div>
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Minutes logged</p>
                  <p className="text-3xl font-black text-emerald-600 mt-2">{reviews.reduce((sum, review) => sum + review.timeSpent, 0)}m</p>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
                  <div>
                    <h3 className="font-black text-slate-900">Submission register</h3>
                    <p className="text-xs text-slate-400 mt-1">Showing {filteredReviews.length} of {reviews.length} loaded records</p>
                  </div>
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={reviewSearch}
                      onChange={(event) => setReviewSearch(event.target.value)}
                      placeholder="Search student or quiz"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                {reviewsLoading ? (
                  <div className="py-20 text-center text-slate-500"><Loader className="w-6 h-6 animate-spin mx-auto mb-3" />Loading reviews...</div>
                ) : filteredReviews.length === 0 ? (
                  <div className="py-20 text-center"><FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="font-bold text-slate-600">No reviews found</p><p className="text-sm text-slate-400 mt-1">Try another search or refresh the archive.</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-190">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Student</th>
                          <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Quiz</th>
                          <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Completed</th>
                          <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Score</th>
                          <th className="text-left p-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Duration</th>
                          <th className="p-4 print:hidden" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredReviews.map((review) => {
                          const percentage = Math.round(review.score);
                          const isExpanded = expandedReviewId === review.id;
                          return (
                            <React.Fragment key={review.id}>
                              <tr className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-4"><div className="flex items-center gap-3"><Avatar className="w-9 h-9 bg-indigo-100 text-indigo-700 text-sm">{review.name?.charAt(0) || 'S'}</Avatar><div><p className="font-bold text-slate-900">{review.name}</p><p className="text-xs text-slate-400">ID #{review.userId ?? '—'}</p></div></div></td>
                                <td className="p-4"><p className="font-bold text-slate-800">{review.quizName || review.subtitle}</p><p className="text-xs text-slate-400 mt-1">{review.totalQuestions} questions</p></td>
                                <td className="p-4 text-sm text-slate-600">{new Date(review.completedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                <td className="p-4"><span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-black ${percentage >= 70 ? 'bg-emerald-50 text-emerald-700' : percentage >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{percentage}%</span></td>
                                <td className="p-4 text-sm font-bold text-slate-600">{review.timeSpent} min</td>
                                <td className="p-4 print:hidden"><div className="flex items-center gap-1"><button onClick={() => setExpandedReviewId(isExpanded ? null : review.id ?? null)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600" aria-label={`View ${review.name}'s answers`}><ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} /></button><button onClick={() => printSelectedReview(review)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600" aria-label={`Print ${review.name}'s review`}><Printer className="w-4 h-4" /></button></div></td>
                              </tr>
                              {isExpanded && <tr className="bg-indigo-50/40"><td colSpan={6} className="p-5"><div className="grid gap-3 md:grid-cols-2">{(review.review || []).map((question, index) => <div key={`${review.id}-${index}`} className="bg-white border border-indigo-100 rounded-xl p-4"><p className="text-xs font-black uppercase tracking-widest text-indigo-500 mb-2">Question {index + 1}</p><p className="font-bold text-slate-800">{question.question}</p><p className="text-sm text-slate-500 mt-2">Answer: {question.picked}</p><p className="text-sm text-emerald-600 mt-1">Correct: {question.correct}</p></div>)}</div></td></tr>}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {hasMoreReviews && !reviewsLoading && reviews.length > 0 && (
                  <div className="p-5 border-t border-slate-100 flex justify-center print:hidden">
                    <button
                      onClick={loadMoreReviews}
                      disabled={reviewsLoading}
                      className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      Load more reviews (take {reviewTake + 10})
                    </button>
                  </div>
                )}
              </div>
              </div>
              {selectedReviewForPrint && (
                <article className="review-print-sheet">
                  <div className="print-report-header flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-6">
                    <div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Quiz response report</p><h1 className="text-3xl font-black text-slate-900 mt-2">{selectedReviewForPrint.name}</h1><p className="text-slate-500 mt-1">{selectedReviewForPrint.quizName || selectedReviewForPrint.subtitle}</p><p className="text-xs text-slate-400 mt-3">Student ID: {selectedReviewForPrint.userId ?? 'Not provided'} · Response #{selectedReviewForPrint.id ?? '—'}</p></div>
                    <div className="text-right text-sm text-slate-500"><span className={`print-result-badge inline-flex px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${selectedReviewPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{selectedReviewPassed ? 'Passed' : 'Failed'}</span><p className="mt-3">{new Date(selectedReviewForPrint.completedDate).toLocaleDateString()}</p><p>{selectedReviewForPrint.timeSpent} minutes</p></div>
                  </div>
                  <div className="print-report-summary grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7"><div className="bg-slate-100 p-4 rounded-xl"><p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Score</p><p className="text-2xl font-black text-slate-900 mt-1">{Math.round(selectedReviewForPrint.score)}%</p></div><div className="bg-slate-100 p-4 rounded-xl"><p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Correct</p><p className="text-2xl font-black text-emerald-700 mt-1">{selectedReviewCorrectCount}/{selectedReviewForPrint.totalQuestions}</p></div><div className="bg-slate-100 p-4 rounded-xl"><p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Questions</p><p className="text-2xl font-black text-slate-900 mt-1">{selectedReviewForPrint.totalQuestions}</p></div><div className="bg-slate-100 p-4 rounded-xl"><p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Status</p><p className="text-2xl font-black text-slate-900 mt-1">{selectedReviewForPrint.taken ? 'Taken' : 'Pending'}</p></div></div>
                  <div className="print-report-questions space-y-4">{selectedReviewAnswers.map((question, index) => { const isCorrect = question.picked === question.correct; return <div key={`${selectedReviewForPrint.id}-print-${index}`} className={`print-question-card ${isCorrect ? 'print-question-correct' : 'print-question-incorrect'} border rounded-xl p-4`}><div className="flex items-start justify-between gap-3"><p className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-2">Question {index + 1}</p><span className={`print-question-status px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{isCorrect ? 'Correct' : 'Incorrect'}</span></div><p className="font-bold text-slate-900">{question.question}</p><div className="print-answer-detail mt-4"><div className="print-answer-row"><span className="print-answer-label">Student answer</span><span className="print-answer-value">{question.picked || 'Not answered'}</span></div><div className="print-answer-row"><span className="print-answer-label">Correct answer</span><span className="print-correct-answer print-answer-value">{question.correct || 'Not provided'}</span></div></div></div>; })}</div>
                </article>
              )}
            </section>
          )}

          {activeTab === 'analytics' && (
            <>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Performance Analytics</h2>
                  <p className="text-gray-600 mt-1">Comprehensive insights into quiz performance</p>
                </div>
                <div className="flex gap-2">
                  <button className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition flex items-center gap-2">
                    <Download className="w-4 h-4" /> Export Report
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-indigo-600" />
                      Quiz Completion Metrics
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Completion Rate</span>
                          <span className="font-bold text-indigo-600">{analyticsCompletionRate}%</span>
                        </div>
                        <LinearProgress variant="determinate" value={analyticsCompletionRate} className="h-2.5 rounded-full bg-indigo-50" sx={{ '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Average Pass Rate</span>
                          <span className="font-bold text-green-600">{analyticsPassRate}%</span>
                        </div>
                        <LinearProgress variant="determinate" value={analyticsPassRate} className="h-2.5 rounded-full bg-green-50" color="success" sx={{ '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Active vs Total Quizzes</span>
                          <span className="font-bold text-blue-600">{stats.activeQuizzes || 0} / {stats.totalQuizzes || 0}</span>
                        </div>
                        <LinearProgress variant="determinate" value={((stats.activeQuizzes || 0) / (stats.totalQuizzes || 1)) * 100} className="h-2.5 rounded-full bg-blue-50" sx={{ '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-orange-500" />
                      Score Distribution
                    </h3>
                    <div className="flex items-end justify-between h-32 gap-2 px-2">
                      {scoreBands.map((band) => (
                        <div key={band.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                          <div 
                            className={`w-full ${band.color} hover:opacity-80 transition-opacity rounded-t-lg relative group min-h-1`}
                            style={{ height: `${(band.count / highestBandCount) * 100}%` }}
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {band.count} review{band.count === 1 ? '' : 's'}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">{band.label}%</span>
                        </div>
                      ))}
                    </div>
                    {!reviews.length && <p className="text-center text-xs text-slate-400 mt-4">No review data loaded yet.</p>}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-600" />
                    Top Performing Students
                  </h3>
                  <div className="space-y-4">
                    {topPerformers.map((student, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-linear-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{student.score}%</p>
                          <p className="text-xs text-gray-500">Score</p>
                        </div>
                      </div>
                    ))}
                    {!topPerformers.length && <p className="text-sm text-slate-400">No student performance data available.</p>}
                  </div>
                </div>
              </div>
            </>
          )}


          {activeTab === 'flyer' && (
            <section className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-8 print:hidden">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 mb-2">
                    Celebrate achievement
                  </p>
                  <h2 className="text-3xl font-black text-slate-900">
                    Program Completion Flyer
                  </h2>
                  <p className="text-slate-500 mt-2">
                    Create a beautiful flyer for completed students.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const flyer = document.getElementById('program-completion-flyer');
                    const flyerWindow = window.open('', '_blank');

                    if (!flyer || !flyerWindow) {
                      addToast('Please allow pop-ups to open the flyer', 'error');
                      return;
                    }

                    const stylesheets = Array.from(
                      document.querySelectorAll('link[rel="stylesheet"]')
                    )
                      .map((link) => `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}">`)
                      .join('');

                    flyerWindow.document.write(`
                      <!doctype html>
                      <html>
                        <head>
                          <title>Program Completion Flyer</title>
                          ${stylesheets}
                          <style>
                            html, body { margin: 0; min-height: 100%; background: #0f172a; }
                            body { display: flex; justify-content: center; padding: 2rem; box-sizing: border-box; }
                            #program-completion-flyer { width: min(100%, 900px); min-height: 700px; }
                          </style>
                        </head>
                        <body>${flyer.outerHTML}</body>
                      </html>
                    `);
                    flyerWindow.document.close();
                  }}
                  className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                >
                  <Eye className="w-4 h-4 inline mr-2" />
                  Open Flyer in New Tab
                </button>
              </div>

              <div className="grid lg:grid-cols-[320px_1fr] gap-8 items-start print:block">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 print:hidden">
                  <h3 className="font-black text-slate-900 mb-5">Flyer Details</h3>

                  <div className="space-y-4">
                    <input
                      value={flyerData.studentName}
                      onChange={(event) =>
                        setFlyerData((current) => ({
                          ...current,
                          studentName: event.target.value
                        }))
                      }
                      placeholder="Student name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-black outline-none focus:border-indigo-500"
                    />

                    <input
                      value={flyerData.programName}
                      onChange={(event) =>
                        setFlyerData((current) => ({
                          ...current,
                          programName: event.target.value
                        }))
                      }
                      placeholder="Program name"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-black outline-none focus:border-indigo-500"
                    />

                    <input
                      type="date"
                      value={flyerData.completionDate}
                      onChange={(event) =>
                        setFlyerData((current) => ({
                          ...current,
                          completionDate: event.target.value
                        }))
                      }
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-black outline-none focus:border-indigo-500"
                    />

                    <textarea
                      value={flyerData.message}
                      onChange={(event) =>
                        setFlyerData((current) => ({
                          ...current,
                          message: event.target.value
                        }))
                      }
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-black outline-none focus:border-indigo-500 resize-none"
                    />

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">
                        Signature image
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;

                          const reader = new FileReader();
                          reader.onload = () => {
                            setFlyerData((current) => ({
                              ...current,
                              signatureImage: String(reader.result)
                            }));
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-bold file:text-indigo-700 hover:file:bg-indigo-100"
                      />

                      {flyerData.signatureImage && (
                        <button
                          type="button"
                          onClick={() =>
                            setFlyerData((current) => ({
                              ...current,
                              signatureImage: ''
                            }))
                          }
                          className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-700"
                        >
                          Remove signature
                        </button>
                      )}
                    </div>


                  </div>
                </div>

                <article id="program-completion-flyer" className="relative overflow-hidden rounded-4xl bg-linear-to-br from-slate-950 via-indigo-950 to-violet-900 text-white shadow-2xl min-h-155 flex items-center justify-center p-8 sm:p-14 print:shadow-none print:min-h-screen">
                  <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full border border-cyan-300/20" />
                  <div className="absolute -bottom-40 -left-32 w-120 h-120 rounded-full border border-fuchsia-300/20" />
                  <div className="absolute inset-6 rounded-3xl border border-white/15" />

                  <div className="relative z-10 text-center max-w-2xl">
                    <div className="mx-auto mb-7 w-20 h-20 rounded-3xl bg-cyan-300 text-slate-950 flex items-center justify-center">
                      <Award className="w-10 h-10" />
                    </div>

                    <p className="text-cyan-300 text-sm font-black uppercase tracking-[0.35em]">
                      Certificate of Achievement
                    </p>

                    <h1 className="mt-6 text-4xl sm:text-6xl font-black">
                      Program Completed
                    </h1>

                    <div className="my-8 h-px bg-linear-to-r from-transparent via-cyan-300 to-transparent" />

                    <p className="text-slate-300 text-lg">Presented with pride to</p>

                    <h2 className="mt-3 text-3xl sm:text-5xl font-black wrap-break-word">
                      {flyerData.studentName || 'Outstanding Student'}
                    </h2>

                    <p className="mt-6 text-slate-300 text-lg">
                      for successfully completing
                    </p>

                    <p className="mt-2 text-2xl font-bold text-cyan-200">
                      {flyerData.programName}
                    </p>

                    <p className="mt-8 text-slate-300 leading-relaxed">
                      {flyerData.message}
                    </p>

                    <div className="mt-12 flex justify-center gap-10 text-sm">
                      <div>
                        <p className="text-slate-400 uppercase tracking-widest text-[10px] font-black">
                          Completion Date
                        </p>
                        <p className="font-bold mt-2">
                          {new Date(
                            `${flyerData.completionDate}T00:00:00`
                          ).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>

                      <div>
                        <p className="text-slate-400 uppercase tracking-widest text-[10px] font-black">
                          Issued By
                        </p>
                        <p className="font-bold mt-2">Lan&apos;s Hub</p>
                      </div>
                    </div>

                    {flyerData.signatureImage && (
                      <div className="mt-10 flex flex-col items-center">
                        <img
                          src={flyerData.signatureImage}
                          alt="Authorized signature"
                          className="max-h-12 max-w-36 object-contain"
                        />
                        <div className="mt-2 w-52 border-t border-white/40" />
                        <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                          Authorized Signature
                        </p>
                      </div>
                    )}

                    <div className="mt-12 text-cyan-300 font-black tracking-[0.25em] uppercase text-xs">
                      Learn · Grow · Achieve
                    </div>

                    <div className="mt-8 flex items-center justify-center gap-3 text-cyan-300/70">
                      <span className="h-px w-16 bg-linear-to-r from-transparent to-cyan-300/70" />
                      <span className="h-2 w-2 rotate-45 border border-cyan-300/70" />
                      <span className="h-px w-16 bg-linear-to-l from-transparent to-cyan-300/70" />
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      <span>Official Achievement Record</span>
                      <span className="hidden h-1 w-1 rounded-full bg-cyan-300 sm:block" />
                      <span>Lan&apos;s Hub</span>
                    </div>

                    <p className="mt-3 text-center text-[9px] tracking-wide text-slate-500">
                      Presented with recognition of dedication and growth
                    </p>

                  </div>
                </article>
              </div>
            </section>
          )}


          {activeTab === 'settings' && (
            <div className="max-w-4xl">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
                <p className="text-gray-600 mt-1">Manage your dashboard preferences and browser configurations</p>
              </div>

              <div className="grid gap-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-indigo-600" />
                    Appearance & Interface
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Moon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Dark Mode</p>
                          <p className="text-xs text-slate-500">Adjust the dashboard theme for low light</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.darkMode} 
                        onChange={(e) => updateSetting('darkMode', e.target.checked)} 
                      />
                    </div>
                    
                    <Divider />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Globe className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Language</p>
                          <p className="text-xs text-slate-500">Select your preferred display language</p>
                        </div>
                      </div>
                      <select 
                        value={settings.language}
                        onChange={(e) => updateSetting('language', e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100"
                      >
                        <option>English</option>
                        <option>Spanish</option>
                        <option>French</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Security & Notifications
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <BellRing className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Push Notifications</p>
                          <p className="text-xs text-slate-500">Receive alerts for new student enrollments</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.notifications} 
                        onChange={(e) => updateSetting('notifications', e.target.checked)} 
                      />
                    </div>

                    <Divider />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Save className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Auto-save Progress</p>
                          <p className="text-xs text-slate-500">Automatically save quiz drafts every 30 seconds</p>
                        </div>
                      </div>
                      <Switch 
                        checked={settings.autoSave} 
                        onChange={(e) => updateSetting('autoSave', e.target.checked)} 
                      />
                    </div>

                    <Divider />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">Test Deadlines</p>
                          <p className="text-xs text-slate-500">Set global due dates for active assessments</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setDeadlineModal(true)}
                        className="text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                      >
                        Configure
                      </button>
                    </div>

                    <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Deadlines</p>
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder="Search student..." 
                            className="pl-7 pr-3 py-1 text-[10px] bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
                            value={deadlineSearch}
                            onChange={(e) => setDeadlineSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <ul className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {user.filter(u => u.name.toLowerCase().includes(deadlineSearch.toLowerCase())).map(q => (
                          <li key={q.id} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full ${q.deadline ? 'bg-amber-400' : 'bg-slate-300'}`}></div>
                              <span className="text-slate-700 font-medium">{q.name}</span>
                            </div>
                            <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${q.deadline ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>{q.deadline == null ? 'No Deadline' : new Date(q.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Quiz Details Modal */}
      {selectedQuiz && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedQuiz(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5 sm:p-7 border-b border-slate-100 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 mb-2">Quiz details</p>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 wrap-break-word">{selectedQuiz.name}</h2>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold">{selectedQuiz.totalQuestions} questions</span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold">Code: {selectedQuiz.code}</span>
                  {selectedQuiz.isDynamic && <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold">{selectedQuiz.dynamicTime || 0} minute timer</span>}
                </div>
              </div>
              <button
                onClick={() => setSelectedQuiz(null)}
                className="shrink-0 p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close quiz details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-500 pb-2">
                <span>Created {new Date(selectedQuiz.createdAt).toLocaleDateString()}</span>
                <span className="font-bold text-slate-700">{(selectedQuiz.questions ?? []).length} loaded</span>
              </div>
              {(selectedQuiz.questions ?? []).length === 0 ? (
                <div className="py-12 text-center text-slate-500">No questions are available for this quiz.</div>
              ) : (
                (selectedQuiz.questions ?? []).map((question, index) => (
                  <div key={`${selectedQuiz.id}-${question.id}-${index}`} className="border border-slate-200 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black shrink-0">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 wrap-break-word">{question.question}</p>
                        <div className="grid sm:grid-cols-2 gap-2 mt-4">
                          {question.options.map((option, optionIndex) => (
                            <div key={`${question.id}-option-${optionIndex}`} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${question.correct === optionIndex ? 'bg-emerald-50 text-emerald-700 font-bold' : 'bg-slate-50 text-slate-600'}`}>
                              <span className="font-black">{String.fromCharCode(65 + optionIndex)}.</span>
                              <span className="wrap-break-word">{option}</span>
                              {question.correct === optionIndex && <Check className="w-4 h-4 ml-auto shrink-0" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Quiz Modal */}
      {showNewQuizModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-8 max-w-4xl w-full my-8 max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-gray-900">Create New Quiz</h2>
              <button
                onClick={() => setShowNewQuizModal(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            {/* Quiz Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quiz Name *</label>
                <input
                  type="text"
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder="e.g., Biology 101, Math Basics"
                  className="w-full px-4 py-3 text-black placeholder:text-gray-400 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-col justify-end">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border-2 border-gray-200">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">Timed Quiz</h4>
                    <p className="text-xs text-slate-500">Enable countdown timer</p>
                  </div>
                  <Switch checked={dynamic} onChange={(e) => setDynamic(e.target.checked)} color="primary" />
                </div>
              </div>
              {dynamic && (
                <div className="md:col-span-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (Minutes)</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="number" value={dynamicTime} onChange={(e) => setDynamicTime(Number(e.target.value))} className="w-full pl-12 pr-4 py-3 text-black rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none" placeholder="30" />
                  </div>
                </div>
              )}
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

              <div className="space-y-4 md:space-y-6">
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
                      className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base text-black placeholder:text-gray-500 rounded-lg md:rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none mb-4"
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
                            className="flex-1 px-3 md:px-4 py-2 text-sm md:text-base text-black placeholder:text-gray-500 rounded-lg border-2 border-gray-200 focus:border-indigo-500 focus:outline-none min-w-0"
                          />
                          <span className="text-xs font-bold text-white bg-indigo-600 px-2 md:px-3 py-1 md:py-2 rounded-lg shrink-0">
                            {String.fromCharCode(65 + optIndex)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4 mt-6">
              <button
                onClick={handleCreateQuiz}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2 md:py-3 px-4 md:px-6 rounded-lg md:rounded-xl transition flex items-center justify-center gap-2 text-sm md:text-base"
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

      {/* Modals */}
      <UpdateUserCode isOpen={updateCodeModal} onClose={() => setUpdateCodeModal(false)} onSubmit={async(e,id,val, attempt) => handleUpdateCode(e,id,val, attempt)} isLoading={loading}/>
      <AddUserModal isOpen={addUserModal} isLoading={loading} onClose={() => setAddUserModal(false)} onSubmit={async(UserFormData) => handleCreateUser(UserFormData.email, UserFormData.name, UserFormData.code!)} />
      
      <Modal isOpen={deadlineModal} onClose={() => setDeadlineModal(false)} title="Set Test Deadlines">
        <div className="p-4 space-y-6">
          <p className="text-sm text-slate-600">Select a User and set a global expiration date. Students will not be able to start the quiz after this time.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Select User</label>
              <select 
                className="w-full p-3 bg-slate-50 border text-black border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                onChange={(e) => setSelectedUser(user.find(u => u.id === Number(e.target.value)))}
              >
                {user.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Select Quiz</label>
              <select 
                className="w-full p-3 bg-slate-50 border text-black border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                onChange={(e) => setSelectedQuizId(e.target.value)}
                value={selectedQuizId}
              >
                <option value="">Choose a quiz...</option>
                {quizzes.map(q => <option key={q.id} value={q.code}>{q.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Deadline Date</label>
              <input 
                type="date" 
                id="deadline-input"
                className="w-full p-3 text-black bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
            <Button variant="contained" fullWidth className="bg-indigo-600 py-3 rounded-xl font-bold mt-4" disabled={loading} onClick={() => {
              const dateVal = (document.getElementById('deadline-input') as HTMLInputElement)?.value;
              handleUpdateDeadline(selectedUser?.id || user[0]?.id, dateVal, selectedQuizId);
            }}>
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Save Deadline'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Miscellaneous Actions">
        <div className='flex justify-around gap-20'>
          <Button className='text-black' onClick={() => setIsAttemptUpdate(false)}>Update Attempt</Button>
          <Button className='text-black' onClick={() => setIsAttemptUpdate(true)}>Update Time</Button>
        </div>
        <div className='w-full flex justify-center items-center py-1 relative transition'>
          <div className={`w-20 h-1 bg-indigo-500 rounded absolute ${!isAttemptUpdate ? 'left-11' : 'right-7'} transition-all`}></div>
        </div>
        <div className='h-2'></div>
        <Divider></Divider>
        {!isAttemptUpdate ? (
          <div className='flex flex-col gap-4 mt-4'>
            <p className='text-gray-700'>Updating attempt allows you to modify the number of attempts a user has made on their quiz code. This is useful for tracking progress and managing quiz access.</p>
            <div className='h-2'></div>
            <p className='text-sm font-semibold text-gray-600'>To update a user's attempt:</p>
            <Box>
              <form className='flex flex-col' onSubmit={(e) => updateAttempt(e, miscController.userId, Number(miscController.value))}>
                <TextField label="User ID" fullWidth margin="normal"
                value={miscController.userId ?? 0}
                 onChange={(e) => setMiscValues(prev => ({
                  ...prev,
                  userId: Number(e.target.value)
                }))} required/>
                <TextField label="New Attempt Count" 
                value={miscController.value ?? ''}
                fullWidth margin="normal" onChange={(e) => setMiscValues(prev => ({
                  ...prev,
                  value: Number(e.target.value)
                }))} required/>
                <Button variant="contained" type='submit' color="primary" className='mt-7'>
                  {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : 'Submit'}
                </Button>
              </form>
            </Box>
          </div>
        ) : ( 
          <div className='flex flex-col gap-4 mt-4'>
            <p className='text-gray-700'>Updating Time allows you to change the quiz access Time assigned to a user. This is useful for resetting access or providing new Time for different quizzes.</p>
            <div className='h-2'></div>
            <p className='text-sm font-semibold text-gray-600'>To update a user's Time:</p>
            <Box>
              <form className='flex flex-col' onSubmit={(e) => updateTime(e, miscController.userId, Number(miscController.value))}>
                <TextField label="User ID"
                value={miscController.userId ?? 0}
                 fullWidth margin="normal" onChange={(e) => setMiscValues(prev => ({
                  ...prev,
                  userId: Number(e.target.value)
                }))} required/> 
                <TextField label="New Time (in minutes)"
                value={miscController.value ?? ''}
                 fullWidth margin="normal" onChange={(e) => setMiscValues(prev => ({
                  ...prev,
                  value: Number(e.target.value)
                }))} required/>
                <Button variant="contained" type='submit' color="primary" className='mt-7'>
                  {loading ? (<Loader className='w-4 h-4 animate-spin'></Loader>) : 'Submit'}
                </Button>
              </form>
            </Box>
          </div>
        )}
      </Modal>
      <Validator/>
    </div>
  );
}