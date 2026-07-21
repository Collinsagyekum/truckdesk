import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  leftIcon,
  rightIcon,
  type = 'button',
  ...props
}: ButtonProps) {
  // Base classes for premium styling with micro-animations
  const baseClasses = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-250 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy-900 disabled:opacity-50 disabled:pointer-events-none disabled:scale-100 active:scale-[0.98] select-none';

  // Variant classes mapping to the requested brand colors:
  // - primary: Brand green (#22C55E)
  // - secondary: Navy-700 (#162B55)
  // - danger: Brand red (#EF4444)
  const variantClasses = {
    primary: 'bg-brand-green text-navy-900 shadow-[0_4px_12px_rgba(34,197,94,0.2)] hover:bg-[#2efc73] hover:shadow-[0_6px_16px_rgba(34,197,94,0.35)] focus:ring-brand-green/50',
    secondary: 'bg-navy-700 text-white border border-white/10 hover:bg-navy-600 hover:border-white/20 hover:shadow-[0_4px_12px_rgba(0,0,0,0.25)] focus:ring-navy-700/50',
    danger: 'bg-brand-red text-white shadow-[0_4px_12px_rgba(239,68,68,0.2)] hover:bg-[#ff5555] hover:shadow-[0_6px_16px_rgba(239,68,68,0.35)] focus:ring-brand-red/50',
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-7 py-3 text-base gap-2.5',
  };

  // Spinner sizes
  const spinnerSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={`${spinnerSizes[size]} animate-spin`} />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      
      <span>{children}</span>
      
      {!isLoading && rightIcon && (
        <span className="inline-flex shrink-0">{rightIcon}</span>
      )}
    </button>
  );
}

export default Button;
