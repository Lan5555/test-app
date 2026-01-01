import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from './toast';
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
  const {addToast,setStudentInfo, setState} = useToast();
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

    localStorage.setItem('userSession', JSON.stringify({
        type: 'user',
        code: state.credentials.code.toUpperCase(),
        name: state.credentials.email,
        quizId: 2
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
            router.push('/pages/student');
        }else{
            addToast(res.message,'error');
        }
    }catch(e:any){
        addToast(e.message,'error');
    }
  }

  return (
        <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 relative">
            <button
            className="bg-linear-to-tr from-blue-600 to-white rounded-full shadow absolute top-2 right-4 text-black p-2 cursor-pointer"
            onClick={() => setState(false)}>
            <ArrowLeft />
        </button>

      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎓</div>
            <h1 className="text-3xl font-bold text-gray-800">Student Login</h1>
            <p className="text-gray-600 mt-2">Access your dashboard</p>
          </div>

          {/* Error Message */}
          {state.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm font-medium">{state.error}</p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="your.email@school.edu"
                  value={state.credentials.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-black placeholder:text-black"
                />
              </div>
            </div>

            {/* Code Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Access Code
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
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-black placeholder:text-black"
                />
                <button
                  type="button"
                  onClick={toggleShowCode}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition"
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
              className="w-full bg-linear-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 rounded-lg hover:shadow-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-6"
            >
              {state.isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
                  Logging in...
                </span>
              ) : (
                'Login'
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600">
              Need help? <span className="text-indigo-600 font-semibold cursor-pointer hover:text-indigo-800">Contact Support</span>
            </p>
          </div>
        </div>

        {/* Bottom Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Protected by secure authentication</p>
        </div>
      </div>
    </div>
  );
}