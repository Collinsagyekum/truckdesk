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
import { formatCurrency, formatMiles, getInitials } from '../../utils/formatting';
import { withTimeout } from '../../utils/withTimeout';
import type { User, Load, Expense } from '../../types';
import { 
  Users, 
  MapPin, 
  DollarSign, 
  AlertTriangle, 
  Copy, 
  Check,
  TrendingUp, 
  ArrowRight,
  ShieldAlert,
  Clock
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

  // Copied Referral State
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Without clearing loading here, a null user leaves the page spinning forever.
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      try {
        setLoading(true);
        const companyId = user.company_id || 'company-123';
        
        const [driversData, loadsData, expensesData, mileageData] = await Promise.all([
          withTimeout(getFleetDrivers(companyId), [], 'getFleetDrivers'),
          withTimeout(getFleetLoads(companyId), [], 'getFleetLoads'),
          withTimeout(getFleetExpenses(companyId), [], 'getFleetExpenses'),
          withTimeout(getFleetMileage(), [] as DailyMileage[], 'getFleetMileage'),
        ]);

        setDrivers(driversData);
        setLoads(loadsData);
        setExpenses(expensesData);
        setAllMileage(mileageData);
      } catch (error) {
        console.error('Error fetching owner dashboard data:', error);
        showError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, showError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Current week date threshold
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Helper: Filter loads this week
  const weeklyLoads = loads.filter((load) => new Date(load.pickup_date) >= startOfWeek);
  
  // Helper: Filter expenses this week
  const weeklyExpenses = expenses.filter((exp) => new Date(exp.date) >= startOfWeek);

  // 1. KPI Fleet Miles (this week) — loads + standalone mileage
  const weeklyMileageEntries = allMileage.filter((m) => new Date(m.log_date) >= startOfWeek);
  const fleetLoadMiles = weeklyLoads.reduce((sum, l) => sum + l.miles, 0);
  const fleetStandaloneMiles = weeklyMileageEntries.reduce((sum, m) => sum + (m.miles || 0), 0);
  const totalFleetMiles = fleetLoadMiles + fleetStandaloneMiles;

  // 2. KPI Fleet Revenue (this week)
  const totalFleetRevenue = weeklyLoads.reduce((sum, l) => sum + l.rate, 0);

  // 3. KPI Active Drivers count
  // A driver is active if they have an active load or status is active
  const activeDriversCount = drivers.length; // Default all drivers active for demo or filter:
  const activeCount = drivers.filter(d => d.role === 'driver').length; // For the grid, we will detail their status badges

  // 4. KPI Flagged Receipt Count
  const flaggedExpenses = expenses.filter((e) => e.flagged === true);
  const flaggedReceiptsCount = flaggedExpenses.length;

  // Driver metrics mapping
  const driverMetrics = drivers
    .filter((d) => d.role === 'driver')
    .map((driver) => {
      const driverLoads = loads.filter((l) => l.driver_id === driver.id);
      const driverWeeklyLoads = driverLoads.filter((l) => new Date(l.pickup_date) >= startOfWeek);
      const driverExpenses = expenses.filter((e) => e.driver_id === driver.id);
      const driverWeeklyExpenses = driverExpenses.filter((e) => new Date(e.date) >= startOfWeek);

      const driverMileageEntries = allMileage.filter((m) => m.driver_id === driver.id && new Date(m.log_date) >= startOfWeek);
      const milesThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.miles, 0)
        + driverMileageEntries.reduce((sum, m) => sum + (m.miles || 0), 0);
      const revenueThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.rate, 0);
      const expensesThisWeek = driverWeeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfitThisWeek = revenueThisWeek - expensesThisWeek;

      // Status helper
      let status: 'Active' | 'Idle' | 'Review' = 'Active';
      const hasFlagged = expenses.some((e) => e.driver_id === driver.id && e.flagged === true);
      const hasExpiring = driver.id === 'driver-david' || driver.id === 'driver-marcus'; // David expiring CDL, Marcus expired Med
      
      if (hasFlagged || hasExpiring) {
        status = 'Review';
      } else if (driverLoads.length === 0 || driverWeeklyLoads.length === 0) {
        status = 'Idle';
      }

      // Last activity time ago
      let lastActivityTime = '1 day ago';
      if (driver.id === 'mock-driver-id') lastActivityTime = '10 mins ago';
      if (driver.id === 'driver-john') lastActivityTime = '2 hours ago';
      if (driver.id === 'driver-david') lastActivityTime = '4 hours ago';

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
    const referralCode = user?.referral_code || 'SARAH888';
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
            Real-time operations, driver status, and compliance tracking.
          </p>
        </div>
      </div>

      {/* KPI GRID */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Fleet Miles (This Week)"
          value={formatMiles(totalFleetMiles)}
          subtext="Combined logged miles"
        />
        <StatCard
          label="Fleet Revenue (This Week)"
          value={formatCurrency(totalFleetRevenue)}
          subtext="Sum of active/delivered loads"
        />
        <StatCard
          label="Active Drivers"
          value={`${driverMetrics.filter(d => d.status === 'Active').length}/${driverMetrics.length}`}
          subtext="24h operational status"
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
                      <span className="text-[10px] text-gray-500 font-sans">Miles this week</span>
                      <p className="text-sm font-semibold font-mono text-gray-200 mt-0.5">
                        {formatMiles(driver.milesThisWeek)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-sans">Profit this week</span>
                      <p className={`text-sm font-semibold font-mono mt-0.5 ${driver.netProfitThisWeek >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                        {formatCurrency(driver.netProfitThisWeek)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-gray-500 font-sans">
                  <Clock className="w-3.5 h-3.5 text-gray-600" />
                  Active {driver.lastActivityTime}
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
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
