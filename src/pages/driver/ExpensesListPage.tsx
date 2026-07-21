import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Receipt, DollarSign, Calendar, ChevronRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getExpenses, deleteExpense } from '../../services/supabase/expenses';
import type { Expense } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import ExpenseBadge from '../../components/ui/ExpenseBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

interface SwipeableExpenseCardProps {
  expense: Expense;
  onDelete: (id: string) => void;
  deletingId: string | null;
}

function SwipeableExpenseCard({ expense, onDelete, deletingId }: SwipeableExpenseCardProps) {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isSwiped, setIsSwiped] = useState<boolean>(false);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const threshold = 50; // minimum distance to trigger swipe state
  const maxSwipe = 80;  // translation amount in pixels to show delete button

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null || !isSwiping) return;
    const diff = e.touches[0].clientX - startX;

    if (isSwiped) {
      const newX = -maxSwipe + diff;
      setCurrentX(Math.min(0, Math.max(newX, -maxSwipe - 20)));
    } else {
      setCurrentX(Math.min(0, Math.max(diff, -maxSwipe - 20)));
    }
  };

  const handleTouchEnd = () => {
    if (startX === null) return;
    setIsSwiping(false);

    if (currentX < -threshold) {
      setIsSwiped(true);
      setCurrentX(-maxSwipe);
    } else {
      setIsSwiped(false);
      setCurrentX(0);
    }
    setStartX(null);
  };

  const resetSwipe = () => {
    setIsSwiped(false);
    setCurrentX(0);
  };

  useEffect(() => {
    if (deletingId) {
      resetSwipe();
    }
  }, [deletingId]);

  return (
    <div className="relative overflow-hidden rounded-2xl select-none">
      {/* Background Swipe Actions (Delete button) */}
      <div
        className="absolute inset-0 bg-gradient-to-l from-brand-red to-navy-900 flex items-center justify-end pr-6 transition-all duration-200"
        style={{ opacity: currentX < 0 ? 1 : 0 }}
      >
        <button
          onClick={() => {
            onDelete(expense.id);
            resetSwipe();
          }}
          disabled={deletingId === expense.id}
          className="flex flex-col items-center gap-1 text-white hover:scale-105 active:scale-95 transition-all outline-none"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Delete</span>
        </button>
      </div>

      {/* Foreground Card */}
      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-navy-800 border border-white/5 rounded-2xl p-4 flex items-center justify-between transition-all duration-200 hover:border-white/10 touch-pan-y relative z-10"
        style={{
          transform: `translateX(${currentX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ExpenseBadge category={expense.category} />
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(expense.date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-white truncate max-w-full">
            {expense.description}
          </h4>
          {expense.receipt_url && (
            <a
              href={expense.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-1 text-[11px] text-brand-green hover:underline"
            >
              <Receipt className="w-3 h-3" /> View receipt
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-sm font-bold text-brand-red flex items-center justify-end">
              <DollarSign className="w-3.5 h-3.5 text-brand-red shrink-0" />
              {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {expense.is_deductible && (
              <span className="text-[10px] text-brand-green font-semibold bg-brand-green/10 border border-brand-green/20 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                Tax Ded.
              </span>
            )}
          </div>

          {/* Swipe indicator for mobile, inline delete button for desktop */}
          <div className="flex items-center">
            <button
              onClick={() => onDelete(expense.id)}
              disabled={deletingId === expense.id}
              className="hidden md:flex p-2 rounded-lg bg-navy-900 border border-white/5 text-gray-400 hover:text-brand-red hover:border-brand-red/20 transition-all active:scale-95 disabled:opacity-50"
              aria-label="Delete expense"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <ChevronRight className="w-4 h-4 text-gray-600 block md:hidden shrink-0 transition-transform duration-200" style={{ transform: isSwiped ? 'rotate(180deg)' : 'none' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExpensesListPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const driverId = user?.id || 'mock-driver';

  useEffect(() => {
    async function loadData() {
      try {
        const fetchedExpenses = await getExpenses(driverId);
        setExpenses(fetchedExpenses);
      } catch (err) {
        console.error('Error fetching expenses:', err);
        showError('Failed to load expenses');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [driverId, showError]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    setDeletingId(id);
    try {
      const success = await deleteExpense(id);
      if (success) {
        setExpenses((prev) => prev.filter((exp) => exp.id !== id));
        showSuccess('Expense deleted successfully');
      } else {
        showError('Failed to delete expense');
      }
    } catch (err) {
      console.error('Error deleting expense:', err);
      showError('An error occurred while deleting the expense');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (categoryFilter === 'all') return true;
      return expense.category === categoryFilter;
    });
  }, [expenses, categoryFilter]);

  const filterCategories = ['all', 'fuel', 'tolls', 'meals', 'maintenance', 'other'];

  const rightAction = (
    <Link to="/driver/expenses/new">
      <Button
        variant="primary"
        size="sm"
        leftIcon={<Plus className="w-4 h-4 text-navy-900" />}
      >
        New Expense
      </Button>
    </Link>
  );

  return (
    <div className="max-w-lg mx-auto w-full pb-8">
      <PageHeader title="My Expenses" rightAction={rightAction} />

      <div className="mt-4 px-1 space-y-4">
        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {filterCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border capitalize whitespace-nowrap transition-all duration-200 ${
                categoryFilter === cat
                  ? 'bg-brand-green text-navy-900 border-brand-green shadow-[0_2px_8px_rgba(34,197,94,0.2)]'
                  : 'bg-navy-800 text-gray-400 border-white/5 hover:text-white hover:bg-navy-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Swipe instructions helper text for mobile */}
        {filteredExpenses.length > 0 && (
          <p className="text-[10px] text-gray-500 italic px-1 block md:hidden">
            Tip: Swipe left on an expense card to delete.
          </p>
        )}

        {/* Expenses List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={categoryFilter !== 'all' ? 'No matching expenses' : 'No expenses tracked'}
            message={
              categoryFilter !== 'all'
                ? 'Try selecting a different category filter.'
                : 'Track your first expense like fuel, tolls, or meals.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredExpenses.map((expense) => (
              <SwipeableExpenseCard
                key={expense.id}
                expense={expense}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
