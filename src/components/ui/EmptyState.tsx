import { ComponentType } from 'react';

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  message: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  message,
  ctaLabel,
  onCta,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 rounded-2xl bg-navy-800/40 my-6">
      <div className="p-4 bg-navy-800 rounded-full border border-white/5 text-gray-400 mb-4">
        <Icon className="w-8 h-8 text-brand-green" />
      </div>
      <h3 className="text-lg font-semibold text-white font-sans">{title}</h3>
      <p className="mt-1 text-sm text-gray-400 max-w-xs font-sans">{message}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-5 px-4 py-2 bg-brand-green hover:bg-brand-green/90 text-navy-900 text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95 font-sans"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
