

interface LoadingSkeletonProps {
  width?: string;
  height?: string;
  rounded?: boolean;
}

export default function LoadingSkeleton({
  width = '100%',
  height = '1rem',
  rounded = false,
}: LoadingSkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-navy-800 border border-white/5 ${
        rounded ? 'rounded-full' : 'rounded-lg'
      }`}
      style={{ width, height }}
    />
  );
}
