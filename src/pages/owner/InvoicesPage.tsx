import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { getFleetInvoices, updateInvoiceStatus } from '../../services/supabase/invoices';
import type { Invoice } from '../../types';
import { FileText, Clock, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';

export default function InvoicesPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const companyId = user?.company_id || 'company-123';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await getFleetInvoices(companyId);
      setInvoices(data && data.length > 0 ? data : DEMO_INVOICES);
    } catch (err) {
      console.error('Error loading invoices:', err);
      setInvoices(DEMO_INVOICES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const handleMarkPaid = async (inv: Invoice) => {
    setUpdatingId(inv.id);
    try {
      await updateInvoiceStatus(inv.id, 'paid');
      setInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? { ...i, status: 'paid', paid_date: new Date().toISOString() } : i))
      );
      showSuccess(`Invoice ${inv.invoice_number || inv.id} marked as paid.`);
    } catch (err) {
      showError('Could not update invoice status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        inv.client_name?.toLowerCase().includes(q) ||
        inv.driver_name?.toLowerCase().includes(q) ||
        inv.invoice_number?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, search]);

  const totals = useMemo(() => {
    const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
    const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
    return { outstanding, paid, overdueCount };
  }, [invoices]);

  const statusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'text-brand-green bg-brand-green/10 border-brand-green/20';
      case 'sent': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'overdue': return 'text-brand-red bg-brand-red/10 border-brand-red/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const fmt = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <p className="text-sm text-gray-400 mt-1">Manage fleet billing, payments, and overdue accounts.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2"><Clock className="w-4 h-4" /> Outstanding</div>
          <div className="text-2xl font-bold text-white font-mono">{fmt(totals.outstanding)}</div>
        </div>
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2"><CheckCircle2 className="w-4 h-4" /> Paid</div>
          <div className="text-2xl font-bold text-brand-green font-mono">{fmt(totals.paid)}</div>
        </div>
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2"><AlertTriangle className="w-4 h-4" /> Overdue</div>
          <div className="text-2xl font-bold text-brand-red font-mono">{totals.overdueCount}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client, driver, or invoice number..."
            className="w-full bg-navy-900 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-brand-green" />
        </div>
        <div className="flex gap-1.5 bg-navy-900 p-1 rounded-xl border border-white/5">
          {(['all', 'draft', 'sent', 'paid', 'overdue'] as StatusFilter[]).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${statusFilter === s ? 'bg-brand-green text-navy-900' : 'text-gray-400 hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-navy-800/40 border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-8 h-8 text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No invoices match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Invoice</th>
                  <th className="py-3.5 px-5">Client</th>
                  <th className="py-3.5 px-5">Driver</th>
                  <th className="py-3.5 px-5 text-right">Amount</th>
                  <th className="py-3.5 px-5">Due Date</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="text-sm hover:bg-white/5 transition-colors">
                    <td className="py-4 px-5 font-mono text-gray-300">{inv.invoice_number || inv.id.slice(0, 8)}</td>
                    <td className="py-4 px-5 text-white">{inv.client_name || '—'}</td>
                    <td className="py-4 px-5 text-gray-300">{inv.driver_name || '—'}</td>
                    <td className="py-4 px-5 text-right font-mono text-white">{fmt(inv.amount)}</td>
                    <td className="py-4 px-5 text-gray-400">{inv.due_date}</td>
                    <td className="py-4 px-5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded border uppercase ${statusBadge(inv.status)}`}>{inv.status}</span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      {inv.status !== 'paid' ? (
                        <button onClick={() => handleMarkPaid(inv)} disabled={updatingId === inv.id}
                          className="text-xs font-semibold text-brand-green hover:underline disabled:opacity-50">
                          {updatingId === inv.id ? 'Saving...' : 'Mark Paid'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500 flex items-center justify-end gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-brand-green" /> Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const DEMO_INVOICES: Invoice[] = [
  { id: 'inv-001', load_id: 'load-1', amount: 1800, status: 'sent', due_date: '2026-06-20', created_at: '2026-06-01', client_name: 'Echo Global Logistics', driver_name: 'Daniel Mensah', invoice_number: 'INV-1001' },
  { id: 'inv-002', load_id: 'load-2', amount: 1204, status: 'paid', due_date: '2026-06-10', paid_date: '2026-06-08', created_at: '2026-05-28', client_name: 'Coyote Logistics', driver_name: 'Samuel Osei', invoice_number: 'INV-1002' },
  { id: 'inv-003', load_id: 'load-3', amount: 950, status: 'overdue', due_date: '2026-06-01', created_at: '2026-05-15', client_name: 'CH Robinson', driver_name: 'Ama Boateng', invoice_number: 'INV-1003' },
];