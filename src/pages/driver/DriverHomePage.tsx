import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getWeeklyLoads } from '../../services/supabase/loads';
import { getExpenses, getRetirementLogs, createRetirementLog } from '../../services/supabase/expenses';
import { getOdometer, getMaintenanceSchedule } from '../../services/supabase/maintenance';
import { getWeeklyMileage, getDailyMileage } from '../../services/supabase/mileage';
import type { DailyMileage } from '../../services/supabase/mileage';
import StatCard from '../../components/ui/StatCard';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatMiles, formatDate, getInitials } from '../../utils/formatting';
import { calculateSolo401kContribution } from '../../utils/irs';
import type { Load, Expense } from '../../types';
import type { MaintenanceItem } from '../../services/supabase/maintenance';

import {
  Bell,
  Plus,
  DollarSign,
  MessageSquare,
  Wrench,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sparkles,
  CheckCircle,
  Truck,
  Receipt,
  Calendar,
  X,
  MapPin,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'load' | 'expense';
  name: string;
  date: string;
  amount: number;
}

interface RetirementLog {
  id: string;
  driver_id: string;
  amount: number;
  type: string;
  date: string;
}

export default function DriverHomePage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [weeklyLoads, setWeeklyLoads] = useState<Load[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [odometer, setOdometer] = useState<number | null>(null);
  const [maintenanceSchedule, setMaintenanceSchedule] = useState<MaintenanceItem[]>([]);
  const [retirementLogs, setRetirementLogs] = useState<RetirementLog[]>([]);
  const [weeklyMileageEntries, setWeeklyMileageEntries] = useState<DailyMileage[]>([]);
  const [recentMileage, setRecentMileage] = useState<DailyMileage[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);
  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [contributionAmount, setContributionAmount] = useState('');
  const [submittingContribution, setSubmittingContribution] = useState(false);

  useEffect(() => {
    // Without clearing loading here, a null user leaves the page spinning forever.
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [loadsData, expensesData, odometerData, maintenanceData, retirementData, weeklyMileageData, allMileageData] = await Promise.all([
          getWeeklyLoads(user.id),
          getExpenses(user.id),
          getOdometer(user.id),
          getMaintenanceSchedule(user.id),
          getRetirementLogs(user.id),
          getWeeklyMileage(user.id),
          getDailyMileage(user.id),
        ]);

        setWeeklyLoads(loadsData);
        setExpenses(expensesData);
        setOdometer(odometerData);
        setMaintenanceSchedule(maintenanceData);
        setRetirementLogs(retirementData as RetirementLog[]);
        setWeeklyMileageEntries(weeklyMileageData);
        setRecentMileage(allMileageData.slice(0, 10));
      } catch (error) {
        console.error('Error fetching driver home page data:', error);
        showError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, showError]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Time-based greeting helper
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = user.full_name ? user.full_name.split(' ')[0] : 'Driver';

  // Current week calculations
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weeklyExpenses = expenses.filter((exp) => {
    const expDate = new Date(exp.date);
    return expDate >= startOfWeek;
  });

  const totalWeeklyRates = weeklyLoads.reduce((sum, load) => sum + (load.rate || 0), 0);
  const totalWeeklyExpenses = weeklyExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const netProfit = totalWeeklyRates - totalWeeklyExpenses;

  const loadMiles = weeklyLoads.reduce((sum, load) => sum + (load.miles || 0), 0);
  const standaloneMiles = weeklyMileageEntries.reduce((sum, entry) => sum + (entry.miles || 0), 0);
  const totalMiles = loadMiles + standaloneMiles;

  const activeLoadsCount = weeklyLoads.filter(
    (load) => load.status === 'active' || load.status === 'upcoming'
  ).length;

  // Combined activity stream
  const activityItems: ActivityItem[] = [
    ...weeklyLoads.map((load) => ({
      id: load.id,
      type: 'load' as const,
      name: load.broker_name,
      date: load.pickup_date,
      amount: load.rate,
    })),
    ...expenses.map((exp) => ({
      id: exp.id,
      type: 'expense' as const,
      name: exp.category.charAt(0).toUpperCase() + exp.category.slice(1),
      date: exp.date,
      amount: exp.amount,
    })),
  ];

  const recentActivities = activityItems
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // Maintenance alert conditions
  const currentOdometer = odometer || 0;
  const dueMaintenanceItems = maintenanceSchedule.filter(
    (item) => item.due_odometer - currentOdometer < 500
  );
  const showMaintenanceAlert = dueMaintenanceItems.length > 0;

  // Retirement nudge calculations
  const hasLoggedContributionThisWeek = retirementLogs.some((log) => {
    const logDate = new Date(log.date);
    return logDate >= startOfWeek;
  });

  const showRetirementNudge =
    !!user.fin_intel_addon && !hasLoggedContributionThisWeek && netProfit > 0;

  const suggestedContribution = showRetirementNudge
    ? Math.round(calculateSolo401kContribution(netProfit))
    : 0;

  const handleOpenContributionModal = () => {
    setContributionAmount(suggestedContribution.toString());
    setContributionModalOpen(true);
  };

  const handleLogContribution = async () => {
    const amount = parseFloat(contributionAmount);
    if (isNaN(amount) || amount <= 0) {
      showError('Please enter a valid contribution amount.');
      return;
    }

    try {
      setSubmittingContribution(true);
      const newLog = await createRetirementLog({
        driver_id: user.id,
        amount,
        type: 'Solo 401k',
        date: new Date().toISOString().split('T')[0],
      }) as RetirementLog;

      setRetirementLogs((prev) => [newLog, ...prev]);
      showSuccess(`Successfully logged contribution of ${formatCurrency(amount)}!`);
      setContributionModalOpen(false);
    } catch (error) {
      console.error('Error logging retirement contribution:', error);
      showError('Failed to log contribution. Please try again.');
    } finally {
      setSubmittingContribution(false);
    }
  };

  // Mock Notification Data
  const mockNotifications = [
    {
      id: 'notif-1',
      title: 'Active Load Dispatch',
      message: `${weeklyLoads[1]?.broker_name || 'TQL'} load is active. Pickup in ${weeklyLoads[1]?.origin || 'Atlanta, GA'}.`,
      time: '15 mins ago',
      type: 'info',
    },
    {
      id: 'notif-2',
      title: 'Maintenance Due Soon',
      message: dueMaintenanceItems[0]
        ? `${dueMaintenanceItems[0].type} is due in ${dueMaintenanceItems[0].due_odometer - currentOdometer} miles.`
        : 'Inspection required soon.',
      time: '2 hours ago',
      type: 'warning',
    },
    {
      id: 'notif-3',
      title: 'Weekly Profit Summary',
      message: `Your estimated weekly net profit stands at ${formatCurrency(netProfit)}.`,
      time: '1 day ago',
      type: 'success',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* HEADER SECTION */}
      <header className="flex items-center justify-between bg-navy-800/40 border border-white/5 rounded-2xl p-4 sm:p-6 backdrop-blur-md">
        <div className="flex items-center space-x-4">
          {/* Initials Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand-green/30 to-brand-green/10 border border-brand-green/20 flex items-center justify-center font-sans font-semibold text-brand-green text-lg tracking-wider shadow-inner">
            {getInitials(user.full_name)}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest font-sans">
              Driver Hub
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white font-sans mt-0.5">
              {getGreeting()}, {firstName}
            </h1>
          </div>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              if (unreadNotifications > 0) {
                setUnreadNotifications(0);
              }
            }}
            className={`p-3 rounded-full bg-navy-800 hover:bg-navy-700/80 border border-white/5 hover:border-white/10 text-gray-300 hover:text-white transition-all relative ${
              notificationsOpen ? 'ring-2 ring-brand-green/40 bg-navy-700/80' : ''
            }`}
            aria-label="Toggle notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-brand-red rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-navy-900 animate-pulse">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl glass-premium border border-white/10 shadow-2xl z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <h3 className="font-semibold text-white text-sm font-sans flex items-center gap-2">
                  <Bell className="w-4 h-4 text-brand-green" /> Notifications
                </h3>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {mockNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 rounded-xl bg-navy-800/60 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          notif.type === 'warning'
                            ? 'text-brand-amber bg-brand-amber/10'
                            : notif.type === 'success'
                            ? 'text-brand-green bg-brand-green/10'
                            : 'text-blue-400 bg-blue-500/10'
                        }`}
                      >
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-gray-500">{notif.time}</span>
                    </div>
                    <p className="text-xs text-gray-300 mt-1.5 leading-relaxed font-sans">
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* CONDITIONAL MAINTENANCE ALERT */}
      {showMaintenanceAlert && (
        <div className="bg-gradient-to-r from-brand-red/10 via-brand-red/5 to-navy-900 border border-brand-red/20 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-red" />
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-brand-red/10 rounded-xl text-brand-red border border-brand-red/20 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-sans">
                Immediate Maintenance Required
              </h3>
              <p className="text-xs text-gray-400 mt-1 max-w-xl font-sans leading-relaxed">
                You have active tasks on your maintenance schedule that are past due or less than 500
                miles away from service.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {dueMaintenanceItems.map((item) => {
                  const rem = item.due_odometer - currentOdometer;
                  return (
                    <span
                      key={item.id}
                      className="inline-flex items-center text-[11px] font-medium bg-navy-800/80 text-brand-red border border-brand-red/20 px-2.5 py-1 rounded-full font-mono"
                    >
                      <Wrench className="w-3 h-3 mr-1.5" />
                      {item.type}: {rem < 0 ? `overdue by ${Math.abs(rem)} mi` : `${rem} mi remaining`}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          <Link
            to="/driver/compliance"
            className="self-start md:self-center inline-flex items-center justify-center text-xs font-semibold text-white bg-brand-red hover:bg-brand-red/90 px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            Log Maintenance <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      )}

      {/* KPI ROW */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Net Profit (This Week)"
          value={formatCurrency(netProfit)}
          trend="+14.2%"
          trendDirection="up"
          subtext="After logged expenses"
        />
        <StatCard
          label="Miles This Week"
          value={formatMiles(totalMiles)}
          trend="+8.5%"
          trendDirection="up"
          subtext={standaloneMiles > 0 ? `${formatMiles(loadMiles)} from loads + ${formatMiles(standaloneMiles)} logged` : 'Across active/done loads'}
        />
        <StatCard
          label="Active & Upcoming Loads"
          value={activeLoadsCount}
          subtext="Loads scheduled this week"
        />
      </section>

      {/* RETIREMENT NUDGE */}
      {showRetirementNudge && (
        <section className="bg-gradient-to-br from-navy-800 via-navy-800 to-brand-green/5 border border-brand-green/20 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-brand-green/10 rounded-2xl text-brand-green border border-brand-green/20 shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="inline-flex items-center text-[10px] font-bold text-brand-green uppercase tracking-widest bg-brand-green/10 px-2 py-0.5 rounded-full mb-1">
                  FinIntel Smart Nudge
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white font-sans">
                  Secure Your Future
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-lg font-sans leading-relaxed">
                  You haven&apos;t logged a retirement contribution yet this week. Based on your current profit of{' '}
                  <span className="text-brand-green font-semibold">{formatCurrency(netProfit)}</span>, we
                  recommend a Solo 401(k) contribution of{' '}
                  <span className="text-white font-bold">{formatCurrency(suggestedContribution)}</span>.
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenContributionModal}
              className="inline-flex items-center justify-center bg-brand-green hover:bg-brand-green/90 text-navy-900 text-xs sm:text-sm font-bold px-5 py-3 rounded-xl transition-all shadow-lg active:scale-95 shrink-0"
            >
              Log Contribution
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QUICK ACTIONS */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-gray-400 uppercase tracking-widest font-sans px-1">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3.5">
            <Link
              to="/driver/loads/new"
              className="group p-5 bg-navy-800 hover:bg-navy-700/60 border border-white/5 hover:border-white/10 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-36 hover:scale-[1.02] shadow-md"
            >
              <div className="p-2.5 bg-brand-green/10 text-brand-green rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-sans">Log Miles</h3>
                <p className="text-xs text-gray-400 mt-1 font-sans">Enter new trip miles</p>
              </div>
            </Link>

            <Link
              to="/driver/expenses/new"
              className="group p-5 bg-navy-800 hover:bg-navy-700/60 border border-white/5 hover:border-white/10 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-36 hover:scale-[1.02] shadow-md"
            >
              <div className="p-2.5 bg-brand-red/10 text-brand-red rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-sans">Add Expense</h3>
                <p className="text-xs text-gray-400 mt-1 font-sans">Log receipts & costs</p>
              </div>
            </Link>

            <Link
              to="/driver/loads/new"
              className="group p-5 bg-navy-800 hover:bg-navy-700/60 border border-white/5 hover:border-white/10 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-36 hover:scale-[1.02] shadow-md"
            >
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-sans">New Load</h3>
                <p className="text-xs text-gray-400 mt-1 font-sans">Schedule upcoming cargo</p>
              </div>
            </Link>

            <a
              href="https://wa.me/12815550001"
              target="_blank"
              rel="noopener noreferrer"
              className="group p-5 bg-gradient-to-br from-navy-800 to-brand-green/5 hover:to-brand-green/10 border border-white/5 hover:border-brand-green/20 rounded-2xl text-left transition-all duration-300 flex flex-col justify-between h-36 hover:scale-[1.02] shadow-md"
            >
              <div className="p-2.5 bg-brand-green/10 text-brand-green rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-sans flex items-center">
                  Ask MilesBot <Sparkles className="w-3.5 h-3.5 ml-1 text-brand-green" />
                </h3>
                <p className="text-xs text-gray-400 mt-1 font-sans">WhatsApp automated logs</p>
              </div>
            </a>
          </div>
        </section>

        {/* RECENT ACTIVITY */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-gray-400 uppercase tracking-widest font-sans">
              Recent Activity
            </h2>
            <Link
              to="/driver/loads"
              className="text-xs font-semibold text-brand-green hover:underline flex items-center font-sans"
            >
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="bg-navy-800 border border-white/5 rounded-2xl p-4 shadow-lg space-y-3.5">
            {recentActivities.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 font-sans">No recent loads or expenses logged.</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-navy-900/50 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-xl border shrink-0 ${
                        activity.type === 'load'
                          ? 'bg-brand-green/10 text-brand-green border-brand-green/20'
                          : 'bg-brand-red/10 text-brand-red border-brand-red/20'
                      }`}
                    >
                      {activity.type === 'load' ? (
                        <Truck className="w-4 h-4" />
                      ) : (
                        <Receipt className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white font-sans">
                        {activity.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-sans flex items-center mt-0.5">
                        <Calendar className="w-3 h-3 mr-1 text-gray-600" />
                        {formatDate(activity.date)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-bold font-mono ${
                      activity.type === 'load' ? 'text-brand-green' : 'text-brand-red'
                    }`}
                  >
                    {activity.type === 'load' ? '+' : '-'} {formatCurrency(activity.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* DAILY MILEAGE LOG */}
      {recentMileage.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-gray-400 uppercase tracking-widest font-sans">
              Daily Mileage Log
            </h2>
            <span className="text-xs text-gray-500 font-sans">
              Logged via MilesBot
            </span>
          </div>
          <div className="bg-navy-800 border border-white/5 rounded-2xl p-4 shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest font-sans py-2 pr-4">Date</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-widest font-sans py-2 pr-4">Miles</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-widest font-sans py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMileage.map((entry) => (
                    <tr key={entry.id} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5 pr-4 text-xs text-gray-300 font-sans flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-gray-600" />
                        {formatDate(entry.log_date)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-xs font-bold text-white font-mono">
                        {entry.miles != null ? formatMiles(entry.miles) : '—'}
                      </td>
                      <td className="py-2.5 text-xs text-gray-400 font-sans">
                        {entry.notes ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-600" />
                            {entry.notes}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* INTERACTIVE RETIREMENT CONTRIBUTION MODAL */}
      {contributionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-navy-800 border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setContributionModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-brand-green/10 text-brand-green rounded-xl border border-brand-green/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white font-sans">Log Solo 401(k) Contribution</h3>
            </div>

            <p className="text-xs text-gray-300 mb-5 leading-relaxed font-sans">
              Log this contribution to your Solo 401(k) plan. This will be tracked in your retirement log and helps secure tax advantages.
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="contribution-amount"
                  className="block text-xs font-semibold text-gray-400 uppercase tracking-widest font-sans mb-1.5"
                >
                  Contribution Amount ($)
                </label>
                <input
                  id="contribution-amount"
                  type="number"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  className="w-full bg-navy-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-sans focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                  placeholder="Enter amount"
                  disabled={submittingContribution}
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setContributionModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white transition-colors font-sans"
                  disabled={submittingContribution}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogContribution}
                  className="inline-flex items-center justify-center bg-brand-green hover:bg-brand-green/90 disabled:bg-brand-green/50 text-navy-900 text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md font-sans"
                  disabled={submittingContribution}
                >
                  {submittingContribution ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-navy-900 border-t-transparent rounded-full animate-spin mr-1.5" />
                      Logging...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                      Confirm Contribution
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
