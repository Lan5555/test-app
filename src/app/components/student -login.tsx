import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, GraduationCap, Sparkles, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { sessionType, useToast } from './toast';
import { CoreService } from '../helpers/api-handler';
import { Users } from '../helpers/factories';

interface LoginCredentials {
  email: string;
  code: string;
}

interface LoginState {
  credentials: LoginCredentials;
  showCode: boolean;
  isLoading: boolean;
  error: string;
}

export default function StudentLoginModal() {
  const [state, setLoginState] = useState<LoginState>({
    credentials: {
      email: '',
      code: ''
    },
    showCode: false,
    isLoading: false,
    error: ''
  });
  const router = useRouter();
  const {addToast,setStudentInfo, setState, setSessionData} = useToast();
  const service:CoreService = new CoreService();

  const handleInputChange = (field: keyof LoginCredentials, value: string): void => {
    setLoginState(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [field]: value
      },
      error: ''
    }));
  };

  const toggleShowCode = (): void => {
    setLoginState(prev => ({
      ...prev,
      showCode: !prev.showCode
    }));
  };

  const handleLogin = async (): Promise<void> => {
    if (!state.credentials.email || !state.credentials.code) {
      setLoginState(prev => ({
        ...prev,
        error: 'Please fill in all fields'
      }));
      return;
    }

    if (!state.credentials.email.includes('@')) {
      setLoginState(prev => ({
        ...prev,
        error: 'Please enter a valid email'
      }));
      return;
    }

    setLoginState(prev => ({
      ...prev,
      isLoading: true,
      error: ''
    }));

    await login(state.credentials.email, state.credentials.code);
    setLoginState(prev => ({
        ...prev,
        isLoading: false,
        error: ''
    }));

    
    
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  const login = async(email: string, code: string) => {
    try {
        const res = await service.send('/users/api/login-student', {
            email,
            code
        });
        if(res.success){
            const result = Users.fromJson(res.data!);
            setStudentInfo(result);
            addToast(res.message,'success');
            const sessionData: sessionType = {
            type: 'user',
            code: state.credentials.code.toUpperCase(),
            name: state.credentials.email,
            quizId: 2,
            token: res.data?.token
            }
            setSessionData(sessionData);
            sessionStorage.setItem('userSession', JSON.stringify({
            type: 'user',
            code: state.credentials.code.toUpperCase(),
            name: state.credentials.email,
            quizId: 2,
            token: res.data?.token
          }));
          
            router.push('/pages/student');
        }else{
            addToast(res.message,'error');
        }
    }catch(e:any){
        addToast(e.message,'error');
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 overflow-hidden relative font-sans">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <button
        className="absolute top-8 left-8 z-50 flex items-center justify-center py-2.5 px-6 rounded-full font-medium transition-all duration-300 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 shadow-sm"
        onClick={() => setState(false)}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        <span className="text-sm tracking-tight">Back to Portal</span>
      </button>

      <div className="w-full max-w-[440px] relative z-10">
        {/* Card Container */}
        <div className="bg-white rounded-[32px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-2xl mb-6 relative">
              <GraduationCap className="w-8 h-8 text-indigo-600" />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Student Dashboard</h1>
            <p className="text-slate-500 text-sm">Enter your credentials to access your learning portal</p>
          </div>

          {/* Error Message */}
          {state.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-center">
              <p className="text-red-600 text-sm font-medium">{state.error}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                Institutional Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="your.email@school.edu"
                  value={state.credentials.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-slate-900 placeholder:text-slate-300 bg-slate-50/30"
                />
              </div>
            </div>

            {/* Code Field */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                Personal Access Code
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type={state.showCode ? 'text' : 'password'}
                  placeholder="Enter your code"
                  value={state.credentials.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  onKeyPress={handleKeyPress}
                  maxLength={6}
                  className="w-full pl-12 pr-12 py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-slate-900 placeholder:text-slate-300 bg-slate-50/30 font-mono tracking-widest"
                />
                <button
                  type="button"
                  onClick={toggleShowCode}
                  className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  {state.showCode ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={state.isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-[0_10px_20px_rgba(79,70,229,0.2)] hover:shadow-[0_15px_25px_rgba(79,70,229,0.3)] active:scale-[0.98] mt-4"
            >
              {state.isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
                  Logging in...
                </span>
              ) : (
                'Access Dashboard'
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-center text-xs text-slate-500">
              Need help? <span className="text-indigo-600 font-bold cursor-pointer hover:underline">Contact Support</span>
            </p>
          </div>
        </div>

        {/* Bottom Info */}
        <p className="mt-8 text-center text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secure Student Authentication Protocol
        </p>
      </div>
    </div>
  );
}