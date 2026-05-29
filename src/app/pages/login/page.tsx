'use client';
import React, { useState } from 'react';
import { Lock, Eye, EyeOff, LogIn, Settings, Zap, Book, ShieldCheck, GraduationCap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { info, useToast } from '@/app/components/toast';
import { CoreService } from '@/app/helpers/api-handler';
import { ClipLoader } from 'react-spinners';
import StudentLoginModal from '@/app/components/student -login';
import { useMediaQuery } from '@/app/components/media';



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
  const {addToast, setInformation, setQuestionId, loading, setLoading, state, setState} = useToast();
  const service:CoreService = new CoreService();

  //Question Id
  const [questionIdValue, setQuestionIdValue] = useState<string>('');
  //state

  //MediaQuery
  const isMobile = useMediaQuery("(max-width: 768px)");



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
      sessionStorage.setItem('userSession', JSON.stringify({
        type: 'user',
        code: userCode.toUpperCase(),
        name: userEmail,
        quizId: response.data?.userId,
        token: response.data?.token
      }));
      
      
      const details:info = {
        username: userEmail,
        userId: response.data?.userId,
        attempts:0,
        time: response.data?.time
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
        sessionStorage.setItem('adminSession', JSON.stringify({
        type: 'admin',
        token: res.data?.token,
        name: res.data?.name,
        email: res.data?.email
      }));
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

  if(state) return <StudentLoginModal/>

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4 overflow-hidden relative font-sans">
      {/* Student Dashboard */}
      <div className={`absolute ${isMobile ? 'bottom-6 right-6' : 'top-8 left-8'} z-50 flex gap-3`}>
        <button
          onClick={() => setState(true)}
          className="flex items-center justify-center py-2.5 px-6 rounded-full font-medium transition-all duration-300 bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 shadow-sm"
        >
          <GraduationCap className="w-4 h-4 mr-2" />
          <span className="text-sm tracking-tight">{isMobile ? 'Portal' : 'Student Portal'}</span>
        </button>
      </div>

      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 rounded-full blur-[120px] animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-purple-100/40 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-[440px] w-full relative z-10">
        {/* Toggle Buttons */}
        <div className="flex p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl mb-10 border border-slate-200/50 shadow-inner">
          <button
            onClick={() => setUserType('user')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              userType === 'user'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Student
          </button>
          <button
            onClick={() => setUserType('admin')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              userType === 'admin'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Admin
          </button>
        </div>

        {/* Student Login Form */}
        {userType === 'user' && (
          <div className="bg-white rounded-[32px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 rounded-2xl mb-6">
                <Zap className="w-8 h-8 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Student Access</h1>
              <p className="text-slate-500 text-sm">Enter your credentials to begin the assessment</p>
            </div>

            <form onSubmit={handleUserLogin}>
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="name@university.edu"
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-slate-900 placeholder:text-slate-300 bg-slate-50/30"
                  required
                />
              </div>

             <div className="mb-10">
                <div className="grid grid-cols-2 gap-5">
                  {/* Quiz Code Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Pass Code</label>
                    <input
                      type="text"
                      value={userCode}
                      onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                      placeholder="••••••"
                      maxLength={6}
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none font-bold text-center tracking-[0.2em] transition-all text-slate-900 placeholder:text-slate-300 bg-slate-50/30"
                      required
                    />
                  </div>

                  {/* Quiz ID Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Quiz ID</label>
                    <input
                      type="text"
                      value={questionIdValue}
                      onChange={async(e) => {
                        setQuestionIdValue(e.target.value ?? '');
                        const val = e.target.value;
                        await verifyQuestionId(+val);
                      }
                      } 
                      placeholder="000"
                      maxLength={3}
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none font-bold text-center transition-all text-slate-900 placeholder:text-slate-300 bg-slate-50/30"
                      required
                    />
                  </div>
                </div>
              </div>
              
              { loading ? 
              <div className='flex justify-center items-center py-2'>
              <ClipLoader color={'#4f46e5'} size={24}/> 
              </div>:
              userError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium text-center">
                  {userError}
                </div>
              )}

              <button
                type="submit"
                disabled={userLoading || userError != ''}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-[0_10px_20px_rgba(79,70,229,0.2)] hover:shadow-[0_15px_25px_rgba(79,70,229,0.3)] active:scale-[0.98]"
              >
                {userLoading ? 'Verifying...' : 'Join Quiz'}
              </button>
            </form>
          </div>
        )}

        {/* Admin Login Form */}
        {userType === 'admin' && (
          <div className="bg-white rounded-[32px] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-50 rounded-2xl mb-6">
                <Lock className="w-8 h-8 text-slate-700" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">Admin Portal</h1>
              <p className="text-slate-500 text-sm">Secure access for faculty members</p>
            </div>

            <form onSubmit={handleAdminLogin}>
              <div className="mb-10">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Security Key</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-5 py-3.5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all text-slate-900 placeholder:text-slate-300 bg-slate-50/30"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-medium text-center">
                  {adminError}
                </div>
              )}

              <button
                type="submit"
                disabled={adminLoading}
                className="w-full bg-slate-900 hover:bg-black disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-[0_10px_20px_rgba(0,0,0,0.1)] active:scale-[0.98]"
              >
                {adminLoading ? 'Authenticating...' : 'Enter Dashboard'}
              </button>
            </form>
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