'use client';

import React from "react";

interface CustomInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  onValueChange?: (value: string) => void;
}

const CustomInput: React.FC<CustomInputProps> = ({
  leadingIcon,
  trailingIcon,
  placeholder = "",
  onChange,
  onValueChange,
  className = "",
  disabled,
  ...restProps
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e);
    if (onValueChange) onValueChange(e.target.value);
  };

  return (
    <div
      className={`
        flex items-center justify-between gap-2 px-3 py-1 
        border border-white rounded-tl-[10px] rounded-br-[10px] 
        transition-all duration-200
        focus-within:ring-2 focus-within:ring-white/50 focus-within:border-white
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {/* Left section: Optional leading icon + text input */}
      <div className="flex items-center gap-2 flex-1">
        {leadingIcon && (
          <span className="flex items-center justify-center shrink-0 text-white">
            {leadingIcon}
          </span>
        )}
        
        <input
          {...restProps}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handleChange}
          className="w-full bg-transparent text-white placeholder:text-white outline-none border-none py-1.5 text-sm"
        />
      </div>

      {/* Right section: Optional trailing icon */}
      {trailingIcon && (
        <span className="flex items-center justify-center shrink-0 text-white">
          {trailingIcon}
        </span>
      )}
    </div>
  );
};

export default CustomInput;