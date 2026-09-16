"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Swords,
  X,
} from "lucide-react";

export type LiveLogTone = "combat" | "break" | "system" | "danger";

export interface LiveLog {
  id: number;
  message: string;
  tone: LiveLogTone;
}

interface Props {
  logs: LiveLog[];
  onDismiss: (id: number) => void;
}

const toneStyles: Record<LiveLogTone, { border: string; icon: typeof Swords }> =
  {
    combat: { border: "border-cyan-200/35", icon: Swords },
    break: { border: "border-amber-200/60", icon: ShieldAlert },
    system: { border: "border-white/20", icon: CheckCircle2 },
    danger: { border: "border-red-300/45", icon: AlertTriangle },
  };

export default function LiveLogToast({ logs, onDismiss }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-60 flex flex-col items-end gap-2 sm:left-auto sm:max-w-md">
      {logs.map((log) => {
        const Icon = toneStyles[log.tone].icon;
        return (
          <div
            key={log.id}
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-[#10161b]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-md sm:w-96 ${toneStyles[log.tone].border}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-cyan-200" />
            <span className="flex-1 leading-5">{log.message}</span>
            <button
              type="button"
              aria-label="Dismiss live log"
              onClick={() => onDismiss(log.id)}
              className="text-white/35 transition hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
