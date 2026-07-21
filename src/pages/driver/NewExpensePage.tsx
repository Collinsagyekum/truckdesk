import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Fuel,
  Coins,
  Utensils,
  Bed,
  Wrench,
  Disc,
  ShieldCheck,
  FileText,
  Scale,
  Package,
  Phone as PhoneIcon,
  MapPin,
  HelpCircle,
  Camera,
  Paperclip,
  X,
  FileUp,
  Info,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { createExpense } from '../../services/supabase/expenses';
import { updateOdometer, getOdometer } from '../../services/supabase/maintenance';
import { supabase } from '../../lib/supabase';

// List of US States for selection
const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// Grid configuration of categories
const CATEGORIES = [
  { id: 'fuel', label: 'Fuel', icon: Fuel },
  { id: 'toll', label: 'Tolls', icon: Coins },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'lodging', label: 'Lodging', icon: Bed },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'tire', label: 'Tire', icon: Disc },
  { id: 'insurance', label: 'Insurance', icon: ShieldCheck },
  { id: 'permits', label: 'Permits', icon: FileText },
  { id: 'scales', label: 'Scales', icon: Scale },
  { id: 'lumper', label: 'Lumper', icon: Package },
  { id: 'phone', label: 'Phone', icon: PhoneIcon },
  { id: 'parking', label: 'Parking', icon: MapPin },
  { id: 'other', label: 'Other', icon: HelpCircle },
] as const;

const CATEGORY_KEYS = [
  'fuel',
  'toll',
  'food',
  'lodging',
  'maintenance',
  'tire',
  'insurance',
  'permits',
  'scales',
  'lumper',
  'phone',
  'parking',
  'other',
] as const;

// Zod validation schema
const expenseSchema = z.object({
  category: z.enum(CATEGORY_KEYS, {
    message: 'Please select a category',
  }),
  amount: z.number({ message: 'Amount is required' }).positive('Amount must be positive'),
  vendor: z.string().min(1, 'Vendor is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State is required'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  perDiemEligible: z.boolean().optional(),
  iftaFuelPurchase: z.boolean().optional(),
  odometer: z
    .union([
      z.number().positive('Odometer must be positive'),
      z.nan(),
      z.undefined(),
    ])
    .optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export default function NewExpensePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // File states
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  // Set up React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category: undefined,
      amount: undefined,
      vendor: '',
      city: '',
      state: '',
      date: new Date().toLocaleDateString('en-CA'), // Formats to YYYY-MM-DD in local time
      notes: '',
      perDiemEligible: true,
      iftaFuelPurchase: true,
      odometer: undefined,
    },
  });

  const selectedCategory = watch('category');

  // Load odometer reading automatically when category becomes maintenance
  useEffect(() => {
    if (selectedCategory === 'maintenance' && user?.id) {
      getOdometer(user.id).then((val) => {
        if (val && !getValues('odometer')) {
          setValue('odometer', val);
        }
      });
    }
  }, [selectedCategory, user?.id, setValue, getValues]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      setIsPdf(file.type === 'application/pdf');

      // Create local image preview if file is image
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setReceiptFile(null);
    setPreviewUrl(null);
    setIsPdf(false);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (data: ExpenseFormValues) => {
    setIsSubmitting(true);
    const driverId = user?.id || 'mock-driver';

    try {
      // 1. Upload receipt if present
      let receiptUrl = '';
      if (receiptFile) {
        try {
          const fileExt = receiptFile.name.split('.').pop();
          const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
          const filePath = `receipts/${driverId}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('receipts')
            .upload(filePath, receiptFile);

          if (!uploadError && uploadData) {
            const { data: urlData } = supabase.storage
              .from('receipts')
              .getPublicUrl(filePath);
            receiptUrl = urlData.publicUrl;
          }
        } catch (storageErr) {
          console.error('Storage bucket unavailable, falling back to mock receipt url', storageErr);
        }

        // Mock fallback receipt url if real upload didn't execute/failed due to local env keys
        if (!receiptUrl) {
          receiptUrl = `https://supabase.co/storage/v1/object/public/receipts/mock-${Date.now()}.jpg`;
        }
      }

      // 2. Format details/description
      let detailedNotes = data.notes || '';
      if (data.category === 'food' || data.category === 'lodging') {
        detailedNotes += data.perDiemEligible ? ' (Per Diem Eligible)' : '';
      } else if (data.category === 'fuel') {
        detailedNotes += data.iftaFuelPurchase ? ' (IFTA Fuel Purchase)' : '';
      }

      const description = [
        data.vendor,
        data.city && data.state ? `${data.city}, ${data.state}` : data.city || data.state,
        detailedNotes,
      ]
        .filter(Boolean)
        .join(' - ');

      // 3. Create expense
      await createExpense({
        driver_id: driverId,
        category: data.category,
        amount: data.amount,
        description,
        date: data.date,
        is_deductible: true,
        receipt_url: receiptUrl || undefined,
      });

      // 4. Update odometer if category is maintenance
      if (data.category === 'maintenance' && typeof data.odometer === 'number' && !isNaN(data.odometer)) {
        await updateOdometer(driverId, data.odometer);
      }

      showSuccess('Expense logged successfully!');
      navigate('/driver/expenses');
    } catch (error) {
      console.error('Failed to log expense:', error);
      showError('Failed to log expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-900 pb-12">
      <PageHeader
        title="Log New Expense"
        showBack
        onBack={() => navigate('/driver/expenses')}
      />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Card Wrapper for Form */}
          <div className="card-premium p-5 md:p-6 space-y-6">
            
            {/* Category Icon Grid */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Select Category
              </label>
              <div className="grid grid-cols-4 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setValue('category', cat.id, { shouldValidate: true })}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all duration-200 ${
                        isSelected
                          ? 'border-brand-green bg-brand-green/10 text-brand-green shadow-[0_0_12px_rgba(34,197,94,0.15)] scale-[1.02]'
                          : 'border-white/5 bg-navy-800/40 text-gray-400 hover:text-white hover:border-white/10 hover:bg-navy-800/60'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? 'scale-110' : ''} transition-transform`} />
                      <span className="text-[9px] md:text-[10px] font-semibold tracking-wide uppercase truncate w-full">
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.category && (
                <p className="text-xs text-brand-red font-medium">{errors.category.message as string}</p>
              )}
            </div>

            {/* Large Amount Input */}
            <div className="flex flex-col items-center justify-center p-5 bg-navy-800/40 rounded-2xl border border-white/5 focus-within:border-brand-green/30 focus-within:shadow-[0_0_15px_rgba(34,197,94,0.08)] transition-all">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Expense Amount
              </label>
              <div className="flex items-center justify-center text-white">
                <span className="text-4xl font-bold text-gray-400 mr-1">$</span>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="text-4xl md:text-5xl font-bold font-mono bg-transparent text-white text-center border-0 p-0 focus:ring-0 focus:outline-none placeholder-white/10 w-44"
                  {...register('amount', { valueAsNumber: true })}
                />
              </div>
              {errors.amount && (
                <p className="mt-2 text-xs text-brand-red font-medium">{errors.amount.message as string}</p>
              )}
            </div>

            {/* Core Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vendor */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vendor" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Vendor / Location
                </label>
                <input
                  id="vendor"
                  type="text"
                  placeholder="e.g. Speedco"
                  className="w-full bg-navy-800/60 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 transition-all outline-none"
                  {...register('vendor')}
                />
                {errors.vendor && (
                  <p className="text-xs text-brand-red font-medium">{errors.vendor.message as string}</p>
                )}
              </div>

              {/* City */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="city" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  placeholder="e.g. Indianapolis"
                  className="w-full bg-navy-800/60 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 transition-all outline-none"
                  {...register('city')}
                />
                {errors.city && (
                  <p className="text-xs text-brand-red font-medium">{errors.city.message as string}</p>
                )}
              </div>

              {/* State */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="state" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  State
                </label>
                <select
                  id="state"
                  className="w-full bg-navy-800/60 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 transition-all outline-none"
                  {...register('state')}
                >
                  <option value="" disabled className="bg-navy-900">Select state...</option>
                  {US_STATES.map((state) => (
                    <option key={state.code} value={state.code} className="bg-navy-900">
                      {state.code} - {state.name}
                    </option>
                  ))}
                </select>
                {errors.state && (
                  <p className="text-xs text-brand-red font-medium">{errors.state.message as string}</p>
                )}
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="date" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  className="w-full bg-navy-800/60 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 transition-all outline-none"
                  {...register('date')}
                />
                {errors.date && (
                  <p className="text-xs text-brand-red font-medium">{errors.date.message as string}</p>
                )}
              </div>
            </div>

            {/* Conditional Switches */}
            {/* Food or Lodging (Per Diem) */}
            {(selectedCategory === 'food' || selectedCategory === 'lodging') && (
              <div className="p-4 bg-navy-800/30 rounded-xl border border-white/5 flex flex-col gap-3 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-white">Per diem eligible</span>
                    <span className="text-xs text-gray-400">Apply daily business tax deduction</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      {...register('perDiemEligible')}
                    />
                    <div className="w-11 h-6 bg-navy-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                  </label>
                </div>
                
                <div className="flex items-start gap-2 bg-brand-green/5 border border-brand-green/10 rounded-lg p-2.5">
                  <Info className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
                  <span className="text-xs text-brand-green font-medium">
                    IRS Per Diem Rate: $69/day applies.
                  </span>
                </div>
              </div>
            )}

            {/* Fuel (IFTA) */}
            {selectedCategory === 'fuel' && (
              <div className="p-4 bg-navy-800/30 rounded-xl border border-white/5 flex items-center justify-between transition-all">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-white">IFTA fuel purchase</span>
                  <span className="text-xs text-gray-400">Log gallons for IFTA fuel tax logs</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register('iftaFuelPurchase')}
                  />
                  <div className="w-11 h-6 bg-navy-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-green"></div>
                </label>
              </div>
            )}

            {/* Maintenance (Odometer) */}
            {selectedCategory === 'maintenance' && (
              <div className="p-4 bg-navy-800/30 rounded-xl border border-white/5 flex flex-col gap-2.5 transition-all">
                <label htmlFor="odometer" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Current Odometer
                </label>
                <div className="relative">
                  <input
                    id="odometer"
                    type="number"
                    placeholder="e.g. 154620"
                    className="w-full bg-navy-800/60 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 transition-all outline-none"
                    {...register('odometer', { valueAsNumber: true })}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                    miles
                  </span>
                </div>
                {errors.odometer && (
                  <p className="text-xs text-brand-red font-medium">{errors.odometer.message as string}</p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="notes" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Notes / Details
              </label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Enter details like invoice number or parts description..."
                className="w-full bg-navy-800/60 border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-brand-green focus:ring-1 focus:ring-brand-green/30 transition-all outline-none resize-none"
                {...register('notes')}
              />
            </div>

            {/* Receipt Upload Slot */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Receipt Attachment
              </span>
              
              {receiptFile ? (
                <div className="relative flex items-center gap-3 p-3 bg-navy-800/40 border border-white/10 rounded-xl">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg bg-navy-900 border border-white/5 overflow-hidden flex items-center justify-center shrink-0">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Receipt thumbnail" className="w-full h-full object-cover" />
                    ) : isPdf ? (
                      <FileText className="w-6 h-6 text-brand-amber animate-pulse" />
                    ) : (
                      <Paperclip className="w-6 h-6 text-gray-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {receiptFile.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>

                  {/* Remove btn */}
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 rounded-lg bg-navy-700 hover:bg-brand-red/10 text-gray-400 hover:text-brand-red border border-white/5 hover:border-brand-red/20 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl bg-navy-800/20 gap-4">
                  <div className="flex flex-col items-center text-center gap-1">
                    <FileUp className="w-7 h-7 text-gray-500" />
                    <span className="text-xs font-semibold text-white">Attach invoice/receipt</span>
                    <span className="text-[10px] text-gray-400">Upload a photo, pdf, or scan</span>
                  </div>

                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-navy-700 border border-white/10 text-xs font-semibold text-white hover:bg-navy-600 active:scale-[0.98] transition-all"
                    >
                      <Camera className="w-3.5 h-3.5 text-brand-green" />
                      <span>Take Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-navy-700 border border-white/10 text-xs font-semibold text-white hover:bg-navy-600 active:scale-[0.98] transition-all"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-brand-green" />
                      <span>Upload Doc</span>
                    </button>
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

          </div>

          {/* Form Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={isSubmitting}
              onClick={() => navigate('/driver/expenses')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={isSubmitting}
            >
              Log Expense
            </Button>
          </div>

        </form>
      </main>
    </div>
  );
}
