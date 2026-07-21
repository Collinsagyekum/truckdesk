import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Truck, ArrowRight, DollarSign, Calendar } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getLoads } from '../../services/supabase/loads';
import type { Load } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import LoadStatusBadge from '../../components/ui/LoadStatusBadge';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

export default function LoadsListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const driverId = user?.id || 'mock-driver';

  useEffect(() => {
    async function loadData() {
      try {
        const fetchedLoads = await getLoads(driverId);
        setLoads(fetchedLoads);
      } catch (err) {
        console.error('Error fetching loads:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [driverId]);

  // Sort and filter loads
  const filteredLoads = useMemo(() => {
    const sorted = [...loads].sort(
      (a, b) => new Date(b.pickup_date).getTime() - new Date(a.pickup_date).getTime()
    );

    return sorted.filter((load) => {
      const matchesSearch =
        load.broker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        load.destination.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || load.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [loads, searchTerm, statusFilter]);

  const rightAction = (
    <Link to="/driver/loads/new">
      <Button
        variant="primary"
        size="sm"
        leftIcon={<Plus className="w-4 h-4 text-navy-900" />}
      >
        Create Load
      </Button>
    </Link>
  );

  return (
    <div className="max-w-lg mx-auto w-full pb-8">
      <PageHeader title="My Loads" rightAction={rightAction} />

      <div className="mt-4 px-1 space-y-4">
        {/* Search & Filters */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by broker, origin, or destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-white/10 rounded-xl text-sm text-white placeholder-gray-400 focus:outline-none focus:border-brand-green/50 transition-all font-sans"
            />
          </div>

          {/* Status filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {['all', 'active', 'delivered', 'upcoming'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border capitalize whitespace-nowrap transition-all duration-200 ${
                  statusFilter === status
                    ? 'bg-brand-green text-navy-900 border-brand-green shadow-[0_2px_8px_rgba(34,197,94,0.2)]'
                    : 'bg-navy-800 text-gray-400 border-white/5 hover:text-white hover:bg-navy-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Loads List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="md" />
          </div>
        ) : filteredLoads.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={searchTerm || statusFilter !== 'all' ? 'No loads found' : 'No loads assigned'}
            message={
              searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'You don\'t have any loads yet. Create a new load to start tracking.'
            }
            ctaLabel={!(searchTerm || statusFilter !== 'all') ? 'Create Load' : undefined}
            onCta={() => navigate('/driver/loads/new')}
          />
        ) : (
          <div className="space-y-3">
            {filteredLoads.map((load) => (
              <div
                key={load.id}
                onClick={() => navigate(`/driver/loads/${load.id}`)}
                className="bg-navy-800 border border-white/5 rounded-2xl p-4 hover:border-white/15 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.3)] active:scale-[0.98]"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs text-gray-400 font-sans block mb-1">
                      {load.broker_name}
                    </span>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white font-sans">
                      <span>{load.origin}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-brand-green" />
                      <span>{load.destination}</span>
                    </div>
                  </div>
                  <LoadStatusBadge status={load.status} />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-1.5 text-brand-green font-semibold text-base font-sans">
                    <DollarSign className="w-4 h-4 text-brand-green" />
                    <span>{load.rate.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-sans">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(load.pickup_date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
