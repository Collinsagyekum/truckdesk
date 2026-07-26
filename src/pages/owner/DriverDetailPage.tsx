import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, DollarSign, Calendar, Truck, PiggyBank, MapPin, Eye } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getUserProfile } from '../../services/supabase/users';
import { getLoads } from '../../services/supabase/loads';
import { getExpenses, getRetirementLogs } from '../../services/supabase/expenses';
import { withTimeout } from '../../utils/withTimeout';
import { formatCurrency, formatMiles, getInitials } from '../../utils/formatting';
import type { User, Load, Expense } from '../../types';
import StatCard from '../../components/ui/StatCard';
import LoadStatusBadge from '../../components/ui/LoadStatusBadge';
import ExpenseBadge from '../../components/ui/ExpenseBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

interface RetirementLog {
  id: string;
  amount: number;
  type: string;
  date: string;
}

function fmtDate(d: string): string {
  if (!d) return '—';
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DriverDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { impersonateDriver } = useAuth();

  const [driver, setDriver] = useState<User | null>(null);
  const [loads, setLoads] = useState<Load[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [retirement, setRetirement] = useState<RetirementLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }

    const load = async () => {
      try {
        setLoading(true);
        const [d, l, e, r] = await Promise.all([
          withTimeout(getUserProfile(id), null, 'getUserProfile'),
          withTimeout(getLoads(id), [], 'getLoads'),
          withTimeout(getExpenses(id), [], 'getExpenses'),
          withTimeout(getRetirementLogs(id), [], 'getRetirementLogs'),
        ]);
        setDriver(d);
        setLoads(l);
        setExpenses(e);
        setRetirement(r as RetirementLog[]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const totalMiles = loads.reduce((s, l) => s + l.miles, 0);
  const grossRevenue = loads.reduce((s, l) => s + l.rate, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = grossRevenue - totalExpenses;
  const ytdRetirement = retirement.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="max-w-5xl mx-auto w-full pb-12 space-y-8">
      {/* Header */}
      <div>
        <Link to="/owner/fleet" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Fleet Directory
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-green/15 border border-brand-green/30 flex items-center justify-center text-brand-green font-bold text-lg shrink-0">
            {getInitials(driver?.full_name || 'Driver')}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-white truncate">{driver?.full_name || 'Driver'}</h1>
            <p className="text-sm text-gray-400">
              {driver?.phone || 'No phone'}{driver?.email ? ` · ${driver.email}` : ''}
            </p>
          </div>
          {driver && (
            <button
              onClick={() => { impersonateDriver(driver); navigate('/driver/home'); }}
              className="shrink-0 inline-flex items-center gap-2 bg-brand-green/15 border border-brand-green/30 text-brand-green hover:bg-brand-green/25 transition-colors rounded-xl px-4 py-2 text-sm font-semibold"
            >
              <Eye className="w-4 h-4" /> Open driver view
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Loads" value={loads.length} subtext={`${formatMiles(totalMiles)} logged`} />
        <StatCard label="Gross Revenue" value={formatCurrency(grossRevenue)} subtext="All logged loads" />
        <StatCard label="Net Profit" value={formatCurrency(netProfit)} subtext={`${formatCurrency(totalExpenses)} expenses`} />
        <StatCard label="Retirement (YTD)" value={formatCurrency(ytdRetirement)} subtext={`${retirement.length} contributions`} />
      </section>

      {/* Loads */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
          <Truck className="w-4 h-4" /> Loads
        </h2>
        {loads.length === 0 ? (
          <EmptyState icon={Truck} title="No loads" message="This driver has no logged loads yet." />
        ) : (
          <div className="space-y-3">
            {loads.map((l) => (
              <div key={l.id} className="bg-navy-800 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">
                      {l.origin || '—'} → {l.destination || '—'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-3">
                    <span>{l.broker_name || 'No broker'}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(l.pickup_date)}</span>
                    <span>{formatMiles(l.miles)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-bold text-brand-green">{formatCurrency(l.rate)}</span>
                  {l.status && <LoadStatusBadge status={l.status} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Expenses */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
          <Receipt className="w-4 h-4" /> Expenses
        </h2>
        {expenses.length === 0 ? (
          <EmptyState icon={Receipt} title="No expenses" message="This driver has no logged expenses yet." />
        ) : (
          <div className="space-y-3">
            {expenses.map((e) => (
              <div key={e.id} className="bg-navy-800 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ExpenseBadge category={e.category} />
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{fmtDate(e.date)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white truncate">{e.description || '—'}</div>
                  {e.receipt_url && (
                    <a
                      href={e.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[11px] text-brand-green hover:underline"
                    >
                      <Receipt className="w-3 h-3" /> View receipt
                    </a>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-brand-red flex items-center justify-end">
                    <DollarSign className="w-3.5 h-3.5" />
                    {e.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {e.is_deductible && (
                    <span className="text-[10px] text-brand-green font-semibold bg-brand-green/10 border border-brand-green/20 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                      Tax Ded.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Retirement */}
      <section>
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
          <PiggyBank className="w-4 h-4" /> Retirement Contributions
        </h2>
        {retirement.length === 0 ? (
          <EmptyState icon={PiggyBank} title="No contributions" message="This driver has no logged retirement contributions yet." />
        ) : (
          <div className="space-y-3">
            {retirement.map((r) => (
              <div key={r.id} className="bg-navy-800 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">{r.type}</div>
                  <div className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(r.date)}</div>
                </div>
                <span className="text-sm font-bold text-brand-green">{formatCurrency(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
