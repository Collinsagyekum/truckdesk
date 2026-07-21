import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down';
  subtext?: string;
}

export default function StatCard({
  label,
  value,
  trend,
  trendDirection,
  subtext,
}: StatCardProps) {
  const isPositive = trendDirection === 'up';

  return (
    <div className="bg-navy-800 border border-white/5 rounded-xl p-6 shadow-lg">
      <div className="text-sm font-medium text-gray-400 font-sans">{label}</div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-3xl font-semibold text-white tracking-tight font-sans">
          {value}
        </div>
        {trend && (
          <div
            className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPositive
                ? 'text-brand-green bg-brand-green/10'
                : 'text-brand-red bg-brand-red/10'
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
            )}
            {trend}
          </div>
        )}
      </div>
      {subtext && (
        <div className="mt-1 text-xs text-gray-500 font-sans">{subtext}</div>
      )}
    </div>
  );
}
