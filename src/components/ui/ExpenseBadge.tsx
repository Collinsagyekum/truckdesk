import {
  Fuel,
  Coins,
  Utensils,
  Bed,
  Wrench,
  Disc,
  ShieldCheck,
  FileText,
  Scale,
  Package,
  Phone,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ExpenseCategory } from '../../types';

interface ExpenseBadgeProps {
  category: ExpenseCategory;
}

const categoryConfig: Record<
  ExpenseCategory,
  { label: string; colorClass: string; icon: LucideIcon }
> = {
  fuel: {
    label: 'Fuel',
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
    icon: Fuel,
  },
  tolls: {
    label: 'Tolls',
    colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
    icon: Coins,
  },
  toll: {
    label: 'Toll',
    colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/25',
    icon: Coins,
  },
  meals: {
    label: 'Meals',
    colorClass: 'text-green-400 bg-green-500/10 border-green-500/25',
    icon: Utensils,
  },
  food: {
    label: 'Food',
    colorClass: 'text-green-400 bg-green-500/10 border-green-500/25',
    icon: Utensils,
  },
  lodging: {
    label: 'Lodging',
    colorClass: 'text-teal-400 bg-teal-500/10 border-teal-500/25',
    icon: Bed,
  },
  maintenance: {
    label: 'Maintenance',
    colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    icon: Wrench,
  },
  tire: {
    label: 'Tire',
    colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
    icon: Disc,
  },
  insurance: {
    label: 'Insurance',
    colorClass: 'text-blue-300 bg-navy-700/50 border-navy-700',
    icon: ShieldCheck,
  },
  permits: {
    label: 'Permits',
    colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/25',
    icon: FileText,
  },
  scales: {
    label: 'Scales',
    colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/25',
    icon: Scale,
  },
  lumper: {
    label: 'Lumper',
    colorClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    icon: Package,
  },
  phone: {
    label: 'Phone',
    colorClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25',
    icon: Phone,
  },
  parking: {
    label: 'Parking',
    colorClass: 'text-pink-400 bg-pink-500/10 border-pink-500/25',
    icon: MapPin,
  },
  supplies: {
    label: 'Supplies',
    colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/25',
    icon: HelpCircle,
  },
  other: {
    label: 'Other',
    colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/25',
    icon: HelpCircle,
  },
};

export default function ExpenseBadge({ category }: ExpenseBadgeProps) {
  const config = categoryConfig[category] || categoryConfig.other;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.colorClass}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{config.label}</span>
    </span>
  );
}
