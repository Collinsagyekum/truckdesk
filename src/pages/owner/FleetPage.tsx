import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getFleetDrivers } from '../../services/supabase/users';
import { getFleetLoads } from '../../services/supabase/loads';
import { getFleetExpenses } from '../../services/supabase/expenses';
import { mockDb } from '../../utils/mockDb';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { formatCurrency, formatMiles, getInitials } from '../../utils/formatting';
import type { User, Load, Expense } from '../../types';
import { 
  Search, 
  Filter, 
  ArrowUpDown,
  ChevronRight,
  Shield,
  Truck,
  TrendingUp,
  UserCheck
} from 'lucide-react';

export default function FleetPage() {
  const { user } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();

  // Data States
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Idle' | 'Review'>('All');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const companyId = user.company_id || 'company-123';
        
        const [driversData, loadsData, expensesData] = await Promise.all([
          getFleetDrivers(companyId),
          getFleetLoads(companyId),
          getFleetExpenses(companyId),
        ]);

        setDrivers(driversData);
        setLoads(loadsData);
        setExpenses(expensesData);
      } catch (error) {
        console.error('Error fetching fleet page data:', error);
        showError('Failed to load fleet directory.');
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

  // Date thresholds
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  // Map drivers to their combined metrics
  const driverRowData = drivers
    .filter((d) => d.role === 'driver')
    .map((driver) => {
      const driverLoads = loads.filter((l) => l.driver_id === driver.id);
      const driverWeeklyLoads = driverLoads.filter((l) => new Date(l.pickup_date) >= startOfWeek);
      const driverExpenses = expenses.filter((e) => e.driver_id === driver.id);
      const driverWeeklyExpenses = driverExpenses.filter((e) => new Date(e.date) >= startOfWeek);

      const milesThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.miles, 0);
      const revenueThisWeek = driverWeeklyLoads.reduce((sum, l) => sum + l.rate, 0);
      const expensesThisWeek = driverWeeklyExpenses.reduce((sum, e) => sum + e.amount, 0);
      const netProfitThisWeek = revenueThisWeek - expensesThisWeek;

      // Active Loads count (active/upcoming/in_transit/pending)
      const activeLoadsCount = driverLoads.filter(
        (l) => l.status === 'active' || l.status === 'upcoming' || l.status === 'in_transit' || l.status === 'pending'
      ).length;

      // Compliance details
      const driverCompliance = mockDb.getDriverCompliance(driver.id);
      const avgComplianceScore = driverCompliance.length > 0
        ? Math.round(driverCompliance.reduce((sum, c) => sum + (c.score || 0), 0) / driverCompliance.length)
        : 90;

      // Status helper
      let status: 'Active' | 'Idle' | 'Review' = 'Active';
      const hasFlagged = expenses.some((e) => e.driver_id === driver.id && e.flagged === true);
      const hasExpiring = driver.id === 'driver-david' || driver.id === 'driver-marcus'; // mock drivers with alerts
      
      if (hasFlagged || hasExpiring) {
        status = 'Review';
      } else if (driverLoads.length === 0 || driverWeeklyLoads.length === 0) {
        status = 'Idle';
      }

      // Vehicles matching
      let vehiclePlate = 'T-104';
      if (driver.id === 'mock-driver-id') vehiclePlate = 'T-209';
      if (driver.id === 'driver-john') vehiclePlate = 'T-345';
      if (driver.id === 'driver-marcus') vehiclePlate = 'T-982';

      return {
        ...driver,
        milesThisWeek,
        netProfitThisWeek,
        activeLoadsCount,
        complianceScore: avgComplianceScore,
        vehiclePlate,
        status,
      };
    });

  // Filter Row Data
  const filteredDrivers = driverRowData.filter((driver) => {
    const matchesSearch = driver.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (driver.email && driver.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          driver.vehiclePlate.toLowerCase().includes(searchQuery.toLowerCase());
    
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
            placeholder="Search by name, email, truck..."
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
                <th className="py-4 px-4 font-semibold">Truck</th>
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
                  <td colSpan={8} className="text-center py-12 text-xs text-gray-500 font-sans">
                    No drivers found matching your search.
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

                    {/* Truck */}
                    <td className="py-4 px-4 font-mono text-xs text-gray-300">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-gray-500" />
                        {driver.vehiclePlate}
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

                    {/* Compliance */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Shield className={`w-3.5 h-3.5 ${
                          driver.complianceScore >= 90
                            ? 'text-brand-green'
                            : driver.complianceScore >= 75
                            ? 'text-brand-amber'
                            : 'text-brand-red'
                        }`} />
                        <span className="font-semibold text-xs font-mono">
                          {driver.complianceScore}%
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
