import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Truck, MessageSquare, Mail, Phone, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { signInWithPhone, signInWithEmail, verifyOtp, user, role } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  // Login method (not a role). The user's role is resolved from their `users`
  // row after sign-in, so both owners and drivers use the same email/phone flow.
  const [activeTab, setActiveTab] = useState<'driver' | 'owner'>('owner');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user && role) {
      if (role === 'owner') navigate('/owner/dashboard');
      else navigate('/driver/home');
    }
  }, [user, role, navigate]);

  const handleRequestAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (activeTab === 'driver') {
        if (!phone) { showError('Please enter your phone number.'); setLoading(false); return; }
        const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;
        const { error } = await signInWithPhone(fullPhone);
        if (error) throw error;
        showSuccess('Verification code sent to your phone!');
        setOtpSent(true);
      } else {
        if (!email) { showError('Please enter your email address.'); setLoading(false); return; }
        const { error } = await signInWithEmail(email);
        if (error) throw error;
        showSuccess('Verification code sent to your email!');
        setOtpSent(true);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to send login request.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) {
      const newOtp = [...otp]; newOtp[index] = ''; setOtp(newOtp); return;
    }
    const newOtp = [...otp];
    newOtp[index] = cleanValue.substring(cleanValue.length - 1);
    setOtp(newOtp);
    if (index < 5 && cleanValue) otpRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const token = otp.join('');
    if (token.length < 6) { showError('Please enter the full 6-digit verification code.'); return; }
    setLoading(true);
    try {
      const identifier = activeTab === 'driver' ? `${countryCode}${phone.replace(/\D/g, '')}` : email;
      const { error } = await verifyOtp(identifier, token);
      if (error) throw error;
      showSuccess('Signed in successfully!');
      // small delay so the session is written before we navigate
      await new Promise((r) => setTimeout(r, 400));
      if (activeTab === 'driver') navigate('/driver/home');
      else navigate('/owner/dashboard');
    } catch (err: any) {
      showError(err.message || 'Invalid verification code.');
    } finally {
      // Always clear the spinner. Previously this only ran on error, so if the
      // post-login redirect bounced back to /login (e.g. the role couldn't be
      // read because RLS blocks `users`), the button hung on "Verifying..."
      // forever with no feedback.
      setLoading(false);
    }
  };

  useEffect(() => {
    if (otp.join('').length === 6) handleVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-navy-900 px-4 select-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-navy-800/40 border border-white/5 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 justify-center mb-2">
            <Truck className="w-8 h-8 text-brand-green" />
            <h1 className="text-3xl font-extrabold tracking-tight font-sans">
              <span className="text-white">Truck</span><span className="text-brand-green">Desk</span>
            </h1>
          </div>
          <p className="text-xs text-gray-400 font-sans tracking-wide">Automated Backoffice for Owner-Operators & Fleets</p>
        </div>

        {!otpSent ? (
          <>
            <div className="grid grid-cols-2 bg-navy-900/60 p-1.5 rounded-2xl border border-white/5 mb-6">
              <button type="button" onClick={() => { setActiveTab('owner'); setPhone(''); }}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'owner' ? 'bg-brand-green text-navy-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
              <button type="button" onClick={() => { setActiveTab('driver'); setEmail(''); }}
                className={`py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'driver' ? 'bg-brand-green text-navy-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                <Phone className="w-3.5 h-3.5" /> Phone (SMS)
              </button>
            </div>

            <form onSubmit={handleRequestAuth} className="space-y-5">
              {activeTab === 'driver' ? (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans mb-2">Mobile Phone Number</label>
                  <div className="flex gap-2">
                    <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl px-2 py-3.5 text-white text-xs sm:text-sm focus:outline-none focus:border-brand-green/60 text-center font-semibold">
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+233">🇬🇭 +233</option>
                      <option value="+234">🇳🇬 +234</option>
                    </select>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl px-4 py-3.5 text-white text-sm font-mono tracking-widest focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                      placeholder="e.g. 281-555-0199" required />
                  </div>
                  <p className="text-[10px] text-brand-amber mt-2 font-sans flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> SMS sign-in isn't enabled yet — use Email for now.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans mb-2">Email Address</label>
                  <div className="relative">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-navy-900 border border-white/5 hover:border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white text-sm focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                      placeholder="you@example.com" required />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2 font-sans flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-brand-green" /> A 6-digit code is emailed to you. Drivers and owners both sign in here.</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full bg-brand-green hover:bg-brand-green/95 text-navy-900 font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>) : activeTab === 'driver' ? 'Send SMS Code' : 'Send Email Code'}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-6">
            <button onClick={() => { setOtpSent(false); setOtp(Array(6).fill('')); setLoading(false); }}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Change Login Details
            </button>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white font-sans">Enter Security Code</h2>
              <p className="text-xs text-gray-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Enter the 6-digit code sent to <span className="text-white font-semibold">{activeTab === 'driver' ? `${countryCode} ${phone}` : email}</span>
              </p>
            </div>
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex justify-between gap-2 max-w-sm mx-auto">
                {otp.map((digit, idx) => (
                  <input key={idx} ref={(el) => (otpRefs.current[idx] = el)}
                    type="text" maxLength={1} value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="w-12 h-14 bg-navy-900 border border-white/5 focus:border-brand-green focus:ring-1 focus:ring-brand-green text-center text-xl font-extrabold rounded-xl text-white font-mono"
                    placeholder="-" disabled={loading} />
                ))}
              </div>
              <button type="submit" disabled={loading || otp.join('').length < 6}
                className="w-full bg-brand-green hover:bg-brand-green/95 text-navy-900 font-bold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>) : 'Verify Security Code'}
              </button>
              <div className="text-center">
                <button type="button" onClick={handleRequestAuth} disabled={loading}
                  className="text-xs text-brand-green hover:underline font-semibold">Resend verification code</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
