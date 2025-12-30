'use client';

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, LogIn, Settings, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { info, useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { ClipLoader } from 'react-spinners';

export default function LoginPage() {
  const router = useRouter();
  const [userType, setUserType] = useState('user'); // 'user' or 'admin'
  const [showPassword, setShowPassword] = useState(false);
  
  // User login state
  const [userCode, setUserCode] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');

  // Admin login state
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const {addToast, setInformation, setQuestionId, loading, setLoading} = useToast();
  const service:CoreService = new CoreService();

  //Question Id
  const [questionIdValue, setQuestionIdValue] = useState<string>('');

  const handleUserLogin = async (e:any) => {
    e.preventDefault();
    setUserError('');
    setUserLoading(true);
    setLoading(true);

    try {
      const response = await service.send('/users/api/verify-code',{
        'email':userEmail,
        'code':userCode
      });
      
      if (!response.success) {
        setUserError(response.message || 'Invalid code');
        setUserLoading(false);
        return;
      }

      // Store user session
      if(userError == ''){
      localStorage.setItem('userSession', JSON.stringify({
        type: 'user',
        code: userCode.toUpperCase(),
        name: userEmail,
        quizId: response.data?.userId
      }));
      const details:info = {
        username: userEmail,
        userId: response.data?.userId,
        attempts:0
      }
      setInformation(details);
      setQuestionId(+questionIdValue!);
      router.push(`/pages/quiz-page`);
      addToast(response.message,'success');
    }else{
      addToast('All parameters not validated. Please try again', 'warning');
      setUserLoading(false);
    }
    } catch (error) {
      setUserError('Failed to connect to server');
      setUserLoading(false);
    }finally{
      setLoading(false);
    }
  };

  const verifyQuestionId = async(val:number) => {
    setLoading(true);
    try{
      const res = await service.send('/question/api/verify-quiz-id', {
        id:val
      });
      if(res.success){
        addToast(res.message,'success')
        setUserError('');
      }else{
        setUserError(res.message ?? '');
        return;
      }
    }catch(e:any){
      addToast(e.message,'error');
    }finally{
      setLoading(false);
    }
  }

  const handleAdminLogin = async (e:any) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);
    try{
      const res = await service.send('/users/api/login-admin',{
        password:adminPassword.trim()
      });
      if(res.success){
        addToast(res.message,'success');
         router.push('/pages/admin');

      }else{
        setAdminError(res.message);
        setAdminLoading(false);
        addToast(res.message,'warning');
      }
    }catch(e:any){
     addToast(e.message,'warning');
    }
    setAdminError('');
    setAdminLoading(false);

  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4 overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-linear-to-br from-purple-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-linear-to-tr from-blue-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-linear-to-br from-pink-300 to-transparent rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-md w-full relative z-10">
        {/* Toggle Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setUserType('user')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition transform ${
              userType === 'user'
                ? 'bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                : 'bg-white/60 backdrop-blur-xl border border-gray-200 text-gray-700 hover:border-purple-400'
            }`}
          >
            <LogIn className="w-5 h-5 inline mr-2" />
            Student
          </button>
          <button
            onClick={() => setUserType('admin')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition transform ${
              userType === 'admin'
                ? 'bg-linear-to-r from-purple-600 to-pink-600 text-white shadow-lg scale-105'
                : 'bg-white/60 backdrop-blur-xl border border-gray-200 text-gray-700 hover:border-purple-400'
            }`}
          >
            <Settings className="w-5 h-5 inline mr-2" />
            Admin
          </button>
        </div>

        {/* Student Login Form */}
        {userType === 'user' && (
          <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-3xl p-8 shadow-2xl animate-in fade-in duration-300">
            <div className="flex items-center justify-center w-14 h-14 bg-linear-to-br from-purple-600 to-pink-600 rounded-full mx-auto mb-6 shadow-lg">
              <Zap className="w-7 h-7 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">Welcome Back</h1>
            <p className="text-gray-600 text-center mb-8">Enter your quiz code to get started</p>

            <form onSubmit={handleUserLogin}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none font-semibold transition text-black placeholder:text-gray-400"
                  required
                />
              </div>

             <div className="mb-8">
                <div className="grid grid-cols-2 gap-4">
                  {/* Quiz Code Input */}
                  <div className="group">
                    <label className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">1</span>
                      </div>
                      Quiz Code
                    </label>
                    <input
                      type="text"
                      value={userCode}
                      onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                      placeholder="ABC123"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none font-bold text-center tracking-widest transition duration-200 text-gray-900 placeholder:text-gray-400 bg-white/80 backdrop-blur-sm"
                      required
                    />
                    <p className="text-xs text-gray-600 mt-2 font-medium">6 character code</p>
                  </div>

                  {/* Quiz ID Input */}
                  <div className="group">
                    <label className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <span className="text-white text-xs font-bold">2</span>
                      </div>
                      Quiz ID
                    </label>
                    <input
                      type="text"
                      value={questionIdValue}
                      onChange={async(e) => {
                        setQuestionIdValue(e.target.value ?? '');
                        const val = e.target.value;
                        await verifyQuestionId(+val);
                      }
                      } 
                      placeholder="eg, 2"
                      maxLength={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none font-bold text-center tracking-widest transition duration-200 text-gray-900 placeholder:text-gray-400 bg-white/80 backdrop-blur-sm"
                      required
                    />
                    <p className="text-xs text-gray-600 mt-2 font-medium">Max 3 digit ID</p>
                  </div>
                </div>

                {/* Helper Text */}
                <div className="mt-5 p-4 bg-linear-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-purple-500 shrink-0 flex items-center justify-center mt-0.5">
                    <span className="text-white text-xs font-bold">i</span>
                  </div>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">Your instructor will provide both the quiz code and ID.</span>
                    <br />
                    <span className="text-gray-600">Enter them exactly as provided to join the quiz.</span>
                  </p>
                </div>
              </div>
              
              { loading ? 
              <div className='flex justify-center items-center'>
              <ClipLoader color={'blue'} size={20}/> 
              </div>:
              userError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm font-semibold">
                  {userError}
                </div>
              )}

              <button
                type="submit"
                disabled={userLoading}
                className="w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {userLoading ? 'Verifying...' : 'Join Quiz'}
              </button>
            </form>
          </div>
        )}

        {/* Admin Login Form */}
        {userType === 'admin' && (
          <div className="bg-white/70 backdrop-blur-xl border-2 border-white/80 rounded-3xl p-8 shadow-2xl animate-in fade-in duration-300">
            <div className="flex items-center justify-center w-14 h-14 bg-linear-to-br from-blue-600 to-cyan-600 rounded-full mx-auto mb-6 shadow-lg">
              <Lock className="w-7 h-7 text-white" />
            </div>

            <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">Admin Panel</h1>
            <p className="text-gray-600 text-center mb-8">Create and manage quizzes</p>

            <form onSubmit={handleAdminLogin}>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none font-semibold transition text-black placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-900"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-lg text-red-700 text-sm font-semibold">
                  {adminError}
                </div>
              )}

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {adminLoading ? 'Authenticating...' : 'Access Admin Panel'}
              </button>
            </form>

            <p className="text-xs text-gray-500 text-center mt-6">
              Input required access pass
            </p>
          </div>
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