'use client';

import React, { useState, useEffect, JSX, useCallback } from 'react';
import { 
  Plus, Trash2, Copy, LogOut, Settings, Lock, Share2, Check, X, 
  Eye, Edit2, Save, ArrowLeft, Users, BarChart3, Zap, Loader, 
  User2, Code, MoreHorizontal, Divide, Space, Menu, ChevronLeft,
  Home, BookOpen, TrendingUp, Award, Bell, Search, Filter,
  Calendar, Clock, Star, TrendingDown, Activity, PieChart,
  Download,
  Moon, Sun, Monitor, Globe, BellRing, ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AddUserModal from '@/app/components/add-user';
import { useToast } from '@/app/components/toast';
import { generateId, generateSmallNumbers } from '@/app/helpers/id-generator';
import { CoreService } from '@/app/helpers/api-handler';
import UpdateUserCode from '@/app/components/update-code';
import { Users as Person } from '@/app/helpers/factories';
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
  const [admin, setAdmin] = useState<AdminSession>();

  // Browser Settings State
  const [settings, setSettings] = useState({
    darkMode: false,
    notifications: true,
    language: 'English',
    autoSave: true
  });

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
    completionRate: 78,
    activeQuizzes: 0,
    passRate: 65
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
    loadMockActivities();
    setAdminSession();
  }, [router]);

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
        setQuizzes((response.data as Quiz[]) || []);
        setStats(prev => ({
          ...prev,
          activeQuizzes: (response.data as Quiz[])?.length || 0
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
      <aside className={`${sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 lg:w-20'} bg-white border-r border-slate-100 shadow-xl transition-all duration-300 flex flex-col fixed lg:sticky top-0 h-screen z-30 text-slate-600`}>
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">QuizMaster</h1>
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
                <p className="text-sm font-bold text-slate-900">{admin.name || 'Admin User'}</p>
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
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 lg:px-8 py-4">
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
                  <p className="text-sm font-semibold text-gray-900">{admin.name || 'Admin User'}</p>
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
              <div className="bg-slate-900 rounded-4xl p-8 mb-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full -mr-10 -mt-10"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-black mb-2 tracking-tight">Welcome back, Admin!</h2>
                    <p className="text-slate-400 font-medium">Here's what's happening with your platform today.</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                    <Calendar className="w-8 h-8" />
                  </div>
                </div>
                <div className="mt-6 flex gap-4">
                  <div className="bg-slate-800 rounded-xl px-4 py-2 border border-slate-700">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Today's Date</p>
                    <p className="text-sm font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                  <p className="text-3xl font-bold text-gray-900">{stats.averageScore || 0}%</p>
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
                  <p className="text-3xl font-bold text-gray-900">{stats.completionRate || 78}%</p>
                  <p className="text-xs text-green-600 mt-2">+5% from last month</p>
                </div>
              </div>

              {/* Recent Activity & Quick Actions */}
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Recent Activity */}
                <div className="bg-white rounded-4xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Latest updates</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {recentActivities.map((activity) => (
                      <div key={activity.id} className="p-4 hover:bg-gray-50 transition">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1">
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
                <div className="bg-white rounded-4xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100">
                  <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Common tasks</p>
                  </div>
                  <div className="p-6 space-y-4">
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
                          <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2">
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
                          <span className="font-bold text-indigo-600">{stats.completionRate || 78}%</span>
                        </div>
                        <LinearProgress variant="determinate" value={stats.completionRate || 78} className="h-2.5 rounded-full bg-indigo-50" sx={{ '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Average Pass Rate</span>
                          <span className="font-bold text-green-600">{stats.passRate || 65}%</span>
                        </div>
                        <LinearProgress variant="determinate" value={stats.passRate || 65} className="h-2.5 rounded-full bg-green-50" color="success" sx={{ '& .MuiLinearProgress-bar': { borderRadius: 5 } }} />
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
                      {[40, 65, 85, 50, 75, 90, 60].map((height, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div 
                            className="w-full bg-indigo-100 hover:bg-indigo-500 transition-colors rounded-t-lg relative group"
                            style={{ height: `${height}%` }}
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                              {height}%
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">Q{i+1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-600" />
                    Top Performing Students
                  </h3>
                  <div className="space-y-4">
                    {user.slice(0, 5).map((student, index) => (
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
                  </div>
                </div>
              </div>
            </>
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
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

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
      
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Miscellaneous Actions">
        <div className='flex justify-around gap-20'>
          <Button className='text-black' onClick={() => setIsAttemptUpdate(false)}>Update Attempt</Button>
          <Button className='text-black' onClick={() => setIsAttemptUpdate(true)}>Update Code</Button>
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