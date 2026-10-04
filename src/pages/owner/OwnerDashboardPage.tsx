import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getFleetDrivers } from '../../services/supabase/users';
import { getFleetLoads } from '../../services/supabase/loads';
import { getFleetExpenses, updateExpense } from '../../services/supabase/expenses';
import { getFleetMileage } from '../../services/supabase/mileage';
import type { DailyMileage } from '../../services/supabase/mileage';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatMiles, getInitials, timeAgo, toLocalDate } from '../../utils/formatting';
import { withTimeout } from '../../utils/withTimeout';
import type { User, Load, Expense } from '../../types';
import {
  Copy,
  Check,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  Clock,
  AlertTriangle
} from 'lucide-react';

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  // Page States
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allMileage, setAllMileage] = useState<DailyMileage[]>([]);
  const [loading, setLoading] = useState(true);
  // Drivers, loads and expenses are the core of this page: if any fails, the
  // KPIs would read as zeros, so the page shows an error instead. Mileage is
  // secondary and only blanks the miles figure.
  const [loadError, setLoadError] = useState(false);
  const [mileageError, setMileageError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Copied Referral State
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Without clearing loading here, a null user leaves the page spinning forever.
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);
      setLoadError(false);
      // An owner's fleet is scoped by their own user id (drivers carry
      // owner_id === this id). RLS enforces the same boundary server-side.
      const ownerId = user.id;

      const [driversR, loadsR, expensesR, mileageR] = await Promise.allSettled([
        withTimeout(getFleetDrivers(ownerId), 'getFleetDrivers'),
        withTimeout(getFleetLoads(ownerId), 'getFleetLoads'),
        withTimeout(getFleetExpenses(ownerId), 'getFleetExpenses'),
        withTimeout(getFleetMileage(ownerId), 'getFleetMileage'),
      ]);

      if (driversR.status === 'fulfilled' && loadsR.status === 'fulfilled' && expensesR.status === 'fulfilled') {
        setDrivers(driversR.value);
        setLoads(loadsR.value);
        setExpenses(expensesR.value);
      } else {
        for (const r of [driversR, loadsR, expensesR]) {
          if (r.status === 'rejected') console.error('Error fetching owner dashboard data:', r.reason);
        }
        setLoadError(true);
      }

      if (mileageR.status === 'fulfilled') {
        setAllMileage(mileageR.value);
        setMileageError(false);
      } else {
        console.error('Fleet mileage failed to load:', mileageR.reason);
        setMileageError(true);
      }
      setLoading(false);
    };

    fetchData();
  }, [user, reloadKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <AlertTriangle className="w-12 h-12 text-brand-amber mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Couldn&apos;t load your fleet</h2>
        <p className="text-gray-400 mb-6">Check your connection and try again.</p>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="text-sm font-semibold text-navy-900 bg-brand-green hover:bg-brand-green/90 px-5 py-2.5 rounded-xl"
        >
          Try again
        </button>
      </div>
    );
  }

  // Rolling last-7-days window (today + the previous 6 days), matching the
  // driver Home, so fleet totals don't reset on Sunday or diverge from what the
  // driver sees. `startOfWeek` keeps its name but is now "7 days ago".
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  // Helper: Filter loads this week
  const weeklyLoads = loads.filter((load) => toLocalDate(load.pickup_date) >= startOfWeek);
  
  // 1. KPI Fleet Miles (this week) — loads + standalone mileage
  const weeklyMileageEntries = allMileage.filter((m) => toLocalDate(m.log_date) >= startOfWeek);
  const fleetLoadMiles = weeklyLoads.reduce((sum, l) => sum + l.miles, 0);
  const fleetStandaloneMiles = weeklyMileageEntries.reduce((sum, m) => sum + (m.miles || 0), 0);
  const totalFleetMiles = fleetLoadMiles + fleetStandaloneMiles;

  // 2. KPI Fleet Revenue (this week)
  const totalFleetRevenue = weeklyLoads.reduce((sum, l) => sum + l.rate, 0);

  // 3. KPI Flagged Receipt Count
  const flaggedExpenses = expenses.filter((e) => e.flagged === true);
  const flaggedReceiptsCount = flaggedExpenses.length;

  // Driver metrics mapping
  const driverMetrics = drivers
    .filter((d) => d.role === 'driver')
    .map((driver) => {
      const driverLoads = loads.filter((l) => l.driver_id === driver.id);
      const driverWeeklyLoads = driverLoads.filter((l) => toLocalDate(l.pickup_date) >= startOfWeek);
      const driverExpenses = expenses.filter((e) => e.driver_id === driver.id);
      const driverWeeklyExpenses = driverExpenses.filter((e) => toLocalDate(e.date) >= startOfWeek);

      const driverMileageEntries = allMileage.filter((m) => m.driver_id === driver.id && toLocalDate(m.log_date) >= startOfWeek);
      const milesThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.miles, 0)
        + driverMileageEntries.reduce((sum, m) => sum + (m.miles || 0), 0);
      const revenueThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.rate, 0);
      const expensesThisWeek = driverWeeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfitThisWeek = revenueThisWeek - expensesThisWeek;

      // Status helper
      let status: 'Active' | 'Idle' | 'Review' = 'Active';
      const hasFlagged = expenses.some((e) => e.driver_id === driver.id && e.flagged === true);

      if (hasFlagged) {
        status = 'Review';
      } else if (driverLoads.length === 0 || driverWeeklyLoads.length === 0) {
        status = 'Idle';
      }

      // Last activity: when the driver most recently logged anything. Uses
      // created_at, a full timestamp, rather than the date-only trip fields.
      const lastLogged = [
        ...driverLoads.map((l) => l.created_at),
        ...driverExpenses.map((e) => e.created_at),
        ...allMileage.filter((m) => m.driver_id === driver.id).map((m) => m.created_at),
      ]
        .map((t) => (t ? new Date(t).getTime() : NaN))
        .filter((t) => !isNaN(t));
      const lastActivityTime = lastLogged.length
        ? `Last logged ${timeAgo(Math.max(...lastLogged))}`
        : 'Nothing logged yet';

      return {
        ...driver,
        milesThisWeek,
        netProfitThisWeek,
        status,
        lastActivityTime,
      };
    });

  // Handle Dismiss Flag
  const handleDismissFlag = async (expenseId: string) => {
    try {
      const updated = await updateExpense(expenseId, { flagged: false });
      if (updated) {
        // Update local state
        setExpenses((prev) =>
          prev.map((e) => (e.id === expenseId ? { ...e, flagged: false } : e))
        );
        showSuccess('Receipt warning dismissed.');
      }
    } catch (error) {
      showError('Failed to dismiss warning.');
    }
  };

  // Handle Copy Referral
  const handleCopyReferral = () => {
    // No fallback code: sharing someone else's code would credit them instead.
    const referralCode = user?.referral_code;
    if (!referralCode) return;
    const referralUrl = `https://truckdesk.app/join?ref=${referralCode}`;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    showSuccess('Referral invitation link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans">
            Fleet Overview
          </h1>
          <p className="text-xs text-gray-400 font-sans mt-1">
            Miles, revenue and driver activity — last 7 days.
          </p>
        </div>
      </div>

      {/* KPI GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Fleet Miles (Last 7 Days)"
          value={mileageError ? '—' : formatMiles(totalFleetMiles)}
          subtext={mileageError ? "Couldn't load logged miles" : 'Combined logged miles'}
        />
        <StatCard
          label="Fleet Revenue (Last 7 Days)"
          value={formatCurrency(totalFleetRevenue)}
          subtext="Sum of active/delivered loads"
        />
        <StatCard
          label="Active Drivers"
          value={`${driverMetrics.filter(d => d.status === 'Active').length}/${driverMetrics.length}`}
          subtext="With loads in the last 7 days"
        />
        <StatCard
          label="Flagged Receipts"
          value={flaggedReceiptsCount}
          subtext="Expenses requiring review"
          trend={flaggedReceiptsCount > 0 ? `${flaggedReceiptsCount} alerts` : undefined}
          trendDirection={flaggedReceiptsCount > 0 ? 'down' : undefined}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* DRIVERS GRID SECTION */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-sans">
              Drivers Status Grid
            </h2>
            <button
              onClick={() => navigate('/owner/fleet')}
              className="text-xs font-semibold text-brand-green hover:underline flex items-center gap-1 font-sans"
            >
              View Fleet Directory <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {driverMetrics.map((driver) => (
              <div
                key={driver.id}
                onClick={() => navigate(`/owner/driver/${driver.id}`)}
                className="group p-5 bg-navy-800 hover:bg-navy-700/50 border border-white/5 hover:border-white/10 rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.01] shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-green/30 to-brand-green/5 border border-brand-green/20 flex items-center justify-center font-bold text-brand-green text-sm">
                        {getInitials(driver.full_name)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm group-hover:text-brand-green transition-colors font-sans">
                          {driver.full_name}
                        </h4>
                        <span className="text-[10px] text-gray-500 font-sans tracking-wide uppercase">
                          Driver
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        driver.status === 'Active'
                          ? 'text-brand-green bg-brand-green/10 border border-brand-green/20'
                          : driver.status === 'Idle'
                          ? 'text-brand-amber bg-brand-amber/10 border border-brand-amber/20'
                          : 'text-brand-red bg-brand-red/10 border border-brand-red/20'
                      }`}
                    >
                      {driver.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 border-t border-white/5 mt-2">
                    <div>
                      <span className="text-[10px] text-gray-500 font-sans">Miles (7d)</span>
                      <p className="text-sm font-semibold font-mono text-gray-200 mt-0.5">
                        {formatMiles(driver.milesThisWeek)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-sans">Profit (7d)</span>
                      <p className={`text-sm font-semibold font-mono mt-0.5 ${driver.netProfitThisWeek >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                        {formatCurrency(driver.netProfitThisWeek)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-gray-500 font-sans">
                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                  {driver.lastActivityTime}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FLAGGED QUEUE & REFERRAL SIDE PANEL */}
        <div className="space-y-6">
          
          {/* FLAGGED RECEIPTS QUEUE */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-sans px-1">
              Flagged Receipt Queue
            </h2>

            <div className="bg-navy-800 border border-white/5 rounded-2xl p-4 shadow-lg space-y-4">
              {flaggedExpenses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-gray-500 font-sans">No expenses currently flagged for audit.</p>
                </div>
              ) : (
                flaggedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="p-3.5 rounded-xl bg-navy-900/60 border border-brand-red/10 space-y-3 relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-red" />
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-white font-sans">
                          {exp.description}
                        </h4>
                        <p className="text-[10px] text-gray-500 font-sans mt-0.5">
                          Logged by <span className="text-gray-300 font-semibold">{exp.driver_name}</span>
                        </p>
                      </div>
                      <span className="text-xs font-bold text-brand-red font-mono">
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>

                    <div className="p-2 bg-brand-red/5 rounded-lg border border-brand-red/10 text-[10px] text-brand-red font-sans leading-relaxed flex gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-brand-red" />
                      <div>
                        <span className="font-bold">Flag: </span>
                        {exp.flag_reason}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1.5 border-t border-white/5">
                      <span className="text-[9px] text-gray-500 font-mono">
                        {exp.date}
                      </span>
                      <button
                        onClick={() => handleDismissFlag(exp.id)}
                        className="text-[10px] font-bold text-brand-green hover:underline font-sans cursor-pointer"
                      >
                        Dismiss warning
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* REFERRAL TRACKER CARD */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest font-sans px-1">
              Referral Program
            </h2>

            <div className="bg-gradient-to-br from-navy-800 to-brand-green/5 border border-brand-green/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-brand-green/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center gap-3.5 mb-4">
                <div className="p-2.5 bg-brand-green/10 text-brand-green rounded-xl border border-brand-green/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm font-sans">
                    Invite Operators
                  </h3>
                  <p className="text-[10px] text-gray-400 font-sans mt-0.5">
                    Earn credits for every active referral signup.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-navy-900/50 p-3 rounded-xl border border-white/5 mb-4">
                <div className="text-center">
                  <span className="text-[9px] text-gray-500 font-sans">Total Referrals</span>
                  <p className="text-base font-extrabold text-white mt-0.5 font-sans">
                    {user?.referral_count || 0}
                  </p>
                </div>
                <div className="text-center border-l border-white/5">
                  <span className="text-[9px] text-gray-500 font-sans">Credits Earned</span>
                  <p className="text-base font-extrabold text-brand-green mt-0.5 font-mono">
                    {formatCurrency(user?.referral_credits || 0)}
                  </p>
                </div>
              </div>

              {!user?.referral_code ? (
                <p className="text-xs text-gray-400 text-center py-2.5">
                  Your referral link isn&apos;t set up yet.
                </p>
              ) : (
              <button
                onClick={handleCopyReferral}
                className="w-full bg-navy-900 hover:bg-navy-950 border border-brand-green/30 hover:border-brand-green text-brand-green font-bold py-2.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied Referral Link!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Invite a Driver
                  </>
                )}
              </button>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
