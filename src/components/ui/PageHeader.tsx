import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: ReactNode;
}

export default function PageHeader({
  title,
  showBack = false,
  onBack,
  rightAction,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-navy-900/90 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center min-w-[40px]">
        {showBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      <h1 className="text-lg font-semibold text-white truncate max-w-[60%] font-sans text-center">
        {title}
      </h1>

      <div className="flex items-center justify-end min-w-[40px]">
        {rightAction}
      </div>
    </header>
  );
}
