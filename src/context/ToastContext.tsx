import { createContext, useState, useCallback, ReactNode } from 'react';
import Toast from '../components/ui/Toast';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ToastContextType {
  showSuccess: (msg: string, duration?: number) => void;
  showError: (msg: string, duration?: number) => void;
  showInfo: (msg: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info', duration: number = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const showSuccess = useCallback((msg: string, duration?: number) => {
    addToast(msg, 'success', duration);
  }, [addToast]);

  const showError = useCallback((msg: string, duration?: number) => {
    addToast(msg, 'error', duration);
  }, [addToast]);

  const showInfo = useCallback((msg: string, duration?: number) => {
    addToast(msg, 'info', duration);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo }}>
      {children}
      {/* Container position: top-center on mobile, top-right on desktop */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full max-w-sm px-4 pointer-events-none sm:top-6 sm:right-6 sm:left-auto sm:translate-x-0 sm:items-end sm:px-0">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            type={toast.type}
            title={toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}
            message={toast.message}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export { ToastContext };
