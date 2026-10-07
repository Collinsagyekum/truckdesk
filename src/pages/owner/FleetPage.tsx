import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getFleetDrivers } from '../../services/supabase/users';
import { getFleetLoads } from '../../services/supabase/loads';
import { getFleetExpenses } from '../../services/supabase/expenses';
import { getComplianceDocs, summarizeCompliance } from '../../services/supabase/compliance';
import type { ComplianceStatus } from '../../services/supabase/compliance';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatMiles, getInitials, toLocalDate } from '../../utils/formatting';
import type { User, Load, Expense } from '../../types';
import {
  Search,
  Filter,
  ChevronRight,
  Shield,
  AlertTriangle,
} from 'lucide-react';

const COMPLIANCE_LABEL: Record<ComplianceStatus | 'unknown', { label: string; cls: string }> = {
  clear: { label: 'Clear', cls: 'text-brand-green' },
  attention: { label: 'Attention', cls: 'text-brand-amber' },
  critical: { label: 'Critical', cls: 'text-brand-red' },
  unknown: { label: '—', cls: 'text-gray-500' },
};

export default function FleetPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data States
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  // Per-driver document status, from their real compliance records.
  const [compliance, setCompliance] = useState<Record<string, ComplianceStatus | 'unknown'>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Idle' | 'Review'>('All');

  useEffect(() => {
    // Without clearing loading here, a null user leaves the page spinning forever.
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        // Scope the fleet to this owner's own drivers (owner_id === their id).
        const ownerId = user.id;

        const [driversData, loadsData, expensesData] = await Promise.all([
          getFleetDrivers(ownerId),
          getFleetLoads(ownerId),
          getFleetExpenses(ownerId),
        ]);

        setDrivers(driversData);
        setLoads(loadsData);
        setExpenses(expensesData);

        // One driver's documents failing shouldn't hide the rest of the table.
        const docResults = await Promise.allSettled(driversData.map((d) => getComplianceDocs(d.id)));
        const byDriver: Record<string, ComplianceStatus | 'unknown'> = {};
        driversData.forEach((d, i) => {
          const r = docResults[i];
          byDriver[d.id] = r.status === 'fulfilled' ? summarizeCompliance(r.value).status : 'unknown';
        });
        setCompliance(byDriver);
      } catch (error) {
        // Distinct from an empty fleet, which would read as "no drivers".
        console.error('Error fetching fleet page data:', error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
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
          className="text-sm font-semibold text-[#0A1628] bg-brand-green hover:bg-brand-green/90 px-5 py-2.5 rounded-xl"
        >
          Try again
        </button>
      </div>
    );
  }

  // Date thresholds
  // Rolling last-7-days window (today + the previous 6 days), matching the
  // driver Home and owner dashboard.
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  // Map drivers to their combined metrics
  const driverRowData = drivers
    .filter((d) => d.role === 'driver')
    .map((driver) => {
      const driverLoads = loads.filter((l) => l.driver_id === driver.id);
      const driverWeeklyLoads = driverLoads.filter((l) => toLocalDate(l.pickup_date) >= startOfWeek);
      const driverExpenses = expenses.filter((e) => e.driver_id === driver.id);
      const driverWeeklyExpenses = driverExpenses.filter((e) => toLocalDate(e.date) >= startOfWeek);

      const milesThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.miles, 0);
      const revenueThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.rate, 0);
      const expensesThisWeek = driverWeeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfitThisWeek = revenueThisWeek - expensesThisWeek;

      // Active Loads count (active/upcoming/in_transit/pending)
      const activeLoadsCount = driverLoads.filter(
        (l) => l.status === 'active' || l.status === 'upcoming' || l.status === 'in_transit' || l.status === 'pending'
      ).length;

      const complianceStatus = compliance[driver.id] ?? 'unknown';

      // Status helper: expired documents or a flagged receipt put a driver
      // under review.
      let status: 'Active' | 'Idle' | 'Review' = 'Active';
      const hasFlagged = expenses.some((e) => e.driver_id === driver.id && e.flagged === true);

      if (hasFlagged || complianceStatus === 'critical') {
        status = 'Review';
      } else if (driverLoads.length === 0 || driverWeeklyLoads.length === 0) {
        status = 'Idle';
      }

      return {
        ...driver,
        milesThisWeek,
        netProfitThisWeek,
        activeLoadsCount,
        complianceStatus,
        status,
      };
    });

  // Filter Row Data
  const filteredDrivers = driverRowData.filter((driver) => {
    const matchesSearch = driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (driver.email && driver.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || driver.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans">
          Fleet Directory
        </h1>
        <p className="text-xs text-gray-400 font-sans mt-1">
          Monitor operational performance, compliance health, and load schedules for all drivers.
        </p>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-navy-800/40 border border-white/5 p-4 rounded-2xl backdrop-blur-md">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green text-white placeholder-gray-500"
            placeholder="Search by name or email..."
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-gray-500 font-sans mr-2 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Filter Status:
          </span>
          {(['All', 'Active', 'Idle', 'Review'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                statusFilter === tab
                  ? 'bg-brand-green/10 text-brand-green border border-brand-green/20'
                  : 'bg-navy-900/40 text-gray-400 border border-transparent hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

      </div>

      {/* TABLE */}
      <div className="bg-navy-800 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-navy-900/30 text-[10px] text-gray-500 uppercase tracking-widest font-sans">
                <th className="py-4 px-6 font-semibold">Driver Details</th>
                <th className="py-4 px-4 font-semibold text-center">Status</th>
                <th className="py-4 px-4 font-semibold">Weekly Miles</th>
                <th className="py-4 px-4 font-semibold">Weekly Net Profit</th>
                <th className="py-4 px-4 font-semibold text-center">Active Loads</th>
                <th className="py-4 px-4 font-semibold text-center">Compliance</th>
                <th className="py-4 px-6 font-semibold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-xs text-gray-500 font-sans">
                    {driverRowData.length === 0
                      ? 'No drivers in your fleet yet.'
                      : 'No drivers found matching your search.'}
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => (
                  <tr
                    key={driver.id}
                    onClick={() => navigate(`/owner/driver/${driver.id}`)}
                    className="hover:bg-navy-700/20 cursor-pointer transition-colors group"
                  >
                    {/* Details */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-green/20 to-brand-green/5 border border-brand-green/20 flex items-center justify-center font-bold text-brand-green text-xs">
                          {getInitials(driver.full_name)}
                        </div>
                        <div>
                          <h4 className="font-bold text-white group-hover:text-brand-green transition-colors font-sans leading-none">
                            {driver.full_name}
                          </h4>
                          <span className="text-[10px] text-gray-500 font-mono mt-1 block">
                            {driver.email || 'No Email'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full inline-block ${
                          driver.status === 'Active'
                            ? 'text-brand-green bg-brand-green/10 border border-brand-green/20'
                            : driver.status === 'Idle'
                            ? 'text-brand-amber bg-brand-amber/10 border border-brand-amber/20'
                            : 'text-brand-red bg-brand-red/10 border border-brand-red/20'
                        }`}
                      >
                        {driver.status}
                      </span>
                    </td>

                    {/* Weekly Miles */}
                    <td className="py-4 px-4 font-mono text-xs text-gray-300">
                      {formatMiles(driver.milesThisWeek)}
                    </td>

                    {/* Weekly Profit */}
                    <td className="py-4 px-4 font-mono text-xs font-semibold">
                      <span className={driver.netProfitThisWeek >= 0 ? 'text-brand-green' : 'text-brand-red'}>
                        {formatCurrency(driver.netProfitThisWeek)}
                      </span>
                    </td>

                    {/* Active Loads */}
                    <td className="py-4 px-4 text-center font-mono text-xs text-gray-300">
                      <span className="inline-flex items-center justify-center bg-navy-900/60 border border-white/5 w-6 h-6 rounded-lg">
                        {driver.activeLoadsCount}
                      </span>
                    </td>

                    {/* Compliance: from the driver's real documents */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Shield className={`w-3.5 h-3.5 ${COMPLIANCE_LABEL[driver.complianceStatus].cls}`} />
                        <span className={`font-semibold text-xs ${COMPLIANCE_LABEL[driver.complianceStatus].cls}`}>
                          {COMPLIANCE_LABEL[driver.complianceStatus].label}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-4 px-6 text-center">
                      <button className="text-gray-400 group-hover:text-brand-green transition-colors inline-flex items-center gap-0.5 text-xs font-semibold font-sans">
                        Details <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
