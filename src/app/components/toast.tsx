'use client'
import { useState, useCallback, useEffect, createContext, useContext, ReactNode, FC } from 'react';
import { X, Check, AlertCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface IToast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  information: info | undefined,
  setInformation: (val:info) => void,
  questionId: number;
  setQuestionId: (id:number) => void;
  loading:boolean;
  setLoading: (val:boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProps {
  message: string;
  type: ToastType;
  duration: number;
  onClose: () => void;
}

const Toast: FC<ToastProps> = ({ message, type, duration, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-amber-50 border-amber-200',
  };

  const textColor: Record<ToastType, string> = {
    success: 'text-green-900',
    error: 'text-red-900',
    info: 'text-blue-900',
    warning: 'text-amber-900',
  };

  const iconColor: Record<ToastType, string> = {
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    warning: 'text-amber-500',
  };

  const icons: Record<ToastType, ReactNode> = {
    success: <Check className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${bgColor[type]} shadow-lg animate-in fade-in slide-in-from-right-4 duration-300`}>
      <div className={iconColor[type]}>{icons[type]}</div>
      <p className={`flex-1 text-sm font-medium ${textColor[type]}`}>{message}</p>
      <button
        onClick={onClose}
        className={`p-1 hover:bg-white/50 rounded transition-colors ${textColor[type]}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: IToast[];
  removeToast: (id: string) => void;
}

const ToastContainer: FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-md pointer-events-auto">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export type info = {
  username:string;
  userId:number;
  attempts:number
}

export const ToastProvider: FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<IToast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  //====== New providers ======= //
  const [information, setUserInformation] = useState<info>();
  const [questionId, setQuestionId] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  return (
    <ToastContext.Provider value={{
       addToast ,
       information,
       setInformation: setUserInformation,
       questionId,setQuestionId,
       loading,setLoading
      }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

