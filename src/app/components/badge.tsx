import React from 'react';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  label: string;
  icon?: React.ReactNode;
  variant?: BadgeVariant;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  children: React.ReactNode;
}

const variants: Record<BadgeVariant, string> = {
  primary: 'bg-indigo-600 text-white',
  success: 'bg-green-600 text-white',
  warning: 'bg-orange-500 text-white',
  danger: 'bg-red-600 text-white',
};

const positions: Record<string, string> = {
  'top-right': '-top-1 right-0.5',
  'top-left': '-top-2 -left-2',
  'bottom-right': '-bottom-2 -right-2',
  'bottom-left': '-bottom-2 -left-2',
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  icon,
  variant = 'primary',
  position = 'top-right',
  children,
}) => {
  return (
    <div className="relative inline-block">
      {/* Badge */}
      <span
        className={`absolute z-20 flex items-center gap-1.5 p-1 rounded-full text-xs font-bold animate-pulse shadow-lg ${variants[variant]} ${positions[position]}`}
      >
        {icon && <span className="w-3 h-3">{icon}</span>}
        {label}
      </span>

      {/* Wrapped content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
