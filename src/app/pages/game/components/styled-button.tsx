'use client';

import React from "react";

interface WutheringButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name?: string;
  children?: React.ReactNode;
}

const WutheringButton: React.FC<WutheringButtonProps> = ({
  name,
  children,
  onClick,
  className = "",
  disabled,
  ...props
}) => {
  return (
    <div
      className={`
        relative inline-block p-0.5 transition-all duration-300
        bg-linear-to-r from-[#00f0ff]/80 via-white/20 to-[#00f0ff]/80
        hover:from-[#00f0ff] hover:via-white hover:to-[#00f0ff]
        hover:drop-shadow-[0_0_12px_rgba(0,240,255,0.7)]
        [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]
        ${disabled ? "opacity-40 pointer-events-none" : "cursor-pointer"}
        ${className}
      `}
    >
      <button
        {...props}
        disabled={disabled}
        onClick={onClick}
        className={`
          relative w-full px-10 py-3.5 text-sm font-bold tracking-[2px] uppercase
          text-[#00f0ff] bg-[rgba(10,15,25,0.85)] border-none outline-none
          transition-all duration-200 ease-out
          hover:bg-[#00f0ff] hover:text-black
          active:scale-95
          [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]
        cursor-pointer`}
      >
        <span className="relative z-10 pointer-events-none">
          {children || name || "INITIALIZE"}
        </span>
      </button>
    </div>
  );
};

export default WutheringButton;