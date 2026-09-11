"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Change this when content changes to re-trigger the fade. */
  trigger?: string | number;
  /** Duration in ms. Defaults to 400. */
  duration?: number;
  /** Optional className merged onto the wrapper. */
  className?: string;
  children: React.ReactNode;
}

export default function FadeIn({
  trigger,
  duration = 400,
  className = "",
  children,
}: Props) {
  const [key, setKey] = useState(0);
  const prev = useRef(trigger);

  useEffect(() => {
    if (prev.current !== trigger) {
      prev.current = trigger;
      setKey((k) => k + 1);
    }
  }, [trigger]);

  return (
    <div
      key={key}
      className={`fade-in ${className}`}
      style={{ animationDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
}