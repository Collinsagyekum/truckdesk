import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getFleetDrivers } from '../../services/supabase/users';
import { getComplianceDocs, summarizeCompliance } from '../../services/supabase/compliance';
import type { ComplianceStatus } from '../../services/supabase/compliance';
import type { User } from '../../types';
import { Shield, CheckCircle2, AlertTriangle, XCircle, ChevronRight } from 'lucide-react';

// 'unknown' when a driver's documents couldn't be loaded.
type Status = ComplianceStatus | 'unknown';

interface Row {
  driver: User;
  status: Status;
  expired: string[];
  expiringSoon: string[];
  missing: string[];
}

function describe(row: Row): string {
  if (row.status === 'unknown') return "Couldn't load documents";
  const parts = [
    ...row.expired.map((t) => `${t} expired`),
    ...row.expiringSoon.map((t) => `${t} expiring soon`),
    ...row.missing.map((t) => `${t} missing`),
  ];
  return parts.length ? parts.join(' · ') : 'All documents current';
}

export default function OwnerCompliancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const companyId = user?.company_id ?? '';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const drivers = await getFleetDrivers(companyId);
        // One driver's documents failing to load shouldn't hide the others.
        const results = await Promise.allSettled(drivers.map((d) => getComplianceDocs(d.id)));
        setRows(
          drivers.map((driver, i) => {
            const result = results[i];
            if (result.status === 'fulfilled') return { driver, ...summarizeCompliance(result.value) };
            console.error(`Compliance docs failed for driver ${driver.id}:`, result.reason);
            return { driver, status: 'unknown', expired: [], expiringSoon: [], missing: [] };
          })
        );
      } catch (err) {
        console.error('Error loading fleet compliance:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [companyId, reloadKey]);

  const cfg = (s: Status) => {
    if (s === 'clear') return { label: 'Clear', cls: 'text-brand-green bg-brand-green/10 border-brand-green/20', Icon: CheckCircle2 };
    if (s === 'attention') return { label: 'Needs Attention', cls: 'text-brand-amber bg-brand-amber/10 border-brand-amber/20', Icon: AlertTriangle };
    if (s === 'critical') return { label: 'Critical', cls: 'text-brand-red bg-brand-red/10 border-brand-red/20', Icon: XCircle };
    return { label: 'Unknown', cls: 'text-gray-400 bg-white/5 border-white/10', Icon: AlertTriangle };
  };

  const clear = rows.filter((r) => r.status === 'clear').length;
  const attention = rows.filter((r) => r.status === 'attention').length;
  const critical = rows.filter((r) => r.status === 'critical').length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fleet Compliance</h1>
        <p className="text-sm text-gray-400 mt-1">
          Each driver&apos;s required documents — expired, expiring within 30 days, or missing.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Clear</div>
          <div className="text-2xl font-bold text-brand-green">{loading || loadError ? '—' : clear}</div>
        </div>
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Needs Attention</div>
          <div className="text-2xl font-bold text-brand-amber">{loading || loadError ? '—' : attention}</div>
        </div>
        <div className="bg-navy-800/60 border border-white/5 rounded-2xl p-5">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Critical</div>
          <div className="text-2xl font-bold text-brand-red">{loading || loadError ? '—' : critical}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-brand-green" />
        <h2 className="text-sm font-semibold text-white">Driver Compliance Status</h2>
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : loadError ? (
        <div className="bg-navy-800/40 border border-brand-amber/30 rounded-2xl p-5 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-200">Couldn&apos;t load your fleet. Check your connection and try again.</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="text-sm font-semibold text-brand-green hover:underline shrink-0"
          >
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-gray-400 text-sm">No drivers in your fleet yet.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const c = cfg(r.status);
            return (
              <button
                key={r.driver.id}
                onClick={() => navigate(`/owner/driver/${r.driver.id}`)}
                className="w-full text-left bg-navy-800/40 border border-white/5 hover:border-white/15 rounded-2xl p-5 flex items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-brand-green/15 text-brand-green flex items-center justify-center text-xs font-bold shrink-0">
                    {r.driver.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-medium text-sm">{r.driver.full_name}</div>
                    <div className="text-xs text-gray-400 truncate">{describe(r)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded border uppercase ' + c.cls}>
                    <c.Icon className="w-3.5 h-3.5" /> {c.label}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
