"use client";
import {
  createContext,
  type FC,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { Users } from "../helpers/factories";
import {
  type ToastType,
  toastDuration,
  toastMessage,
} from "./notifications/model";
import ToastCard from "./notifications/toast-card";

interface IToast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  information: info | undefined;
  setInformation: (val: info) => void;
  questionId: number;
  setQuestionId: (id: number) => void;
  loading: boolean;
  setLoading: (val: boolean) => void;
  studentsInfo: Users;
  setStudentInfo: (user: Users) => void;
  state: boolean;
  setState: (val: boolean) => void;
  sessionData: sessionType | null;
  setSessionData: (data: sessionType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export type info = {
  username: string;
  userId: number;
  attempts: number;
  time: number;
};

export type sessionType = {
  type: string;
  code: string;
  name: string;
  quizId: number;
  token: string;
};

export const ToastProvider: FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<IToast[]>([]);

  const nextId = useRef(0);
  const addToast = useCallback(
    (value: string, type: ToastType = "info", duration?: number) => {
      const message = toastMessage(value);
      if (!message) return;
      const id = String(++nextId.current);
      setToasts((previous) =>
        previous.some(
          (toast) => toast.message === message && toast.type === type,
        )
          ? previous
          : [
              ...previous,
              { id, message, type, duration: toastDuration(type, duration) },
            ],
      );
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  //====== New providers ======= //
  const [information, setUserInformation] = useState<info>();
  const [questionId, setQuestionId] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [studentsInfo, setStudentInfo] = useState<Users>({
    email: "",
    name: "",
    score: 0,
    codeInfo: {},
    id: 0,
    code: "",
    time: 0,
    deadline: null,
    currentProgram: "",
    activated: false,
    quizId: 0,
  });
  const [state, setState] = useState<boolean>(false);
  const [sessionData, setSessionData] = useState<sessionType | null>(null);

  return (
    <ToastContext.Provider
      value={{
        addToast,
        information,
        setInformation: setUserInformation,
        questionId,
        setQuestionId,
        loading,
        setLoading,
        studentsInfo,
        setStudentInfo,
        state,
        setState,
        sessionData,
        setSessionData,
      }}
    >
      {children}
      <section className="hub-toast-region" aria-label="Notifications">
        {toasts.slice(0, 3).map((toast) => (
          <ToastCard
            key={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        ))}
        {toasts.length > 1 && (
          <div className="hub-toast-queue">
            <span>
              {toasts.length > 3
                ? `${toasts.length - 3} more notification${toasts.length - 3 === 1 ? "" : "s"} queued`
                : `${toasts.length} notifications`}
            </span>
            <button type="button" onClick={() => setToasts([])}>
              Dismiss all
            </button>
          </div>
        )}
      </section>
    </ToastContext.Provider>
  );
};
