import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';
import type { ToastContextType } from '../context/ToastContext';

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
