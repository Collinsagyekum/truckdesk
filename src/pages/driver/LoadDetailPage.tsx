import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Trash2,
  Truck,
  Receipt,
  Info,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getLoad, deleteLoad } from '../../services/supabase/loads';
import { getExpenses } from '../../services/supabase/expenses';
import type { Load, Expense } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import LoadStatusBadge from '../../components/ui/LoadStatusBadge';
import ExpenseBadge from '../../components/ui/ExpenseBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

export default function LoadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [load, setLoad] = useState<Load | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const driverId = user?.id || 'mock-driver';

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [fetchedLoad, fetchedExpenses] = await Promise.all([
          getLoad(id),
          getExpenses(driverId),
        ]);
        setLoad(fetchedLoad);
        setExpenses(fetchedExpenses);
      } catch (err) {
        console.error('Error fetching load details:', err);
        showError('Failed to load details');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, driverId, showError]);

  // Filter expenses linked to this load (by date or metadata)
  const linkedExpenses = useMemo(() => {
    if (!load) return [];
    return expenses.filter((expense) => {
      // Check if expense description contains the load ID or broker name
      const matchesMetadata =
        expense.description.toLowerCase().includes(load.id.toLowerCase()) ||
        expense.description.toLowerCase().includes(load.broker_name.toLowerCase());

      // Check if expense date is within the load's pickup & delivery date window
      const expenseTime = new Date(expense.date).getTime();
      const pickupTime = new Date(load.pickup_date).getTime();
      const deliveryTime = new Date(load.delivery_date || load.pickup_date).getTime();

      const matchesDate = expenseTime >= pickupTime && expenseTime <= deliveryTime;

      return matchesMetadata || matchesDate;
    });
  }, [load, expenses]);

  // Calculations for Profit Summary
  const { totalExpenses, netProfit, rpm } = useMemo(() => {
    if (!load) return { totalExpenses: 0, netProfit: 0, rpm: 0 };
    const total = linkedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const profit = load.rate - total;
    const ratePerMile = load.miles > 0 ? load.rate / load.miles : 0;
    return {
      totalExpenses: total,
      netProfit: profit,
      rpm: ratePerMile,
    };
  }, [load, linkedExpenses]);

  const handleDelete = async () => {
    if (!id || !load) return;
    if (!window.confirm('Are you sure you want to delete this load?')) return;

    setIsDeleting(true);
    try {
      const success = await deleteLoad(id);
      if (success) {
        showSuccess('Load deleted successfully');
        navigate('/driver/loads');
      } else {
        showError('Failed to delete load');
      }
    } catch (err) {
      console.error('Error deleting load:', err);
      showError('An error occurred while deleting the load');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (!load) {
    return (
      <div className="max-w-lg mx-auto w-full text-center py-20 px-4">
        <Info className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Load not found</h2>
        <p className="text-gray-400 mb-6">The load you are trying to view does not exist or has been deleted.</p>
        <Button variant="secondary" onClick={() => navigate('/driver/loads')}>
          Back to Loads
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full pb-12">
      <PageHeader title="Load Details" showBack onBack={() => navigate('/driver/loads')} />

      <div className="mt-4 px-1 space-y-6">
        {/* Load Status & Broker Card */}
        <div className="bg-navy-800 border border-white/5 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs text-gray-400 block mb-1">BROKER</span>
              <h2 className="text-lg font-bold text-white leading-tight">{load.broker_name}</h2>
            </div>
            <LoadStatusBadge status={load.status} />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 text-sm">
            <div>
              <span className="text-xs text-gray-400 block mb-1">ID</span>
              <span className="font-mono text-gray-200">{load.id}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block mb-1">Equipment / Trailer</span>
              <span className="text-gray-200 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-brand-green shrink-0" />
                <span>53' Dry Van</span>
              </span>
            </div>
          </div>
        </div>

        {/* Route Details Card */}
        <div className="bg-navy-800 border border-white/5 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <Navigation className="w-4 h-4 text-brand-green" />
            Route Information
          </h3>

          <div className="relative pl-6 space-y-6">
            {/* Origin & Pickup */}
            <div className="relative">
              <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-brand-green border-2 border-navy-900" />
              <div>
                <span className="text-xs text-gray-400 block">PICKUP</span>
                <span className="font-semibold text-white block">{load.origin}</span>
                <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3" />
                  {new Date(load.pickup_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Connecting line */}
            <div className="absolute -left-[19px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-brand-green to-blue-500" />

            {/* Destination & Delivery */}
            <div className="relative">
              <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-navy-900" />
              <div>
                <span className="text-xs text-gray-400 block">DELIVERY</span>
                <span className="font-semibold text-white block">{load.destination}</span>
                <span className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3" />
                  {load.delivery_date ? new Date(load.delivery_date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }) : 'Not Scheduled'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex items-center justify-between text-sm">
            <span className="text-gray-400">Total Distance</span>
            <span className="font-semibold text-white">{load.miles.toLocaleString()} miles</span>
          </div>
        </div>

        {/* Mini Profit Summary Card */}
        <div className="bg-navy-800 border border-white/5 rounded-2xl p-5 space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-green" />
            Profit Summary
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-navy-900/50 rounded-xl border border-white/5">
              <span className="text-xs text-gray-400 block mb-0.5">Gross Rate</span>
              <span className="text-base font-bold text-white flex items-center">
                <DollarSign className="w-4 h-4 text-brand-green shrink-0" />
                {load.rate.toLocaleString()}
              </span>
            </div>

            <div className="p-3 bg-navy-900/50 rounded-xl border border-white/5">
              <span className="text-xs text-gray-400 block mb-0.5">Total Expenses</span>
              <span className="text-base font-bold text-brand-red flex items-center">
                <DollarSign className="w-4 h-4 text-brand-red shrink-0" />
                {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 bg-brand-green/5 rounded-xl border border-brand-green/10 col-span-2 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Net Profit</span>
                <span className={`text-lg font-bold flex items-center ${netProfit >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                  <DollarSign className="w-4.5 h-4.5 shrink-0" />
                  {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-400 block mb-0.5">RPM</span>
                <span className="text-base font-bold text-white">
                  ${rpm.toFixed(2)}/mi
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-navy-800 border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-brand-green" />
              Linked Expenses
            </h3>
            <span className="text-xs bg-navy-700 text-gray-300 px-2 py-0.5 rounded-full font-semibold">
              {linkedExpenses.length}
            </span>
          </div>

          {linkedExpenses.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-4 bg-navy-900/20 rounded-xl border border-dashed border-white/5">
              No expenses matching date or metadata.
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {linkedExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 bg-navy-900/40 border border-white/5 rounded-xl text-xs hover:border-white/10 transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-white">{expense.description}</span>
                    <div className="flex items-center gap-2">
                      <ExpenseBadge category={expense.category} />
                      <span className="text-[10px] text-gray-400">
                        {new Date(expense.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-brand-red">
                    -${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes if any */}
        {load.notes && (
          <div className="bg-navy-800 border border-white/5 rounded-2xl p-5 space-y-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Notes</h3>
            <p className="text-sm text-gray-300 whitespace-pre-wrap bg-navy-900/30 p-3 rounded-xl border border-white/5">
              {load.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 flex flex-col gap-3">
          <Button
            variant="danger"
            isLoading={isDeleting}
            leftIcon={<Trash2 className="w-4 h-4 text-white" />}
            onClick={handleDelete}
            className="w-full py-3"
          >
            Delete Load
          </Button>
        </div>
      </div>
    </div>
  );
}
