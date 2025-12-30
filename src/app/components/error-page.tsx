'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';

interface ErrorPageProps {
  errorCode?: string;
  errorMessage?: string;
  errorDescription?: string;
  showHomeButton?: boolean;
}

export default function ErrorPage({
  errorCode = '500',
  errorMessage = 'Something went wrong',
  errorDescription = 'We encountered an unexpected error. Please try again or contact support.',
  showHomeButton = true
}: ErrorPageProps) {
  const router = useRouter();

  const handleGoBack = () => {
    router.back();
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const getErrorColor = () => {
    const code = parseInt(errorCode);
    if (code === 404) return 'from-yellow-500 to-orange-500';
    if (code === 403) return 'from-red-500 to-pink-500';
    if (code >= 500) return 'from-red-500 to-rose-500';
    return 'from-blue-500 to-purple-500';
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
      `}</style>

      {/* Main error container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Error card */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Error icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-20 h-20 rounded-full bg-linear-to-br ${getErrorColor()} flex items-center justify-center shadow-lg`}>
              <AlertCircle className="w-10 h-10 text-white" strokeWidth={1.5} />
            </div>
          </div>

          {/* Error code */}
          <div className="text-center mb-4">
            <p className="text-6xl font-bold text-transparent bg-clip-text bg-linear-to-r from-red-400 to-pink-400 mb-2">
              {errorCode}
            </p>
            <h1 className="text-2xl font-bold text-white mb-3">{errorMessage}</h1>
            <p className="text-gray-300 text-sm leading-relaxed">{errorDescription}</p>
          </div>

          {/* Divider */}
          <div className="my-6 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"></div>

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Back button */}
            <button
              onClick={handleGoBack}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 hover:border-white/50 text-white font-semibold transition duration-200 backdrop-blur-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>

            {/* Home button */}
            {showHomeButton && (
              <button
                onClick={handleGoHome}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-linear-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition duration-200 shadow-lg hover:shadow-purple-500/50"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            )}
          </div>

          {/* Support message */}
          <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
            <p className="text-xs text-blue-200">
              Need help? <a href="mailto:support@example.com" className="font-semibold hover:text-blue-100 underline">Contact Support</a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-6">
          Error ID: {Math.random().toString(36).substring(7).toUpperCase()}
        </p>
      </div>
    </div>
  );
}