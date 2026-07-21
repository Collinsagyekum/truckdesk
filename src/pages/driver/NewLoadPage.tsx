import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  User, 
  DollarSign, 
  Calendar, 
  Sparkles, 
  Copy, 
  Check, 
  TrendingUp, 
  Navigation, 
  Loader2, 
  ChevronRight,
  Calculator,
  Truck
} from 'lucide-react';

import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';
import { createLoad, createRateRecord } from '../../services/supabase/loads';
import { calculateFuelCost, calculateRatePerMile, getAIRecommendation } from '../../utils/profit';
import { claudeAPI } from '../../lib/claude';

// Constants
const DIESEL_PRICE = 3.82;
const AVERAGE_RPM = 2.20;

const TRAILER_TYPES = [
  { value: 'dry_van', label: 'Dry Van' },
  { value: 'reefer', label: 'Reefer' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'step_deck', label: 'Step Deck' },
  { value: 'power_only', label: 'Power Only' },
  { value: 'hot_shot', label: 'Hot Shot' },
];

interface FormErrors {
  origin?: string;
  destination?: string;
  brokerName?: string;
  rate?: string;
  miles?: string;
  pickupDate?: string;
  deliveryDate?: string;
}

export default function NewLoadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  // Form states
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [rate, setRate] = useState('');
  const [miles, setMiles] = useState('');
  const [trailerType, setTrailerType] = useState('dry_van');
  const [pickupDate, setPickupDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Negotiation script state
  const [negotiationScript, setNegotiationScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse numeric values
  const rateNum = parseFloat(rate);
  const milesNum = parseFloat(miles);
  const showCalculator = !isNaN(rateNum) && rateNum > 0 && !isNaN(milesNum) && milesNum > 0;

  // Calculate calculations
  const fuelCost = showCalculator ? calculateFuelCost(milesNum, DIESEL_PRICE) : 0;
  const rpm = showCalculator ? calculateRatePerMile(rateNum, milesNum) : 0;
  const recommendation = showCalculator ? getAIRecommendation(rpm, AVERAGE_RPM) : 'pass';
  
  // Custom estimated net profit calculation: Subtracts fuel cost, and incorporates standard mileage maintenance ($0.15/mi)
  const maintenanceCost = showCalculator ? milesNum * 0.15 : 0;
  const netProfit = showCalculator ? rateNum - fuelCost - maintenanceCost : 0;

  // Automatic negotiation script generation when recommendation is 'counter'
  useEffect(() => {
    if (!showCalculator || recommendation !== 'counter') {
      setNegotiationScript('');
      return;
    }

    const trailerLabel = TRAILER_TYPES.find((t) => t.value === trailerType)?.label || trailerType;

    // Debounce the call to prevent generating on every keystroke
    const timer = setTimeout(async () => {
      setIsGeneratingScript(true);
      try {
        const prompt = `Generate a short 2-sentence broker negotiation script to increase this rate of $${rateNum} for a ${milesNum} mile load from ${origin || 'origin'} to ${destination || 'destination'}. Trailer: ${trailerLabel}.`;
        const script = await claudeAPI(prompt);
        setNegotiationScript(script || '');
      } catch (err) {
        console.error('Claude API Error:', err);
        // Fallback negotiation script if API fails or Anthropic key is not configured
        const targetRate = Math.round(milesNum * AVERAGE_RPM * 1.05);
        setNegotiationScript(
          `Hi, regarding the load from ${origin || 'origin'} to ${destination || 'destination'} for $${rateNum}, due to current diesel prices ($${DIESEL_PRICE}/gal) and the specialized ${trailerLabel} trailer requirements, could we negotiate closer to $${targetRate} to make this route profitable for us?`
        );
      } finally {
        setIsGeneratingScript(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [rate, miles, origin, destination, trailerType, recommendation, showCalculator]);

  // Form validation
  const validateForm = (): boolean => {
    const tempErrors: FormErrors = {};
    let isValid = true;

    if (!origin.trim()) {
      tempErrors.origin = 'Origin City/State is required';
      isValid = false;
    }
    if (!destination.trim()) {
      tempErrors.destination = 'Destination City/State is required';
      isValid = false;
    }
    if (!brokerName.trim()) {
      tempErrors.brokerName = 'Broker Name is required';
      isValid = false;
    }
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      tempErrors.rate = 'Please enter a valid rate greater than 0';
      isValid = false;
    }
    if (!miles || isNaN(milesNum) || milesNum <= 0) {
      tempErrors.miles = 'Please enter a valid miles greater than 0';
      isValid = false;
    }
    if (!pickupDate) {
      tempErrors.pickupDate = 'Pickup Date is required';
      isValid = false;
    }
    if (deliveryDate && pickupDate && new Date(deliveryDate) < new Date(pickupDate)) {
      tempErrors.deliveryDate = 'Delivery date cannot be earlier than pickup date';
      isValid = false;
    }

    setErrors(tempErrors);
    return isValid;
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showError('Please check the form for errors');
      return;
    }

    setIsSubmitting(true);
    try {
      const driverId = user?.id || 'mock-driver';
      const selectedTrailerLabel = TRAILER_TYPES.find((t) => t.value === trailerType)?.label || trailerType;

      // 1. Create Load record
      const newLoad = await createLoad({
        driver_id: driverId,
        broker_name: brokerName,
        origin,
        destination,
        rate: rateNum,
        miles: milesNum,
        status: 'upcoming',
        pickup_date: pickupDate,
        delivery_date: deliveryDate || undefined,
        notes: `Trailer Type: ${selectedTrailerLabel}`,
      });

      // 2. Create Rate Record
      await createRateRecord({
        load_id: newLoad.id,
        rate: rateNum,
        miles: milesNum,
        rate_per_mile: rpm,
      });

      showSuccess('Load and Rate records successfully created!');
      navigate('/driver/loads');
    } catch (err: any) {
      console.error('Submission Error:', err);
      showError(err.message || 'Failed to create load. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyScript = () => {
    if (!negotiationScript) return;
    navigator.clipboard.writeText(negotiationScript);
    setCopied(true);
    showSuccess('Negotiation script copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader 
        title="Add New Load" 
        showBack 
        onBack={() => navigate('/driver/loads')} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        {/* Form Container */}
        <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-6">
          <div className="card-premium p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Truck className="w-5 h-5 text-brand-green" />
                Load Details
              </h2>
              <p className="text-sm text-gray-400 mt-1">Enter your route parameters and trailer configuration.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Origin */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Origin City / State
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="e.g. Houston, TX"
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none"
                  />
                </div>
                {errors.origin && <p className="text-xs text-brand-red mt-1">{errors.origin}</p>}
              </div>

              {/* Destination */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Destination City / State
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Dallas, TX"
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none"
                  />
                </div>
                {errors.destination && <p className="text-xs text-brand-red mt-1">{errors.destination}</p>}
              </div>

              {/* Broker Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Broker Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={brokerName}
                    onChange={(e) => setBrokerName(e.target.value)}
                    placeholder="e.g. C.H. Robinson"
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none"
                  />
                </div>
                {errors.brokerName && <p className="text-xs text-brand-red mt-1">{errors.brokerName}</p>}
              </div>

              {/* Trailer Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Trailer Type
                </label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <select
                    value={trailerType}
                    onChange={(e) => setTrailerType(e.target.value)}
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none appearance-none cursor-pointer"
                  >
                    {TRAILER_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-navy-800 text-white">
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </div>
                </div>
              </div>

              {/* Load Rate */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Load Rate ($)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="number"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="e.g. 1500"
                    min="1"
                    step="any"
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none"
                  />
                </div>
                {errors.rate && <p className="text-xs text-brand-red mt-1">{errors.rate}</p>}
              </div>

              {/* Total Miles */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Total Miles
                </label>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="number"
                    value={miles}
                    onChange={(e) => setMiles(e.target.value)}
                    placeholder="e.g. 500"
                    min="1"
                    step="any"
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none"
                  />
                </div>
                {errors.miles && <p className="text-xs text-brand-red mt-1">{errors.miles}</p>}
              </div>

              {/* Pickup Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Pickup Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none [color-scheme:dark]"
                  />
                </div>
                {errors.pickupDate && <p className="text-xs text-brand-red mt-1">{errors.pickupDate}</p>}
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Delivery Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full bg-navy-900/60 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 transition-all duration-200 outline-none [color-scheme:dark]"
                  />
                </div>
                {errors.deliveryDate && <p className="text-xs text-brand-red mt-1">{errors.deliveryDate}</p>}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/5">
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="flex-1"
                leftIcon={<Truck className="w-4 h-4" />}
              >
                Create Load Record
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/driver/loads')}
                disabled={isSubmitting}
                className="sm:w-32"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>

        {/* AI Calculator Column */}
        <div className="lg:col-span-5 space-y-6">
          {showCalculator ? (
            <div className="card-premium p-6 md:p-8 space-y-6 border border-brand-green/20 relative overflow-hidden transition-all duration-300">
              {/* Decorative Glow */}
              <div className="absolute -right-16 -top-16 w-32 h-32 bg-brand-green/10 rounded-full blur-2xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-green animate-pulse" />
                  <h3 className="font-bold text-white tracking-wide text-lg">AI Profit Calculator</h3>
                </div>
                {/* pulsing status */}
                <div className="text-[10px] uppercase font-semibold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded border border-brand-green/20 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-brand-green animate-ping" />
                  Live
                </div>
              </div>

              {/* Recommendation and RPM section */}
              <div className="bg-navy-900/60 rounded-xl p-5 border border-white/5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Rate Per Mile</p>
                    <p className="text-3xl font-extrabold text-white font-mono flex items-baseline">
                      ${rpm.toFixed(2)}
                      <span className="text-xs font-normal text-gray-400 font-sans ml-1">/ mi</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 text-right">Recommendation</p>
                    {recommendation === 'go' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-green/10 text-brand-green border border-brand-green/20 shadow-[0_0_12px_rgba(34,197,94,0.15)] uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-ping" />
                        GO
                      </div>
                    )}
                    {recommendation === 'counter' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-amber/10 text-brand-amber border border-brand-amber/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse" />
                        COUNTER
                      </div>
                    )}
                    {recommendation === 'pass' && (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-red/10 text-brand-red border border-brand-red/20 shadow-[0_0_12px_rgba(239,68,68,0.15)] uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-red" />
                        PASS
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress compared to National Average */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-400">vs. National Avg ($2.20/mi)</span>
                    <span className={rpm >= AVERAGE_RPM ? 'text-brand-green' : 'text-brand-red'}>
                      {rpm >= AVERAGE_RPM ? '+' : ''}{(((rpm - AVERAGE_RPM) / AVERAGE_RPM) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-navy-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        recommendation === 'go' ? 'bg-brand-green' : 
                        recommendation === 'counter' ? 'bg-brand-amber' : 
                        'bg-brand-red'
                      }`}
                      style={{ width: `${Math.min((rpm / 3) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Profit breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Estimated Profit Breakdown</h4>
                
                <div className="space-y-2 text-sm">
                  {/* Gross revenue */}
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-gray-400">Gross Load Rate</span>
                    <span className="font-mono text-white font-medium">+${rateNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Fuel cost */}
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-gray-400 flex items-center gap-1">
                      Fuel Cost Estimate
                      <span className="text-[10px] text-gray-500 font-sans">({milesNum} mi @ 7 mpg * $3.82)</span>
                    </span>
                    <span className="font-mono text-brand-red">-${fuelCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {/* Maintenance cost */}
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-gray-400 flex items-center gap-1">
                      Maintenance Est.
                      <span className="text-[10px] text-gray-500 font-sans">($0.15/mi)</span>
                    </span>
                    <span className="font-mono text-brand-red">-${maintenanceCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {/* Net profit */}
                  <div className="flex justify-between items-center pt-2 text-base font-semibold">
                    <span className="text-white">Est. Net Profit</span>
                    <span className={`font-mono ${netProfit > 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                      ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Claude Script Speech Bubble Box */}
              {recommendation === 'counter' && (
                <div className="relative mt-6 p-5 rounded-xl bg-navy-900/60 border border-white/5 space-y-3">
                  {/* Speech bubble pointer */}
                  <div className="absolute top-[-8px] left-6 w-4 h-4 bg-navy-900/60 border-t border-l border-white/5 rotate-45" />
                  
                  <div className="flex items-center justify-between text-xs text-gray-400 font-semibold tracking-wide">
                    <span className="flex items-center gap-1.5 text-brand-amber uppercase">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Broker negotiation script
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyScript}
                      disabled={isGeneratingScript || !negotiationScript}
                      className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors focus:outline-none disabled:opacity-50"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-brand-green" />
                          <span className="text-brand-green font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Script</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isGeneratingScript ? (
                    <div className="flex items-center gap-2 py-4 justify-center text-xs text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-amber" />
                      <span>Writing negotiation script...</span>
                    </div>
                  ) : negotiationScript ? (
                    <p className="text-sm italic text-gray-200 leading-relaxed font-sans pt-1">
                      "{negotiationScript}"
                    </p>
                  ) : (
                    <div className="text-xs text-gray-500 text-center py-2">
                      Could not load script. Please check your network.
                    </div>
                  )}
                </div>
              )}

              {/* Recommendation message help */}
              <div className="flex gap-2.5 items-start bg-navy-900/40 rounded-lg p-3 text-xs text-gray-400">
                <TrendingUp className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
                <p>
                  {recommendation === 'go' && 'Excellent RPM. This load provides a solid margin above national standards. Highly recommended.'}
                  {recommendation === 'counter' && 'Rate is average. Try to negotiate with the broker using the AI script above to boost your margin.'}
                  {recommendation === 'pass' && 'Low RPM. Ensure this load is part of a route strategy or try to negotiate for a much higher rate.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="card-premium p-6 md:p-8 border border-white/5 flex flex-col items-center justify-center text-center min-h-[320px] text-gray-400 space-y-4">
              <div className="p-3 bg-navy-900 rounded-full border border-white/5 text-gray-500">
                <Calculator className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base">AI Profit Calculator</h4>
                <p className="text-xs text-gray-400 max-w-[280px] mx-auto mt-2 leading-relaxed">
                  Enter both <span className="text-brand-green font-medium">Load Rate</span> and <span className="text-brand-green font-medium">Total Miles</span> to see dynamic fuel cost calculations, RPM recommendation badges, and negotiate scripts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
