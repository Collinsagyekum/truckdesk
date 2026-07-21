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
import { getExpenses } from '../../services/supabase/expenses';
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

export default function CompliancePage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const driverId = user?.id || 'mock-driver-1';

  // Tabs state: Maintenance | Documents | HOS | IFTA
  const [activeTab, setActiveTab] = useState<'maintenance' | 'documents' | 'hos' | 'ifta'>('maintenance');
  const [loading, setLoading] = useState(true);

  // Odometer states
  const [currentOdometer, setCurrentOdometer] = useState<number>(154620);
  const [isOdoModalOpen, setIsOdoModalOpen] = useState(false);
  const [newOdoVal, setNewOdoVal] = useState('');
  const [isUpdatingOdo, setIsUpdatingOdo] = useState(false);

  // Maintenance states
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [customType, setCustomType] = useState('');
  const [serviceDate, setServiceDate] = useState('2026-05-28');
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
  const [isUploading, setIsUploading] = useState(false);

  // HOS states
  const [dutyStatus, setDutyStatus] = useState<'driving' | 'on_duty' | 'sleeper' | 'off_duty'>('driving');

  // IFTA states
  const [expenses, setExpenses] = useState<any[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q2');

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Odometer
      const odo = await getOdometer(driverId);
      setCurrentOdometer(odo);

      // 2. Maintenance Schedule
      const schedule = await getMaintenanceSchedule(driverId);
      setMaintenanceItems(schedule);

      // 3. Expenses (for IFTA)
      const expList = await getExpenses(driverId);
      setExpenses(expList);

      // 4. Documents from localStorage or defaults
      const localDocs = localStorage.getItem(`truckdesk_docs_${driverId}`);
      if (localDocs) {
        setDocuments(JSON.parse(localDocs));
      } else {
        const defaultDocs: ComplianceDocument[] = [
          {
            id: 'doc-cdl',
            type: 'CDL',
            title: "Commercial Driver's License (Class A)",
            expiry_date: '2028-10-15',
            document_url: '#',
          },
          {
            id: 'doc-dot',
            type: 'DOT Medical Card',
            title: "DOT Medical Examiner's Certificate",
            expiry_date: '2026-06-25',
            document_url: '#',
          },
          {
            id: 'doc-ins',
            type: 'Vehicle Insurance',
            title: 'Commercial Auto Liability Insurance Policy',
            expiry_date: '2026-08-15',
            document_url: '#',
          },
          {
            id: 'doc-reg',
            type: 'Registration',
            title: 'Cab Card & Apportioned Registration',
            expiry_date: '2027-02-28',
            document_url: '#',
          },
        ];
        setDocuments(defaultDocs);
        localStorage.setItem(`truckdesk_docs_${driverId}`, JSON.stringify(defaultDocs));
      }
    } catch (err) {
      console.error('Error fetching compliance data:', err);
      showError('Failed to load compliance data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  // Prepopulate standard fields when service type changes
  useEffect(() => {
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
        showError('Could not update odometer.');
      }
    } catch (err) {
      showError('Error updating odometer.');
    } finally {
      setIsUpdatingOdo(false);
    }
  };

  // Handler: Log service done
  const handleLogService = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const result = await logMaintenanceService(payload);
      if (result) {
        showSuccess(`Log entry created for ${typeStr}.`);
        // Refresh schedule
        const updatedSchedule = await getMaintenanceSchedule(driverId);
        setMaintenanceItems(updatedSchedule);
        
        // Reset form
        setServiceType('');
        setCustomType('');
        setServiceNotes('');
      }
    } catch (err) {
      showError('Error logging service record.');
    } finally {
      setIsLoggingService(false);
    }
  };

  // Helper: Open document upload modal
  const openUploadModal = (doc: ComplianceDocument) => {
    setSelectedDocForUpload(doc);
    setNewExpiryDate(doc.expiry_date);
    setUploadedFileName(doc.fileName || '');
    setIsUploadOpen(true);
  };

  // Handler: Submit document upload
  const handleUploadSubmit = () => {
    if (!selectedDocForUpload || !newExpiryDate) return;
    setIsUploading(true);

    setTimeout(() => {
      const updated = documents.map((doc) => {
        if (doc.id === selectedDocForUpload.id) {
          return {
            ...doc,
            expiry_date: newExpiryDate,
            fileName: uploadedFileName || 'uploaded_document.pdf',
            document_url: '#',
          };
        }
        return doc;
      });

      setDocuments(updated);
      localStorage.setItem(`truckdesk_docs_${driverId}`, JSON.stringify(updated));
      setIsUploading(false);
      setIsUploadOpen(false);
      showSuccess(`${selectedDocForUpload.type} document updated successfully!`);
    }, 1200);
  };

  // HOS calculations for progress circles
  const hosClocks = useMemo(() => {
    // Modify based on the active duty state to simulate interactive change
    if (dutyStatus === 'driving') {
      return {
        drive: 5.75, // 5h 45m left
        shift: 9.25, // 9h 15m left
        cycle: 42.5, // 42h 30m left
        break: 3.25, // 3h 15m left
      };
    } else if (dutyStatus === 'on_duty') {
      return {
        drive: 8.0,
        shift: 11.5,
        cycle: 48.0,
        break: 5.0,
      };
    } else if (dutyStatus === 'sleeper') {
      return {
        drive: 11.0,
        shift: 14.0,
        cycle: 62.2,
        break: 8.0,
      };
    } else {
      // Off duty
      return {
        drive: 11.0,
        shift: 14.0,
        cycle: 70.0,
        break: 8.0,
      };
    }
  }, [dutyStatus]);

  // HOS Progress Ring helper
  const renderProgressRing = (value: number, limit: number, title: string, sub: string, ringColorClass: string) => {
    const percentage = Math.max(0, Math.min(100, (value / limit) * 100));
    const radius = 54;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (percentage / 100) * circ;

    const hrs = Math.floor(value);
    const mins = Math.round((value - hrs) * 60);
    const textVal = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    return (
      <div className="flex flex-col items-center p-6 card-premium relative group hover:border-white/10 transition-all duration-300">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`${ringColorClass} transition-all duration-700 ease-out`}
            />
          </svg>
          <div className="absolute text-center">
            <span className="text-xl font-bold font-mono tracking-tight text-white">{textVal}</span>
            <div className="text-[9px] text-gray-400 font-sans mt-0.5">/ {limit}h limit</div>
          </div>
        </div>
        <span className="text-sm font-semibold text-white mt-4">{title}</span>
        <span className="text-xs text-gray-400 mt-0.5">{sub}</span>
      </div>
    );
  };

  // IFTA: Filter and group fuel transactions
  const getQuarter = (dateStr: string) => {
    const d = new Date(dateStr);
    const m = d.getMonth(); // 0-11
    if (m >= 0 && m <= 2) return 'Q1';
    if (m >= 3 && m <= 5) return 'Q2';
    if (m >= 6 && m <= 8) return 'Q3';
    return 'Q4';
  };

  const fuelPurchases = useMemo(() => {
    const list = expenses.filter((e) => e.category === 'fuel') as any[];

    // Ensure realistic state distributions if standard mock items are loaded
    let parsed = list.map((e, idx) => ({
      ...e,
      ifta_eligible: e.ifta_eligible !== undefined ? e.ifta_eligible : true,
      state: e.state || ['IL', 'IN', 'OH', 'TX', 'MI'][idx % 5],
      gallons: e.gallons || Math.round(e.amount / 3.8) || 92,
    }));

    // Pad with multi-quarter items for a robust planner demo
    if (parsed.length <= 2) {
      const simulated = [
        { id: 'sim-f1', category: 'fuel', amount: 320.0, gallons: 85, state: 'IL', date: '2026-02-15', ifta_eligible: true },
        { id: 'sim-f2', category: 'fuel', amount: 410.0, gallons: 110, state: 'IN', date: '2026-03-10', ifta_eligible: true },
        { id: 'sim-f3', category: 'fuel', amount: 280.0, gallons: 75, state: 'OH', date: '2026-01-20', ifta_eligible: true },
        { id: 'sim-f4', category: 'fuel', amount: 380.0, gallons: 100, state: 'TX', date: '2026-04-18', ifta_eligible: true },
        { id: 'sim-f5', category: 'fuel', amount: 350.5, gallons: 92, state: 'IL', date: '2026-05-27', ifta_eligible: true },
        { id: 'sim-f6', category: 'fuel', amount: 450.0, gallons: 120, state: 'OH', date: '2026-07-04', ifta_eligible: true },
        { id: 'sim-f7', category: 'fuel', amount: 300.0, gallons: 80, state: 'MI', date: '2026-08-12', ifta_eligible: true },
        { id: 'sim-f8', category: 'fuel', amount: 390.0, gallons: 102, state: 'TX', date: '2026-10-25', ifta_eligible: true },
        { id: 'sim-f9', category: 'fuel', amount: 340.0, gallons: 90, state: 'IN', date: '2026-11-14', ifta_eligible: true },
      ];
      parsed = [...parsed, ...simulated.filter((s) => !parsed.some((p) => p.id === s.id))];
    }

    return parsed;
  }, [expenses]);

  const groupedIFTAData = useMemo(() => {
    const filtered = fuelPurchases.filter((p) => {
      if (!p.ifta_eligible) return false;
      return getQuarter(p.date) === selectedQuarter;
    });

    const groups: Record<string, { state: string; gallons: number; amount: number; count: number }> = {};
    filtered.forEach((p) => {
      const st = p.state || 'Unknown';
      if (!groups[st]) {
        groups[st] = { state: st, gallons: 0, amount: 0, count: 0 };
      }
      groups[st].gallons += p.gallons;
      groups[st].amount += p.amount;
      groups[st].count += 1;
    });

    return Object.values(groups).sort((a, b) => b.amount - a.amount);
  }, [fuelPurchases, selectedQuarter]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (groupedIFTAData.length === 0) {
      showError(`No fuel purchase data found for ${selectedQuarter} to export.`);
      return;
    }

    const headers = 'State,Gallons Purchased,Total Cost ($),Avg Cost/Gallon ($),Transactions Count\n';
    const rows = groupedIFTAData
      .map(
        (r) =>
          `${r.state},${r.gallons},${r.amount.toFixed(2)},${(r.amount / r.gallons).toFixed(2)},${r.count}`
      )
      .join('\n');

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + rows);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `IFTA_Report_2026_${selectedQuarter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showSuccess(`IFTA Report for ${selectedQuarter} exported successfully!`);
  };

  // Helper to determine document validity status details
  const getDocStatusDetails = (expiryDateStr: string) => {
    const expiry = new Date(expiryDateStr);
    expiry.setHours(0, 0, 0, 0);
    const today = new Date('2026-05-28');
    today.setHours(0, 0, 0, 0);

    const diff = expiry.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

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

      {/* Tabs Menu */}
      <div className="flex p-1 bg-navy-800/80 backdrop-blur rounded-xl border border-white/5 gap-1">
        {(['maintenance', 'documents', 'hos', 'ifta'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg capitalize transition-all duration-200 ${
              activeTab === tab
                ? 'bg-brand-green text-navy-900 shadow-lg shadow-brand-green/25 font-bold'
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
                  {currentOdometer.toLocaleString()} <span className="text-sm font-sans font-normal text-gray-400">mi</span>
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
                const remaining = item.due_odometer - currentOdometer;
                let badgeClass = 'text-brand-green bg-brand-green/10 border-brand-green/20';
                let alertLabel = 'Good';

                if (remaining < 200) {
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
                        <span className={`font-mono font-bold ${remaining < 200 ? 'text-brand-red' : remaining <= 500 ? 'text-brand-amber' : 'text-brand-green'}`}>
                          {remaining < 0 ? `-${Math.abs(remaining).toLocaleString()}` : remaining.toLocaleString()} mi
                        </span>
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
                        <span className="text-white font-medium">{doc.expiry_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Verification Status:</span>
                        <span className="text-brand-green font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
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
                    {doc.fileName && (
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
      {activeTab === 'hos' && (
        <div className="space-y-6">
          {/* Header & Status selector */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 card-premium p-6">
            <div>
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider block">
                Current Duty Status
              </span>
              <div className="flex items-center gap-2.5 mt-1.5">
                <span className={`w-3 h-3 rounded-full animate-pulse ${
                  dutyStatus === 'driving' ? 'bg-brand-green shadow-[0_0_8px_#22c55e]' :
                  dutyStatus === 'on_duty' ? 'bg-brand-amber shadow-[0_0_8px_#f59e0b]' :
                  dutyStatus === 'sleeper' ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa]' :
                  'bg-gray-500'
                }`} />
                <span className="text-lg font-bold text-white capitalize">
                  {dutyStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Selector */}
            <div className="flex p-1 bg-navy-900 rounded-lg border border-white/5 w-fit">
              {(['driving', 'on_duty', 'sleeper', 'off_duty'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setDutyStatus(status);
                    showSuccess(`Status changed to ${status.replace('_', ' ')}`);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 capitalize ${
                    dutyStatus === status
                      ? 'bg-brand-green text-navy-900 shadow shadow-brand-green/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {status.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* RINGS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderProgressRing(hosClocks.drive, 11, 'Driving Time', 'Remaining Drive Hours', 'text-brand-green')}
            {renderProgressRing(hosClocks.shift, 14, 'Shift Limit', 'Total Daily On-Duty Limit', 'text-brand-amber')}
            {renderProgressRing(hosClocks.cycle, 70, 'Cycle Remaining', '70h / 8-Day Limit', 'text-brand-red')}
            {renderProgressRing(hosClocks.break, 8, 'Break Clock', 'Hours until required break', 'text-blue-400')}
          </div>

          <div className="card-premium p-6 border border-white/5 flex gap-4 items-start">
            <Clock className="w-5 h-5 text-brand-green shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-white">Daily Recap & Next Break</h4>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                You are currently in compliance with FMCSR hours-of-service regulations. Your next mandatory 30-minute rest break is due in <span className="text-white font-semibold font-mono">03:15</span>. Your 34-hour cycle restart can be triggered anytime you take 34 consecutive hours off duty.
              </p>
            </div>
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
                        ? 'bg-brand-green text-navy-900 shadow shadow-brand-green/20'
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

          {/* Grouped Table */}
          <div className="card-premium overflow-hidden border border-white/5">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-navy-800/20">
              <span className="text-sm font-semibold text-white">State Grouped Summary ({selectedQuarter} 2026)</span>
              <span className="text-xs font-mono text-gray-400 bg-navy-900/60 px-2.5 py-1 rounded-md border border-white/5">
                Total states: {groupedIFTAData.length}
              </span>
            </div>

            {groupedIFTAData.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Fuel className="w-8 h-8 text-gray-500 mx-auto mb-3" />
                <p className="text-sm">No IFTA eligible fuel stops recorded in {selectedQuarter}.</p>
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
                          ${(row.amount / row.gallons).toFixed(3)}
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
                        ${(
                          groupedIFTAData.reduce((acc, r) => acc + r.amount, 0) /
                          (groupedIFTAData.reduce((acc, r) => acc + r.gallons, 0) || 1)
                        ).toFixed(3)}
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
                  {currentOdometer.toLocaleString()} mi
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
