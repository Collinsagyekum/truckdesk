import { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  type: 'success' | 'error' | 'info';
  title?: string;
  message: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Toast({
  type = 'info',
  title,
  message,
  onClose,
  className = '',
}: ToastProps) {
  // Map icons based on toast type
  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  }[type];

  // Specific classes per type
  const typeStyles = {
    success: {
      border: 'border-l-4 border-l-brand-green',
      iconColor: 'text-brand-green',
      titleColor: 'text-brand-green',
      shadow: 'shadow-[0_8px_30px_rgba(34,197,94,0.08)]',
    },
    error: {
      border: 'border-l-4 border-l-brand-red',
      iconColor: 'text-brand-red',
      titleColor: 'text-brand-red',
      shadow: 'shadow-[0_8px_30px_rgba(239,68,68,0.08)]',
    },
    info: {
      border: 'border-l-4 border-l-blue-500',
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-400',
      shadow: 'shadow-[0_8px_30px_rgba(59,130,246,0.08)]',
    },
  }[type];

  return (
    <>
      {/* Self-contained keyframe animations for a premium slide-in layout */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes toast-slide-in {
            0% {
              transform: translateY(0.75rem) scale(0.98);
              opacity: 0;
            }
            100% {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }
          .animate-toast-in {
            animation: toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `
      }} />

      <div
        className={`
          flex items-start gap-3.5 p-4 rounded-lg bg-[#0C1A30]/95 backdrop-blur-md 
          border border-white/5 ${typeStyles.border} ${typeStyles.shadow} 
          min-w-[320px] max-w-md pointer-events-auto transition-all duration-200 
          animate-toast-in ${className}
        `}
        role="alert"
      >
        <Icon className={`w-5 h-5 ${typeStyles.iconColor} shrink-0 mt-0.5`} />

        <div className="flex-1 min-w-0">
          {title && (
            <h4 className={`text-sm font-semibold mb-1 ${typeStyles.titleColor}`}>
              {title}
            </h4>
          )}
          <div className="text-gray-200 text-sm leading-relaxed break-words">
            {message}
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 -mt-1 -mr-1 focus:outline-none focus:ring-1 focus:ring-white/20"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </>
  );
}

export default Toast;
