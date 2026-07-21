
import type { LoadStatus } from '../../types';

interface LoadStatusBadgeProps {
  status: LoadStatus;
}

const statusConfig: Record<LoadStatus, { label: string; colorClass: string }> = {
  upcoming: {
    label: 'Upcoming',
    colorClass: 'text-brand-amber bg-brand-amber/10 border-brand-amber/25',
  },
  pending: {
    label: 'Pending',
    colorClass: 'text-brand-amber bg-brand-amber/10 border-brand-amber/25',
  },
  active: {
    label: 'Active',
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  },
  in_transit: {
    label: 'In Transit',
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  },
  delivered: {
    label: 'Delivered',
    colorClass: 'text-brand-green bg-brand-green/10 border-brand-green/25',
  },
  invoiced: {
    label: 'Invoiced',
    colorClass: 'text-brand-green bg-brand-green/10 border-brand-green/25',
  },
  paid: {
    label: 'Paid',
    colorClass: 'text-brand-green bg-brand-green/10 border-brand-green/25',
  },
  cancelled: {
    label: 'Cancelled',
    colorClass: 'text-brand-red bg-brand-red/10 border-brand-red/25',
  },
};

export default function LoadStatusBadge({ status }: LoadStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/25',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.colorClass}`}
    >
      {config.label}
    </span>
  );
}
