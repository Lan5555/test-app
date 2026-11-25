"use client";

import { KeyRound } from "lucide-react";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  type AutomationOperation,
  type AutomationResult,
  automationStore,
} from "../persistence";

interface Session {
  connected: boolean;
  verified: boolean;
  connect(key: string): void;
  disconnect(): void;
  run(
    task: AutomationOperation,
    input: string,
    signal: AbortSignal,
  ): Promise<AutomationResult>;
}
const Context = createContext<Session | undefined>(undefined);

export function BlueprintAiProvider({ children }: { children: ReactNode }) {
  const key = useRef("");
  const [connected, setConnected] = useState(false);
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    const reset = () => {
      key.current = "";
      setConnected(false);
      setVerified(false);
    };
    window.addEventListener("pagehide", reset);
    return () => {
      key.current = "";
      window.removeEventListener("pagehide", reset);
    };
  }, []);
  return (
    <Context.Provider
      value={{
        connected,
        verified,
        connect(value) {
          key.current = value;
          setConnected(true);
          setVerified(false);
        },
        disconnect() {
          key.current = "";
          setConnected(false);
          setVerified(false);
        },
        async run(task, input, signal) {
          const current = key.current;
          if (!current)
            throw new Error(
              "Connect an OpenAI key in Studio settings before running AI nodes.",
            );
          const result = await automationStore.run(
            current,
            task,
            input,
            signal,
          );
          if (current === key.current) setVerified(true);
          return result;
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useBlueprintAi() {
  const session = useContext(Context);
  if (!session) throw new Error("Blueprint AI requires the Studio layout.");
  return session;
}

export function AiConnection({ disabled = false }: { disabled?: boolean }) {
  const session = useBlueprintAi();
  const inputId = useId();
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("apiKey");
    const key = typeof value === "string" ? value.trim() : "";
    if (!/^sk-[!-~]{16,300}$/.test(key)) {
      setError("Enter an OpenAI API key beginning with sk-.");
      return;
    }
    setError("");
    session.connect(key);
    event.currentTarget.reset();
  }
  return (
    <div className="bp-automation-panel">
      <h3>
        <KeyRound size={17} /> OpenAI connection
      </h3>
      {session.connected ? (
        <>
          <output className="bp-automation-connection">
            {session.verified
              ? "Verified by a completed run"
              : "Key ready to use"}
          </output>
          <button
            type="button"
            disabled={disabled}
            onClick={session.disconnect}
          >
            Disconnect key
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor={inputId}>OpenAI API key</label>
          <input
            id={inputId}
            name="apiKey"
            type="password"
            autoComplete="off"
            maxLength={303}
            disabled={disabled}
            spellCheck={false}
            required
          />
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={disabled}>
            Use key for this session
          </button>
        </form>
      )}
      <p className="bp-automation-note">
        The key stays in memory while you move between Studio screens. AI tasks
        send their inputs to OpenAI and can use your API quota.
      </p>
    </div>
  );
}
