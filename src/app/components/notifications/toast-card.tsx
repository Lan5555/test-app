"use client";

import { AlertCircle, Check, Info, TriangleAlert, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { remainingToastTime, type ToastType } from "./model";
import "./toasts.css";

const appearances = {
  success: { title: "Success", icon: Check },
  error: { title: "Something went wrong", icon: AlertCircle },
  warning: { title: "Please check", icon: TriangleAlert },
  info: { title: "Good to know", icon: Info },
};

export function ToastCardView({
  message,
  type,
  duration,
  paused = false,
  onClose,
  onHover,
  onFocus,
}: {
  message: string;
  type: ToastType;
  duration: number;
  paused?: boolean;
  onClose: () => void;
  onHover?: (value: boolean) => void;
  onFocus?: (value: boolean) => void;
}) {
  const { title, icon: Icon } = appearances[type];
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Hover and focus only pause dismissal; the live region has no click action.
    <div
      className={`hub-toast hub-toast-${type}`}
      role={type === "error" ? "alert" : "status"}
      aria-atomic="true"
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onFocusCapture={() => onFocus?.(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          onFocus?.(false);
      }}
    >
      <span className="hub-toast-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="hub-toast-copy">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <button
        type="button"
        className="hub-toast-close"
        onClick={onClose}
        aria-label={`Dismiss ${type} notification`}
      >
        <X size={16} />
      </button>
      {duration > 0 && (
        <span className="hub-toast-track" aria-hidden="true">
          <span
            style={
              {
                "--toast-duration": `${duration}ms`,
                animationPlayState: paused ? "paused" : "running",
              } as CSSProperties
            }
          />
        </span>
      )}
    </div>
  );
}

export default function ToastCard({
  message,
  type,
  duration,
  onClose,
}: {
  message: string;
  type: ToastType;
  duration: number;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const remaining = useRef(duration);
  const close = useRef(onClose);
  const paused = hovered || focused || hidden;
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (duration <= 0 || paused) return;
    const started = Date.now();
    const timer = setTimeout(() => close.current(), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = remainingToastTime(
        remaining.current,
        started,
        Date.now(),
      );
    };
  }, [duration, paused]);
  return (
    <ToastCardView
      message={message}
      type={type}
      duration={duration}
      paused={paused}
      onClose={onClose}
      onHover={setHovered}
      onFocus={setFocused}
    />
  );
}
