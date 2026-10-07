import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import {
  getMaintenanceSchedule,
  updateOdometer,
  getOdometer,
  logMaintenanceService,
} from '../../services/supabase/maintenance';
import type { MaintenanceItem } from '../../services/supabase/maintenance';
import { getCurrentQuarter } from '../../utils/irs';
import { getExpenses } from '../../services/supabase/expenses';
import { getComplianceDocs, saveComplianceDoc, daysUntilExpiry } from '../../services/supabase/compliance';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
  Calendar,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Upload,
  Download,
  Fuel,
  MapPin,
  Clock,
  Gauge,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface ComplianceDocument {
  id: string;
  type: string;
  title: string;
  expiry_date: string;
  document_url?: string;
  fileName?: string;
}

// Today's date as YYYY-MM-DD in the driver's own time zone. toISOString()
// would give UTC, which is already tomorrow on a US evening.
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CompliancePage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const driverId = user?.id;

  // Tabs state: Maintenance | Documents | HOS | IFTA
  const [activeTab, setActiveTab] = useState<'maintenance' | 'documents' | 'hos' | 'ifta'>('maintenance');
  const [loading, setLoading] = useState(true);
  // Sections that failed to load, named for the retry banner.
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  // Odometer states. Null until known — a driver with no truck on file has no
  // reading, and a placeholder number would drive every maintenance estimate.
  const [currentOdometer, setCurrentOdometer] = useState<number | null>(null);
  const [isOdoModalOpen, setIsOdoModalOpen] = useState(false);
  const [newOdoVal, setNewOdoVal] = useState('');
  const [isUpdatingOdo, setIsUpdatingOdo] = useState(false);

  // Maintenance states
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [customType, setCustomType] = useState('');
  const [serviceDate, setServiceDate] = useState(localToday);
  const [serviceOdometer, setServiceOdometer] = useState<number | ''>('');
  const [dueOdometerVal, setDueOdometerVal] = useState<number | ''>('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [isLoggingService, setIsLoggingService] = useState(false);

  // Documents states
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocForUpload, setSelectedDocForUpload] = useState<ComplianceDocument | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // IFTA states
  const [expenses, setExpenses] = useState<any[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>(
    () => `Q${getCurrentQuarter()}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
  );
  // IFTA is filed per quarter of a specific year.
  const iftaYear = new Date().getFullYear();

  // Fetch all initial data. Sections load independently, so a missing truck
  // record can't stop the driver's documents from loading.
  const fetchData = async (forDriver: string) => {
    setLoading(true);
    const [odoR, scheduleR, expensesR, docsR] = await Promise.allSettled([
      getOdometer(forDriver),
      getMaintenanceSchedule(forDriver),
      getExpenses(forDriver),
      // Standard slots overlaid with whatever the driver has provided.
      getComplianceDocs(forDriver),
    ]);

    const errors: string[] = [];
    if (odoR.status === 'fulfilled') setCurrentOdometer(odoR.value);
    else errors.push('odometer');
    if (scheduleR.status === 'fulfilled') setMaintenanceItems(scheduleR.value);
    else errors.push('maintenance schedule');
    if (expensesR.status === 'fulfilled') setExpenses(expensesR.value);
    else errors.push('fuel purchases');
    if (docsR.status === 'fulfilled') setDocuments(docsR.value);
    else errors.push('documents');

    for (const r of [odoR, scheduleR, expensesR, docsR]) {
      if (r.status === 'rejected') console.error('Compliance: a section failed to load', r.reason);
    }
    setLoadErrors(errors);
    setLoading(false);
  };

  useEffect(() => {
    if (driverId) fetchData(driverId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  // Prepopulate standard fields when service type changes. Without a known
  // odometer there's nothing to prefill from, so the driver types it.
  useEffect(() => {
    if (currentOdometer == null) return;
    if (serviceType && serviceType !== 'custom') {
      const item = maintenanceItems.find((m) => m.type === serviceType);
      if (item) {
        const interval = item.due_odometer - item.last_service_odometer;
        const odo = currentOdometer;
        setServiceOdometer(odo);
        setDueOdometerVal(odo + (interval > 0 ? interval : 15000));
      }
    } else if (serviceType === 'custom') {
      const odo = currentOdometer;
      setServiceOdometer(odo);
      setDueOdometerVal(odo + 15000);
    }
  }, [serviceType, currentOdometer, maintenanceItems]);

  // Handler: Update current odometer
  const handleOdometerSave = async () => {
    if (!driverId) return;
    const odoNum = Number(newOdoVal);
    if (!newOdoVal || odoNum <= 0) {
      showError('Please enter a valid odometer reading.');
      return;
    }
    setIsUpdatingOdo(true);
    try {
      const success = await updateOdometer(driverId, odoNum);
      if (success) {
        setCurrentOdometer(odoNum);
        showSuccess('Current vehicle odometer updated successfully.');
        setIsOdoModalOpen(false);
        setNewOdoVal('');
      } else {
        // updateOdometer only updates an existing vehicle row.
        showError("There's no truck on file for your account yet, so the reading can't be saved.");
      }
    } catch (err) {
      console.error('Odometer update failed:', err);
      showError("Couldn't update the odometer. Please try again.");
    } finally {
      setIsUpdatingOdo(false);
    }
  };

  // Handler: Log service done
  const handleLogService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) return;
    if (!serviceType || !serviceDate || !serviceOdometer || !dueOdometerVal) {
      showError('Please fill out all required fields.');
      return;
    }

    const typeStr = serviceType === 'custom' ? customType : serviceType;
    if (!typeStr) {
      showError('Please specify the service type.');
      return;
    }

    setIsLoggingService(true);
    try {
      const payload = {
        driver_id: driverId,
        type: typeStr,
        last_service_date: serviceDate,
        last_service_odometer: Number(serviceOdometer),
        due_odometer: Number(dueOdometerVal),
        notes: serviceNotes || undefined,
      };

      const saved = await logMaintenanceService(payload);
      showSuccess(`Log entry created for ${typeStr}.`);

      // Reset form
      setServiceType('');
      setCustomType('');
      setServiceNotes('');

      // Refresh the schedule. The entry is already saved, so a failed refresh
      // falls back to adding it locally rather than reporting a failed save.
      try {
        setMaintenanceItems(await getMaintenanceSchedule(driverId));
      } catch (refreshErr) {
        console.error('Schedule refresh failed after saving:', refreshErr);
        setMaintenanceItems((prev) => [...prev, saved]);
      }
    } catch (err) {
      console.error('Logging service failed:', err);
      showError("Couldn't log the service record. Please try again.");
    } finally {
      setIsLoggingService(false);
    }
  };

  // Helper: Open document upload modal
  const openUploadModal = (doc: ComplianceDocument) => {
    setSelectedDocForUpload(doc);
    setNewExpiryDate(doc.expiry_date);
    setUploadedFileName(doc.fileName || '');
    setSelectedFile(null);
    setIsUploadOpen(true);
  };

  // Handler: Submit document upload — persists to Supabase + uploads the scan.
  const handleUploadSubmit = async () => {
    if (!driverId || !selectedDocForUpload || !newExpiryDate) return;
    setIsUploading(true);
    try {
      // Throws if the scan upload or the record save fails, so the card below
      // is only updated once the document is genuinely stored.
      const saved = await saveComplianceDoc(
        driverId,
        {
          type: selectedDocForUpload.type,
          title: selectedDocForUpload.title,
          expiry_date: newExpiryDate,
        },
        selectedFile
      );

      setDocuments((prev) =>
        prev.map((doc) =>
          doc.type === selectedDocForUpload.type
            ? { ...doc, ...saved, fileName: uploadedFileName || doc.fileName }
            : doc
        )
      );
      showSuccess(`${selectedDocForUpload.type} saved.`);
      setIsUploadOpen(false);
    } catch (err) {
      // The modal stays open with the driver's input so they can retry.
      console.error('Compliance save failed:', err);
      showError(
        selectedFile
          ? "Couldn't save the document — the scan may not have uploaded. Please try again."
          : "Couldn't save the document. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  // IFTA: Filter and group fuel transactions. Date-only strings parse as UTC
  // midnight — the previous day in US time zones, enough to push a fuel stop on
  // the first of a quarter into the prior one — so parse them at noon.
  const parseDay = (dateStr: string) =>
    new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr);
  const getQuarter = (dateStr: string) => {
    const d = parseDay(dateStr);
    const m = d.getMonth(); // 0-11
    if (m >= 0 && m <= 2) return 'Q1';
    if (m >= 3 && m <= 5) return 'Q2';
    if (m >= 6 && m <= 8) return 'Q3';
    return 'Q4';
  };

  // Real fuel purchases only. MilesBot records the purchase state and gallons
  // on fuel expenses; anything missing a state is surfaced as "Unknown" rather
  // than invented, so the IFTA summary always reflects actual filings data.
  const fuelPurchases = useMemo(() => {
    return (expenses.filter((e) => e.category === 'fuel') as any[]).map((e) => ({
      ...e,
      ifta_eligible: e.ifta_eligible !== undefined ? e.ifta_eligible : true,
      state: e.state || null,
      gallons: typeof e.gallons === 'number' ? e.gallons : null,
    }));
  }, [expenses]);

  // Fuel stops that can't be attributed to a state yet — shown as a prompt so
  // the driver knows what's missing from their IFTA report.
  const unattributedFuelCount = useMemo(
    () => fuelPurchases.filter((p) => !p.state).length,
    [fuelPurchases]
  );

  const groupedIFTAData = useMemo(() => {
    // Match the year as well as the quarter: otherwise Q3 would combine fuel
    // from every year's Q3 into one filing.
    const filtered = fuelPurchases.filter((p) => {
      if (!p.ifta_eligible) return false;
      return parseDay(p.date).getFullYear() === iftaYear && getQuarter(p.date) === selectedQuarter;
    });

    const groups: Record<string, { state: string; gallons: number; amount: number; count: number }> = {};
    filtered.forEach((p) => {
      // Stops without a state can't be filed for IFTA and would distort the
      // per-gallon math (no gallons recorded), so they're reported separately
      // in the "missing a state" prompt rather than mixed into the table.
      if (!p.state) return;
      const st = p.state;
      if (!groups[st]) {
        groups[st] = { state: st, gallons: 0, amount: 0, count: 0 };
      }
      groups[st].gallons += p.gallons ?? 0;
      groups[st].amount += p.amount;
      groups[st].count += 1;
    });

    return Object.values(groups).sort((a, b) => b.amount - a.amount);
  }, [fuelPurchases, selectedQuarter, iftaYear]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (groupedIFTAData.length === 0) {
      showError(`No fuel purchase data found for ${selectedQuarter} ${iftaYear} to export.`);
      return;
    }

    const headers = 'State,Gallons Purchased,Total Cost ($),Avg Cost/Gallon ($),Transactions Count\n';
    const rows = groupedIFTAData
      .map(
        (r) =>
          `${r.state},${r.gallons},${r.amount.toFixed(2)},${r.gallons > 0 ? (r.amount / r.gallons).toFixed(2) : ''},${r.count}`
      )
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `IFTA_Report_${iftaYear}_${selectedQuarter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess(`IFTA Report for ${selectedQuarter} ${iftaYear} exported successfully!`);
  };

  // Helper to determine document validity status details, measured against
  // the real current date.
  const getDocStatusDetails = (expiryDateStr: string) => {
    const days = daysUntilExpiry(expiryDateStr);
    // An empty slot has no expiry date; without this check the NaN comparisons
    // below all fail and it would fall through to "Valid".
    if (days == null) {
      return {
        label: 'Not provided',
        days: null,
        colorClass: 'text-brand-amber bg-brand-amber/10 border-brand-amber/20',
        icon: <AlertTriangle className="w-4 h-4 text-brand-amber" />,
      };
    }

    if (days < 0) {
      return {
        label: 'Expired',
        days,
        colorClass: 'text-brand-red bg-brand-red/10 border-brand-red/20',
        icon: <XCircle className="w-4 h-4 text-brand-red" />,
      };
    }
    if (days < 30) {
      return {
        label: `${days} days left`,
        days,
        colorClass: 'text-brand-red bg-brand-red/10 border-brand-red/20',
        icon: <AlertTriangle className="w-4 h-4 text-brand-red" />,
      };
    }
    if (days <= 90) {
      return {
        label: `${days} days left`,
        days,
        colorClass: 'text-brand-amber bg-brand-amber/10 border-brand-amber/20',
        icon: <AlertTriangle className="w-4 h-4 text-brand-amber" />,
      };
    }
    return {
      label: 'Valid',
      days,
      colorClass: 'text-brand-green bg-brand-green/10 border-brand-green/20',
      icon: <CheckCircle2 className="w-4 h-4 text-brand-green" />,
    };
  };

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <PageHeader title="Compliance & Maintenance" />

      {loadErrors.length > 0 && (
        <div className="flex items-start justify-between gap-3 p-4 rounded-xl border border-brand-amber/30 bg-brand-amber/10">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-brand-amber shrink-0 mt-0.5" />
            <p className="text-sm text-gray-200">
              Couldn&apos;t load your {loadErrors.join(', ')}. What&apos;s shown below may be incomplete.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => driverId && fetchData(driverId)}>
            Try again
          </Button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex p-1 bg-navy-800/80 backdrop-blur rounded-xl border border-white/5 gap-1">
        {(['maintenance', 'documents', 'hos', 'ifta'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 min-w-0 truncate py-2.5 text-sm font-semibold rounded-lg capitalize transition-all duration-200 ${
              activeTab === tab
                ? 'bg-brand-green text-[#0A1628] shadow-lg shadow-brand-green/25 font-bold'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab CONTENT: Maintenance */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Dashboard Bar */}
          <div className="card-premium p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-green/10 border border-brand-green/20 rounded-xl">
                <Gauge className="w-6 h-6 text-brand-green" />
              </div>
              <div>
                <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">
                  Current Odometer
                </span>
                <span className="text-2xl font-bold font-mono text-white">
                  {currentOdometer == null ? (
                    <span className="text-lg font-sans text-gray-400">Not set</span>
                  ) : (
                    <>
                      {currentOdometer.toLocaleString()} <span className="text-sm font-sans font-normal text-gray-400">mi</span>
                    </>
                  )}
                </span>
              </div>
            </div>
            <Button variant="secondary" leftIcon={<RefreshCwIcon />} onClick={() => setIsOdoModalOpen(true)}>
              Update Current Odometer
            </Button>
          </div>

          {/* Schedule List */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-green" />
              Maintenance Schedule & Reminders
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {maintenanceItems.map((item) => {
                // Distance to service is unknowable without an odometer reading.
                const remaining = currentOdometer == null ? null : item.due_odometer - currentOdometer;
                let badgeClass = 'text-brand-green bg-brand-green/10 border-brand-green/20';
                let alertLabel = 'Good';

                if (remaining == null) {
                  badgeClass = 'text-gray-400 bg-white/5 border-white/10';
                  alertLabel = 'Set odometer';
                } else if (remaining < 200) {
                  badgeClass = 'text-brand-red bg-brand-red/10 border-brand-red/20';
                  alertLabel = remaining < 0 ? 'Overdue' : 'Due Soon';
                } else if (remaining <= 500) {
                  badgeClass = 'text-brand-amber bg-brand-amber/10 border-brand-amber/20';
                  alertLabel = 'Upcoming';
                }

                return (
                  <div
                    key={item.id}
                    className="card-premium p-5 border border-white/5 flex flex-col justify-between hover:border-white/10 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-sm font-bold text-white leading-snug">{item.type}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${badgeClass}`}>
                          {alertLabel}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs text-gray-400 mb-4">
                        <div className="flex justify-between">
                          <span>Last Serviced:</span>
                          <span className="text-gray-200 font-medium">{item.last_service_date}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Odometer:</span>
                          <span className="text-gray-200 font-mono">{item.last_service_odometer.toLocaleString()} mi</span>
                        </div>
                        <div className="flex justify-between border-t border-white/5 pt-2">
                          <span className="font-semibold text-gray-300">Due Odometer:</span>
                          <span className="text-white font-mono font-bold">{item.due_odometer.toLocaleString()} mi</span>
                        </div>
                        {item.due_date && (
                          <div className="flex justify-between">
                            <span>Due Date Limit:</span>
                            <span className="text-gray-300 font-medium">{item.due_date}</span>
                          </div>
                        )}
                        {item.notes && (
                          <div className="mt-2 text-[10px] text-gray-500 italic bg-navy-900/50 p-2 rounded">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500">Remaining:</span>
                        {remaining == null ? (
                          <span className="font-mono font-bold text-gray-400">—</span>
                        ) : (
                          <span className={`font-mono font-bold ${remaining < 200 ? 'text-brand-red' : remaining <= 500 ? 'text-brand-amber' : 'text-brand-green'}`}>
                            {remaining < 0 ? `-${Math.abs(remaining).toLocaleString()}` : remaining.toLocaleString()} mi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inline Form */}
          <div className="card-premium p-6 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Sparkles className="w-12 h-12 text-brand-green" />
            </div>
            <h3 className="text-md font-semibold text-white mb-4">Log Completed Service</h3>
            <form onSubmit={handleLogService} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Service Type
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green"
                  required
                >
                  <option value="">Select service type</option>
                  {maintenanceItems.map((item) => (
                    <option key={item.id} value={item.type}>
                      {item.type}
                    </option>
                  ))}
                  <option value="custom">Other (Custom Service)</option>
                </select>
              </div>

              {serviceType === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Custom Service Name
                  </label>
                  <input
                    type="text"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="e.g. Belt Replacement"
                    className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Completed Date
                </label>
                <input
                  type="date"
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Odometer (mi)
                </label>
                <input
                  type="number"
                  value={serviceOdometer}
                  onChange={(e) => setServiceOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 154620"
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Next Due Odometer (mi)
                </label>
                <input
                  type="number"
                  value={dueOdometerVal}
                  onChange={(e) => setDueOdometerVal(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 169620"
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                  placeholder="Specify oil grade, filter brand, or mechanics notes..."
                  rows={2}
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green resize-none"
                />
              </div>

              <div className="md:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isLoggingService}
                  disabled={
                    !serviceType ||
                    (serviceType === 'custom' && !customType) ||
                    !serviceDate ||
                    serviceOdometer === '' ||
                    dueOdometerVal === ''
                  }
                >
                  Log Service
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab CONTENT: Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-brand-green" />
            <h2 className="text-lg font-bold text-white">Required Credentials & Permits</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documents.map((doc) => {
              const details = getDocStatusDetails(doc.expiry_date);

              return (
                <div
                  key={doc.id}
                  className="card-premium p-6 border border-white/5 hover:border-white/10 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                          {doc.type}
                        </span>
                        <h3 className="text-md font-bold text-white mt-1 leading-snug">{doc.title}</h3>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded border ${details.colorClass}`}>
                        {details.icon}
                        {details.label}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs text-gray-400 mb-6 bg-navy-900/40 p-4 rounded-xl border border-white/5">
                      <div className="flex justify-between">
                        <span>Expiration Date:</span>
                        <span className="text-white font-medium">{doc.expiry_date || 'Not set'}</span>
                      </div>
                      {/* Reports what's actually stored. Nothing reviews these
                          documents, so nothing here should claim "Verified". */}
                      <div className="flex justify-between">
                        <span>Scan on file:</span>
                        {doc.document_url ? (
                          <span className="text-brand-green font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">No</span>
                        )}
                      </div>
                      {doc.fileName && (
                        <div className="flex justify-between border-t border-white/5 pt-2">
                          <span>Attached File:</span>
                          <span className="text-gray-300 font-mono truncate max-w-[180px]">{doc.fileName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                      onClick={() => openUploadModal(doc)}
                    >
                      Upload File
                    </Button>
                    {/* Keyed on the stored URL: fileName only exists for a scan
                        uploaded in this session. */}
                    {doc.document_url && (
                      <a
                        href={doc.document_url}
                        download
                        className="flex items-center justify-center px-4 py-2 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab CONTENT: HOS */}
      {/* HOS: TruckDesk has no hours-of-service data, so it shows no clocks
          and makes no compliance claim. The previous version displayed fixed
          numbers and told every driver they were "in compliance". */}
      {activeTab === 'hos' && (
        <div className="card-premium p-6 border border-white/5 flex gap-4 items-start">
          <Clock className="w-5 h-5 text-brand-amber shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-white">Hours of Service isn&apos;t tracked in TruckDesk yet</h4>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Use your ELD for your driving, on-duty and cycle clocks. TruckDesk doesn&apos;t record your
              duty status, so it can&apos;t tell you how many hours you have left or whether you&apos;re within
              the limits.
            </p>
          </div>
        </div>
      )}

      {/* Tab CONTENT: IFTA */}
      {activeTab === 'ifta' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 card-premium p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-green/10 border border-brand-green/20 rounded-xl">
                <Fuel className="w-6 h-6 text-brand-green" />
              </div>
              <div>
                <h3 className="text-md font-bold text-white">IFTA Fuel Tax Summary</h3>
                <span className="text-xs text-gray-400 mt-0.5 block">
                  Eligible purchases grouped by US State
                </span>
              </div>
            </div>

            {/* Quarter Filter & Export */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex p-1 bg-navy-900 rounded-lg border border-white/5">
                {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setSelectedQuarter(q)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                      selectedQuarter === q
                        ? 'bg-brand-green text-[#0A1628] shadow shadow-brand-green/20'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportCSV}
              >
                Export CSV
              </Button>
            </div>
          </div>

          {/* Fuel stops we couldn't attribute to a state */}
          {unattributedFuelCount > 0 && (
            <div className="card-premium border border-brand-amber/30 bg-brand-amber/5 p-4 flex items-start gap-3">
              <Fuel className="w-4 h-4 text-brand-amber shrink-0 mt-0.5" />
              <p className="text-xs text-gray-300 leading-relaxed">
                <span className="font-semibold text-brand-amber">
                  {unattributedFuelCount} fuel {unattributedFuelCount === 1 ? 'stop is' : 'stops are'} missing a state
                </span>{' '}
                and can't be counted toward IFTA. When logging fuel on WhatsApp, include the location —
                e.g. <em>"paid $180 for fuel in Memphis TN"</em> — or send a photo of the receipt.
              </p>
            </div>
          )}

          {/* Grouped Table */}
          <div className="card-premium overflow-hidden border border-white/5">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-navy-800/20">
              <span className="text-sm font-semibold text-white">State Grouped Summary ({selectedQuarter} {iftaYear})</span>
              <span className="text-xs font-mono text-gray-400 bg-navy-900/60 px-2.5 py-1 rounded-md border border-white/5">
                Total states: {groupedIFTAData.length}
              </span>
            </div>

            {groupedIFTAData.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Fuel className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                <p className="text-sm">No IFTA eligible fuel stops recorded in {selectedQuarter} {iftaYear}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-navy-950/40">
                      <th className="py-3.5 px-6">US State</th>
                      <th className="py-3.5 px-6 text-right">Gallons</th>
                      <th className="py-3.5 px-6 text-right">Total Cost</th>
                      <th className="py-3.5 px-6 text-right">Avg Price / Gal</th>
                      <th className="py-3.5 px-6 text-right">Stops</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {groupedIFTAData.map((row) => (
                      <tr key={row.state} className="hover:bg-white/5 transition-colors text-sm">
                        <td className="py-4 px-6 font-bold text-white flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-brand-green" />
                          {row.state}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-gray-200">
                          {row.gallons.toLocaleString()} gal
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-gray-200">
                          ${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-gray-400">
                          {row.gallons > 0 ? `$${(row.amount / row.gallons).toFixed(3)}` : '—'}
                        </td>
                        <td className="py-4 px-6 text-right font-mono text-gray-400">
                          {row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-navy-950/20 font-bold border-t-2 border-white/10 text-sm">
                      <td className="py-4 px-6 text-white">Total</td>
                      <td className="py-4 px-6 text-right font-mono text-white">
                        {groupedIFTAData.reduce((acc, r) => acc + r.gallons, 0).toLocaleString()} gal
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-brand-green">
                        ${groupedIFTAData.reduce((acc, r) => acc + r.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-gray-400">
                        {(() => {
                          const gal = groupedIFTAData.reduce((acc, r) => acc + r.gallons, 0);
                          const amt = groupedIFTAData.reduce((acc, r) => acc + r.amount, 0);
                          return gal > 0 ? `$${(amt / gal).toFixed(3)}` : '—';
                        })()}
                      </td>
                      <td className="py-4 px-6 text-right font-mono text-white">
                        {groupedIFTAData.reduce((acc, r) => acc + r.count, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="card-premium p-6 border border-white/5 flex gap-4 items-start">
            <TrendingUp className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-white">About IFTA Calculations</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                International Fuel Tax Agreement (IFTA) summaries group your diesel fuel purchases by state so you can report them to your base jurisdiction quarterly. Only expenses where <span className="text-brand-green">category = 'fuel'</span> and <span className="text-brand-green">ifta_eligible = true</span> are included in these totals. Ensure you submit receipt photos for all transactions to verify state tax claims.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Update Odometer */}
      {isOdoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 card-premium border border-white/10 shadow-2xl relative">
            <h3 className="text-lg font-semibold text-white mb-4">Update Odometer</h3>
            <p className="text-xs text-gray-400 mb-6">
              Update the current odometer reading of your vehicle. This will recalculate the remaining miles for all scheduled maintenance items.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Current Reading
                </label>
                <div className="text-2xl font-bold font-mono text-gray-400">
                  {currentOdometer == null ? 'Not set' : `${currentOdometer.toLocaleString()} mi`}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  New Odometer (mi)
                </label>
                <input
                  type="number"
                  value={newOdoVal}
                  onChange={(e) => setNewOdoVal(e.target.value)}
                  placeholder="e.g. 155000"
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setIsOdoModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleOdometerSave}
                isLoading={isUpdatingOdo}
                disabled={!newOdoVal || Number(newOdoVal) <= 0}
              >
                Update
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Document Upload */}
      {isUploadOpen && selectedDocForUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 card-premium border border-white/10 shadow-2xl relative">
            <h3 className="text-lg font-semibold text-white mb-4">Update Document: {selectedDocForUpload.type}</h3>
            <p className="text-xs text-gray-400 mb-6">
              Upload a clear scan or photo of your {selectedDocForUpload.type} and specify the new expiration date.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-800 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-brand-green"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Document File (PDF, PNG, JPG)
                </label>
                <div className="border border-dashed border-white/10 hover:border-brand-green/50 rounded-lg p-6 text-center cursor-pointer transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadedFileName(e.target.files[0].name);
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <span className="text-xs text-gray-300 font-medium block">
                    {uploadedFileName || 'Select document file'}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-1">Max size 10MB</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUploadSubmit}
                isLoading={isUploading}
                disabled={!newExpiryDate}
              >
                Save Document
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline custom Icon component to avoid additional imports
function RefreshCwIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 mr-1 animate-spin-hover"
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}
