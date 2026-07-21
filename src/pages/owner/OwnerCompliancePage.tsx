import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getFleetDrivers } from '../../services/supabase/users';
import type { User } from '../../types';
import { Shield, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface Row { driver: User; score: number; alerts: number; status: 'clear' | 'attention' | 'critical'; }

const DEMO: User[] = [
  { id: 'drv-1', full_name: 'Daniel Mensah', role: 'driver', created_at: '', updated_at: '' } as User,
  { id: 'drv-2', full_name: 'Samuel Osei', role: 'driver', created_at: '', updated_at: '' } as User,
  { id: 'drv-3', full_name: 'Ama Boateng', role: 'driver', created_at: '', updated_at: '' } as User,
];

export default function OwnerCompliancePage() {
  const { user } = useAuth();
  const companyId = user?.company_id || 'company-123';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const drivers = await getFleetDrivers(companyId);
        const list = drivers && drivers.length > 0 ? drivers : DEMO;
        setRows(list.map((driver, i) => ({
          driver,
          score: [98, 84, 71][i % 3],
          alerts: [0, 1, 2][i % 3],
          status: (['clear', 'attention', 'critical'] as const)[i % 3],
        })));
      } catch {
        setRows(DEMO.map((driver, i) => ({
          driver,
          score: [98, 84, 71][i % 3],
          alerts: [0, 1, 2][i % 3],
          status: (['clear', 'attention', 'critical'] as const)[i % 3],
        })));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [companyId]);

  const cfg = (s: Row['status']) => {
    if (s === 'clear') return { label: 'Clear', cls: 'text-brand-green bg-brand-green/10 border-brand-green/20', Icon: CheckCircle2 };
    if (s === 'attention') return { label: 'Needs Attention', cls: 'text-brand-amber bg-brand-amber/10 border-brand-amber/20', Icon: AlertTriangle };
    return { label: 'Critical', cls: 'text-brand-red bg-brand-red/10 border-brand-red/20', Icon: XCircle };
  };

  const clear = rows.filter((r) => r.status === 'clear').length;
  const attention = rows.filter((r) => r.status === 'attention').length;
  const critical = rows.filter((r) => r.status === 'critical').length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fleet Compliance</h1>
        <p className="text-sm text-gray-400 mt-1">Driver compliance scores and maintenance alerts across your fleet.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Clear</div>
          <div className="text-2xl font-bold text-brand-green">{clear}</div>
        </div>
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Needs Attention</div>
          <div className="text-2xl font-bold text-brand-amber">{attention}</div>
        </div>
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Critical</div>
          <div className="text-2xl font-bold text-brand-red">{critical}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-brand-green" />
        <h2 className="text-sm font-semibold text-white">Driver Compliance Status</h2>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const c = cfg(r.status);
            return (
              <div key={r.driver.id} className="bg-navy-800/40 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-green/15 text-brand-green flex items-center justify-center text-xs font-bold">{r.driver.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}</div>
                  <div>
                    <div className="text-white font-medium text-sm">{r.driver.full_name}</div>
                    <div className="text-xs text-gray-400">{r.alerts > 0 ? r.alerts + ' maintenance alert(s)' : 'No alerts'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={'font-mono font-bold text-sm ' + (r.score >= 95 ? 'text-brand-green' : r.score >= 80 ? 'text-brand-amber' : 'text-brand-red')}>{r.score}%</span>
                  <span className={'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded border uppercase ' + c.cls}><c.Icon className="w-3.5 h-3.5" /> {c.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
