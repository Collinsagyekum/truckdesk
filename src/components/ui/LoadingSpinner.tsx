

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  const spinner = (
    <div
      className={`border-brand-green/20 border-t-brand-green rounded-full animate-spin ${sizeClasses[size]}`}
      role="status"
      aria-label="loading"
    />
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy-900">
        {spinner}
      </div>
    );
  }

  return <div className="flex items-center justify-center p-4">{spinner}</div>;
}
